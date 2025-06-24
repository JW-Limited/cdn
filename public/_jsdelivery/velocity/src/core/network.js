/**
 * VelocityNetwork - Enhanced networking utilities for VelocityJS
 * Provides advanced HTTP client with caching, retries, and offline support
 */

export class VelocityNetwork {
    constructor(logger) {
        this.logger = logger;
        this.cache = new Map();
        this.interceptors = {
            request: [],
            response: []
        };
        this.config = {
            baseURL: '',
            timeout: 30000,
            retries: 3,
            retryDelay: 1000,
            enableCache: true,
            enableRetry: true,
            enableOffline: true
        };
        
        // Enhanced features
        this.requestQueue = [];
        this.abortControllers = new Map();
        this.rateLimiters = new Map();
        this.mockResponses = new Map();
        this.offlineQueue = [];
        this.activeRequests = new Set();
        this.requestMetrics = new Map();
        this.authTokens = new Map();
        
        // Offline support
        this.isOnline = navigator.onLine;
        this.offlineQueue = [];
        this.syncStrategies = new Map();
        
        // Request tracking
        this.activeRequests = new Set();
        this.requestMetrics = new Map();
        
        this.init();
    }

    /**
     * Initialize network module
     */
    init() {
        this.setupOnlineOfflineHandlers();
        this.setupDefaultInterceptors();
        this.logger.info('VelocityNetwork initialized');
    }

    /**
     * Setup online/offline event handlers
     */
    setupOnlineOfflineHandlers() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.logger.info('Network: Back online');
            this.processOfflineQueue();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.logger.warn('Network: Gone offline');
        });
    }

    /**
     * Setup default interceptors
     */
    setupDefaultInterceptors() {
        // Request interceptor for auth tokens
        this.addRequestInterceptor((config) => {
            const authToken = this.getAuthToken(config.url);
            if (authToken) {
                config.headers = config.headers || {};
                config.headers.Authorization = `Bearer ${authToken}`;
            }
            return config;
        });

        // Response interceptor for error handling
        this.addResponseInterceptor(
            (response) => response,
            (error) => {
                this.logger.error('Network request failed:', {
                    url: error.config?.url,
                    status: error.status,
                    message: error.message
                });
                return Promise.reject(error);
            }
        );
    }

    /**
     * Main request method with enhanced features
     */
    async request(url, options = {}) {
        const config = this.mergeConfig(url, options);
        const requestId = this.generateRequestId();
        
        try {
            // Start request tracking
            this.startRequestTracking(requestId, config);
            
            // Check cache first
            if (config.cache !== false && this.config.enableCache) {
                const cached = this.getFromCache(config);
                if (cached) {
                    this.logger.debug('Cache hit:', config.url);
                    return cached;
                }
            }
            
            // Check rate limiting
            if (await this.checkRateLimit(config.url)) {
                throw new Error('Rate limit exceeded');
            }
            
            // Handle offline requests
            if (!this.isOnline && config.offline !== false) {
                return this.handleOfflineRequest(config);
            }
            
            // Execute request with retry logic
            const response = await this.executeRequestWithRetry(config, requestId);
            
            // Cache successful responses
            if (config.cache !== false && response.ok) {
                this.addToCache(config, response.clone());
            }
            
            return response;
            
        } catch (error) {
            this.handleRequestError(error, config, requestId);
            throw error;
        } finally {
            this.endRequestTracking(requestId);
        }
    }

    /**
     * Execute request with retry logic
     */
    async executeRequestWithRetry(config, requestId) {
        let lastError;
        const maxRetries = config.retries ?? this.config.retries;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Apply request interceptors
                const processedConfig = await this.applyRequestInterceptors(config);
                
                // Create abort controller
                const abortController = new AbortController();
                this.abortControllers.set(requestId, abortController);
                processedConfig.signal = abortController.signal;
                
                // Set timeout
                const timeoutId = setTimeout(() => {
                    abortController.abort();
                }, processedConfig.timeout || this.config.timeout);
                
                try {
                    // Check for mock response
                    const mockResponse = this.getMockResponse(processedConfig.url, processedConfig.method);
                    if (mockResponse) {
                        this.logger.debug('Using mock response:', processedConfig.url);
                        clearTimeout(timeoutId);
                        return mockResponse;
                    }
                    
                    // Make actual request
                    const response = await fetch(processedConfig.url, processedConfig);
                    clearTimeout(timeoutId);
                    
                    // Apply response interceptors
                    const processedResponse = await this.applyResponseInterceptors(response, processedConfig);
                    
                    if (!processedResponse.ok && this.shouldRetry(processedResponse.status, attempt, maxRetries)) {
                        throw new Error(`HTTP ${processedResponse.status}: ${processedResponse.statusText}`);
                    }
                    
                    return processedResponse;
                    
                } finally {
                    clearTimeout(timeoutId);
                    this.abortControllers.delete(requestId);
                }
                
            } catch (error) {
                lastError = error;
                
                if (attempt < maxRetries && this.shouldRetry(error, attempt, maxRetries)) {
                    const delay = this.calculateRetryDelay(attempt, config.retryDelay);
                    this.logger.debug(`Retrying request (${attempt + 1}/${maxRetries}) after ${delay}ms:`, config.url);
                    await this.sleep(delay);
                    continue;
                }
                
                break;
            }
        }
        
        throw lastError;
    }

    /**
     * HTTP method shortcuts with enhanced options
     */
    async get(url, options = {}) {
        return this.request(url, { ...options, method: 'GET' });
    }

    async post(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'POST',
            body: this.serializeBody(data, options.headers)
        });
    }

    async put(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'PUT',
            body: this.serializeBody(data, options.headers)
        });
    }

    async patch(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'PATCH',
            body: this.serializeBody(data, options.headers)
        });
    }

    async delete(url, options = {}) {
        return this.request(url, { ...options, method: 'DELETE' });
    }

    /**
     * Advanced request methods
     */
    async upload(url, formData, options = {}) {
        const config = {
            ...options,
            method: 'POST',
            body: formData,
            onUploadProgress: options.onProgress
        };

        // Remove content-type header to let browser set it with boundary
        if (config.headers && config.headers['Content-Type']) {
            delete config.headers['Content-Type'];
        }

        return this.request(url, config);
    }

    async download(url, options = {}) {
        const response = await this.request(url, {
            ...options,
            responseType: 'blob'
        });

        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = options.filename || this.extractFilename(url);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(downloadUrl);
        return response;
    }

    /**
     * Parallel requests
     */
    async all(requests) {
        return Promise.all(requests.map(req => {
            if (typeof req === 'string') {
                return this.get(req);
            } else if (Array.isArray(req)) {
                return this.request(req[0], req[1]);
            } else {
                return this.request(req.url, req);
            }
        }));
    }

    /**
     * Sequential requests
     */
    async series(requests) {
        const results = [];
        
        for (const req of requests) {
            try {
                let result;
                if (typeof req === 'string') {
                    result = await this.get(req);
                } else if (Array.isArray(req)) {
                    result = await this.request(req[0], req[1]);
                } else {
                    result = await this.request(req.url, req);
                }
                results.push({ success: true, data: result });
            } catch (error) {
                results.push({ success: false, error });
                if (req.stopOnError !== false) {
                    break;
                }
            }
        }
        
        return results;
    }

    /**
     * Request caching system
     */
    getFromCache(config) {
        const cacheKey = this.generateCacheKey(config);
        const cached = this.cache.get(cacheKey);
        
        if (cached && !this.isCacheExpired(cached)) {
            return cached.response;
        }
        
        if (cached) {
            this.cache.delete(cacheKey);
        }
        
        return null;
    }

    addToCache(config, response) {
        const cacheKey = this.generateCacheKey(config);
        const ttl = config.cacheTTL || 300000; // 5 minutes default
        
        this.cache.set(cacheKey, {
            response,
            timestamp: Date.now(),
            ttl
        });
        
        // Clean up old cache entries
        this.cleanupCache();
    }

    generateCacheKey(config) {
        const key = `${config.method || 'GET'}:${config.url}`;
        if (config.body) {
            const bodyHash = this.hashString(JSON.stringify(config.body));
            return `${key}:${bodyHash}`;
        }
        return key;
    }

    isCacheExpired(cached) {
        return Date.now() - cached.timestamp > cached.ttl;
    }

    cleanupCache() {
        for (const [key, cached] of this.cache.entries()) {
            if (this.isCacheExpired(cached)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Rate limiting
     */
    async checkRateLimit(url) {
        const limiter = this.rateLimiters.get(url);
        if (!limiter) return false;
        
        const now = Date.now();
        const timeWindow = limiter.window || 60000; // 1 minute default
        
        // Clean old requests
        limiter.requests = limiter.requests.filter(time => now - time < timeWindow);
        
        return limiter.requests.length >= limiter.limit;
    }

    setRateLimit(url, limit, window = 60000) {
        this.rateLimiters.set(url, {
            limit,
            window,
            requests: []
        });
    }

    /**
     * Authentication token management
     */
    setAuthToken(pattern, token) {
        this.authTokens.set(pattern, token);
    }

    getAuthToken(url) {
        for (const [pattern, token] of this.authTokens) {
            if (url.includes(pattern)) {
                return token;
            }
        }
        return null;
    }

    /**
     * Request interceptors
     */
    addRequestInterceptor(interceptor) {
        this.interceptors.request.push(interceptor);
    }

    addResponseInterceptor(onSuccess, onError) {
        this.interceptors.response.push({ onSuccess, onError });
    }

    async applyRequestInterceptors(config) {
        let processedConfig = { ...config };
        
        for (const interceptor of this.interceptors.request) {
            try {
                processedConfig = await interceptor(processedConfig) || processedConfig;
            } catch (error) {
                this.logger.error('Request interceptor error:', error);
            }
        }
        
        return processedConfig;
    }

    async applyResponseInterceptors(response, config) {
        let processedResponse = response;
        
        for (const interceptor of this.interceptors.response) {
            try {
                if (response.ok && interceptor.onSuccess) {
                    processedResponse = await interceptor.onSuccess(processedResponse, config) || processedResponse;
                } else if (!response.ok && interceptor.onError) {
                    processedResponse = await interceptor.onError(processedResponse, config) || processedResponse;
                }
            } catch (error) {
                this.logger.error('Response interceptor error:', error);
            }
        }
        
        return processedResponse;
    }

    /**
     * Offline support
     */
    handleOfflineRequest(config) {
        if (config.offline === false) {
            throw new Error('Request failed: Network offline');
        }
        
        // Add to offline queue
        return new Promise((resolve, reject) => {
            this.offlineQueue.push({
                config,
                resolve,
                reject,
                timestamp: Date.now()
            });
            
            this.logger.info('Request queued for offline sync:', config.url);
        });
    }

    async processOfflineQueue() {
        this.logger.info(`Processing ${this.offlineQueue.length} offline requests`);
        
        while (this.offlineQueue.length > 0) {
            const queuedRequest = this.offlineQueue.shift();
            
            try {
                const response = await this.executeRequestWithRetry(queuedRequest.config, this.generateRequestId());
                queuedRequest.resolve(response);
            } catch (error) {
                queuedRequest.reject(error);
            }
        }
    }

    /**
     * Mock responses for testing
     */
    addMockResponse(url, method, response) {
        const key = `${method.toUpperCase()}:${url}`;
        this.mockResponses.set(key, response);
    }

    getMockResponse(url, method = 'GET') {
        const key = `${method.toUpperCase()}:${url}`;
        const mockResponse = this.mockResponses.get(key);
        
        if (mockResponse) {
            return new Response(JSON.stringify(mockResponse.data), {
                status: mockResponse.status || 200,
                statusText: mockResponse.statusText || 'OK',
                headers: mockResponse.headers || {}
            });
        }
        
        return null;
    }

    /**
     * Request tracking and metrics
     */
    startRequestTracking(requestId, config) {
        this.activeRequests.add(requestId);
        this.requestMetrics.set(requestId, {
            url: config.url,
            method: config.method || 'GET',
            startTime: performance.now(),
            timestamp: Date.now()
        });
    }

    endRequestTracking(requestId) {
        this.activeRequests.delete(requestId);
        const metrics = this.requestMetrics.get(requestId);
        
        if (metrics) {
            metrics.endTime = performance.now();
            metrics.duration = metrics.endTime - metrics.startTime;
            
            this.logger.debug('Request completed:', {
                url: metrics.url,
                method: metrics.method,
                duration: `${metrics.duration.toFixed(2)}ms`
            });
        }
    }

    /**
     * Request cancellation
     */
    cancelRequest(requestId) {
        const controller = this.abortControllers.get(requestId);
        if (controller) {
            controller.abort();
            this.abortControllers.delete(requestId);
            this.logger.info('Request cancelled:', requestId);
        }
    }

    cancelAllRequests() {
        for (const [requestId, controller] of this.abortControllers) {
            controller.abort();
        }
        this.abortControllers.clear();
        this.logger.info('All requests cancelled');
    }

    /**
     * Utility methods
     */
    mergeConfig(url, options) {
        const fullUrl = this.buildUrl(url);
        
        return {
            ...this.config,
            ...options,
            url: fullUrl,
            headers: {
                'Content-Type': 'application/json',
                ...this.config.headers,
                ...options.headers
            }
        };
    }

    buildUrl(url) {
        if (url.startsWith('http')) {
            return url;
        }
        
        const baseURL = this.config.baseURL.replace(/\/$/, '');
        const path = url.startsWith('/') ? url : `/${url}`;
        
        return `${baseURL}${path}`;
    }

    serializeBody(data, headers = {}) {
        if (data instanceof FormData || data instanceof URLSearchParams) {
            return data;
        }
        
        if (typeof data === 'object') {
            const contentType = headers['Content-Type'] || headers['content-type'];
            
            if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
                return new URLSearchParams(data);
            }
            
            return JSON.stringify(data);
        }
        
        return data;
    }

    shouldRetry(error, attempt, maxRetries) {
        if (attempt >= maxRetries) return false;
        
        // Don't retry certain status codes
        if (typeof error === 'object' && error.status) {
            const noRetryStatuses = [400, 401, 403, 404, 422];
            if (noRetryStatuses.includes(error.status)) {
                return false;
            }
        }
        
        // Retry on network errors and 5xx status codes
        return true;
    }

    calculateRetryDelay(attempt, baseDelay = 1000) {
        // Exponential backoff with jitter
        const exponentialDelay = Math.pow(2, attempt) * baseDelay;
        const jitter = Math.random() * 0.1 * exponentialDelay;
        return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
    }

    extractFilename(url) {
        return url.split('/').pop().split('?')[0] || 'download';
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    generateRequestId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    handleRequestError(error, config, requestId) {
        const metrics = this.requestMetrics.get(requestId);
        
        this.logger.error('Request failed:', {
            url: config.url,
            method: config.method,
            error: error.message,
            duration: metrics ? `${(performance.now() - metrics.startTime).toFixed(2)}ms` : 'unknown'
        });
    }

    /**
     * Configuration methods
     */
    setBaseURL(baseURL) {
        this.config.baseURL = baseURL;
        return this;
    }

    setTimeout(timeout) {
        this.config.timeout = timeout;
        return this;
    }

    setRetries(retries) {
        this.config.retries = retries;
        return this;
    }

    /**
     * Statistics and monitoring
     */
    getStats() {
        return {
            activeRequests: this.activeRequests.size,
            cacheSize: this.cache.size,
            offlineQueueSize: this.offlineQueue.length,
            isOnline: this.isOnline,
            rateLimiters: this.rateLimiters.size,
            authTokens: this.authTokens.size,
            interceptors: {
                request: this.interceptors.request.length,
                response: this.interceptors.response.length
            }
        };
    }

    clearCache() {
        this.cache.clear();
        this.logger.info('Network cache cleared');
    }

    clearOfflineQueue() {
        this.offlineQueue = [];
        this.logger.info('Offline queue cleared');
    }
}
 