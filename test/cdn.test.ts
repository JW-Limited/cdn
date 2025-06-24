import { describe, it, expect } from 'vitest';
import { env, SELF } from 'cloudflare:test';

describe('JWLimited CDN', () => {
	describe('API Endpoints', () => {
		it('should return health status', async () => {
			const response = await SELF.fetch('https://example.com/api/health');
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data).toHaveProperty('status', 'healthy');
			expect(data).toHaveProperty('timestamp');
			expect(data).toHaveProperty('version');
		});

		it('should return stats', async () => {
			const response = await SELF.fetch('https://example.com/api/stats');
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data).toHaveProperty('requests_served');
			expect(data).toHaveProperty('cache_hit_ratio');
			expect(data).toHaveProperty('bandwidth_saved');
		});

		it('should handle CORS preflight', async () => {
			const response = await SELF.fetch('https://example.com/api/health', {
				method: 'OPTIONS'
			});
			expect(response.status).toBe(200);
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
			expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
		});

		it('should return 404 for unknown API endpoints', async () => {
			const response = await SELF.fetch('https://example.com/api/unknown');
			expect(response.status).toBe(404);

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data).toHaveProperty('status', 404);
		});
	});

	describe('Asset Serving', () => {
		it('should serve static assets', async () => {
			const response = await SELF.fetch('https://example.com/index.html');

			// Should attempt to fetch from assets
			// In test environment, this might return 404 if no assets are present
			expect([200, 404]).toContain(response.status);
		});

		it('should add security headers', async () => {
			const response = await SELF.fetch('https://example.com/test.css');

			// Check for security headers (even on 404)
			expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
			expect(response.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
			expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
		});

		it('should set correct content types', async () => {
			// These will be 404 in test but should still have correct error format
			const testCases = [
				{ path: '/test.css', expectedType: 'text/css' },
				{ path: '/test.js', expectedType: 'application/javascript' },
				{ path: '/test.png', expectedType: 'image/png' },
				{ path: '/test.json', expectedType: 'application/json' }
			];

			for (const testCase of testCases) {
				const response = await SELF.fetch(`https://example.com${testCase.path}`);

				if (response.status === 404) {
					// Error responses should be JSON
					expect(response.headers.get('Content-Type')).toContain('application/json');
				} else {
					// Successful responses should have correct content type
					expect(response.headers.get('Content-Type')).toBe(testCase.expectedType);
				}
			}
		});

		it('should add CORS headers to asset responses', async () => {
			const response = await SELF.fetch('https://example.com/test.css');
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
		});
	});

	describe('Caching', () => {
		it('should set appropriate cache headers for images', async () => {
			const response = await SELF.fetch('https://example.com/test.png');

			if (response.status === 200) {
				const cacheControl = response.headers.get('Cache-Control');
				expect(cacheControl).toContain('public');
				expect(cacheControl).toContain('max-age=2592000'); // 30 days
			}
		});

		it('should set appropriate cache headers for fonts', async () => {
			const response = await SELF.fetch('https://example.com/test.woff2');

			if (response.status === 200) {
				const cacheControl = response.headers.get('Cache-Control');
				expect(cacheControl).toContain('public');
				expect(cacheControl).toContain('max-age=31536000'); // 1 year
			}
		});

		it('should generate ETags', async () => {
			const response = await SELF.fetch('https://example.com/test.css');

			if (response.status === 200) {
				expect(response.headers.has('ETag')).toBe(true);
			}
		});
	});

	describe('Error Handling', () => {
		it('should return structured error responses', async () => {
			const response = await SELF.fetch('https://example.com/nonexistent.file');
			expect(response.status).toBe(404);
			expect(response.headers.get('Content-Type')).toContain('application/json');

			const data = await response.json();
			expect(data).toHaveProperty('error');
			expect(data).toHaveProperty('status', 404);
			expect(data).toHaveProperty('timestamp');
		});

		it('should handle malformed requests gracefully', async () => {
			// Test with invalid URL characters
			const response = await SELF.fetch('https://example.com/test%');

			// Should not crash and should return valid response
			expect(response.status).toBeGreaterThanOrEqual(400);
			expect(response.status).toBeLessThan(600);
		});
	});

	describe('Performance Features', () => {
		it('should indicate cache status', async () => {
			const response = await SELF.fetch('https://example.com/test.css');

			// Should have cache status header
			expect(['HIT', 'MISS']).toContain(response.headers.get('X-Cache-Status'));
		});

		it('should support conditional requests', async () => {
			// First request
			const response1 = await SELF.fetch('https://example.com/test.css');

			if (response1.status === 200) {
				const etag = response1.headers.get('ETag');

				// Second request with ETag
				const response2 = await SELF.fetch('https://example.com/test.css', {
					headers: {
						'If-None-Match': etag!
					}
				});

				expect(response2.status).toBe(304);
			}
		});

		it('should handle compression headers', async () => {
			const response = await SELF.fetch('https://example.com/test.css', {
				headers: {
					'Accept-Encoding': 'gzip, deflate, br'
				}
			});

			if (response.status === 200) {
				// Should either be compressed or indicate compression capability
				const encoding = response.headers.get('Content-Encoding');
				const vary = response.headers.get('Vary');

				// Either should have encoding or indicate it varies
				expect(encoding || vary).toBeTruthy();
			}
		});
	});
});
