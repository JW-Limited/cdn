interface Env {
	ASSETS: {
		fetch: (request: Request) => Promise<Response>;
	};
	MTS_STV0_WORKER: {
		fetch: (request: Request) => Promise<Response>;
	};
	SMPWEB_2X_AUTH_WORKER: {
		fetch: (request: Request) => Promise<Response>;
	};

	CDN_CACHE: KVNamespace;
	CDN_METADATA: KVNamespace;
	FILE_VERSIONS: KVNamespace;
	FILE_CONTENT: KVNamespace;
	ASSETS_DB: D1Database;
}

interface FileVersion {
	version: number;
	timestamp: number;
	author: string;
	authorId: string;
	changeType: 'metadata' | 'content' | 'both';
	changes: {
		metadata?: any;
		contentSize?: number;
		contentHash?: string;
	};
	storage: {
		contentBytes: number;
		metadataBytes: number;
	};
}

interface FileMetadata {
	id: string;
	name: string;
	originalName: string;
	path: string;
	mimeType: string;
	size: number;
	owner: string;
	ownerId: string;
	created: number;
	modified: number;
	version: number;
	isPublic: boolean;
	tags: string[];
	description?: string;
	customFields?: Record<string, any>;
}

const MIME_TYPES: Record<string, string> = {
	// Images
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.avif': 'image/avif',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',

	// Fonts
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.eot': 'application/vnd.ms-fontobject',
	'.otf': 'font/otf',

	// Stylesheets and Scripts
	'.css': 'text/css',
	'.js': 'application/javascript',
	'.mjs': 'application/javascript',
	'.json': 'application/json',
	'.xml': 'application/xml',

	// Documents
	'.html': 'text/html',
	'.htm': 'text/html',
	'.txt': 'text/plain',
	'.pdf': 'application/pdf',

	// Audio/Video
	'.mp3': 'audio/mpeg',
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.ogg': 'audio/ogg',

	// Archives
	'.zip': 'application/zip',
	'.gz': 'application/gzip',
};

// Cache TTL configurations (in seconds)
const CACHE_TTL = {
	STATIC_ASSETS: 31536000, // 1 year for static assets
	IMAGES: 2592000,         // 30 days for images
	FONTS: 31536000,         // 1 year for fonts
	STYLESHEETS: 86400,      // 1 day for CSS
	SCRIPTS: 86400,          // 1 day for JS
	DOCUMENTS: 3600,         // 1 hour for HTML/documents
	DEFAULT: 3600            // 1 hour default
};

class CDNService {
	private env: Env;

	constructor(env: Env) {
		this.env = env;
	}

		/**
	 * Main request handler for the CDN
	 */
	async handleRequest(request: Request): Promise<Response> {
		try {
			const url = new URL(request.url);
			const pathname = url.pathname;

			// Handle special API endpoints
			if (pathname.startsWith('/api/')) {
				return this.handleAPIRequest(request, pathname);
			}

			// Handle worker proxy requests with advanced URI scheme
			if (pathname.startsWith('/worker/') || pathname.startsWith('/proxy/')) {
				return await this.handleWorkerProxyRequest(request, pathname);
			}

						// Handle remote worker RPC calls
			if (pathname.startsWith('/rpc/')) {
				return await this.handleRPCRequest(request, pathname);
			}

			// Handle external resource fetching (CORS proxy)
			if (pathname.startsWith('/fetch/') || pathname.startsWith('/proxy-external/')) {
				return await this.handleExternalFetch(request, pathname);
			}

			// Handle Chrome DevTools well-known path
			if (pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
				return this.handleChromeDevTools();
			}

			// Handle icon.png redirect
			if (pathname === '/icon.png' || pathname === '/favicon.ico') {
				return this.handleIconRedirect(request);
			}

			// Handle uploaded asset requests (check obfuscated paths first)
			const isObfuscatedAsset = await this.isObfuscatedAssetPath(pathname);
			if (isObfuscatedAsset || pathname.startsWith('/prod/') || pathname.includes('/object/live.m3u8') || pathname.startsWith('/assets/uploads/') || pathname.startsWith('/assets/custom/')) {
				return await this.handleUploadedAssetRequest(request, pathname);
			}

			// Handle static asset requests (fallback to ASSETS binding)
			return await this.handleAssetRequest(request, pathname);

		} catch (error) {
			console.error('CDN Error:', error);
			return this.createErrorResponse(500, 'Internal Server Error');
		}
	}

	/**
	 * Handle worker proxy requests with advanced URI scheme
	 * Supports: /worker/{worker-name}/{path} and /proxy/{worker-name}/{path}
	 */
	private async handleWorkerProxyRequest(request: Request, pathname: string): Promise<Response> {
		const pathParts = pathname.split('/').filter(part => part.length > 0);

		if (pathParts.length < 2) {
			return this.createErrorResponse(400, 'Invalid proxy path. Use /worker/{worker-name}/{path}');
		}

		const workerName = pathParts[1];
		const workerPath = '/' + pathParts.slice(2).join('/');

		// Map worker names to bindings
		const workerBindings: Record<string, keyof Env> = {
			'mts-stv0': 'MTS_STV0_WORKER',
			'emailworker': 'MTS_STV0_WORKER', // alias
			'smpweb-2x-auth': 'SMPWEB_2X_AUTH_WORKER',
			'authworker': 'SMPWEB_2X_AUTH_WORKER', // alias
			'auth': 'SMPWEB_2X_AUTH_WORKER', // short alias
			'serix': 'SMPWEB_2X_AUTH_WORKER', // short alias
		};

		const bindingName = workerBindings[workerName];
		if (!bindingName) {
			return this.createErrorResponse(404, `Worker '${workerName}' not found or not configured`);
		}

		const workerBinding = this.env[bindingName] as { fetch: (request: Request) => Promise<Response> };
		if (!workerBinding) {
			return this.createErrorResponse(500, `Worker binding '${bindingName}' not available`);
		}

				try {
			// Multi-layer caching strategy: KV -> Cache API -> Origin
			const cacheKeyString = `worker:${workerName}:${workerPath}:${this.hashRequest(request)}`;
			const cache = caches.default;

			// Layer 1: Try KV cache first (persistent across deployments)
			if (request.method === 'GET') {
				const kvCachedData = await this.getFromKVCache(cacheKeyString);
				if (kvCachedData) {
					const response = this.deserializeKVResponse(kvCachedData);
					response.headers.set('X-Cache-Status', 'KV-HIT');
					response.headers.set('X-Cache-Layer', 'KV');
					response.headers.set('X-Proxy-Worker', workerName);
					return response;
				}

				// Layer 2: Try Cache API (faster access, but ephemeral)
				const cacheKey = new Request(`${request.url}-worker-proxy`, {
					method: request.method,
					headers: request.headers
				});

				const cachedResponse = await cache.match(cacheKey);
				if (cachedResponse) {
					const newResponse = new Response(cachedResponse.body, cachedResponse);
					newResponse.headers.set('X-Cache-Status', 'CACHE-HIT');
					newResponse.headers.set('X-Cache-Layer', 'EdgeCache');
					newResponse.headers.set('X-Proxy-Worker', workerName);

					// Store in KV for future requests (async, don't block response)
					this.storeInKVCache(cacheKeyString, newResponse.clone(), workerPath).catch(console.error);

					return newResponse;
				}
			}

			// Create new request for the target worker
			const workerUrl = new URL(request.url);
			workerUrl.pathname = workerPath;
			workerUrl.search = new URL(request.url).search; // preserve query params

			const workerRequest = new Request(workerUrl.toString(), {
				method: request.method,
				headers: request.headers,
				body: request.body
			});

			// Forward request to target worker
			const workerResponse = await workerBinding.fetch(workerRequest);

			if (!workerResponse.ok) {
				return new Response(workerResponse.body, {
					status: workerResponse.status,
					headers: workerResponse.headers
				});
			}

			// Optimize the response with CDN features
			const optimizedResponse = await this.optimizeWorkerResponse(
				workerResponse,
				workerName,
				workerPath,
				request
			);

						// Cache successful GET responses in both layers
			if (request.method === 'GET' && optimizedResponse.status === 200) {
				const cacheTTL = this.getWorkerCacheTTL(workerPath);
				optimizedResponse.headers.set('Cache-Control', `public, max-age=${cacheTTL}`);
				optimizedResponse.headers.set('X-Cache-Status', 'MISS');
				optimizedResponse.headers.set('X-Cache-Layer', 'Origin');
				optimizedResponse.headers.set('X-Proxy-Worker', workerName);

				// Create cache key for Cache API
				const cacheKey = new Request(`${request.url}-worker-proxy`, {
					method: request.method,
					headers: request.headers
				});

				// Store in both cache layers (don't await to avoid blocking)
				cache.put(cacheKey, optimizedResponse.clone()).catch(console.error);
				this.storeInKVCache(cacheKeyString, optimizedResponse.clone(), workerPath).catch(console.error);
			}

			return optimizedResponse;

		} catch (error) {
			console.error(`Worker proxy error for ${workerName}:`, error);
			return this.createErrorResponse(500, `Failed to proxy request to worker '${workerName}'`);
		}
	}

	/**
	 * Handle RPC-style requests to workers
	 * Supports: /rpc/{worker-name}/{method}
	 */
	private async handleRPCRequest(request: Request, pathname: string): Promise<Response> {
		const pathParts = pathname.split('/').filter(part => part.length > 0);

		if (pathParts.length < 3) {
			return this.createErrorResponse(400, 'Invalid RPC path. Use /rpc/{worker-name}/{method}');
		}

		const workerName = pathParts[1];
		const method = pathParts[2];
		const params = pathParts.slice(3);

		// Map worker names to bindings
		const workerBindings: Record<string, keyof Env> = {
			'mts-stv0': 'MTS_STV0_WORKER',
			'emailworker': 'MTS_STV0_WORKER', // alias
			'smpweb-2x-auth': 'SMPWEB_2X_AUTH_WORKER',
			'authworker': 'SMPWEB_2X_AUTH_WORKER', // alias
			'auth': 'SMPWEB_2X_AUTH_WORKER', // short alias
		};

		const bindingName = workerBindings[workerName];
		if (!bindingName) {
			return this.createErrorResponse(404, `Worker '${workerName}' not found or not configured`);
		}

		const workerBinding = this.env[bindingName] as { fetch: (request: Request) => Promise<Response> };
		if (!workerBinding) {
			return this.createErrorResponse(500, `Worker binding '${bindingName}' not available`);
		}

		try {
			// Create RPC-style request
			const rpcPath = `/rpc/${method}${params.length > 0 ? '/' + params.join('/') : ''}`;
			const rpcUrl = new URL(request.url);
			rpcUrl.pathname = rpcPath;

			const rpcRequest = new Request(rpcUrl.toString(), {
				method: request.method,
				headers: {
					...Object.fromEntries(request.headers.entries()),
					'X-RPC-Call': 'true',
					'X-RPC-Method': method,
					'X-RPC-Worker': workerName
				},
				body: request.body
			});

			const response = await workerBinding.fetch(rpcRequest);

			// Add RPC headers
			const rpcResponse = new Response(response.body, {
				status: response.status,
				headers: response.headers
			});

			rpcResponse.headers.set('X-RPC-Worker', workerName);
			rpcResponse.headers.set('X-RPC-Method', method);

			// Add CORS headers
			const corsHeaders = this.getCORSHeaders();
			Object.entries(corsHeaders).forEach(([key, value]) => {
				rpcResponse.headers.set(key, value);
			});

			return rpcResponse;

		} catch (error) {
			console.error(`RPC error for ${workerName}.${method}:`, error);
			return this.createErrorResponse(500, `RPC call failed: ${workerName}.${method}`);
		}
	}

	/**
	 * Handle API requests including authentication
	 */
	private async handleAPIRequest(request: Request, pathname: string): Promise<Response> {
		const url = new URL(request.url);

		// Authentication endpoints
		if (pathname.startsWith('/api/auth/')) {
			return this.handleAuthRequest(request, pathname);
		}

		// Search endpoint
		if (pathname === '/api/search') {
			return this.handleSearchRequest(request);
		}

		// Assets listing endpoint
		if (pathname === '/api/assets') {
			return this.handleAssetsListRequest(request);
		}

		// Index rebuild endpoint (requires authentication)
		if (pathname === '/api/index') {
			return this.handleIndexRequest(request);
		}

		// Upload endpoint (requires authentication)
		if (pathname.startsWith('/api/upload')) {
			return this.handleUploadRequest(request, pathname);
		}

		// File management endpoints (requires authentication)
		if (pathname.startsWith('/api/files/')) {
			return this.handleFileRequest(request, pathname);
		}

		// User management endpoints
		if (pathname.startsWith('/api/user/')) {
			return this.handleUserRequest(request, pathname);
		}

		// File editor endpoints (requires authentication)
		if (pathname.startsWith('/api/file-editor/')) {
			return this.handleFileEditorRequest(request, pathname);
		}

		// Version control endpoints (requires authentication)
		if (pathname.startsWith('/api/versions/')) {
			return this.handleVersionsRequest(request, pathname);
		}

		// Health check
		if (pathname === '/api/health') {
			return new Response(JSON.stringify({
				status: 'healthy',
				timestamp: new Date().toISOString(),
				version: '2.0.0'
			}), {
				headers: {
					'Content-Type': 'application/json',
					...this.getCORSHeaders()
				}
			});
		}

		return this.createErrorResponse(404, 'API endpoint not found');
	}

	/**
	 * Handle authentication requests via SXAP worker
	 */
	private async handleAuthRequest(request: Request, pathname: string): Promise<Response> {
		try {
			const authPath = pathname.replace('/api/auth', '');

			// Forward authentication requests to SMPWEB_2X_AUTH_WORKER
			const authRequest = new Request(`https://smpweb-2x-auth.kidjjoe.workers.dev${authPath}`, {
				method: request.method,
				headers: request.headers,
				body: request.body
			});

			const authResponse = await this.env.SMPWEB_2X_AUTH_WORKER.fetch(authRequest);
			const responseData = await authResponse.json();

			// Add CORS headers to auth responses
			const headers = new Headers();
			Object.entries(this.getCORSHeaders()).forEach(([key, value]) => {
				headers.set(key, value);
			});
			headers.set('Content-Type', 'application/json');

			return new Response(JSON.stringify(responseData), {
				status: authResponse.status,
				headers
			});

		} catch (error) {
			console.error('Auth request error:', error);
			return this.createErrorResponse(500, 'Authentication service unavailable');
		}
	}

	/**
	 * Handle file management requests
	 */
	private async handleFileRequest(request: Request, pathname: string): Promise<Response> {
		try {
			// Verify authentication first
			const authResult = await this.verifyUserAuthentication(request);
			if (!authResult.success) {
				return this.createErrorResponse(401, 'Authentication required');
			}

			const fileId = pathname.split('/api/files/')[1];
			if (!fileId) {
				return this.createErrorResponse(400, 'File ID required');
			}

			if (request.method === 'GET') {
				return this.getFileInfo(fileId, authResult.user);
			}

			if (request.method === 'DELETE') {
				return this.deleteFile(fileId, authResult.user);
			}

			if (request.method === 'PUT') {
				return this.updateFileInfo(fileId, authResult.user, request);
			}

			return this.createErrorResponse(405, 'Method not allowed');

		} catch (error) {
			console.error('File request error:', error);
			return this.createErrorResponse(500, 'File service error');
		}
	}

	/**
	 * Handle user management requests
	 */
	private async handleUserRequest(request: Request, pathname: string): Promise<Response> {
		try {
			// Verify authentication first
			const authResult = await this.verifyUserAuthentication(request);
			if (!authResult.success) {
				return this.createErrorResponse(401, 'Authentication required');
			}

			const userPath = pathname.replace('/api/user', '');

			if (userPath === '/profile' && request.method === 'GET') {
				return this.getUserProfile(authResult.user);
			}

			if (userPath === '/uploads' && request.method === 'GET') {
				return this.getUserUploads(authResult.user, request);
			}

			if (userPath === '/quota' && request.method === 'GET') {
				return this.getUserQuota(authResult.user);
			}

			if (userPath === '/stats' && request.method === 'GET') {
				return this.getUserStats(authResult.user);
			}

			return this.createErrorResponse(404, 'User endpoint not found');

		} catch (error) {
			console.error('User request error:', error);
			return this.createErrorResponse(500, 'User service error');
		}
	}

	/**
	 * Handle file editor requests - separate endpoints for metadata and content
	 */
	private async handleFileEditorRequest(request: Request, pathname: string): Promise<Response> {
		try {
			// Verify authentication first
			const authResult = await this.verifyUserAuthentication(request);
			if (!authResult.success) {
				return this.createErrorResponse(401, 'Authentication required');
			}

			const pathParts = pathname.split('/').filter(part => part.length > 0);
			// Expected: /api/file-editor/{fileId}/{action}

			if (pathParts.length < 3) {
				return this.createErrorResponse(400, 'Invalid file editor endpoint. Use /api/file-editor/{fileId}/{action}');
			}

			const fileId = pathParts[2];
			const action = pathParts[3];

			// Verify file ownership
			const fileMetadata = await this.getFileMetadata(fileId);
			if (!fileMetadata) {
				return this.createErrorResponse(404, 'File not found');
			}

			if (fileMetadata.ownerId !== authResult.user.id) {
				return this.createErrorResponse(403, 'Access denied. You can only edit your own files.');
			}

			switch (action) {
				case 'metadata':
					if (request.method === 'PUT') {
						return this.updateFileMetadata(fileId, authResult.user, request);
					}
					break;
				case 'content':
					if (request.method === 'PUT') {
						return this.updateFileContent(fileId, authResult.user, request);
					}
					break;
				case 'info':
					if (request.method === 'GET') {
						return this.getFileWithVersions(fileId, authResult.user);
					}
					break;
			default:
					return this.createErrorResponse(400, 'Invalid action. Use: metadata, content, or info');
			}

			return this.createErrorResponse(405, 'Method not allowed');

		} catch (error) {
			console.error('File editor error:', error);
			return this.createErrorResponse(500, 'File editor service error');
		}
	}

	/**
	 * Handle version control requests
	 */
	private async handleVersionsRequest(request: Request, pathname: string): Promise<Response> {
		try {
			// Verify authentication first
			const authResult = await this.verifyUserAuthentication(request);
			if (!authResult.success) {
				return this.createErrorResponse(401, 'Authentication required');
			}

			const pathParts = pathname.split('/').filter(part => part.length > 0);
			// Expected: /api/versions/{fileId} or /api/versions/{fileId}/{version}

			if (pathParts.length < 3) {
				return this.createErrorResponse(400, 'Invalid versions endpoint. Use /api/versions/{fileId}');
			}

			const fileId = pathParts[2];
			const version = pathParts[3] ? parseInt(pathParts[3]) : null;

			// Verify file ownership
			const fileMetadata = await this.getFileMetadata(fileId);
			if (!fileMetadata) {
				return this.createErrorResponse(404, 'File not found');
			}

			if (fileMetadata.ownerId !== authResult.user.id) {
				return this.createErrorResponse(403, 'Access denied. You can only access versions of your own files.');
			}

			if (request.method === 'GET') {
				if (version !== null) {
					// Get specific version
					return this.getFileVersion(fileId, version, authResult.user);
				} else {
					// Get all versions
					return this.getFileVersionHistory(fileId, authResult.user);
				}
			}

			if (request.method === 'POST' && pathParts[3] === 'restore') {
				// Restore to specific version
				const body = await request.json() as { version: number };
				const restoreVersion = body.version;
				return this.restoreFileVersion(fileId, restoreVersion, authResult.user);
			}

			return this.createErrorResponse(405, 'Method not allowed');

		} catch (error) {
			console.error('Versions request error:', error);
			return this.createErrorResponse(500, 'Version control service error');
		}
	}

	/**
	 * Verify user authentication using SXAP
	 */
	private async verifyUserAuthentication(request: Request): Promise<{success: boolean, user?: any, error?: string}> {
		try {
			const authHeader = request.headers.get('Authorization');
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				return { success: false, error: 'No authentication token provided' };
			}

			const token = authHeader.substring(7);

			// Verify token with SXAP auth worker
			const verifyRequest = new Request('https://smpweb-2x-auth.kidjjoe.workers.dev/v2/auth?op=verify&mode=strict&sec=2', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ token })
			});

			const verifyResponse = await this.env.SMPWEB_2X_AUTH_WORKER.fetch(verifyRequest);
			const result = await verifyResponse.json() as any;

			if (result.valid && result.user) {
				return { success: true, user: result.user };
			}

			return { success: false, error: 'Invalid or expired token' };

		} catch (error) {
			console.error('Auth verification error:', error);
			return { success: false, error: 'Authentication verification failed' };
		}
	}

	/**
	 * Get user profile information
	 */
	private async getUserProfile(user: any): Promise<Response> {
		try {
			const profileData = {
				id: user.id,
				username: user.username,
				email: user.email,
				createdAt: user.createdAt,
				lastLogin: user.lastLogin,
				role: user.role || 'user'
			};

			return new Response(JSON.stringify({
				success: true,
				profile: profileData
			}), {
				headers: {
					'Content-Type': 'application/json',
					...this.getCORSHeaders()
				}
			});

		} catch (error) {
			console.error('Get profile error:', error);
			return this.createErrorResponse(500, 'Failed to get user profile');
		}
	}

	/**
	 * Get user uploads with pagination
	 */
	private async getUserUploads(user: any, request: Request): Promise<Response> {
		try {
			const url = new URL(request.url);
			const page = parseInt(url.searchParams.get('page') || '1');
			const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
			const offset = (page - 1) * limit;

			const kvUploads = await this.getUserKVUploads(user.id, offset, limit);

			let dbUploads: any[] = [];
			if (this.env.ASSETS_DB) {
				try {
					const dbResult = await this.env.ASSETS_DB.prepare(`
						SELECT id, name as given_name, original_name as name, file_path as path, file_size as size, mime_type, category,
							   description, tags, created_at as createdAt, updated_at as uploadedAt
						FROM assets
						WHERE user_id = ?
						ORDER BY created_at DESC
						LIMIT ? OFFSET ?
					`).bind(user.id, limit, offset).all();

					dbUploads = dbResult.results || [];
				} catch (dbError) {
					console.warn('Database query failed:', dbError);
				}
			}

			// Combine and sort results
			const allUploads = [...kvUploads, ...dbUploads].sort((a, b) =>
				new Date(b.createdAt || b.uploadedAt).getTime() - new Date(a.createdAt || a.uploadedAt).getTime()
			);

			return new Response(JSON.stringify({
				success: true,
				uploads: allUploads.slice(0, limit),
				pagination: {
					page,
					limit,
					total: allUploads.length,
					hasMore: allUploads.length === limit
				}
			}), {
				headers: {
					'Content-Type': 'application/json',
					...this.getCORSHeaders()
				}
			});

		} catch (error) {
			console.error('Get uploads error:', error);
			return this.createErrorResponse(500, 'Failed to get user uploads');
		}
	}

	/**
	 * Get user uploads from KV storage
	 */
	private async getUserKVUploads(userId: string, offset: number, limit: number): Promise<any[]> {
		try {
			// List user uploads from KV metadata
			const userUploadsKey = `user_uploads:${userId}`;
			const uploadsData = await this.env.CDN_METADATA.get(userUploadsKey, 'json');

			if (!uploadsData || !Array.isArray(uploadsData)) {
				return [];
			}

			return uploadsData
				.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
				.slice(offset, offset + limit);

		} catch (error) {
			console.error('KV uploads query error:', error);
			return [];
		}
	}

	/**
	 * Get user quota information
	 */
	private async getUserQuota(user: any): Promise<Response> {
		try {
			// Default quotas (can be customized per user role)
			const quotas = {
				user: { maxFiles: 100, maxStorage: 1024 * 1024 * 1024 }, // 1GB
				premium: { maxFiles: 1000, maxStorage: 10 * 1024 * 1024 * 1024 }, // 10GB
				admin: { maxFiles: -1, maxStorage: -1 } // Unlimited
			};

			const userRole = user.role || 'user';
			const quota = quotas[userRole as keyof typeof quotas] || quotas.user;

			// Calculate current usage
			const usage = await this.calculateUserUsage(user.id);

			// Get detailed storage usage including versions
			let storageUsage = await this.env.CDN_METADATA.get(`storage_usage:${user.id}`, 'json') as any || {
				files: 0,
				versions: 0,
				total: 0,
				lastUpdated: Date.now()
			};

			// Always recalculate storage breakdown to ensure accuracy
			const versionStorage = await this.calculateUserVersionStorage(user.id);

			// Use actual usage for files and calculated version storage
			storageUsage = {
				files: usage.storage, // Use the actual calculated storage
				versions: versionStorage,
				total: usage.storage + versionStorage,
				lastUpdated: Date.now()
			};

			// Update the storage tracking
			await this.env.CDN_METADATA.put(`storage_usage:${user.id}`, JSON.stringify(storageUsage));

			const quotaInfo = {
				role: userRole,
				limits: {
					maxFiles: quota.maxFiles,
					maxStorage: quota.maxStorage,
					maxStorageMB: quota.maxStorage > 0 ? Math.round(quota.maxStorage / (1024 * 1024)) : -1
				},
				usage: {
					files: usage.files,
					storage: usage.storage,
					storageMB: Math.round(usage.storage / (1024 * 1024)),
					// Detailed storage breakdown
					storageBreakdown: {
						files: storageUsage.files,
						versions: storageUsage.versions,
						total: storageUsage.total,
						filesMB: Math.round(storageUsage.files / (1024 * 1024)),
						versionsMB: Math.round(storageUsage.versions / (1024 * 1024)),
						totalMB: Math.round(storageUsage.total / (1024 * 1024))
					}
				},
				percentage: {
					files: quota.maxFiles > 0 ? Math.round((usage.files / quota.maxFiles) * 100) : 0,
					storage: quota.maxStorage > 0 ? Math.round((usage.storage / quota.maxStorage) * 100) : 0,
					// Version storage percentage
					versions: quota.maxStorage > 0 ? Math.round((storageUsage.versions / quota.maxStorage) * 100) : 0
				},
				canUpload: quota.maxFiles === -1 || usage.files < quota.maxFiles,
				storageAvailable: quota.maxStorage === -1 || usage.storage < quota.maxStorage,
				// Storage visualization data for different colors
				storageVisualization: {
					fileStorage: {
						bytes: storageUsage.files,
						percentage: quota.maxStorage > 0 ? Math.round((storageUsage.files / quota.maxStorage) * 100) : 0,
						color: '#3B82F6', // Blue for regular files
						label: 'File Storage'
					},
					versionStorage: {
						bytes: storageUsage.versions,
						percentage: quota.maxStorage > 0 ? Math.round((storageUsage.versions / quota.maxStorage) * 100) : 0,
						color: '#F59E0B', // Amber/Orange for version history
						label: 'Version History'
					},
					totalUsed: {
						bytes: storageUsage.total,
						percentage: quota.maxStorage > 0 ? Math.round((storageUsage.total / quota.maxStorage) * 100) : 0,
						color: '#10B981', // Green for total
						label: 'Total Used'
					},
					available: {
						bytes: quota.maxStorage > 0 ? Math.max(0, quota.maxStorage - storageUsage.total) : 0,
						percentage: quota.maxStorage > 0 ? Math.max(0, 100 - Math.round((storageUsage.total / quota.maxStorage) * 100)) : 100,
						color: '#E5E7EB', // Gray for available
						label: 'Available'
					}
				}
			};

			return new Response(JSON.stringify({
				success: true,
				quota: quotaInfo
			}), {
				headers: {
					'Content-Type': 'application/json',
					...this.getCORSHeaders()
				}
			});

		} catch (error) {
			console.error('Get quota error:', error);
			return this.createErrorResponse(500, 'Failed to get user quota');
		}
	}

	/**
	 * Calculate user storage usage
	 */
	private async calculateUserUsage(userId: string): Promise<{files: number, storage: number}> {
		try {
			let totalFiles = 0;
			let totalStorage = 0;

			// Count KV uploads
			const userUploadsKey = `user_uploads:${userId}`;
			const kvUploads = await this.env.CDN_METADATA.get(userUploadsKey, 'json');
			if (kvUploads && Array.isArray(kvUploads)) {
				totalFiles += kvUploads.length;
				totalStorage += kvUploads.reduce((sum, upload) => sum + (upload.size || upload.fileSize || 0), 0);
			}

			// Count D1 uploads
			if (this.env.ASSETS_DB) {
								try {
					const dbResult = await this.env.ASSETS_DB.prepare(`
						SELECT COUNT(*) as count, SUM(file_size) as total_size
						FROM assets
						WHERE user_id = ?
					`).bind(userId).first() as any;

					if (dbResult) {
						totalFiles += Number(dbResult.count || 0);
						totalStorage += Number(dbResult.total_size || 0);
					}
				} catch (dbError) {
					console.warn('Database usage query failed:', dbError);
				}
			}

			return { files: totalFiles, storage: totalStorage };

		} catch (error) {
			console.error('Usage calculation error:', error);
			return { files: 0, storage: 0 };
		}
	}

	/**
	 * Get file information by ID
	 */
	private async getFileInfo(fileId: string, user: any): Promise<Response> {
		try {
			// Try to get from D1 database first
			const dbFile = await this.env.ASSETS_DB.prepare(`
				SELECT * FROM assets WHERE id = ? AND user_id = ?
			`).bind(fileId, user.id).first() as any;

			if (dbFile) {
				return new Response(JSON.stringify({
					success: true,
					file: {
						id: dbFile.id,
						name: dbFile.name,
						originalName: dbFile.original_name,
						path: dbFile.file_path,
						size: dbFile.file_size,
						mimeType: dbFile.mime_type,
						category: dbFile.category,
						description: dbFile.description,
						tags: JSON.parse(dbFile.tags || '[]'),
						uploadedAt: dbFile.uploaded_at,
						userId: dbFile.user_id,
						type: 'database'
					}
				}), {
					headers: {
						'Content-Type': 'application/json',
						...this.getCORSHeaders()
					}
				});
			}

			// Try to get from KV storage (direct uploads)
			const kvFile = await this.env.CDN_METADATA.get(`file:${fileId}`, 'json') as any;
			if (kvFile && kvFile.userId === user.id) {
				return new Response(JSON.stringify({
					success: true,
					file: {
						id: fileId,
						name: kvFile.name,
						originalName: kvFile.name,
						path: kvFile.path,
						size: kvFile.size,
						mimeType: kvFile.type,
						uploadedAt: kvFile.uploadedAt,
						userId: kvFile.userId,
						type: 'direct'
					}
				}), {
					headers: {
						'Content-Type': 'application/json',
						...this.getCORSHeaders()
					}
				});
			}

			return this.createErrorResponse(404, 'File not found or access denied');

		} catch (error) {
			console.error('Get file info error:', error);
			return this.createErrorResponse(500, 'Failed to retrieve file information');
		}
	}

	/**
	 * Delete file by ID
	 */
	private async deleteFile(fileId: string, user: any): Promise<Response> {
		try {
			let deleted = false;
			let fileInfo: any = null;

			// Try to delete from D1 database first
			const dbFile = await this.env.ASSETS_DB.prepare(`
				SELECT * FROM assets WHERE id = ? AND user_id = ?
			`).bind(fileId, user.id).first() as any;

			if (dbFile) {
				// Delete from database
				await this.env.ASSETS_DB.prepare(`
					DELETE FROM assets WHERE id = ? AND user_id = ?
				`).bind(fileId, user.id).run();

				// Delete file content from KV
				const cleanPath = dbFile.file_path.replace('/object/live.m3u8', '');
				await this.env.CDN_CACHE.delete(`asset:${cleanPath}`);

				fileInfo = dbFile;
				deleted = true;
			} else {
				// Try to delete from KV storage (direct uploads)
				const kvFile = await this.env.CDN_METADATA.get(`file:${fileId}`, 'json') as any;
				if (kvFile && kvFile.userId === user.id) {
					// Delete metadata
					await this.env.CDN_METADATA.delete(`file:${fileId}`);

					// Delete file content
					const cleanPath = kvFile.storagePath || fileId;
					await this.env.CDN_CACHE.delete(`asset:${cleanPath}`);

					// Remove from user uploads tracking
					await this.removeFromUserUploads(user.id, fileId);

					fileInfo = kvFile;
					deleted = true;
				}
			}

			if (!deleted) {
				return this.createErrorResponse(404, 'File not found or access denied');
			}

			return new Response(JSON.stringify({
				success: true,
				message: 'File deleted successfully',
				deletedFile: {
					id: fileId,
					name: fileInfo.name || fileInfo.original_name,
					size: fileInfo.size || fileInfo.file_size
				}
			}), {
				headers: {
					'Content-Type': 'application/json',
					...this.getCORSHeaders()
				}
			});

		} catch (error) {
			console.error('Delete file error:', error);
			return this.createErrorResponse(500, 'Failed to delete file');
		}
	}

	/**
	 * Update file information
	 */
	private async updateFileInfo(fileId: string, user: any, request: Request): Promise<Response> {
		try {
			const updateData = await request.json() as any;

			// Try to update in D1 database first
			const dbFile = await this.env.ASSETS_DB.prepare(`
				SELECT * FROM assets WHERE id = ? AND user_id = ?
			`).bind(fileId, user.id).first() as any;

			if (dbFile) {
				const updates: string[] = [];
				const bindings: any[] = [];

				if (updateData.name) {
					updates.push('name = ?');
					bindings.push(updateData.name);
				}

				if (updateData.description !== undefined) {
					updates.push('description = ?');
					bindings.push(updateData.description);
				}

				if (updateData.category) {
					updates.push('category = ?');
					bindings.push(updateData.category);
				}

				if (updateData.tags) {
					updates.push('tags = ?');
					bindings.push(JSON.stringify(updateData.tags));
				}

				if (updates.length > 0) {
					bindings.push(fileId, user.id);
					await this.env.ASSETS_DB.prepare(`
						UPDATE assets SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
					`).bind(...bindings).run();
				}

				return new Response(JSON.stringify({
					success: true,
					message: 'File information updated successfully',
					fileId: fileId
				}), {
					headers: {
						'Content-Type': 'application/json',
						...this.getCORSHeaders()
					}
				});
			}

			// KV files have limited update capabilities
			return this.createErrorResponse(400, 'Direct upload files have limited update capabilities');

		} catch (error) {
			console.error('Update file info error:', error);
			return this.createErrorResponse(500, 'Failed to update file information');
		}
	}

	/**
	 * Remove file from user uploads tracking
	 */
	private async removeFromUserUploads(userId: string, fileId: string): Promise<void> {
		try {
			const userUploadsKey = `user_uploads:${userId}`;
			const existingUploads = await this.env.CDN_METADATA.get(userUploadsKey, 'json') as any[] || [];

			const updatedUploads = existingUploads.filter(upload =>
				upload.storagePath !== fileId && upload.path !== fileId
			);

			await this.env.CDN_METADATA.put(userUploadsKey, JSON.stringify(updatedUploads));
		} catch (error) {
			console.error('Failed to remove from user uploads:', error);
		}
	}

	/**
	 * Track user upload in KV storage
	 */
	private async trackUserUpload(userId: string, fileMetadata: any): Promise<void> {
		try {
			const userUploadsKey = `user_uploads:${userId}`;
			const existingUploads = await this.env.CDN_METADATA.get(userUploadsKey, 'json') as any[] || [];

			existingUploads.push({
				...fileMetadata,
				createdAt: fileMetadata.uploadedAt
			});

			// Keep only the last 1000 uploads per user to avoid storage bloat
			const recentUploads = existingUploads
				.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
				.slice(0, 1000);

			await this.env.CDN_METADATA.put(userUploadsKey, JSON.stringify(recentUploads));
		} catch (error) {
			console.error('Failed to track user upload:', error);
		}
	}

	/**
	 * Check if user can upload based on quota
	 */
	private async checkUserQuota(user: any): Promise<{canUpload: boolean, reason?: string}> {
		try {
			// Default quotas (can be customized per user role)
			const quotas = {
				user: { maxFiles: 100, maxStorage: 1024 * 1024 * 1024 }, // 1GB
				premium: { maxFiles: 1000, maxStorage: 10 * 1024 * 1024 * 1024 }, // 10GB
				admin: { maxFiles: -1, maxStorage: -1 } // Unlimited
			};

			const userRole = user.role || 'user';
			const quota = quotas[userRole as keyof typeof quotas] || quotas.user;

			// Unlimited quota for admins
			if (quota.maxFiles === -1 && quota.maxStorage === -1) {
				return { canUpload: true };
			}

			// Calculate current usage
			const usage = await this.calculateUserUsage(user.id);

			// Check file count limit
			if (quota.maxFiles > 0 && usage.files >= quota.maxFiles) {
				return { canUpload: false, reason: `File limit exceeded (${usage.files}/${quota.maxFiles})` };
			}

			// Check storage limit
			if (quota.maxStorage > 0 && usage.storage >= quota.maxStorage) {
				const usedMB = Math.round(usage.storage / (1024 * 1024));
				const maxMB = Math.round(quota.maxStorage / (1024 * 1024));
				return { canUpload: false, reason: `Storage limit exceeded (${usedMB}MB/${maxMB}MB)` };
			}

			return { canUpload: true };

		} catch (error) {
			console.error('Quota check error:', error);
			return { canUpload: false, reason: 'Unable to verify quota' };
		}
	}

	/**
	 * Get user statistics
	 */
	private async getUserStats(user: any): Promise<Response> {
		try {
			const usage = await this.calculateUserUsage(user.id);

			// Get recent upload activity (last 30 days)
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

			let recentUploads = 0;

						// Count recent KV uploads
			const userUploadsKey = `user_uploads:${user.id}`;
			const kvUploads = await this.env.CDN_METADATA.get(userUploadsKey, 'json');
			if (kvUploads && Array.isArray(kvUploads)) {
				recentUploads += kvUploads.filter(upload =>
					new Date(upload.createdAt) > thirtyDaysAgo
				).length;
			}

			// Count recent D1 uploads
			if (this.env.ASSETS_DB) {
				try {
					const dbResult = await this.env.ASSETS_DB.prepare(`
						SELECT COUNT(*) as count
						FROM assets
						WHERE user_id = ? AND created_at > ?
					`).bind(user.id, thirtyDaysAgo.toISOString()).first() as any;

					recentUploads += Number(dbResult?.count || 0);
				} catch (dbError) {
					console.warn('Database stats query failed:', dbError);
				}
			}

			return new Response(JSON.stringify({
				success: true,
				stats: {
					totalFiles: usage.files,
					totalStorage: usage.storage,
					recentUploads,
					memberSince: user.createdAt,
					lastLogin: user.lastLogin
				}
			}), {
				headers: {
					'Content-Type': 'application/json',
					...this.getCORSHeaders()
				}
			});

		} catch (error) {
			console.error('Get stats error:', error);
			return this.createErrorResponse(500, 'Failed to get user statistics');
		}
	}

	/**
	 * Get file metadata from storage
	 */
	private async getFileMetadata(fileId: string): Promise<FileMetadata | null> {
		try {
			// Try database first
			if (this.env.ASSETS_DB) {
				const dbResult = await this.env.ASSETS_DB.prepare(`
					SELECT * FROM assets WHERE id = ?
				`).bind(fileId).first() as any;

				if (dbResult) {
					return {
						id: dbResult.id,
						name: dbResult.name,
						originalName: dbResult.original_name,
						path: dbResult.path,
						mimeType: dbResult.mime_type,
						size: dbResult.size,
						owner: dbResult.user_name || 'Unknown',
						ownerId: dbResult.user_id,
						created: new Date(dbResult.created_at).getTime(),
						modified: new Date(dbResult.updated_at || dbResult.created_at).getTime(),
						version: dbResult.version || 1,
						isPublic: dbResult.is_public || false,
						tags: dbResult.tags ? JSON.parse(dbResult.tags) : [],
						description: dbResult.description || '',
						customFields: dbResult.custom_fields ? JSON.parse(dbResult.custom_fields) : {}
					};
				}
			}

			// Fallback to KV storage
			const kvResult = await this.env.CDN_METADATA.get(`file:${fileId}`, 'json') as FileMetadata;
			return kvResult || null;

		} catch (error) {
			console.error('Get file metadata error:', error);
			return null;
		}
	}

	/**
	 * Update file metadata with version control
	 */
	private async updateFileMetadata(fileId: string, user: any, request: Request): Promise<Response> {
		try {
			const updateData = await request.json() as any;
			const currentMetadata = await this.getFileMetadata(fileId);

			if (!currentMetadata) {
				return this.createErrorResponse(404, 'File not found');
			}

			// Create version backup before updating
			await this.createFileVersion(currentMetadata, user, 'metadata', { metadata: updateData });

			// Update file metadata
			const updatedMetadata: FileMetadata = {
				...currentMetadata,
				...updateData,
				modified: Date.now(),
				version: currentMetadata.version + 1
			};

			// Update in database if available
			if (this.env.ASSETS_DB) {
				try {
					await this.env.ASSETS_DB.prepare(`
						UPDATE assets SET
							name = ?, description = ?, tags = ?, custom_fields = ?,
							version = ?, updated_at = ?
						WHERE id = ? AND user_id = ?
					`).bind(
						updatedMetadata.name,
						updatedMetadata.description || '',
						JSON.stringify(updatedMetadata.tags),
						JSON.stringify(updatedMetadata.customFields || {}),
						updatedMetadata.version,
						new Date().toISOString(),
						fileId,
						user.id
					).run();
				} catch (dbError) {
					console.warn('Database update failed, using KV fallback:', dbError);
				}
			}

			// Always update in KV as backup
			await this.env.CDN_METADATA.put(`file:${fileId}`, JSON.stringify(updatedMetadata));

			// Update the file metadata in CDN cache if it exists
			const existingAsset = await this.env.CDN_CACHE.getWithMetadata(`asset:${currentMetadata.path}`);
			if (existingAsset.value) {
				const existingMeta = existingAsset.metadata as any || {};
				const updatedMetadataObj = {
					contentType: existingMeta.contentType || currentMetadata.mimeType,
					size: existingMeta.size || currentMetadata.size.toString(),
					name: updatedMetadata.name,
					description: updatedMetadata.description,
					tags: JSON.stringify(updatedMetadata.tags),
					customFields: JSON.stringify(updatedMetadata.customFields || {}),
					lastModified: new Date().toISOString()
				};

				await this.env.CDN_CACHE.put(`asset:${currentMetadata.path}`, existingAsset.value, {
					metadata: updatedMetadataObj
				});
			}

			// Calculate storage usage for version (metadata backup)
			const metadataSize = new TextEncoder().encode(JSON.stringify(currentMetadata)).length;
			await this.updateUserStorageUsage(user.id, 0, metadataSize, 'version');

			return new Response(JSON.stringify({
				success: true,
				message: 'File metadata updated successfully',
				fileId,
				version: updatedMetadata.version,
				storage: {
					versionStorage: metadataSize,
					totalStorage: await this.calculateUserVersionStorage(user.id)
				}
			}), {
				headers: {
					'Content-Type': 'application/json',
					...this.getCORSHeaders()
				}
			});

		} catch (error) {
			console.error('Update metadata error:', error);
			return this.createErrorResponse(500, 'Failed to update file metadata');
		}
	}

	/**
	 * Update file content with version control
	 */
	private async updateFileContent(fileId: string, user: any, request: Request): Promise<Response> {
		try {
			const currentMetadata = await this.getFileMetadata(fileId);
			if (!currentMetadata) {
				return this.createErrorResponse(404, 'File not found');
			}

			// Get current file content
			const currentContent = await this.env.FILE_CONTENT.get(`content:${fileId}`, 'arrayBuffer');

			// Get new content from request
			const newContent = await request.arrayBuffer();
			const newSize = newContent.byteLength;

			if (newSize === 0) {
				return this.createErrorResponse(400, 'Content cannot be empty');
			}

			// Create version backup before updating
			if (currentContent) {
				await this.createFileVersion(currentMetadata, user, 'content', {
					contentSize: currentContent.byteLength,
					contentHash: await this.generateContentHash(currentContent)
				});
			}

			// Store new content in both locations
			await this.env.FILE_CONTENT.put(`content:${fileId}`, newContent);

			// Also update the CDN cache where files are actually served from
			await this.env.CDN_CACHE.put(`asset:${currentMetadata.path}`, newContent, {
				metadata: {
					contentType: currentMetadata.mimeType,
					size: newSize.toString(),
					lastModified: new Date().toISOString()
				}
			});

			// Update metadata with new size and version
			const updatedMetadata: FileMetadata = {
				...currentMetadata,
				size: newSize,
				modified: Date.now(),
				version: currentMetadata.version + 1
			};

			// Update metadata storage
			await this.env.CDN_METADATA.put(`file:${fileId}`, JSON.stringify(updatedMetadata));

			// Update database if available
			if (this.env.ASSETS_DB) {
				try {
					await this.env.ASSETS_DB.prepare(`
						UPDATE assets SET size = ?, file_size = ?, version = ?, updated_at = ?
						WHERE id = ? AND user_id = ?
					`).bind(
						newSize,
						newSize,
						updatedMetadata.version,
						new Date().toISOString(),
						fileId,
						user.id
					).run();
				} catch (dbError) {
					console.warn('Database update failed:', dbError);
				}
			}

			// Calculate storage usage for version
			const oldContentSize = currentContent ? currentContent.byteLength : 0;
			await this.updateUserStorageUsage(user.id, oldContentSize, newSize, 'version');

			return new Response(JSON.stringify({
				success: true,
				message: 'File content updated successfully',
				fileId,
				version: updatedMetadata.version,
				size: newSize,
				storage: {
					versionStorage: oldContentSize,
					totalStorage: await this.calculateUserVersionStorage(user.id)
				}
			}), {
				headers: {
					'Content-Type': 'application/json',
					...this.getCORSHeaders()
				}
			});

		} catch (error) {
			console.error('Update content error:', error);
			return this.createErrorResponse(500, 'Failed to update file content');
		}
	}

	/**
	 * Get file with version information
	 */
	private async getFileWithVersions(fileId: string, user: any): Promise<Response> {
		try {
			const metadata = await this.getFileMetadata(fileId);
			if (!metadata) {
				return this.createErrorResponse(404, 'File not found');
			}

			// Get version history
			const versions = await this.getFileVersions(fileId);

			// Calculate version storage usage
			const versionStorage = await this.calculateFileVersionStorage(fileId);

			return new Response(JSON.stringify({
				success: true,
				file: metadata,
				versions: versions.slice(0, 10), // Limit to last 10 versions for performance
				totalVersions: versions.length,
				storage: {
					currentSize: metadata.size,
					versionStorage,
					totalSize: metadata.size + versionStorage
				}
			}), {
				headers: {
					'Content-Type': 'application/json',
					...this.getCORSHeaders()
				}
			});

		} catch (error) {
			console.error('Get file with versions error:', error);
			return this.createErrorResponse(500, 'Failed to get file information');
		}
	}

	/**
	 * Get file version history
	 */
	private async getFileVersionHistory(fileId: string, user: any): Promise<Response> {
		try {
			const versions = await this.getFileVersions(fileId);

			return new Response(JSON.stringify({
				success: true,
				fileId,
				versions,
				totalVersions: versions.length
			}), {
				headers: {
					'Content-Type': 'application/json',
					...this.getCORSHeaders()
				}
			});

		} catch (error) {
			console.error('Get version history error:', error);
			return this.createErrorResponse(500, 'Failed to get version history');
		}
	}

	/**
	 * Get specific file version
	 */
	private async getFileVersion(fileId: string, version: number, user: any): Promise<Response> {
		try {
			const versionData = await this.env.FILE_VERSIONS.get(`version:${fileId}:${version}`, 'json') as FileVersion;

			if (!versionData) {
				return this.createErrorResponse(404, 'Version not found');
			}

			// Get version content if available
			let content = null;
			if (versionData.changeType === 'content' || versionData.changeType === 'both') {
				const contentBuffer = await this.env.FILE_VERSIONS.get(`version_content:${fileId}:${version}`, 'arrayBuffer');
				if (contentBuffer) {
					content = {
						size: contentBuffer.byteLength,
						hash: versionData.changes.contentHash
					};
				}
			}

			return new Response(JSON.stringify({
				success: true,
				version: versionData,
				content
			}), {
				headers: {
					'Content-Type': 'application/json',
					...this.getCORSHeaders()
				}
			});

		} catch (error) {
			console.error('Get version error:', error);
			return this.createErrorResponse(500, 'Failed to get version information');
		}
	}

	/**
	 * Restore file to specific version
	 */
	private async restoreFileVersion(fileId: string, version: number, user: any): Promise<Response> {
		try {
			const versionData = await this.env.FILE_VERSIONS.get(`version:${fileId}:${version}`, 'json') as FileVersion;

			if (!versionData) {
				return this.createErrorResponse(404, 'Version not found');
			}

			const currentMetadata = await this.getFileMetadata(fileId);
			if (!currentMetadata) {
				return this.createErrorResponse(404, 'File not found');
			}

			// Create backup of current state before restore
			await this.createFileVersion(currentMetadata, user, 'both', {
				metadata: currentMetadata,
				contentSize: currentMetadata.size
			});

			// Restore metadata if version contains metadata changes
			if (versionData.changeType === 'metadata' || versionData.changeType === 'both') {
				if (versionData.changes.metadata) {
					const restoredMetadata: FileMetadata = {
						...currentMetadata,
						...versionData.changes.metadata,
						version: currentMetadata.version + 1,
						modified: Date.now()
					};

					await this.env.CDN_METADATA.put(`file:${fileId}`, JSON.stringify(restoredMetadata));
				}
			}

			// Restore content if version contains content changes
			if (versionData.changeType === 'content' || versionData.changeType === 'both') {
				const versionContent = await this.env.FILE_VERSIONS.get(`version_content:${fileId}:${version}`, 'arrayBuffer');
				if (versionContent) {
					await this.env.FILE_CONTENT.put(`content:${fileId}`, versionContent);
				}
			}

			return new Response(JSON.stringify({
				success: true,
				message: `File restored to version ${version}`,
				fileId,
				restoredVersion: version,
				newVersion: currentMetadata.version + 1
			}), {
				headers: {
					'Content-Type': 'application/json',
					...this.getCORSHeaders()
				}
			});

		} catch (error) {
			console.error('Restore version error:', error);
			return this.createErrorResponse(500, 'Failed to restore file version');
		}
	}

	/**
	 * Create a new file version backup
	 */
	private async createFileVersion(metadata: FileMetadata, user: any, changeType: 'metadata' | 'content' | 'both', changes: any): Promise<void> {
		try {
			const versionNumber = metadata.version;
			const timestamp = Date.now();

			// Calculate storage sizes
			const metadataSize = new TextEncoder().encode(JSON.stringify(metadata)).length;
			let contentSize = 0;

			// Store content if this is a content change
			if (changeType === 'content' || changeType === 'both') {
				const currentContent = await this.env.FILE_CONTENT.get(`content:${metadata.id}`, 'arrayBuffer');
				if (currentContent) {
					contentSize = currentContent.byteLength;
					await this.env.FILE_VERSIONS.put(`version_content:${metadata.id}:${versionNumber}`, currentContent);
				}
			}

			// Create version record
			const versionData: FileVersion = {
				version: versionNumber,
				timestamp,
				author: user.name || user.email,
				authorId: user.id,
				changeType,
				changes,
				storage: {
					contentBytes: contentSize,
					metadataBytes: metadataSize
				}
			};

			await this.env.FILE_VERSIONS.put(`version:${metadata.id}:${versionNumber}`, JSON.stringify(versionData));

			// Update version index
			const versionIndex = await this.env.FILE_VERSIONS.get(`versions:${metadata.id}`, 'json') as number[] || [];
			if (!versionIndex.includes(versionNumber)) {
				versionIndex.push(versionNumber);
				versionIndex.sort((a, b) => b - a); // Sort descending (newest first)

				// Keep only last 50 versions to prevent storage bloat
				const trimmedIndex = versionIndex.slice(0, 50);
				await this.env.FILE_VERSIONS.put(`versions:${metadata.id}`, JSON.stringify(trimmedIndex));

				// Clean up old versions beyond the limit
				for (const oldVersion of versionIndex.slice(50)) {
					await this.env.FILE_VERSIONS.delete(`version:${metadata.id}:${oldVersion}`);
					await this.env.FILE_VERSIONS.delete(`version_content:${metadata.id}:${oldVersion}`);
				}
			}

		} catch (error) {
			console.error('Create version error:', error);
		}
	}

	/**
	 * Get all versions for a file
	 */
	private async getFileVersions(fileId: string): Promise<FileVersion[]> {
		try {
			const versionIndex = await this.env.FILE_VERSIONS.get(`versions:${fileId}`, 'json') as number[] || [];
			const versions: FileVersion[] = [];

			for (const versionNumber of versionIndex) {
				const versionData = await this.env.FILE_VERSIONS.get(`version:${fileId}:${versionNumber}`, 'json') as FileVersion;
				if (versionData) {
					versions.push(versionData);
				}
			}

			return versions.sort((a, b) => b.timestamp - a.timestamp);

		} catch (error) {
			console.error('Get versions error:', error);
			return [];
		}
	}

	/**
	 * Calculate storage used by file versions
	 */
	private async calculateFileVersionStorage(fileId: string): Promise<number> {
		try {
			const versions = await this.getFileVersions(fileId);
			return versions.reduce((total, version) => {
				return total + version.storage.contentBytes + version.storage.metadataBytes;
			}, 0);
		} catch (error) {
			console.error('Calculate version storage error:', error);
			return 0;
		}
	}

	/**
	 * Calculate total version storage for a user
	 */
	private async calculateUserVersionStorage(userId: string): Promise<number> {
		try {
			// This is a simplified calculation - in production you'd want to track this more efficiently
			const userUploads = await this.env.CDN_METADATA.get(`user_uploads:${userId}`, 'json') as any[] || [];
			let totalVersionStorage = 0;

			for (const upload of userUploads) {
				const fileId = upload.storagePath || upload.path;
				if (fileId) {
					totalVersionStorage += await this.calculateFileVersionStorage(fileId);
				}
			}

			return totalVersionStorage;
		} catch (error) {
			console.error('Calculate user version storage error:', error);
			return 0;
		}
	}

	/**
	 * Update user storage usage tracking
	 */
	private async updateUserStorageUsage(userId: string, oldSize: number, newSize: number, type: 'file' | 'version' = 'file'): Promise<void> {
		try {
			const storageKey = `storage_usage:${userId}`;
			const currentUsage = await this.env.CDN_METADATA.get(storageKey, 'json') as any || {
				files: 0,
				versions: 0,
				total: 0,
				lastUpdated: Date.now()
			};

			// Update usage based on type
			if (type === 'version') {
				currentUsage.versions += (newSize - oldSize);
			} else {
				currentUsage.files += (newSize - oldSize);
			}

			currentUsage.total = currentUsage.files + currentUsage.versions;
			currentUsage.lastUpdated = Date.now();

			await this.env.CDN_METADATA.put(storageKey, JSON.stringify(currentUsage));
		} catch (error) {
			console.error('Update storage usage error:', error);
		}
	}

	/**
	 * Generate content hash for version tracking
	 */
	private async generateContentHash(content: ArrayBuffer): Promise<string> {
		const hashBuffer = await crypto.subtle.digest('SHA-256', content);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	}

	/**
	 * Handle uploaded asset requests from KV storage
	 */
	private async handleUploadedAssetRequest(request: Request, pathname: string): Promise<Response> {
		try {
			// Clean the pathname by removing the /object/live.m3u8 suffix if present
			let cleanPathname = pathname;
			if (pathname.endsWith('/object/live.m3u8')) {
				cleanPathname = pathname.replace('/object/live.m3u8', '');
			}

			console.log(`Attempting to serve asset: ${pathname} (cleaned: ${cleanPathname})`);

			// Try to get the file from KV storage using the cleaned path
			const fileData = await this.env.CDN_CACHE.get(`asset:${cleanPathname}`, 'arrayBuffer');
			const kvResult = await this.env.CDN_CACHE.getWithMetadata(`asset:${cleanPathname}`);

			console.log(`Asset lookup result - Data exists: ${!!fileData}, Metadata exists: ${!!kvResult?.metadata}`);

			if (!fileData) {
				// Try to get metadata from direct upload tracking using cleaned path
				const fileMetadata = await this.env.CDN_METADATA.get(`file:${cleanPathname}`, 'json') as any;
				console.log(`Fallback metadata lookup: ${!!fileMetadata}`);

				if (fileMetadata) {
					return this.createErrorResponse(404, `Uploaded asset not found: ${cleanPathname}. File was tracked but content not available.`);
				}
				return this.createErrorResponse(404, `Asset not found: ${cleanPathname}. This may be an obfuscated path that doesn't exist.`);
			}

			// Get content type from metadata or detect from path
			const metadata = kvResult?.metadata as any;
			const contentType = metadata?.contentType || this.getContentType(pathname);

			// Create response headers
			const headers = new Headers();
			headers.set('Content-Type', contentType);
			headers.set('Cache-Control', `public, max-age=${this.getCacheTTL(pathname)}`);

			// Add security and CORS headers
			this.addSecurityHeaders(headers);
			const corsHeaders = this.getCORSHeaders();
			Object.entries(corsHeaders).forEach(([key, value]) => {
				headers.set(key, value);
			});

					// Add upload-specific headers with Serix branding
		headers.set('X-Asset-Source', 'serix-uploaded');
		headers.set('X-Service-Version', '2.0.0');
		headers.set('X-Powered-By', 'Serix');
		if (metadata?.originalName) {
			headers.set('X-Original-Name', metadata.originalName);
		}
		if (metadata?.assetId) {
			headers.set('X-Asset-ID', metadata.assetId);
		}

			// Generate ETag
			const etag = await this.generateETagFromBuffer(fileData);
			headers.set('ETag', etag);

			// Check if client has cached version
			const clientETag = request.headers.get('If-None-Match');
			if (clientETag === etag) {
				return new Response(null, { status: 304, headers });
			}

			// Handle range requests for media files
			const rangeHeader = request.headers.get('Range');
			if (rangeHeader && this.isMediaFile(contentType)) {
				return this.handleRangeRequest(fileData, rangeHeader, headers, contentType);
			}

			return new Response(fileData, { headers });

		} catch (error) {
			console.error('Uploaded asset fetch error:', error);
			return this.createErrorResponse(500, 'Failed to fetch uploaded asset');
		}
	}

	/**
	 * Handle static asset requests with caching and optimization
	 */
	private async handleAssetRequest(request: Request, pathname: string): Promise<Response> {
		const cacheKey = new Request(request.url, request);
		const cache = caches.default;

		// Try to get from cache first
		let response = await cache.match(cacheKey);
		if (response) {
			// Add cache hit header
			const newResponse = new Response(response.body, response);
			newResponse.headers.set('X-Cache-Status', 'HIT');
			return newResponse;
		}

		// Fetch from assets
		try {
			response = await this.env.ASSETS.fetch(request);

			// If asset not found, return 404
			if (!response.ok) {
				return this.createErrorResponse(404, 'Asset not found');
			}

			// Optimize and cache the response
			response = await this.optimizeResponse(response, pathname, request);

			// Cache the response
			const cacheTTL = this.getCacheTTL(pathname);
			if (cacheTTL > 0) {
				response.headers.set('Cache-Control', `public, max-age=${cacheTTL}, immutable`);
				// Store in cache (don't await to avoid blocking)
				cache.put(cacheKey, response.clone()).catch(console.error);
			}

			response.headers.set('X-Cache-Status', 'MISS');
			return response;

		} catch (error) {
			console.error('Asset fetch error:', error);
			return this.createErrorResponse(500, 'Failed to fetch asset');
		}
	}

		/**
	 * Optimize response with compression, headers, and content optimization
	 */
	private async optimizeResponse(response: Response, pathname: string, request: Request): Promise<Response> {
		const contentType = this.getContentType(pathname);
		const headers = new Headers(response.headers);

		// Set content type
		headers.set('Content-Type', contentType);

		// Add security and permissive headers
		this.addSecurityHeaders(headers);

		// Add CORS headers
		const corsHeaders = this.getCORSHeaders();
		Object.entries(corsHeaders).forEach(([key, value]) => {
			headers.set(key, value);
		});

		// Generate ETag for caching
		const etag = await this.generateETag(response);
		headers.set('ETag', etag);

		// Check if client has cached version
		const clientETag = request.headers.get('If-None-Match');
		if (clientETag === etag) {
			return new Response(null, { status: 304, headers });
		}

		// Get response body
		let body = await response.arrayBuffer();

		// Handle range requests for media files
		const rangeHeader = request.headers.get('Range');
		if (rangeHeader && this.isMediaFile(contentType)) {
			return this.handleRangeRequest(body, rangeHeader, headers, contentType);
		}

		// Apply compression if supported and beneficial
		const acceptEncoding = request.headers.get('Accept-Encoding') || '';
		if (this.shouldCompress(contentType, body.byteLength)) {
			if (acceptEncoding.includes('brotli')) {
				// Note: Cloudflare Workers don't have built-in brotli, but CF edge handles this
				headers.set('Content-Encoding', 'br');
			} else if (acceptEncoding.includes('gzip')) {
				// Note: Cloudflare Workers don't have built-in gzip, but CF edge handles this
				headers.set('Content-Encoding', 'gzip');
			}
		}

		// Image optimization for supported formats
		if (contentType.startsWith('image/') && this.supportsWebP(request)) {
			// In production, this could be enhanced with actual image processing
			// For now, we'll rely on Cloudflare's automatic image optimization
			headers.set('Vary', 'Accept');
		}

		// Add additional permissive headers for embeddings and integrations
		headers.set('X-Robots-Tag', 'none');
		headers.set('Cache-Control', headers.get('Cache-Control') || `public, max-age=${this.getCacheTTL(pathname)}`);

		return new Response(body, { headers });
	}

	/**
	 * Generate ETag for cache validation
	 */
	private async generateETag(response: Response): Promise<string> {
		const buffer = await response.clone().arrayBuffer();
		const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		return `"${hashHex.substring(0, 16)}"`;
	}

	/**
	 * Get appropriate cache TTL based on file type
	 */
	private getCacheTTL(pathname: string): number {
		const ext = pathname.substring(pathname.lastIndexOf('.')).toLowerCase();

		if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg', '.ico'].includes(ext)) {
			return CACHE_TTL.IMAGES;
		}
		if (['.woff', '.woff2', '.ttf', '.eot', '.otf'].includes(ext)) {
			return CACHE_TTL.FONTS;
		}
		if (['.css'].includes(ext)) {
			return CACHE_TTL.STYLESHEETS;
		}
		if (['.js', '.mjs'].includes(ext)) {
			return CACHE_TTL.SCRIPTS;
		}
		if (['.html', '.htm'].includes(ext)) {
			return CACHE_TTL.DOCUMENTS;
		}

		return CACHE_TTL.DEFAULT;
	}

	/**
	 * Get MIME type for file extension
	 */
	private getContentType(pathname: string): string {
		const ext = pathname.substring(pathname.lastIndexOf('.')).toLowerCase();
		return MIME_TYPES[ext] || 'application/octet-stream';
	}

	/**
	 * Add security and permissive headers to response
	 */
	private addSecurityHeaders(headers: Headers): void {
		// Security headers
		headers.set('X-Content-Type-Options', 'nosniff');
		headers.set('X-Frame-Options', 'DENY');
		headers.set('X-XSS-Protection', '1; mode=block');
		headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

		// More permissive headers for broader compatibility
		headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, ETag, Last-Modified, Accept-Ranges');
		headers.set('Accept-Ranges', 'bytes');
		headers.set('Vary', 'Accept-Encoding, Accept');

		// Remove restrictive permissions policy for broader use
		// headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	}

	/**
	 * Get CORS headers for cross-origin requests - very permissive for CDN use
	 */
	private getCORSHeaders(): Record<string, string> {
		return {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST, PUT, DELETE, PATCH',
			'Access-Control-Allow-Headers': '*',
			'Access-Control-Allow-Credentials': 'false',
			'Access-Control-Max-Age': '86400',
			'Cross-Origin-Resource-Policy': 'cross-origin',
			'Cross-Origin-Embedder-Policy': 'unsafe-none',
			'Cross-Origin-Opener-Policy': 'unsafe-none'
		};
	}

	/**
	 * Determine if content should be compressed
	 */
	private shouldCompress(contentType: string, size: number): boolean {
		// Don't compress if too small or already compressed
		if (size < 1024) return false;

		const compressibleTypes = [
			'text/',
			'application/javascript',
			'application/json',
			'application/xml',
			'image/svg+xml'
		];

		return compressibleTypes.some(type => contentType.startsWith(type));
	}

	/**
	 * Check if client supports WebP format
	 */
	private supportsWebP(request: Request): boolean {
		const accept = request.headers.get('Accept') || '';
		return accept.includes('image/webp');
	}

	/**
	 * Check if content type is a media file that benefits from range requests
	 */
	private isMediaFile(contentType: string): boolean {
		return contentType.startsWith('video/') ||
		       contentType.startsWith('audio/') ||
		       contentType === 'application/octet-stream';
	}

		/**
	 * Handle range requests for media streaming
	 */
	private handleRangeRequest(body: ArrayBuffer, rangeHeader: string, headers: Headers, contentType: string): Response {
		const fileSize = body.byteLength;
		const range = rangeHeader.replace(/bytes=/, '').split('-');
		const start = parseInt(range[0], 10) || 0;
		const end = parseInt(range[1], 10) || fileSize - 1;

		if (start >= fileSize || end >= fileSize) {
			headers.set('Content-Range', `bytes */${fileSize}`);
			return new Response('Range Not Satisfiable', { status: 416, headers });
		}

		const chunkSize = (end - start) + 1;
		const chunk = body.slice(start, end + 1);

		headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
		headers.set('Content-Length', chunkSize.toString());
		headers.set('Content-Type', contentType);

		return new Response(chunk, { status: 206, headers });
	}

	/**
	 * Optimize response from worker with CDN features
	 */
	private async optimizeWorkerResponse(response: Response, workerName: string, workerPath: string, request: Request): Promise<Response> {
		const headers = new Headers(response.headers);

		// Add security and permissive headers
		this.addSecurityHeaders(headers);

		// Add CORS headers
		const corsHeaders = this.getCORSHeaders();
		Object.entries(corsHeaders).forEach(([key, value]) => {
			headers.set(key, value);
		});

		// Add worker proxy headers
		headers.set('X-Proxy-Worker', workerName);
		headers.set('X-Proxy-Path', workerPath);
		headers.set('X-CDN-Proxy', 'true');

		// Generate ETag for cache validation
		const body = await response.arrayBuffer();
		const etag = await this.generateETagFromBuffer(body);
		headers.set('ETag', etag);

		// Check if client has cached version
		const clientETag = request.headers.get('If-None-Match');
		if (clientETag === etag) {
			return new Response(null, { status: 304, headers });
		}

		return new Response(body, {
			status: response.status,
			headers
		});
	}

	/**
	 * Get cache TTL for worker responses based on path
	 */
	private getWorkerCacheTTL(workerPath: string): number {
		// Different cache strategies for different worker endpoints
		if (workerPath.includes('/attachments/') || workerPath.includes('/files/')) {
			return 3600; // 1 hour for file attachments
		}
		if (workerPath.includes('/api/')) {
			return 300; // 5 minutes for API responses
		}
		if (workerPath.includes('/static/') || workerPath.includes('/assets/')) {
			return 86400; // 1 day for static assets from workers
		}
		return 1800; // 30 minutes default for worker responses
	}

	/**
	 * Generate ETag from buffer
	 */
	private async generateETagFromBuffer(buffer: ArrayBuffer): Promise<string> {
		const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		return `"${hashHex.substring(0, 16)}"`;
	}

	/**
	 * Generate hash for request caching
	 */
	private hashRequest(request: Request): string {
		const url = new URL(request.url);
		const key = `${request.method}:${url.pathname}${url.search}`;

		// Include relevant headers in cache key
		const relevantHeaders = ['authorization', 'accept', 'accept-language'];
		const headerValues = relevantHeaders.map(h => request.headers.get(h) || '').join(':');

		return btoa(key + ':' + headerValues).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
	}

	/**
	 * Get cached response from KV store
	 */
	private async getFromKVCache(cacheKey: string): Promise<any> {
		try {
			const metadata = await this.env.CDN_METADATA.get(cacheKey, 'json') as any;
			if (!metadata || this.isCacheExpired(metadata?.expires)) {
				return null;
			}

			const cachedData = await this.env.CDN_CACHE.get(cacheKey, 'json');
			return cachedData;
		} catch (error) {
			console.error('KV cache read error:', error);
			return null;
		}
	}

	/**
	 * Store response in KV cache
	 */
	private async storeInKVCache(cacheKey: string, response: Response, workerPath: string): Promise<void> {
		try {
			const cacheTTL = this.getWorkerCacheTTL(workerPath);
			const expiresAt = Date.now() + (cacheTTL * 1000);

			// Serialize response data
			const body = await response.arrayBuffer();
			const responseData = {
				status: response.status,
				statusText: response.statusText,
				headers: Object.fromEntries(response.headers.entries()),
				body: Array.from(new Uint8Array(body)),
				timestamp: Date.now()
			};

			// Store metadata separately for quick expiry checks
			const metadata = {
				expires: expiresAt,
				size: body.byteLength,
				workerPath,
				contentType: response.headers.get('content-type') || 'unknown'
			};

			// Store in KV with TTL
			await Promise.all([
				this.env.CDN_CACHE.put(cacheKey, JSON.stringify(responseData), { expirationTtl: cacheTTL }),
				this.env.CDN_METADATA.put(cacheKey, JSON.stringify(metadata), { expirationTtl: cacheTTL })
			]);

			// Track cache statistics
			this.updateCacheStats(cacheKey, body.byteLength);

		} catch (error) {
			console.error('KV cache write error:', error);
		}
	}

	/**
	 * Deserialize KV response back to Response object
	 */
	private deserializeKVResponse(cachedData: any): Response {
		const body = new Uint8Array(cachedData.body);
		const headers = new Headers(cachedData.headers);

		// Add cache timing headers
		const age = Math.floor((Date.now() - cachedData.timestamp) / 1000);
		headers.set('Age', age.toString());
		headers.set('X-Cache-Timestamp', new Date(cachedData.timestamp).toISOString());

		return new Response(body, {
			status: cachedData.status,
			statusText: cachedData.statusText,
			headers
		});
	}

	/**
	 * Check if cache entry is expired
	 */
	private isCacheExpired(expiresAt: number): boolean {
		return Date.now() > expiresAt;
	}

		/**
	 * Update cache statistics in KV
	 */
	private async updateCacheStats(cacheKey: string, size: number): Promise<void> {
		try {
			const statsKey = 'cdn:stats:daily';
			const today = new Date().toISOString().split('T')[0];
			const statsData = await this.env.CDN_METADATA.get(statsKey, 'json') as any || {};

			if (!statsData[today]) {
				statsData[today] = { requests: 0, bandwidth: 0, hits: 0 };
			}

			statsData[today].requests += 1;
			statsData[today].bandwidth += size;

			await this.env.CDN_METADATA.put(statsKey, JSON.stringify(statsData), { expirationTtl: 86400 * 7 }); // 7 days
		} catch (error) {
			console.error('Stats update error:', error);
		}
	}

	/**
	 * Warm cache for popular endpoints
	 */
	private async warmCache(workerName: string, popularPaths: string[]): Promise<void> {
		try {
			const warmingPromises = popularPaths.map(async (path) => {
				const warmRequest = new Request(`https://example.com/worker/${workerName}${path}`);
				await this.handleWorkerProxyRequest(warmRequest, `/worker/${workerName}${path}`);
			});

			await Promise.allSettled(warmingPromises);
		} catch (error) {
			console.error('Cache warming error:', error);
		}
	}

		/**
	 * Invalidate cache for specific patterns
	 */
	private async invalidateCache(pattern: string): Promise<void> {
		try {
			// This would require a more sophisticated implementation
			// For now, we'll implement basic pattern matching
			console.log(`Cache invalidation requested for pattern: ${pattern}`);

			// In a real implementation, you'd scan KV keys and delete matching ones
			// This is a placeholder for demonstration
		} catch (error) {
			console.error('Cache invalidation error:', error);
		}
	}

	/**
	 * Handle external resource fetching with CORS proxy
	 * Supports: /fetch/{encoded-url} and /proxy-external/{encoded-url}
	 */
	private async handleExternalFetch(request: Request, pathname: string): Promise<Response> {
		try {
			const pathParts = pathname.split('/').filter(part => part.length > 0);

			if (pathParts.length < 2) {
				return this.createErrorResponse(400, 'Invalid fetch path. Use /fetch/{url} or /proxy-external/{url}');
			}

			// Extract URL from path (supports both encoded and direct URLs)
			let targetUrl: string;
			if (pathParts.length === 2) {
				// Format: /fetch/encoded-url
				try {
					targetUrl = decodeURIComponent(pathParts[1]);
				} catch {
					targetUrl = pathParts[1];
				}
			} else {
				// Format: /fetch/https/example.com/path
				const protocol = pathParts[1];
				const domain = pathParts[2];
				const path = pathParts.slice(3).join('/');
				targetUrl = `${protocol}://${domain}/${path}`;
			}

			// Validate URL
			let url: URL;
			try {
				url = new URL(targetUrl);
			} catch {
				return this.createErrorResponse(400, 'Invalid URL provided');
			}

			// Security check - block internal/private IPs
			if (this.isBlockedHost(url.hostname)) {
				return this.createErrorResponse(403, 'Access to this host is not allowed');
			}

			// Create cache key for external resources
			const cacheKey = `external:${this.hashRequest(request)}:${url.toString()}`;

			// Check cache first
			if (request.method === 'GET') {
				const cachedData = await this.getFromKVCache(cacheKey);
				if (cachedData) {
					const response = this.deserializeKVResponse(cachedData);
					response.headers.set('X-Cache-Status', 'KV-HIT');
					response.headers.set('X-Proxy-Type', 'External');
					response.headers.set('X-Origin-URL', url.toString());
					return response;
				}
			}

			// Build fetch headers with browser-like behavior
			const fetchHeaders = new Headers();

			// Copy relevant headers from original request
			const allowedHeaders = [
				'accept', 'accept-language', 'cache-control', 'pragma',
				'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site'
			];

			allowedHeaders.forEach(header => {
				const value = request.headers.get(header);
				if (value) {
					fetchHeaders.set(header, value);
				}
			});

			// Add browser-like headers to bypass restrictions
			fetchHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
			fetchHeaders.set('Accept', request.headers.get('Accept') || 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8');
			fetchHeaders.set('Accept-Language', 'en-US,en;q=0.9');
			fetchHeaders.set('Sec-Fetch-Dest', 'image');
			fetchHeaders.set('Sec-Fetch-Mode', 'no-cors');
			fetchHeaders.set('Sec-Fetch-Site', 'cross-site');
			fetchHeaders.set('Referer', 'https://www.google.com/');

			// Handle compression properly as per Cloudflare docs
			fetchHeaders.set('Accept-Encoding', 'br, gzip');

			// Fetch from external source
			const fetchRequest = new Request(url.toString(), {
				method: request.method,
				headers: fetchHeaders,
				body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null
			});

			const response = await fetch(fetchRequest);

			if (!response.ok) {
				return this.createErrorResponse(response.status, `External fetch failed: ${response.statusText}`);
			}

			// Create optimized response with proper headers
			const optimizedResponse = await this.optimizeExternalResponse(response, url, request);

			// Cache successful responses
			if (request.method === 'GET' && optimizedResponse.status === 200) {
				const cacheTTL = this.getExternalCacheTTL(url, response);
				optimizedResponse.headers.set('Cache-Control', `public, max-age=${cacheTTL}`);
				optimizedResponse.headers.set('X-Cache-Status', 'MISS');
				optimizedResponse.headers.set('X-Proxy-Type', 'External');
				optimizedResponse.headers.set('X-Origin-URL', url.toString());

				// Store in cache (async)
				this.storeInKVCache(cacheKey, optimizedResponse.clone(), '/external').catch(console.error);
			}

			return optimizedResponse;

		} catch (error) {
			console.error('External fetch error:', error);
			return this.createErrorResponse(500, 'Failed to fetch external resource');
		}
	}

	/**
	 * Handle Chrome DevTools well-known endpoint
	 */
	private handleChromeDevTools(): Response {
		const devToolsConfig = {
			name: "Serix Professional CDN",
			shortName: "Serix CDN",
			description: "High-performance CDN with advanced obfuscation powered by Serix",
			icons: [
				{
					src: "/assets/applications/icons/jwlimited_developer.png",
					sizes: "512x512",
					type: "image/png"
				}
			],
			version: "2.0.0",
			service: "Serix",
			developer: {
				name: "JWLimited",
				url: "https://jwlimited.dev",
				service: "Serix CDN"
			},
			capabilities: [
				"worker-proxy",
				"multi-layer-caching",
				"cors-proxy",
				"rpc-communication",
				"serix-obfuscation",
				"metadata-driven-paths"
			],
			endpoints: {
				health: "/api/health",
				workers: "/api/workers",
				cache: "/api/cache",
				upload: "/api/upload"
			}
		};

		return new Response(JSON.stringify(devToolsConfig, null, 2), {
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'public, max-age=3600',
				...this.getCORSHeaders()
			}
		});
	}

	/**
	 * Handle icon redirects
	 */
	private handleIconRedirect(request: Request): Response {
		const req = new URL(request.url);

		const iconUrl = req.origin + '/assets/applications/icons/jwlimited_developer.png';

		// If it's a HEAD request, return redirect headers
		if (request.method === 'HEAD') {
			return new Response(null, {
				status: 301,
				headers: {
					'Location': iconUrl,
					'Cache-Control': 'public, max-age=31536000',
					...this.getCORSHeaders()
				}
			});
		}

		// For GET requests, return permanent redirect
		return Response.redirect(iconUrl, 301);
	}

	/**
	 * Check if hostname should be blocked for security
	 */
	private isBlockedHost(hostname: string): boolean {
		const blockedPatterns = [
			// Local/private networks
			/^localhost$/i,
			/^127\./,
			/^10\./,
			/^172\.(1[6-9]|2[0-9]|3[01])\./,
			/^192\.168\./,
			/^169\.254\./, // Link-local
			/^::1$/, // IPv6 localhost
			/^fc00:/, // IPv6 private
			/^fe80:/, // IPv6 link-local
			// Metadata services
			/metadata\.google\.internal/i,
			/169\.254\.169\.254/, // AWS/GCP metadata
		];

		return blockedPatterns.some(pattern => pattern.test(hostname));
	}

	/**
	 * Optimize external response with proper headers
	 */
	private async optimizeExternalResponse(response: Response, url: URL, request: Request): Promise<Response> {
		const headers = new Headers();

		// Copy important headers from original response
		const preserveHeaders = [
			'content-type', 'content-length', 'content-encoding',
			'last-modified', 'etag', 'expires', 'cache-control'
		];

		preserveHeaders.forEach(header => {
			const value = response.headers.get(header);
			if (value) {
				headers.set(header, value);
			}
		});

		// Add CORS headers for cross-origin access
		const corsHeaders = this.getCORSHeaders();
		Object.entries(corsHeaders).forEach(([key, value]) => {
			headers.set(key, value);
		});

		// Add security headers
		this.addSecurityHeaders(headers);

		// Add proxy identification headers with Serix branding
		headers.set('X-Proxy-Source', 'Serix-CDN');
		headers.set('X-Proxy-Version', '2.0.0');
		headers.set('X-Service-Provider', 'Serix');
		headers.set('Via', '1.1 serix-cdn');

		// Handle content type detection for missing headers
		if (!headers.get('content-type')) {
			const contentType = this.detectContentType(url.pathname);
			if (contentType) {
				headers.set('content-type', contentType);
			}
		}

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers
		});
	}

	/**
	 * Get cache TTL for external resources
	 */
	private getExternalCacheTTL(url: URL, response: Response): number {
		// Check if response has cache headers
		const cacheControl = response.headers.get('cache-control');
		if (cacheControl) {
			const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
			if (maxAgeMatch) {
				return Math.min(parseInt(maxAgeMatch[1]), 86400); // Max 1 day
			}
		}

		// Default TTL based on content type
		const contentType = response.headers.get('content-type') || '';
		const pathname = url.pathname.toLowerCase();

		if (contentType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(pathname)) {
			return 3600; // 1 hour for images
		}
		if (contentType.startsWith('text/css') || pathname.endsWith('.css')) {
			return 1800; // 30 minutes for CSS
		}
		if (contentType.startsWith('application/javascript') || pathname.endsWith('.js')) {
			return 1800; // 30 minutes for JS
		}
		if (contentType.startsWith('font/') || /\.(woff|woff2|ttf|eot|otf)$/i.test(pathname)) {
			return 7200; // 2 hours for fonts
		}

		return 900; // 15 minutes default
	}

	/**
	 * Detect content type from file extension
	 */
	private detectContentType(pathname: string): string | null {
		const ext = pathname.substring(pathname.lastIndexOf('.')).toLowerCase();
		return MIME_TYPES[ext] || null;
	}

	/**
	 * Handle search requests for assets
	 */
	private async handleSearchRequest(request: Request): Promise<Response> {
		const corsHeaders = this.getCORSHeaders();

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		if (request.method !== 'GET') {
			return this.createErrorResponse(405, 'Method not allowed');
		}

		try {
			const url = new URL(request.url);
			const query = url.searchParams.get('q') || '';
			const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);

			if (!query.trim()) {
				return new Response(JSON.stringify({
					results: [],
					total: 0,
					query: ''
				}), {
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders
					}
				});
			}

			// Get search index from KV
			const searchIndex = await this.getSearchIndex();

			// Perform search
			const results = this.performAssetSearch(searchIndex, query.trim(), limit);

			return new Response(JSON.stringify({
				results,
				total: results.length,
				query: query.trim(),
				cached: true
			}), {
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'public, max-age=300', // 5 minutes
					...corsHeaders
				}
			});

		} catch (error) {
			console.error('Search error:', error);
			return this.createErrorResponse(500, 'Search failed');
		}
	}

	/**
	 * Handle assets list request
	 */
	private async handleAssetsListRequest(request: Request): Promise<Response> {
		const corsHeaders = this.getCORSHeaders();

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		if (request.method !== 'GET') {
			return this.createErrorResponse(405, 'Method not allowed');
		}

		try {
			const url = new URL(request.url);
			const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
			const category = url.searchParams.get('category');

			// Get assets from D1 database
			let query = 'SELECT * FROM assets ORDER BY uploaded_at DESC';
			let params: any[] = [];

			if (category) {
				query = 'SELECT * FROM assets WHERE category = ? ORDER BY uploaded_at DESC';
				params = [category];
			}

			query += ` LIMIT ${limit}`;

			const result = await this.env.ASSETS_DB.prepare(query).bind(...params).all();

			const assets = result.results?.map((row: any) => ({
				id: row.id,
				name: row.name,
				originalName: row.original_name,
				path: row.file_path,
				size: row.file_size,
				type: row.mime_type,
				category: row.category,
				description: row.description,
				tags: row.tags ? JSON.parse(row.tags) : [],
				uploadedAt: row.uploaded_at,
				url: `${new URL(request.url).origin}${row.file_path}`
			})) || [];

			return new Response(JSON.stringify({
				assets,
				total: assets.length,
				limit,
				category: category || 'all'
			}), {
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'public, max-age=60', // 1 minute cache
					...corsHeaders
				}
			});

		} catch (error) {
			console.error('Assets list error:', error);
			return this.createErrorResponse(500, 'Failed to fetch assets list');
		}
	}

	/**
	 * Handle index rebuild requests (restricted)
	 */
	private async handleIndexRequest(request: Request): Promise<Response> {
		const corsHeaders = this.getCORSHeaders();

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		if (request.method !== 'POST') {
			return this.createErrorResponse(405, 'Method not allowed');
		}

		// Simple authentication check
		const authHeader = request.headers.get('Authorization');
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return this.createErrorResponse(401, 'Authentication required');
		}

		try {
			// Build search index from assets
			const searchIndex = await this.buildSearchIndex();

			// Store in KV
			await this.storeSearchIndex(searchIndex);

			return new Response(JSON.stringify({
				success: true,
				indexed: searchIndex.length,
				timestamp: new Date().toISOString()
			}), {
				headers: {
					'Content-Type': 'application/json',
					...corsHeaders
				}
			});

		} catch (error) {
			console.error('Index rebuild error:', error);
			return this.createErrorResponse(500, 'Index rebuild failed');
		}
	}

	/**
	 * Get search index from KV storage
	 */
	private async getSearchIndex(): Promise<any[]> {
		try {
			const indexData = await this.env.CDN_METADATA.get('search:index', 'json') as any;
			return indexData || await this.buildDefaultSearchIndex();
		} catch (error) {
			console.error('Failed to load search index:', error);
			return await this.buildDefaultSearchIndex();
		}
	}

	/**
	 * Build search index from known assets
	 */
	private async buildSearchIndex(): Promise<any[]> {
		const assets: any[] = [];

		// Define known asset paths based on your public directory structure
		const assetPaths = [
			// Images
			{ path: '/assets/applications/icons/jwlimited_aurora.png', type: 'image', category: 'icons' },
			{ path: '/assets/applications/icons/jwlimited_cloud_beta.png', type: 'image', category: 'icons' },
			{ path: '/assets/applications/icons/jwlimited_cloud.png', type: 'image', category: 'icons' },
			{ path: '/assets/applications/icons/jwlimited_developer.png', type: 'image', category: 'icons' },
			{ path: '/assets/applications/icons/jwlimited_editor.png', type: 'image', category: 'icons' },
			{ path: '/assets/applications/icons/jwlimited_email.png', type: 'image', category: 'icons' },
			{ path: '/assets/applications/icons/jwlmited_auth.png', type: 'image', category: 'icons' },
			{ path: '/assets/applications/icons/jwlmited_draw.png', type: 'image', category: 'icons' },
			{ path: '/assets/applications/icons/simply_web_logo.png', type: 'image', category: 'icons' },

			// Media
			{ path: '/assets/applications/media/3d-smtp.mp4', type: 'video', category: 'media' },
			{ path: '/assets/applications/media/3d-smtp-fallback.jpg', type: 'image', category: 'media' },
			{ path: '/assets/applications/media/laptop_code_preview.jpg', type: 'image', category: 'media' },

			// Aurora showcase
			{ path: '/assets/applications/showcase/aurora/aurora-img.png', type: 'image', category: 'showcase' },
			{ path: '/assets/applications/showcase/aurora/aurora-img2.png', type: 'image', category: 'showcase' },
			{ path: '/assets/applications/showcase/aurora/aurora-img3.png', type: 'image', category: 'showcase' },

			// Simply Mail showcase
			{ path: '/assets/applications/showcase/simply_mail/screen1.png', type: 'image', category: 'showcase' },
			{ path: '/assets/applications/showcase/simply_mail/screen2.png', type: 'image', category: 'showcase' },
			{ path: '/assets/applications/showcase/simply_mail/screen3.png', type: 'image', category: 'showcase' },
			{ path: '/assets/applications/showcase/simply_mail/screen4.png', type: 'image', category: 'showcase' },

			// Simply Web showcase
			{ path: '/assets/applications/showcase/simplyweb_projects/simply-web-img.png', type: 'image', category: 'showcase' },

			// Audio files
			{ path: '/assets/applications/sounds/error-8-206492.mp3', type: 'audio', category: 'sounds' },
			{ path: '/assets/applications/sounds/german-notification.mp3', type: 'audio', category: 'sounds' },
			{ path: '/assets/applications/sounds/new-message-2mp3.mp3', type: 'audio', category: 'sounds' },
			{ path: '/assets/applications/sounds/notification.mp3', type: 'audio', category: 'sounds' },
			{ path: '/assets/applications/sounds/send.mp3', type: 'audio', category: 'sounds' },

			// Backgrounds
			{ path: '/assets/backgrounds/gradients/back-set1.png', type: 'image', category: 'backgrounds' },
			{ path: '/assets/backgrounds/gradients/back-set2.png', type: 'image', category: 'backgrounds' },
			{ path: '/assets/backgrounds/images/a-chosen-soul-9ODC1lIaVTI-unsplash.jpg', type: 'image', category: 'backgrounds' },
			{ path: '/assets/backgrounds/images/devloper-looking-at-me.png', type: 'image', category: 'backgrounds' },

			// Placeholders
			{ path: '/assets/placeholders/bottomLeft.svg', type: 'image', category: 'placeholders' },
			{ path: '/assets/placeholders/media.svg', type: 'image', category: 'placeholders' },
			{ path: '/assets/placeholders/midRight.svg', type: 'image', category: 'placeholders' },
			{ path: '/assets/placeholders/topLeft.svg', type: 'image', category: 'placeholders' },
			{ path: '/assets/placeholders/profile.jpg', type: 'image', category: 'placeholders' },

			// JavaScript Core
			{ path: '/_jsdelivery/vanilla/core/Application.js', type: 'js', category: 'core' },
			{ path: '/_jsdelivery/vanilla/core/ConsoleController.js', type: 'js', category: 'core' },
			{ path: '/_jsdelivery/vanilla/core/Enviroment.js', type: 'js', category: 'core' },
			{ path: '/_jsdelivery/vanilla/core/EventEmitter.js', type: 'js', category: 'core' },
			{ path: '/_jsdelivery/vanilla/core/Feature.js', type: 'js', category: 'core' },
			{ path: '/_jsdelivery/vanilla/core/FeatureControl.js', type: 'js', category: 'core' },
			{ path: '/_jsdelivery/vanilla/core/ImgLazy.js', type: 'js', category: 'core' },
			{ path: '/_jsdelivery/vanilla/core/Integrations.js', type: 'js', category: 'core' },
			{ path: '/_jsdelivery/vanilla/core/JWBase.js', type: 'js', category: 'core' },
			{ path: '/_jsdelivery/vanilla/core/Network.js', type: 'js', category: 'core' },

			// Velocity Framework
			{ path: '/_jsdelivery/velocity/src/velocity.js', type: 'js', category: 'velocity' },
			{ path: '/_jsdelivery/velocity/src/core/logger.js', type: 'js', category: 'velocity' },
			{ path: '/_jsdelivery/velocity/src/core/network.js', type: 'js', category: 'velocity' },
			{ path: '/_jsdelivery/velocity/src/core/pwa.js', type: 'js', category: 'velocity' },
			{ path: '/_jsdelivery/velocity/src/core/router.js', type: 'js', category: 'velocity' },
			{ path: '/_jsdelivery/velocity/src/core/seo.js', type: 'js', category: 'velocity' },
			{ path: '/_jsdelivery/velocity/src/core/storage.js', type: 'js', category: 'velocity' },
			{ path: '/_jsdelivery/velocity/src/core/utils.js', type: 'js', category: 'velocity' },
			{ path: '/_jsdelivery/velocity/src/core/workers.js', type: 'js', category: 'velocity' },

			// Styles
			{ path: '/_jsdelivery/velocity/assets/velocity.css', type: 'css', category: 'styles' },
			{ path: '/_styledelivery/third/tagify.mod.css', type: 'css', category: 'styles' },

			// Third party
			{ path: '/_jsdelivery/third_party/dom-purrify/purify.js', type: 'js', category: 'third-party' },
			{ path: '/_jsdelivery/vanilla/images/svgRender.js', type: 'js', category: 'images' },
			{ path: '/_jsdelivery/vanilla/service/quality.ts', type: 'js', category: 'service' }
		];

		// Process each asset
		for (const asset of assetPaths) {
			const fileName = asset.path.split('/').pop() || '';
			const name = fileName.replace(/\.[^/.]+$/, ''); // Remove extension

			assets.push({
				path: asset.path,
				name: fileName,
				displayName: name,
				type: asset.type,
				category: asset.category,
				searchTerms: this.generateSearchTerms(fileName, asset.path, asset.category),
				lastModified: Date.now(),
				size: null // Could be populated with actual file sizes
			});
		}

		return assets;
	}

	/**
	 * Build default search index with static data
	 */
	private async buildDefaultSearchIndex(): Promise<any[]> {
		return this.buildSearchIndex();
	}

	/**
	 * Generate search terms for an asset
	 */
	private generateSearchTerms(fileName: string, path: string, category: string): string[] {
		const terms = new Set<string>();

		// Add filename variations
		terms.add(fileName.toLowerCase());
		terms.add(fileName.replace(/\.[^/.]+$/, '').toLowerCase()); // without extension

		// Add path components
		path.split('/').forEach(part => {
			if (part && part !== '' && !part.startsWith('_')) {
				terms.add(part.toLowerCase());
			}
		});

		// Add category
		terms.add(category.toLowerCase());

		// Add common aliases
		const aliases: Record<string, string[]> = {
			'jwlimited': ['jw', 'limited', 'jwl'],
			'aurora': ['ui', 'interface', 'app'],
			'cloud': ['storage', 'backup'],
			'developer': ['dev', 'code', 'programming'],
			'editor': ['text', 'code', 'ide'],
			'email': ['mail', 'message', 'smtp'],
			'auth': ['authentication', 'login', 'security'],
			'draw': ['drawing', 'graphics', 'design'],
			'simply': ['simple', 'easy'],
			'web': ['website', 'internet'],
			'notification': ['alert', 'sound', 'notify'],
			'error': ['fail', 'problem', 'issue'],
			'background': ['bg', 'wallpaper', 'backdrop'],
			'gradient': ['color', 'blend'],
			'placeholder': ['dummy', 'sample', 'template']
		};

		// Apply aliases
		terms.forEach(term => {
			if (aliases[term]) {
				aliases[term].forEach(alias => terms.add(alias));
			}
		});

		return Array.from(terms);
	}

	/**
	 * Perform fuzzy search on assets
	 */
	private performAssetSearch(assets: any[], query: string, limit: number): any[] {
		if (!assets.length) return [];

		const searchQuery = query.toLowerCase().trim();
		const searchWords = searchQuery.split(/\s+/);

		// Score each asset
		const scoredAssets = assets.map(asset => {
			let score = 0;

			// Exact name match (highest score)
			if (asset.name.toLowerCase() === searchQuery) {
				score += 100;
			}

			// Name starts with query
			if (asset.name.toLowerCase().startsWith(searchQuery)) {
				score += 50;
			}

			// Name contains query
			if (asset.name.toLowerCase().includes(searchQuery)) {
				score += 25;
			}

			// Search terms matching
			searchWords.forEach(word => {
				asset.searchTerms.forEach((term: string) => {
					if (term === word) {
						score += 20; // Exact term match
					} else if (term.startsWith(word)) {
						score += 10; // Term starts with word
					} else if (term.includes(word)) {
						score += 5; // Term contains word
					}
				});
			});

			// Category bonus
			if (asset.category.toLowerCase().includes(searchQuery)) {
				score += 15;
			}

			// Path bonus
			if (asset.path.toLowerCase().includes(searchQuery)) {
				score += 10;
			}

			// Type bonus
			if (asset.type.toLowerCase().includes(searchQuery)) {
				score += 8;
			}

			return { ...asset, score };
		});

		// Filter and sort by score
		return scoredAssets
			.filter(asset => asset.score > 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, limit)
			.map(({ score, ...asset }) => asset); // Remove score from final result
	}

		/**
	 * Store search index in KV
	 */
	private async storeSearchIndex(index: any[]): Promise<void> {
		try {
			await this.env.CDN_METADATA.put('search:index', JSON.stringify(index), {
				expirationTtl: 86400 * 7 // 7 days
			});

			// Store metadata
			await this.env.CDN_METADATA.put('search:index:meta', JSON.stringify({
				lastUpdated: new Date().toISOString(),
				totalAssets: index.length,
				version: '1.0.0'
			}), {
				expirationTtl: 86400 * 7
			});
		} catch (error) {
			console.error('Failed to store search index:', error);
			throw error;
		}
	}

	/**
	 * Handle upload requests for both direct and database storage
	 */
	private async handleUploadRequest(request: Request, pathname: string): Promise<Response> {
		const corsHeaders = this.getCORSHeaders();

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		if (request.method !== 'POST') {
			return this.createErrorResponse(405, 'Method not allowed');
		}

		try {
			// Verify authentication for uploads
			const authResult = await this.verifyUserAuthentication(request);
			if (!authResult.success) {
				return this.createErrorResponse(401, 'Authentication required for uploads');
			}

			// Check user quota before upload
			const quotaCheck = await this.checkUserQuota(authResult.user);
			if (!quotaCheck.canUpload) {
				return this.createErrorResponse(403, quotaCheck.reason || 'Upload quota exceeded');
			}

			if (pathname === '/api/upload/direct') {
				return await this.handleDirectUpload(request, authResult.user);
			} else if (pathname === '/api/upload/database') {
				return await this.handleDatabaseUpload(request, authResult.user);
			} else {
				return this.createErrorResponse(404, 'Upload endpoint not found');
			}
		} catch (error) {
			console.error('Upload error:', error);
			return this.createErrorResponse(500, 'Upload failed: ' + (error as Error).message);
		}
	}

	/**
	 * Handle direct file upload to CDN
	 */
	private async handleDirectUpload(request: Request, user?: any): Promise<Response> {
		try {
			const formData = await request.formData();
			const file = formData.get('file') as File;
			let userPath = formData.get('path') as string;

			if (!file) {
				return this.createErrorResponse(400, 'No file provided');
			}

			// Validate file size (max 25MB for Cloudflare Workers)
			if (file.size > 25 * 1024 * 1024) {
				return this.createErrorResponse(400, 'File too large (max 25MB)');
			}

			// Store the file content and metadata
			const fileBuffer = await file.arrayBuffer();

			// Generate complex obfuscated path with file buffer
			const obfuscatedPath = await this.generateComplexAssetPath(file.name, fileBuffer, userPath);
			const fileName = file.name;
			const mimeType = file.type || this.getContentType(fileName);

			// Remove /object/live.m3u8 suffix for storage (store clean path)
			const cleanStoragePath = obfuscatedPath.replace('/object/live.m3u8', '');

			// Store file content in KV with metadata using clean path
			await this.env.CDN_CACHE.put(`asset:${cleanStoragePath}`, fileBuffer, {
				metadata: {
					contentType: mimeType,
					originalName: fileName,
					uploadMethod: 'direct',
					userPath: userPath,
					obfuscationLevel: 'high'
				}
			});

			// Store file metadata in KV for tracking using clean path
			const fileMetadata = {
				name: fileName,
				path: obfuscatedPath, // Keep the full path with suffix for display
				storagePath: cleanStoragePath, // Store the clean path for retrieval
				originalPath: userPath,
				size: file.size,
				type: mimeType,
				uploadedAt: new Date().toISOString(),
				method: 'direct',
				obfuscated: true,
				userId: user?.id,
				username: user?.username
			};

			await this.env.CDN_METADATA.put(`file:${cleanStoragePath}`, JSON.stringify(fileMetadata));

			// Track user uploads
			if (user?.id) {
				await this.trackUserUpload(user.id, fileMetadata);
			}

			console.log(`Direct upload: ${fileName} (${file.size} bytes) stored at obfuscated path ${obfuscatedPath}`);

			// Get updated user quota after upload
			const updatedUsage = await this.calculateUserUsage(user.id);
			const quotas = {
				user: { maxFiles: 100, maxStorage: 1024 * 1024 * 1024 },
				premium: { maxFiles: 1000, maxStorage: 10 * 1024 * 1024 * 1024 },
				admin: { maxFiles: -1, maxStorage: -1 }
			};
			const userQuota = quotas[user.role as keyof typeof quotas] || quotas.user;

			return new Response(JSON.stringify({
				success: true,
				file: {
					id: cleanStoragePath,
					name: fileName,
					originalName: fileName,
					path: obfuscatedPath,
					size: file.size,
					mimeType: mimeType,
					uploadedAt: new Date().toISOString(),
					userId: user.id,
					type: 'direct',
					method: 'direct'
				},
				quota: {
					used: {
						files: updatedUsage.files,
						storage: updatedUsage.storage
					},
					limits: {
						files: userQuota.maxFiles,
						storage: userQuota.maxStorage
					},
					remaining: {
						files: userQuota.maxFiles > 0 ? userQuota.maxFiles - updatedUsage.files : -1,
						storage: userQuota.maxStorage > 0 ? userQuota.maxStorage - updatedUsage.storage : -1
					}
				},
				service: 'JWLimited CDN',
				version: '2.1.0',
				message: `File ${fileName} uploaded successfully with enhanced metadata tracking`
			}), {
				headers: {
					'Content-Type': 'application/json',
					...this.getCORSHeaders()
				}
			});

		} catch (error) {
			console.error('Direct upload error:', error);
			return this.createErrorResponse(500, 'Direct upload failed');
		}
	}

	/**
	 * Handle database upload with D1 storage
	 */
	private async handleDatabaseUpload(request: Request, user?: any): Promise<Response> {
		try {
			const formData = await request.formData();
			const file = formData.get('file') as File;
			const name = formData.get('name') as string;
			const category = formData.get('category') as string;
			const description = formData.get('description') as string || '';
			const tags = formData.get('tags') as string || '';

			if (!file) {
				return this.createErrorResponse(400, 'No file provided');
			}

			if (!name) {
				return this.createErrorResponse(400, 'Asset name is required');
			}

			// Validate file size
			if (file.size > 25 * 1024 * 1024) {
				return this.createErrorResponse(400, 'File too large (max 25MB)');
			}

			// Ensure database table exists
			await this.initializeDatabase();

			// Get file buffer first
			const fileBuffer = await file.arrayBuffer();

			// Generate complex obfuscated path for database storage
			const userPath = `/assets/uploads/${category}/`;
			const obfuscatedPath = await this.generateComplexAssetPath(file.name, fileBuffer, userPath, 'database');
			const mimeType = file.type || this.getContentType(file.name);

			// Store file metadata in D1 database
			const assetId = crypto.randomUUID();
			const tagsArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

			await this.env.ASSETS_DB.prepare(`
				INSERT INTO assets (
					id, name, original_name, file_path, file_size, mime_type,
					category, description, tags, uploaded_at, search_terms, user_id
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`).bind(
				assetId,
				name,
				file.name,
				obfuscatedPath, // Keep the full path with suffix for display
				file.size,
				mimeType,
				category,
				description,
				JSON.stringify(tagsArray),
				new Date().toISOString(),
				JSON.stringify(this.generateSearchTermsForAsset(name, file.name, category, tagsArray)),
				user?.id
			).run();

			// Remove /object/live.m3u8 suffix for storage (store clean path)
			const cleanStoragePath = obfuscatedPath.replace('/object/live.m3u8', '');

			// Store file content in KV with obfuscated path using clean path
			await this.env.CDN_CACHE.put(`asset:${cleanStoragePath}`, fileBuffer, {
				metadata: {
					contentType: mimeType,
					originalName: file.name,
					assetId: assetId,
					obfuscationLevel: 'database',
					userCategory: category
				}
			});

			// Update search index
			await this.updateSearchIndexWithNewAsset({
				id: assetId,
				name: name,
				path: obfuscatedPath, // Keep the full path with suffix for display
				storagePath: cleanStoragePath, // Store the clean path for retrieval
				type: this.getAssetTypeFromMime(mimeType),
				category: category,
				size: file.size,
				lastModified: Date.now(),
				searchTerms: this.generateSearchTermsForAsset(name, file.name, category, tagsArray)
			});

			console.log(`Database upload: ${name} (${file.size} bytes) stored as obfuscated ${obfuscatedPath}`);

			// Get updated user quota after upload
			const updatedUsage = await this.calculateUserUsage(user.id);
			const quotas = {
				user: { maxFiles: 100, maxStorage: 1024 * 1024 * 1024 },
				premium: { maxFiles: 1000, maxStorage: 10 * 1024 * 1024 * 1024 },
				admin: { maxFiles: -1, maxStorage: -1 }
			};
			const userQuota = quotas[user.role as keyof typeof quotas] || quotas.user;

			return new Response(JSON.stringify({
				success: true,
				file: {
					id: assetId,
					name: name,
					originalName: file.name,
					path: obfuscatedPath,
					size: file.size,
					mimeType: mimeType,
					category: category,
					description: description,
					tags: tagsArray,
					uploadedAt: new Date().toISOString(),
					userId: user.id,
					type: 'database',
					method: 'database'
				},
				quota: {
					used: {
						files: updatedUsage.files,
						storage: updatedUsage.storage
					},
					limits: {
						files: userQuota.maxFiles,
						storage: userQuota.maxStorage
					},
					remaining: {
						files: userQuota.maxFiles > 0 ? userQuota.maxFiles - updatedUsage.files : -1,
						storage: userQuota.maxStorage > 0 ? userQuota.maxStorage - updatedUsage.storage : -1
					}
				},
				service: 'JWLimited CDN',
				version: '2.1.0',
				message: `Asset ${name} uploaded successfully to database with enhanced metadata`
			}), {
				headers: {
					'Content-Type': 'application/json',
					...this.getCORSHeaders()
				}
			});

		} catch (error) {
			console.error('Database upload error:', error);
			return this.createErrorResponse(500, 'Database upload failed');
		}
	}

	/**
	 * Initialize D1 database tables
	 */
	private async initializeDatabase(): Promise<void> {
		try {
			await this.env.ASSETS_DB.prepare(`
				CREATE TABLE IF NOT EXISTS assets (
					id TEXT PRIMARY KEY,
					name TEXT NOT NULL,
					original_name TEXT NOT NULL,
					file_path TEXT NOT NULL UNIQUE,
					file_size INTEGER NOT NULL,
					mime_type TEXT NOT NULL,
					category TEXT NOT NULL,
					description TEXT,
					tags TEXT, -- JSON array
					uploaded_at TEXT NOT NULL,
					search_terms TEXT, -- JSON array
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					user_id TEXT
				)
			`).run();

			// Create indexes for better search performance
			await this.env.ASSETS_DB.prepare(`
				CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category)
			`).run();

			await this.env.ASSETS_DB.prepare(`
				CREATE INDEX IF NOT EXISTS idx_assets_name ON assets(name)
			`).run();

		} catch (error) {
			console.error('Database initialization error:', error);
			// Don't throw here - database might already exist
		}
	}

	/**
	 * Generate search terms for uploaded asset
	 */
	private generateSearchTermsForAsset(name: string, fileName: string, category: string, tags: string[]): string[] {
		const terms = new Set<string>();

		// Add name variations
		terms.add(name.toLowerCase());
		terms.add(fileName.toLowerCase());
		terms.add(fileName.replace(/\.[^/.]+$/, '').toLowerCase());

		// Add category
		terms.add(category.toLowerCase());

		// Add tags
		tags.forEach(tag => terms.add(tag.toLowerCase()));

		// Add common word variations
		name.split(/[\s_-]+/).forEach(word => {
			if (word.length > 2) {
				terms.add(word.toLowerCase());
			}
		});

		return Array.from(terms);
	}

	/**
	 * Get asset type from MIME type
	 */
	private getAssetTypeFromMime(mimeType: string): string {
		if (mimeType.startsWith('image/')) return 'image';
		if (mimeType.startsWith('video/')) return 'video';
		if (mimeType.startsWith('audio/')) return 'audio';
		if (mimeType.includes('css')) return 'css';
		if (mimeType.includes('javascript')) return 'js';
		if (mimeType.includes('json')) return 'json';
		if (mimeType.includes('html')) return 'html';
		if (mimeType.startsWith('font/') || mimeType.includes('woff')) return 'font';
		return 'document';
	}

	/**
	 * Update search index with new asset
	 */
	private async updateSearchIndexWithNewAsset(asset: any): Promise<void> {
		try {
			const currentIndex = await this.getSearchIndex();
			currentIndex.push(asset);
			await this.storeSearchIndex(currentIndex);
		} catch (error) {
			console.error('Failed to update search index:', error);
		}
	}

		/**
	 * Generate complex obfuscated asset path based on deep file metadata analysis
	 */
	private async generateComplexAssetPath(originalFileName: string, fileBuffer?: ArrayBuffer, userPath?: string, uploadType: string = 'direct'): Promise<string> {
		// Extract file extension and analyze file metadata
		const fileExtension = originalFileName.split('.').pop()?.toLowerCase() || '';
		const fileMetadata = await this.analyzeFileMetadata(originalFileName, fileBuffer, fileExtension);

		// Generate multiple layers of obfuscation with metadata-based complexity
		const timestamp = Date.now();
		const randomSeed = Math.random().toString(36).substring(2);
		const metadataComplexity = this.calculateMetadataComplexity(fileMetadata);

		// Create multiple hash sources with varying complexity
		const primaryHashSource = `${originalFileName}${timestamp}${randomSeed}${uploadType}${userPath || ''}`;
		const metadataHashSource = `${fileMetadata.nameComplexity}${fileMetadata.sizeCategory}${fileMetadata.typeCategory}${fileMetadata.entropyLevel}`;
		const combinedHashSource = `${primaryHashSource}${metadataHashSource}${fileMetadata.checksum}`;

		// Generate multiple cryptographic hashes
		const [primaryHash, metadataHash, combinedHash] = await Promise.all([
			this.generateCryptoHash(primaryHashSource, 'SHA-256'),
			this.generateCryptoHash(metadataHashSource, 'SHA-1'),
			this.generateCryptoHash(combinedHashSource, 'SHA-512')
		]);

		// Determine path complexity based on file characteristics
		const pathComplexity = Math.min(Math.max(metadataComplexity, 3), 8); // 3-8 directory levels
		const segmentCount = Math.min(Math.max(fileMetadata.nameComplexity + 3, 6), 12); // 6-12 filename segments

		// Generate metadata-driven segments with varying algorithms
		const segments = await this.generateMetadataDrivenSegments(
			fileMetadata,
			primaryHash,
			metadataHash,
			combinedHash,
			timestamp,
			randomSeed,
			segmentCount
		);

		// Create deeply nested directory structure based on file characteristics
		const directories = await this.generateMetadataDirectoryStructure(
			fileMetadata,
			primaryHash,
			metadataHash,
			pathComplexity,
			uploadType
		);

		// Generate ultra-complex filename with metadata encoding
		const obfuscatedName = this.assembleMetadataObfuscatedFilename(
			segments,
			fileMetadata,
			combinedHash
		);

		// Detect continent from request (or default to 'na' for North America)
		const continent = this.detectContinent();

		// Construct final path with /prod/ prefix, continent, and streaming endpoint
		const finalPath = `/prod/${continent}/${directories.join('/')}/${obfuscatedName}${this.obfuscateFileExtension(fileExtension, fileMetadata)}/object/live.m3u8`;

		return finalPath;
	}

	/**
	 * Obfuscate timestamp using base conversion and scrambling
	 */
	private obfuscateTimestamp(timestamp: number): string {
		// Convert to base 36 and scramble
		const base36 = timestamp.toString(36);
		const scrambled = base36.split('').reverse().join('');
		// Add random padding
		const padding = Math.random().toString(36).substring(2, 6);
		return `${scrambled}${padding}`;
	}

	/**
	 * Generate random alphanumeric segment with specific patterns
	 */
	private generateRandomSegment(length: number): string {
		const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
		let result = '';
		for (let i = 0; i < length; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return result;
	}

	/**
	 * Generate complex encoded segment from filename and seed
	 */
	private generateComplexSegment(filename: string, seed: string): string {
		// Create complex encoding using filename characteristics
		const nameHash = filename.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
		const seedHash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
		const combined = (nameHash * seedHash).toString(36);

		// Add scrambling and padding
		const scrambled = combined.split('').sort(() => Math.random() - 0.5).join('');
		return scrambled.substring(0, 10) + this.generateRandomSegment(4);
	}

	/**
	 * Analyze file metadata for complex obfuscation
	 */
	private async analyzeFileMetadata(fileName: string, fileBuffer?: ArrayBuffer, extension?: string): Promise<any> {
		const metadata: any = {
			nameComplexity: this.calculateNameComplexity(fileName),
			sizeCategory: fileBuffer ? this.categorizeSizeComplexity(fileBuffer.byteLength) : 'unknown',
			typeCategory: this.categorizeFileType(extension || ''),
			entropyLevel: this.calculateNameEntropy(fileName),
			checksum: '',
			hasSpecialChars: /[^a-zA-Z0-9.-]/.test(fileName),
			wordCount: fileName.split(/[^a-zA-Z0-9]+/).filter(w => w.length > 0).length,
			digitRatio: (fileName.match(/\d/g) || []).length / fileName.length,
			caseVariations: this.analyzeCaseVariations(fileName)
		};

		// Generate file checksum if buffer is available
		if (fileBuffer) {
			const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			metadata.checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
		} else {
			// Fallback checksum from filename
			metadata.checksum = this.generateFallbackChecksum(fileName);
		}

		return metadata;
	}

	/**
	 * Calculate metadata complexity score
	 */
	private calculateMetadataComplexity(metadata: any): number {
		let complexity = 1;

		// Name complexity factor
		complexity += Math.min(metadata.nameComplexity, 5);

		// Size category factor
		const sizeFactors: Record<string, number> = {
			'tiny': 1, 'small': 2, 'medium': 3, 'large': 4, 'huge': 5, 'unknown': 2
		};
		complexity += sizeFactors[metadata.sizeCategory] || 2;

		// Type category factor
		const typeFactors: Record<string, number> = {
			'binary': 3, 'media': 4, 'document': 2, 'code': 3, 'archive': 5, 'unknown': 2
		};
		complexity += typeFactors[metadata.typeCategory] || 2;

		// Additional factors
		if (metadata.hasSpecialChars) complexity += 2;
		if (metadata.wordCount > 3) complexity += 1;
		if (metadata.digitRatio > 0.3) complexity += 1;
		if (metadata.entropyLevel > 3) complexity += 2;

		return Math.min(complexity, 10); // Cap at 10
	}

	/**
	 * Generate cryptographic hash
	 */
	private async generateCryptoHash(input: string, algorithm: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(input);
		const hashBuffer = await crypto.subtle.digest(algorithm, data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	}

	/**
	 * Generate metadata-driven segments
	 */
	private async generateMetadataDrivenSegments(
		metadata: any,
		primaryHash: string,
		metadataHash: string,
		combinedHash: string,
		timestamp: number,
		randomSeed: string,
		segmentCount: number
	): Promise<string[]> {
		const segments: string[] = [];

		// Primary segments based on different hash algorithms
		segments.push(primaryHash.substring(0, 8)); // SHA-256 start
		segments.push(metadataHash.substring(0, 6)); // SHA-1 start
		segments.push(combinedHash.substring(0, 12)); // SHA-512 start

		// Metadata-encoded segments with Serix service identification
		segments.push(this.encodeMetadataToSegment(metadata, 'nameComplexity'));
		segments.push(this.encodeSerixServiceSegment('v2024'));
		segments.push(this.encodeMetadataToSegment(metadata, 'sizeCategory'));
		segments.push(this.encodeSerixServiceSegment('serix'));
		segments.push(this.encodeMetadataToSegment(metadata, 'typeCategory'));

		// Timestamp variations
		segments.push(this.obfuscateTimestamp(timestamp));
		segments.push(this.obfuscateTimestamp(timestamp + metadata.nameComplexity * 1000));

		// Hash-based segments from different positions
		segments.push(primaryHash.substring(16, 24));
		segments.push(metadataHash.substring(8, 14));
		segments.push(combinedHash.substring(32, 44));

		// Random segments with metadata influence
		for (let i = segments.length; i < segmentCount; i++) {
			const influencedSeed = randomSeed + metadata.checksum.substring(i % metadata.checksum.length, (i % metadata.checksum.length) + 2);
			segments.push(this.generateInfluencedRandomSegment(influencedSeed, 6 + (i % 4)));
		}

		return segments.slice(0, segmentCount);
	}

	/**
	 * Generate metadata-based directory structure
	 */
	private async generateMetadataDirectoryStructure(
		metadata: any,
		primaryHash: string,
		metadataHash: string,
		pathComplexity: number,
		uploadType: string
	): Promise<string[]> {
		const directories: string[] = [];

		// Root obfuscated directory based on file type
		directories.push(this.generateAdvancedObfuscatedDirectory(metadata.typeCategory, primaryHash.substring(0, 4)));

		// Upload type directory with metadata influence
		directories.push(this.generateAdvancedObfuscatedDirectory(uploadType, metadataHash.substring(0, 4)));

		// Size-based directory
		directories.push(this.generateAdvancedObfuscatedDirectory(metadata.sizeCategory, primaryHash.substring(8, 12)));

		// Complexity-based nested directories
		for (let i = 3; i < pathComplexity; i++) {
			const hashOffset = (i * 4) % (primaryHash.length - 4);
			const metaOffset = (i * 3) % (metadataHash.length - 3);
			const dirSeed = `${metadata.entropyLevel}${i}${metadata.wordCount}`;
			const hashSegment = primaryHash.substring(hashOffset, hashOffset + 4);
			const metaSegment = metadataHash.substring(metaOffset, metaOffset + 3);

			directories.push(this.generateAdvancedObfuscatedDirectory(dirSeed, hashSegment + metaSegment));
		}

		return directories;
	}

	/**
	 * Assemble metadata-obfuscated filename
	 */
	private assembleMetadataObfuscatedFilename(
		segments: string[],
		metadata: any,
		combinedHash: string
	): string {
		// Validate inputs
		if (!segments || segments.length === 0) {
			segments = ['fallback', 'segment'];
		}
		if (!metadata) {
			metadata = { nameComplexity: 1, caseVariations: 'none', checksum: 'default' };
		}
		if (!combinedHash) {
			combinedHash = 'fallbackhash123456789abcdef';
		}

		// Arrange segments based on metadata characteristics
		const arrangement = this.calculateSegmentArrangement(metadata);
		const arrangedSegments: string[] = [];

		// Apply arrangement pattern
		for (let i = 0; i < segments.length; i++) {
			const arrangedIndex = (i + arrangement.offset) % segments.length;
			let segment = segments[arrangedIndex];

			// Ensure segment is a string
			if (!segment || typeof segment !== 'string') {
				segment = `seg${i}`;
			}

			// Apply metadata-based transformations
			if (arrangement.transforms[i % arrangement.transforms.length] === 'reverse') {
				segment = segment.split('').reverse().join('');
			} else if (arrangement.transforms[i % arrangement.transforms.length] === 'case') {
				segment = this.applyCaseTransformation(segment, metadata.caseVariations);
			} else if (arrangement.transforms[i % arrangement.transforms.length] === 'rotate') {
				segment = this.rotateSegment(segment, metadata.nameComplexity);
			}

			arrangedSegments.push(segment);
		}

		// Add checksum verification segments
		const checksumSegments = this.generateChecksumSegments(metadata.checksum || 'defaultchecksum', combinedHash);
		arrangedSegments.splice(Math.floor(arrangedSegments.length / 2), 0, ...checksumSegments);

		return arrangedSegments.join('');
	}

	/**
	 * Obfuscate file extension based on metadata (no period prefix)
	 */
	private obfuscateFileExtension(extension: string, metadata: any): string {
		if (!extension) return 'dat';

		// Create obfuscated extension based on metadata
		const extHash = extension.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
		const metaInfluence = metadata.nameComplexity + metadata.entropyLevel;
		const obfuscatedBase = (extHash * metaInfluence).toString(36);

		// Combine with original extension in complex way (no period)
		const parts = [
			obfuscatedBase.substring(0, 2),
			extension.substring(0, Math.min(extension.length, 2)),
			obfuscatedBase.substring(2, 4) || 'x'
		];

		return parts.join('').toLowerCase();
	}

		/**
	 * Detect continent based on Cloudflare headers or default to North America
	 */
	private detectContinent(request?: Request): string {
		if (request?.cf?.continent) {
			return request.cf.continent.toString().toLowerCase();
		}

		return 'na';
	}

	/**
	 * Calculate name complexity
	 */
	private calculateNameComplexity(fileName: string): number {
		let complexity = 0;

		complexity += fileName.length > 20 ? 3 : fileName.length > 10 ? 2 : 1;
		complexity += (fileName.match(/[A-Z]/g) || []).length > 0 ? 1 : 0;
		complexity += (fileName.match(/[0-9]/g) || []).length > 0 ? 1 : 0;
		complexity += (fileName.match(/[^a-zA-Z0-9.-]/g) || []).length > 0 ? 2 : 0;
		complexity += fileName.split(/[^a-zA-Z0-9]+/).filter(w => w.length > 0).length > 2 ? 1 : 0;

		return Math.min(complexity, 8);
	}

	/**
	 * Categorize size complexity
	 */
	private categorizeSizeComplexity(sizeBytes: number): string {
		if (sizeBytes < 1024) return 'tiny';
		if (sizeBytes < 1024 * 100) return 'small';
		if (sizeBytes < 1024 * 1024) return 'medium';
		if (sizeBytes < 1024 * 1024 * 10) return 'large';
		return 'huge';
	}

	/**
	 * Categorize file type
	 */
	private categorizeFileType(extension: string): string {
		const ext = extension.toLowerCase();

		if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'mp4', 'mp3', 'wav'].includes(ext)) return 'media';
		if (['exe', 'dll', 'so', 'bin', 'dat'].includes(ext)) return 'binary';
		if (['js', 'ts', 'css', 'html', 'json', 'xml'].includes(ext)) return 'code';
		if (['pdf', 'doc', 'txt', 'md'].includes(ext)) return 'document';
		if (['zip', 'rar', 'tar', 'gz'].includes(ext)) return 'archive';

		return 'unknown';
	}

	/**
	 * Calculate name entropy
	 */
	private calculateNameEntropy(fileName: string): number {
		const charFreq: Record<string, number> = {};
		for (const char of fileName.toLowerCase()) {
			charFreq[char] = (charFreq[char] || 0) + 1;
		}

		let entropy = 0;
		const length = fileName.length;
		for (const freq of Object.values(charFreq)) {
			const p = freq / length;
			entropy -= p * Math.log2(p);
		}

		return Math.round(entropy * 10) / 10;
	}

	/**
	 * Analyze case variations
	 */
	private analyzeCaseVariations(fileName: string): string {
		const hasUpper = /[A-Z]/.test(fileName);
		const hasLower = /[a-z]/.test(fileName);

		if (hasUpper && hasLower) return 'mixed';
		if (hasUpper) return 'upper';
		if (hasLower) return 'lower';
		return 'none';
	}

	/**
	 * Generate fallback checksum
	 */
	private generateFallbackChecksum(fileName: string): string {
		let hash = 0;
		for (let i = 0; i < fileName.length; i++) {
			const char = fileName.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(16).padStart(8, '0');
	}

	/**
	 * Encode metadata to segment
	 */
	private encodeMetadataToSegment(metadata: any, key: string): string {
		const value = metadata[key];
		let encoded = '';

		if (typeof value === 'number') {
			encoded = value.toString(36).padStart(3, '0');
		} else if (typeof value === 'string') {
			encoded = value.split('').reduce((acc, char) => acc + char.charCodeAt(0).toString(36), '').substring(0, 6);
		} else {
			encoded = 'unk000';
		}

		// Add obfuscation layer
		const scrambled = encoded.split('').sort(() => Math.random() - 0.5).join('');
		return scrambled + this.generateRandomSegment(2);
	}

	/**
	 * Encode Serix service identification segment
	 */
	private encodeSerixServiceSegment(identifier: string): string {
		// Create service-specific encoding
		const serviceHash = identifier.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
		const base36 = serviceHash.toString(36);

		// Add Serix-specific patterns
		const serixPatterns = ['sx', 'rx', 'ix', 'er', 'se', 'ri'];
		const pattern = serixPatterns[serviceHash % serixPatterns.length];

		// Combine with timestamp for uniqueness
		const timeSegment = (Date.now() % 100000).toString(36);

		return pattern + base36 + timeSegment;
	}

	/**
	 * Generate influenced random segment
	 */
	private generateInfluencedRandomSegment(seed: string, length: number): string {
		const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
		let result = '';
		let seedHash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

		for (let i = 0; i < length; i++) {
			seedHash = (seedHash * 9301 + 49297) % 233280; // Linear congruential generator
			result += chars.charAt(seedHash % chars.length);
		}

		return result;
	}

	/**
	 * Generate advanced obfuscated directory with Serix branding
	 */
	private generateAdvancedObfuscatedDirectory(input: string, hashSegment: string): string {
		const hash = input.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
		const base = hash.toString(36);

		const prefixes = ['serix', 'sys', 'lib', 'bin', 'opt', 'var', 'tmp', 'usr', 'etc', 'proc', 'dev', 'mnt', 'srv'];
		const suffixes = ['v2', 'v3', 'v4', 'cache', 'data', 'store', 'repo', 'arch', 'dist', 'build', 'core', 'temp', 'meta', 'conf', 'log'];
		const middle = ['x', 'z', 'q', 'k', 'j', 'w', 'v', 'f', 'g', 'h', 'p', 'r', 's', 'e', 'i'];

		const prefix = prefixes[hash % prefixes.length];
		const suffix = suffixes[(hash * 7) % suffixes.length];
		const mid = middle[(hash * 13) % middle.length];

		return `${prefix}${hashSegment}${mid}${base}${suffix}`;
	}

	/**
	 * Calculate segment arrangement
	 */
	private calculateSegmentArrangement(metadata: any): any {
		// Validate metadata
		if (!metadata) {
			metadata = { nameComplexity: 1, entropyLevel: 1 };
		}

		const nameComplexity = metadata.nameComplexity || 1;
		const entropyLevel = metadata.entropyLevel || 1;
		const complexity = nameComplexity + entropyLevel;

		return {
			offset: complexity % 7,
			transforms: ['normal', 'reverse', 'case', 'rotate'].slice(0, (complexity % 4) + 1)
		};
	}

	/**
	 * Apply case transformation
	 */
	private applyCaseTransformation(segment: string, caseVariation: string): string {
		switch (caseVariation) {
			case 'mixed':
				return segment.split('').map((char, i) => i % 2 === 0 ? char.toUpperCase() : char.toLowerCase()).join('');
			case 'upper':
				return segment.toUpperCase();
			case 'lower':
				return segment.toLowerCase();
			default:
				return segment;
		}
	}

	/**
	 * Rotate segment characters
	 */
	private rotateSegment(segment: string, rotateBy: number): string {
		if (!segment || segment.length === 0) {
			return 'default';
		}
		if (!rotateBy || rotateBy === 0) {
			return segment;
		}

		const rotation = rotateBy % segment.length;
		return segment.substring(rotation) + segment.substring(0, rotation);
	}

	/**
	 * Generate checksum segments
	 */
	private generateChecksumSegments(checksum: string, combinedHash: string): string[] {
		const segments = [];

		// Validate inputs
		if (!checksum || typeof checksum !== 'string') {
			checksum = 'defaultchecksum';
		}
		if (!combinedHash || typeof combinedHash !== 'string') {
			combinedHash = 'defaulthash123456789abcdef';
		}

		// Split checksum into parts and combine with hash
		for (let i = 0; i < Math.min(checksum.length, 8); i += 2) {
			const checksumPart = checksum.substring(i, i + 2);
			const hashPart = combinedHash.substring(i * 4, i * 4 + 3) || 'def';
			segments.push(checksumPart + hashPart);
		}

		return segments.slice(0, 2); // Limit to 2 checksum segments
	}

	/**
	 * Generate obfuscated directory names with Serix branding
	 */
	private generateObfuscatedDirectory(input: string): string {
		// Create hash-based directory name
		const hash = input.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
		const base = hash.toString(36);

		// Add prefixes and suffixes with Serix branding
		const prefixes = ['serix', 'sys', 'lib', 'bin', 'opt', 'var', 'tmp', 'usr', 'etc'];
		const suffixes = ['v2', 'v3', 'v4', 'cache', 'data', 'store', 'repo', 'arch', 'dist', 'build', 'core'];

		const prefix = prefixes[hash % prefixes.length];
		const suffix = suffixes[(hash * 7) % suffixes.length];

		return `${prefix}${base}${suffix}`;
	}

	/**
	 * Check if a path is an obfuscated asset by looking for it in KV storage
	 */
	private async isObfuscatedAssetPath(pathname: string): Promise<boolean> {
		try {
			// Clean the pathname by removing the /object/live.m3u8 suffix if present
			let cleanPathname = pathname;
			if (pathname.endsWith('/object/live.m3u8')) {
				cleanPathname = pathname.replace('/object/live.m3u8', '');
			}

			// Check if the asset exists in KV storage using cleaned path
			const assetData = await this.env.CDN_CACHE.get(`asset:${cleanPathname}`);
			return assetData !== null;
		} catch (error) {
			console.error('Error checking obfuscated asset path:', error);
			return false;
		}
	}

	/**
	 * Create standardized error response
	 */
	private createErrorResponse(status: number, message: string): Response {
		return new Response(JSON.stringify({
			error: message,
			status,
			timestamp: new Date().toISOString()
		}), {
			status,
			headers: {
				'Content-Type': 'application/json',
				...this.getCORSHeaders()
			}
		});
	}
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const cdnService = new CDNService(env);
		return await cdnService.handleRequest(request);
	},
} satisfies ExportedHandler<Env>;
