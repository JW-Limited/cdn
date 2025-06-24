/**
 * VelocityJS PWA Core
 * Progressive Web App features and capabilities
 */

class VelocityPWA {
    constructor(config = {}) {
        this.config = {
            // Service Worker Config
            swPath: '/velocity-sw.js',
            swScope: '/',
            enableOffline: true,
            enableBackgroundSync: true,
            enablePushNotifications: false,
            
            // Manifest Config
            manifestPath: '/manifest.json',
            appName: 'VelocityJS App',
            shortName: 'Velocity',
            description: 'A modern web application built with VelocityJS',
            themeColor: '#007bff',
            backgroundColor: '#ffffff',
            display: 'standalone',
            orientation: 'portrait-primary',
            startUrl: window.location.href ,
            
            // Icon Generation Config
            sourceIcon: '/assets/icon-source.png', // Source icon for generation
            iconSizes: [16, 32, 57, 60, 72, 76, 96, 114, 120, 128, 144, 152, 180, 192, 384, 512],
            iconPath: '/assets/icons/',
            generateIcons: true,
            
            // PWA Features
            enableInstallPrompt: true,
            enableShare: true,
            enableBadging: false,
            enablePeriodicSync: false,
            
            // Cache Strategy
            cacheStrategy: 'networkFirst', // networkFirst, cacheFirst, staleWhileRevalidate
            cacheMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            staticCacheName: 'velocity-static-v1',
            dynamicCacheName: 'velocity-dynamic-v1',
            
            ...config
        };
        
        this.isSupported = this.checkSupport();
        this.deferredPrompt = null;
        this.registration = null;
        this.isOnline = navigator.onLine;
        this.generatedIcons = new Map();
        this.iconCache = new Map();
        
        this.init();
    }
    
    /**
     * Check PWA support
     */
    checkSupport() {
        return {
            serviceWorker: 'serviceWorker' in navigator,
            manifest: 'manifest' in document.createElement('link'),
            pushManager: 'PushManager' in window,
            notifications: 'Notification' in window,
            badging: 'navigator' in window && 'setAppBadge' in navigator,
            share: 'navigator' in window && 'share' in navigator,
            periodicSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype
        };
    }
    
    /**
     * Initialize PWA features
     */
    async init() {
        // Generate icons from source
        if (this.config.generateIcons) {
            await this.generateIconsFromSource();
        }
        
        // Generate and inject manifest
        await this.generateManifest();
        
        // Inject generated icons into HTML head
        this.injectIconsToHead();
        
        // Register service worker
        if (this.isSupported.serviceWorker) {
            await this.registerServiceWorker();
        }
        
        // Setup install prompt
        this.setupInstallPrompt();
        
        // Setup offline/online handlers
        this.setupConnectivityHandlers();
        
        // Setup share functionality
        this.setupShare();
        
        // Setup notifications
        if (this.config.enablePushNotifications) {
            await this.setupNotifications();
        }
        
        // Setup background sync
        if (this.config.enableBackgroundSync && this.isSupported.serviceWorker) {
            this.setupBackgroundSync();
        }
        
        console.log('VelocityPWA initialized');
    }
    
    /**
     * Generate PWA icons from source image
     */
    async generateIconsFromSource() {
        try {
            console.log('🎨 Generating PWA icons from source...');
            
            // Load source image
            const sourceImage = await this.loadImage(this.config.sourceIcon);
            
            // Generate icons for all required sizes
            for (const size of this.config.iconSizes) {
                const iconData = await this.generateIcon(sourceImage, size);
                this.generatedIcons.set(size, iconData);
                
                // Cache the generated icon
                this.cacheIcon(size, iconData);
            }
            
            console.log(`✅ Generated ${this.config.iconSizes.length} PWA icons successfully`);
            
        } catch (error) {
            console.warn('⚠️ Icon generation failed, using fallback icons:', error.message);
            this.generateFallbackIcons();
        }
    }
    
    /**
     * Load image from URL
     */
    async loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                // Validate image dimensions
                if (img.width < 512 || img.height < 512) {
                    console.warn('⚠️ Source icon should be at least 512x512 pixels for best quality');
                }
                resolve(img);
            };
            
            img.onerror = () => {
                reject(new Error(`Failed to load source icon: ${url}`));
            };
            
            img.src = url;
        });
    }
    
    /**
     * Generate icon of specific size
     */
    async generateIcon(sourceImage, size) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = size;
        canvas.height = size;
        
        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Calculate dimensions to maintain aspect ratio
        const sourceSize = Math.min(sourceImage.width, sourceImage.height);
        const sourceX = (sourceImage.width - sourceSize) / 2;
        const sourceY = (sourceImage.height - sourceSize) / 2;
        
        // Draw resized image
        ctx.drawImage(
            sourceImage,
            sourceX, sourceY, sourceSize, sourceSize,
            0, 0, size, size
        );
        
        // Convert to blob
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                resolve({
                    blob,
                    url,
                    size,
                    type: 'image/png'
                });
            }, 'image/png', 0.9);
        });
    }
    
    /**
     * Cache generated icon
     */
    cacheIcon(size, iconData) {
        try {
            // Store in memory cache
            this.iconCache.set(size, iconData);
            
            // Store in localStorage for persistence (small icons only)
            if (size <= 192) {
                const reader = new FileReader();
                reader.onload = () => {
                    localStorage.setItem(`velocity-icon-${size}`, reader.result);
                };
                reader.readAsDataURL(iconData.blob);
            }
            
        } catch (error) {
            console.warn(`Failed to cache icon ${size}x${size}:`, error);
        }
    }
    
    /**
     * Get cached icon or generate fallback
     */
    getIconUrl(size) {
        // Check generated icons first
        const generated = this.generatedIcons.get(size);
        if (generated) {
            return generated.url;
        }
        
        // Check cache
        const cached = this.iconCache.get(size);
        if (cached) {
            return cached.url;
        }
        
        // Check localStorage
        const stored = localStorage.getItem(`velocity-icon-${size}`);
        if (stored) {
            return stored;
        }
        
        // Return fallback
        return this.generateSVGIcon(size);
    }
    
    /**
     * Generate SVG fallback icon
     */
    generateSVGIcon(size) {
        const svg = `
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:${this.config.themeColor};stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect width="100%" height="100%" fill="url(#grad)" rx="${size * 0.1}"/>
                <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.3}" 
                      fill="white" text-anchor="middle" dominant-baseline="central" font-weight="bold">V</text>
            </svg>
        `;
        
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        return URL.createObjectURL(blob);
    }
    
    /**
     * Generate fallback icons when source fails
     */
    generateFallbackIcons() {
        console.log('🔄 Generating fallback SVG icons...');
        
        for (const size of this.config.iconSizes) {
            const url = this.generateSVGIcon(size);
            this.generatedIcons.set(size, {
                url,
                size,
                type: 'image/svg+xml',
                fallback: true
            });
        }
    }
    
    /**
     * Generate icons array for manifest
     */
    generateManifestIcons() {
        return this.config.iconSizes.map(size => ({
            src: this.getIconUrl(size),
            sizes: `${size}x${size}`,
            type: this.getIconType(size),
            purpose: 'any maskable'
        }));
    }
    
    /**
     * Get icon type
     */
    getIconType(size) {
        const iconData = this.generatedIcons.get(size);
        return iconData ? iconData.type : 'image/png';
    }
    
    /**
     * Download all generated icons as files
     */
    async downloadGeneratedIcons() {
        console.log('📁 Downloading generated icons...');
        
        for (const [size, iconData] of this.generatedIcons) {
            if (iconData.blob) {
                const link = document.createElement('a');
                link.href = iconData.url;
                link.download = `icon-${size}x${size}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        }
        
        console.log('✅ All icons downloaded successfully');
    }
    
    /**
     * Get icon generation status
     */
    getIconStatus() {
        return {
            generated: this.generatedIcons.size,
            required: this.config.iconSizes.length,
            cached: this.iconCache.size,
            hasFallbacks: Array.from(this.generatedIcons.values()).some(icon => icon.fallback),
            sizes: Array.from(this.generatedIcons.keys())
        };
    }
    
    /**
     * Inject generated icons into HTML head for SEO and favicon
     */
    injectIconsToHead() {
        console.log('🔗 Injecting PWA icons into HTML head...');
        
        // Remove existing favicon and apple-touch-icon links
        this.removeExistingIconLinks();
        
        // Add standard favicon (using 32x32 or closest available)
        this.addFavicon();
        
        // Add Apple Touch Icons
        this.addAppleTouchIcons();
        
        // Add Android/Chrome icons
        this.addAndroidIcons();
        
        // Add Microsoft tile icons
        this.addMicrosoftIcons();
        
        // Add SEO meta tags
        this.addSEOIconMeta();
        
        console.log('✅ PWA icons successfully injected into HTML head');
    }
    
    /**
     * Remove existing icon links to avoid conflicts
     */
    removeExistingIconLinks() {
        const selectors = [
            'link[rel="icon"]',
            'link[rel="shortcut icon"]',
            'link[rel="apple-touch-icon"]',
            'link[rel="apple-touch-icon-precomposed"]',
            'meta[name="msapplication-TileImage"]',
            'meta[name="theme-color"]'
        ];
        
        selectors.forEach(selector => {
            const existing = document.querySelectorAll(selector);
            existing.forEach(el => el.remove());
        });
    }
    
    /**
     * Add standard favicon
     */
    addFavicon() {
        // Use 32x32 if available, otherwise smallest available
        const faviconSize = this.generatedIcons.has(32) ? 32 : 
                           Math.min(...Array.from(this.generatedIcons.keys()));
        
        if (faviconSize) {
            const favicon = document.createElement('link');
            favicon.rel = 'icon';
            favicon.type = this.getIconType(faviconSize);
            favicon.sizes = `${faviconSize}x${faviconSize}`;
            favicon.href = this.getIconUrl(faviconSize);
            document.head.appendChild(favicon);
            
            // Also add shortcut icon for older browsers
            const shortcut = document.createElement('link');
            shortcut.rel = 'shortcut icon';
            shortcut.type = this.getIconType(faviconSize);
            shortcut.href = this.getIconUrl(faviconSize);
            document.head.appendChild(shortcut);
        }
    }
    
    /**
     * Add Apple Touch Icons
     */
    addAppleTouchIcons() {
        // Apple Touch Icon sizes: 180x180 is standard, 152x152 for iPad, etc.
        const appleSizes = [57, 60, 72, 76, 114, 120, 144, 152, 180];
        
        appleSizes.forEach(size => {
            if (this.generatedIcons.has(size)) {
                const appleIcon = document.createElement('link');
                appleIcon.rel = 'apple-touch-icon';
                appleIcon.sizes = `${size}x${size}`;
                appleIcon.href = this.getIconUrl(size);
                document.head.appendChild(appleIcon);
            }
        });
        
        // Add precomposed version for older iOS devices
        const largestAppleSize = Math.max(...appleSizes.filter(size => this.generatedIcons.has(size)));
        if (largestAppleSize) {
            const precomposed = document.createElement('link');
            precomposed.rel = 'apple-touch-icon-precomposed';
            precomposed.sizes = `${largestAppleSize}x${largestAppleSize}`;
            precomposed.href = this.getIconUrl(largestAppleSize);
            document.head.appendChild(precomposed);
        }
    }
    
    /**
     * Add Android/Chrome icons
     */
    addAndroidIcons() {
        // Android Chrome uses 192x192 and 512x512
        [192, 512].forEach(size => {
            if (this.generatedIcons.has(size)) {
                const androidIcon = document.createElement('link');
                androidIcon.rel = 'icon';
                androidIcon.type = this.getIconType(size);
                androidIcon.sizes = `${size}x${size}`;
                androidIcon.href = this.getIconUrl(size);
                document.head.appendChild(androidIcon);
            }
        });
    }
    
    /**
     * Add Microsoft tile icons
     */
    addMicrosoftIcons() {
        // Microsoft tile uses 144x144 typically
        if (this.generatedIcons.has(144)) {
            const tileImage = document.createElement('meta');
            tileImage.name = 'msapplication-TileImage';
            tileImage.content = this.getIconUrl(144);
            document.head.appendChild(tileImage);
            
            const tileColor = document.createElement('meta');
            tileColor.name = 'msapplication-TileColor';
            tileColor.content = this.config.themeColor;
            document.head.appendChild(tileColor);
        }
    }
    
    /**
     * Add SEO meta tags with icons
     */
    addSEOIconMeta() {
        // Theme color for mobile browsers
        const themeColorMeta = document.createElement('meta');
        themeColorMeta.name = 'theme-color';
        themeColorMeta.content = this.config.themeColor;
        document.head.appendChild(themeColorMeta);
        
        // Add Open Graph image if we have a large icon
        const ogSize = this.generatedIcons.has(512) ? 512 : 
                      this.generatedIcons.has(384) ? 384 : 
                      Math.max(...Array.from(this.generatedIcons.keys()));
        
        if (ogSize && ogSize >= 192) {
            // Check if og:image already exists
            let ogImage = document.querySelector('meta[property="og:image"]');
            if (!ogImage) {
                ogImage = document.createElement('meta');
                ogImage.property = 'og:image';
                document.head.appendChild(ogImage);
            }
            ogImage.content = this.getIconUrl(ogSize);
            
            // Add Twitter card image
            let twitterImage = document.querySelector('meta[name="twitter:image"]');
            if (!twitterImage) {
                twitterImage = document.createElement('meta');
                twitterImage.name = 'twitter:image';
                document.head.appendChild(twitterImage);
            }
            twitterImage.content = this.getIconUrl(ogSize);
        }
    }
    
    /**
     * Update SEO icons (called by SEO engine)
     */
    updateSEOIcons(seoEngine) {
        if (!seoEngine) return;
        
        // Get the best icon for SEO purposes
        const seoIconSize = this.generatedIcons.has(512) ? 512 : 
                           this.generatedIcons.has(384) ? 384 : 
                           Math.max(...Array.from(this.generatedIcons.keys()));
        
        if (seoIconSize) {
            const iconUrl = this.getIconUrl(seoIconSize);
            
            // Update Open Graph image
            seoEngine.updateMeta('og:image', iconUrl);
            seoEngine.updateMeta('og:image:width', seoIconSize.toString());
            seoEngine.updateMeta('og:image:height', seoIconSize.toString());
            seoEngine.updateMeta('og:image:type', this.getIconType(seoIconSize));
            
            // Update Twitter card image
            seoEngine.updateMeta('twitter:image', iconUrl);
            seoEngine.updateMeta('twitter:image:width', seoIconSize.toString());
            seoEngine.updateMeta('twitter:image:height', seoIconSize.toString());
        }
    }
    
    /**
     * Generate and inject web app manifest
     */
    async generateManifest() {
        const manifest = {
            name: this.config.appName,
            short_name: this.config.shortName,
            description: this.config.description,
            theme_color: this.config.themeColor,
            background_color: this.config.backgroundColor,
            display: this.config.display,
            orientation: this.config.orientation,
            start_url: this.config.startUrl,
            scope: this.config.scope,
            icons: this.generateManifestIcons(),
            categories: ['productivity', 'utilities'],
            related_applications: [],
            prefer_related_applications: false
        };
        
        // Create blob URL for manifest
        const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], {
            type: 'application/json'
        });
        const manifestUrl = URL.createObjectURL(manifestBlob);
        
        // Inject manifest link
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = manifestUrl;
        document.head.appendChild(link);
        
        // Store manifest for later use
        this.manifest = manifest;
    }
    
    /**
     * Register service worker
     */
    async registerServiceWorker() {
        try {
            // Generate service worker content
            await this.generateServiceWorker();
            
            this.registration = await navigator.serviceWorker.register(
                this.config.swPath,
                { scope: this.config.swScope }
            );
            
            console.log('Service Worker registered successfully');
            
            // Handle updates
            this.registration.addEventListener('updatefound', () => {
                const newWorker = this.registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        this.showUpdateNotification();
                    }
                });
            });
            
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
    
    /**
     * Generate service worker content
     */
    async generateServiceWorker() {
        const swContent = `
// VelocityJS Service Worker v2.0.0
const STATIC_CACHE = '${this.config.staticCacheName}';
const DYNAMIC_CACHE = '${this.config.dynamicCacheName}';
const CACHE_MAX_AGE = ${this.config.cacheMaxAge};

// Static resources to cache
const STATIC_RESOURCES = [
    '/',
    '/src/velocity.js',
    '/src/core/router.js',
    '/src/core/storage.js',
    '/src/core/network.js',
    '/src/core/logger.js',
    '/src/core/utils.js',
    '/src/core/pwa.js',
    '/src/core/seo.js',
    '/assets/velocity.css',
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-512x512.png'
];

// Install event - cache static resources
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => cache.addAll(STATIC_RESOURCES))
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - implement cache strategies
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') return;
    
    // Skip cross-origin requests
    if (url.origin !== location.origin) return;
    
    event.respondWith(handleFetch(request));
});

async function handleFetch(request) {
    const url = new URL(request.url);
    
    // Static resources - cache first
    if (STATIC_RESOURCES.includes(url.pathname)) {
        return cacheFirst(request);
    }
    
    // API requests - network first
    if (url.pathname.startsWith('/api/')) {
        return networkFirst(request);
    }
    
    // Pages - stale while revalidate
    return staleWhileRevalidate(request);
}

async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error('Cache first failed:', error);
        return new Response('Offline', { status: 503 });
    }
}

async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    const fetchPromise = fetch(request).then(networkResponse => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(() => cachedResponse);
    
    return cachedResponse || fetchPromise;
}

// Background sync
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        event.waitUntil(handleBackgroundSync());
    }
});

async function handleBackgroundSync() {
    console.log('Background sync triggered');
    // Handle offline form submissions, data sync, etc.
}

// Push notifications
self.addEventListener('push', event => {
    if (!event.data) return;
    
    const data = event.data.json();
    const options = {
        body: data.body,
        icon: self.iconUrls ? self.iconUrls.get(192) : '/assets/icons/icon-192x192.png',
        badge: self.iconUrls ? self.iconUrls.get(96) : '/assets/icons/icon-96x96.png',
        vibrate: [200, 100, 200],
        data: data.data || {},
        actions: data.actions || []
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow(event.notification.data.url || '/')
        );
    }
});

// Periodic background sync
self.addEventListener('periodicsync', event => {
    if (event.tag === 'content-sync') {
        event.waitUntil(syncContent());
    }
});

async function syncContent() {
    console.log('Periodic sync triggered');
    // Sync content, update cache, etc.
}

// Message handler for communication with main thread
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'UPDATE_ICON_CACHE') {
        // Update cached icons when new ones are generated
        const { size, url } = event.data;
        // Update any references to the old icon URL
    }
});
`;
        
        // Create service worker file
        const swBlob = new Blob([swContent], { type: 'application/javascript' });
        const swUrl = URL.createObjectURL(swBlob);
        
        // Store the service worker content (in a real app, you'd write this to a file)
        this.swContent = swContent;
    }
    
    /**
     * Setup install prompt
     */
    setupInstallPrompt() {
        if (!this.config.enableInstallPrompt) return;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });
        
        window.addEventListener('appinstalled', () => {
            console.log('PWA was installed');
            this.hideInstallButton();
            this.deferredPrompt = null;
        });
    }
    
    /**
     * Show install button
     */
    showInstallButton() {
        const installBtn = document.createElement('button');
        installBtn.id = 'velocity-install-btn';
        installBtn.className = 'velocity-btn velocity-btn-primary velocity-install-btn';
        installBtn.innerHTML = '📱 Install App';
        installBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        installBtn.addEventListener('click', () => this.promptInstall());
        document.body.appendChild(installBtn);
    }
    
    /**
     * Hide install button
     */
    hideInstallButton() {
        const installBtn = document.getElementById('velocity-install-btn');
        if (installBtn) {
            installBtn.remove();
        }
    }
    
    /**
     * Prompt for installation
     */
    async promptInstall() {
        if (!this.deferredPrompt) return;
        
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        
        console.log('Install outcome:', outcome);
        this.deferredPrompt = null;
        this.hideInstallButton();
    }
    
    /**
     * Setup connectivity handlers
     */
    setupConnectivityHandlers() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showConnectivityStatus('online');
            this.syncOfflineData();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showConnectivityStatus('offline');
        });
    }
    
    /**
     * Show connectivity status
     */
    showConnectivityStatus(status) {
        const statusEl = document.createElement('div');
        statusEl.className = `velocity-connectivity-status velocity-${status}`;
        statusEl.textContent = status === 'online' ? '🟢 Back Online' : '🔴 Offline Mode';
        statusEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background: ${status === 'online' ? '#28a745' : '#dc3545'};
            color: white;
            border-radius: 5px;
            z-index: 1001;
            animation: velocity-slide-in 0.3s ease;
        `;
        
        document.body.appendChild(statusEl);
        
        setTimeout(() => {
            statusEl.style.animation = 'velocity-fade-out 0.3s ease';
            setTimeout(() => statusEl.remove(), 300);
        }, 3000);
    }
    
    /**
     * Setup share functionality
     */
    setupShare() {
        if (!this.config.enableShare || !this.isSupported.share) return;
        
        this.addShareButtons();
    }
    
    /**
     * Add share buttons to the page
     */
    addShareButtons() {
        const shareButtons = document.querySelectorAll('[data-velocity-share]');
        
        shareButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const url = button.dataset.url || window.location.href;
                const title = button.dataset.title || document.title;
                const text = button.dataset.text || '';
                
                this.share({ url, title, text });
            });
        });
    }
    
    /**
     * Native share functionality
     */
    async share(data) {
        if (this.isSupported.share) {
            try {
                await navigator.share(data);
                console.log('Shared successfully');
            } catch (err) {
                console.error('Share failed:', err);
                this.fallbackShare(data);
            }
        } else {
            this.fallbackShare(data);
        }
    }
    
    /**
     * Fallback share methods
     */
    fallbackShare(data) {
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(data.text)}&url=${encodeURIComponent(data.url)}`;
        window.open(shareUrl, '_blank', 'width=550,height=420');
    }
    
    /**
     * Setup notifications
     */
    async setupNotifications() {
        if (!this.isSupported.notifications) return;
        
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted');
        }
    }
    
    /**
     * Send notification
     */
    async sendNotification(title, options = {}) {
        if (!this.isSupported.notifications || Notification.permission !== 'granted') {
            return;
        }
        
        const notification = new Notification(title, {
            icon: options.icon || this.getIconUrl(192),
            badge: options.badge || this.getIconUrl(96),
            ...options
        });
        
        return notification;
    }
    
    /**
     * Setup background sync
     */
    setupBackgroundSync() {
        // Register background sync when user goes offline or submits forms
        this.offlineQueue = [];
        
        // Intercept form submissions for offline support
        document.addEventListener('submit', (e) => {
            if (!this.isOnline && e.target.dataset.syncable) {
                e.preventDefault();
                this.queueForSync(e.target);
            }
        });
    }
    
    /**
     * Queue data for background sync
     */
    async queueForSync(form) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        this.offlineQueue.push({
            timestamp: Date.now(),
            url: form.action,
            method: form.method,
            data
        });
        
        // Register sync
        if (this.registration && this.registration.sync) {
            await this.registration.sync.register('background-sync');
        }
        
        this.showOfflineQueuedMessage();
    }
    
    /**
     * Sync offline data when back online
     */
    async syncOfflineData() {
        if (this.offlineQueue.length === 0) return;
        
        console.log('Syncing offline data...');
        
        for (const item of this.offlineQueue) {
            try {
                await fetch(item.url, {
                    method: item.method,
                    body: JSON.stringify(item.data),
                    headers: { 'Content-Type': 'application/json' }
                });
                
                // Remove from queue on success
                this.offlineQueue = this.offlineQueue.filter(i => i !== item);
            } catch (error) {
                console.error('Failed to sync item:', error);
            }
        }
    }
    
    /**
     * Show offline queued message
     */
    showOfflineQueuedMessage() {
        const message = document.createElement('div');
        message.className = 'velocity-alert velocity-alert-warning';
        message.textContent = '📡 Data queued for sync when online';
        message.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            z-index: 1001;
            max-width: 300px;
        `;
        
        document.body.appendChild(message);
        setTimeout(() => message.remove(), 5000);
    }
    
    /**
     * Show update notification
     */
    showUpdateNotification() {
        const notification = document.createElement('div');
        notification.className = 'velocity-update-notification';
        notification.innerHTML = `
            <div style="background: #007bff; color: white; padding: 15px; position: fixed; bottom: 0; left: 0; right: 0; z-index: 1002; text-align: center;">
                🔄 App update available!
                <button onclick="this.parentElement.parentElement.updateApp()" style="margin-left: 10px; background: white; color: #007bff; border: none; padding: 5px 15px; border-radius: 3px; cursor: pointer;">
                    Update Now
                </button>
                <button onclick="this.parentElement.remove()" style="margin-left: 10px; background: transparent; color: white; border: 1px solid white; padding: 5px 15px; border-radius: 3px; cursor: pointer;">
                    Later
                </button>
            </div>
        `;
        
        notification.updateApp = () => {
            if (this.registration && this.registration.waiting) {
                this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
            }
        };
        
        document.body.appendChild(notification);
    }
    
    /**
     * Get PWA status
     */
    getStatus() {
        return {
            isSupported: this.isSupported,
            isInstalled: window.matchMedia('(display-mode: standalone)').matches,
            isOnline: this.isOnline,
            hasServiceWorker: !!this.registration,
            hasManifest: !!this.manifest,
            offlineQueueLength: this.offlineQueue?.length || 0
        };
    }
    
    /**
     * Unregister service worker
     */
    async unregister() {
        if (this.registration) {
            await this.registration.unregister();
            console.log('Service Worker unregistered');
        }
    }
}

export default VelocityPWA; 