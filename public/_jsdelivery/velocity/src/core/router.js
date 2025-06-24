
export class VelocityRouter {
    constructor(options, logger) {
        this.options = options;
        this.logger = logger;
        this.routes = new Map();
        this.middlewares = [];
        this.currentRoute = null;
        this.pageCache = new Map();
        this.layoutCache = new Map();
        this.routeParams = {};
        this.queryParams = {};
        this.loadingPromises = new Map();
        this.layouts = new Map();
        this.routeGuards = new Map();
        this.transitions = new Map();
        
        // Event system for router
        this.eventListeners = new Map();
        
        // Component registry for routes
        this.routeComponents = new Map();
        
        // Route patterns
        this.dynamicRouteRegex = /\[([^\]]+)\]/g;
        this.catchAllRouteRegex = /\[\.\.\.([^\]]+)\]/g;
        
        // Enhanced features
        this.scrollPositions = new Map();
        this.routeMetadata = new Map();
        this.lazyRoutes = new Map();
        this.routeComponents = new Map();
        
        // Layout system
        this.defaultLayout = null;
        this.layoutCache = new Map();
        
        // Route transitions
        this.isTransitioning = false;
        this.transitionQueue = [];
    }

    /**
     * Initialize the router
     */
    async init() {
        this.logger.info('Initializing VelocityRouter');
        
        // Setup scroll restoration
        this.setupScrollRestoration();
        
        // Parse current URL
        await this.handleRoute(window.location.pathname + window.location.search);
        
        this.logger.info('VelocityRouter initialized');
    }

    /**
     * Add a route with enhanced options
     */
    addRoute(path, handler, options = {}) {
        const routeConfig = {
            path,
            handler,
            preload: options.preload || false,
            cache: options.cache !== false,
            middleware: options.middleware || [],
            title: options.title || '',
            meta: options.meta || {},
            layout: options.layout || this.defaultLayout,
            transition: options.transition || 'fade',
            guards: options.guards || [],
            fetchHtml: options.fetchHtml || false, // NEW: HTML fetching flag
            htmlPath: options.htmlPath || null,    // NEW: Path to HTML file
            template: options.template || null,    // NEW: Template path (alias for htmlPath)
            lazy: options.lazy || false,           // NEW: Lazy loading
            component: options.component || null,  // NEW: Component-based routing
            nestedRoutes: options.children || [],  // NEW: Nested routing
            scrollToTop: options.scrollToTop !== false,
            keepAlive: options.keepAlive || false,
            errorBoundary: options.errorBoundary || null
        };

        // Convert dynamic routes to regex
        const regex = this.pathToRegex(path);
        const keys = this.extractKeys(path);
        
        routeConfig.regex = regex;
        routeConfig.keys = keys;
        
        // Store route metadata
        this.routeMetadata.set(path, {
            title: routeConfig.title,
            meta: routeConfig.meta,
            layout: routeConfig.layout
        });
        
        // Handle lazy routes
        if (routeConfig.lazy && typeof handler === 'string') {
            this.lazyRoutes.set(path, handler);
            routeConfig.handler = () => this.loadLazyRoute(path);
        }
        
        // Handle nested routes
        if (routeConfig.nestedRoutes.length > 0) {
            this.addNestedRoutes(path, routeConfig.nestedRoutes);
        }
        
        this.routes.set(path, routeConfig);
        this.logger.info(`Route added: ${path}`, routeConfig);
        
        return this;
    }

    /**
     * Add nested routes
     */
    addNestedRoutes(parentPath, nestedRoutes) {
        nestedRoutes.forEach(route => {
            const fullPath = this.joinPaths(parentPath, route.path);
            this.addRoute(fullPath, route.handler, {
                ...route,
                parent: parentPath
            });
        });
    }

    /**
     * Join paths properly
     */
    joinPaths(parent, child) {
        const cleanParent = parent.replace(/\/$/, '');
        const cleanChild = child.replace(/^\//, '');
        return `${cleanParent}/${cleanChild}`;
    }

    /**
     * Set default layout
     */
    setDefaultLayout(layoutHandler) {
        this.defaultLayout = layoutHandler;
        return this;
    }

    /**
     * Add layout
     */
    addLayout(name, layoutHandler) {
        this.layouts.set(name, layoutHandler);
        return this;
    }

    /**
     * Add route guard
     */
    addGuard(path, guardFunction) {
        if (!this.routeGuards.has(path)) {
            this.routeGuards.set(path, []);
        }
        this.routeGuards.get(path).push(guardFunction);
        return this;
    }

    /**
     * Add route transition
     */
    addTransition(name, transitionConfig) {
        this.transitions.set(name, transitionConfig);
        return this;
    }

    /**
     * Navigate to a route with enhanced options
     */
    async navigate(path, options = {}) {
        try {
            this.logger.info(`Navigating to: ${path}`);
            
            // Check if already transitioning
            if (this.isTransitioning && !options.force) {
                this.transitionQueue.push({ path, options });
                return;
            }
            
            // Don't navigate if already on the same route
            if (this.currentRoute && this.currentRoute.fullPath === path && !options.force) {
                this.logger.info('Already on route, skipping navigation');
                return;
            }

            this.isTransitioning = true;
            
            // Save scroll position
            this.saveScrollPosition(this.currentRoute?.fullPath);
            
            // Show loading state
            this.showLoading();
            
            // Handle route with transition
            await this.handleRouteWithTransition(path, options);
            
            // Update browser history
            if (options.replace) {
                history.replaceState({ path, timestamp: Date.now() }, '', path);
            } else {
                history.pushState({ path, timestamp: Date.now() }, '', path);
            }
            
            this.hideLoading();
            this.isTransitioning = false;
            
            // Process queued transitions
            if (this.transitionQueue.length > 0) {
                const next = this.transitionQueue.shift();
                setTimeout(() => this.navigate(next.path, next.options), 0);
            }
            
        } catch (error) {
            this.hideLoading();
            this.isTransitioning = false;
            this.logger.error('Navigation failed', error);
            this.handleNavigationError(error, path);
        }
    }

    /**
     * Handle route with transition effects
     */
    async handleRouteWithTransition(path, options = {}) {
        const { pathname, search } = this.parseUrl(path);
        const route = this.matchRoute(pathname);
        
        if (!route) {
            this.handle404(pathname);
            return;
        }

        // Apply transition out effect
        if (this.currentRoute) {
            await this.applyTransitionOut(this.currentRoute);
        }

        // Handle the route
        await this.handleRoute(path, options);
        
        // Apply transition in effect
        await this.applyTransitionIn(route.config);
    }

    /**
     * Handle route with enhanced features
     */
    async handleRoute(fullPath, options = {}) {
        const { pathname, search } = this.parseUrl(fullPath);
        const route = this.matchRoute(pathname);
        
        if (!route) {
            this.handle404(pathname);
            return;
        }

        // Extract route parameters
        this.routeParams = this.extractParams(pathname, route);
        this.queryParams = this.parseQuery(search);
        
        // Create route context
        const context = {
            path: pathname,
            fullPath,
            params: this.routeParams,
            query: this.queryParams,
            route: route.config,
            navigate: this.navigate.bind(this),
            redirect: this.redirect.bind(this),
            setTitle: this.setTitle.bind(this),
            setMeta: this.setMeta.bind(this),
            getLayoutData: this.getLayoutData.bind(this)
        };

        // Run route guards
        if (!await this.runRouteGuards(pathname, context)) {
            return;
        }

        // Run middlewares
        for (const middleware of [...this.middlewares, ...route.config.middleware]) {
            const result = await middleware(context);
            if (result === false) {
                this.logger.info('Navigation blocked by middleware');
                return;
            }
        }

        // Update current route
        this.currentRoute = {
            ...context,
            config: route.config
        };

        // Execute route handler with layout
        await this.executeRouteWithLayout(route.config, context);
        
        // Update page meta
        this.updatePageMeta(route.config, context);
        
        // Restore scroll position or scroll to top
        this.handleScrollRestoration(route.config, fullPath);
        
        // Emit route change event
        this.emitRouteChange(context);
    }

    /**
     * Execute route with layout system
     */
    async executeRouteWithLayout(routeConfig, context) {
        try {
            let content;
            
            // Check cache first
            const cacheKey = context.fullPath;
            if (routeConfig.cache && this.pageCache.has(cacheKey)) {
                content = this.pageCache.get(cacheKey);
                this.logger.info('Loaded from cache:', cacheKey);
            } else {
                // Get route content
                content = await this.getRouteContent(routeConfig, context);
                
                // Cache content if enabled
                if (routeConfig.cache && content) {
                    this.pageCache.set(cacheKey, content);
                }
            }

            // Apply layout if specified
            if (routeConfig.layout) {
                content = await this.applyLayout(routeConfig.layout, content, context);
            }

            // Render content
            this.renderContent(content);
            
        } catch (error) {
            this.logger.error('Route execution failed', error);
            this.handleRouteError(error, context);
        }
    }

    /**
     * Get route content with enhanced options
     */
    async getRouteContent(routeConfig, context) {
        this.logger.debug('Getting route content for config:', routeConfig);
        
        // Handle HTML fetching (support both htmlPath and template)
        if (routeConfig.fetchHtml && (routeConfig.htmlPath || routeConfig.template)) {
            const htmlPath = routeConfig.htmlPath || routeConfig.template;
            this.logger.debug('Fetching HTML from:', htmlPath);
            return await this.fetchHtmlPage(htmlPath, context);
        }
        
        // Handle component-based routing
        if (routeConfig.component) {
            this.logger.debug('Rendering component:', routeConfig.component);
            return await this.renderComponent(routeConfig.component, context);
        }
        
        // Handle function handler
        if (typeof routeConfig.handler === 'function') {
            this.logger.debug('Executing function handler');
            return await routeConfig.handler(context);
        }
        
        // Handle string handler (URL)
        if (typeof routeConfig.handler === 'string') {
            this.logger.debug('Loading page from URL:', routeConfig.handler);
            return await this.loadPage(routeConfig.handler);
        }
        
        this.logger.error('No valid route handler found. Route config:', routeConfig);
        throw new Error('Invalid route handler');
    }

    /**
     * Fetch HTML page with AJAX
     */
    async fetchHtmlPage(htmlPath, context) {
        this.logger.info('Fetching HTML page:', htmlPath);
        
        try {
            // Check if already loading
            if (this.loadingPromises.has(htmlPath)) {
                return await this.loadingPromises.get(htmlPath);
            }

            const loadPromise = fetch(htmlPath)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch HTML page: ${response.status}`);
                    }
                    return response.text();
                })
                .then(html => {
                    // Process HTML with context
                    return this.processHtmlTemplate(html, context);
                })
                .finally(() => {
                    this.loadingPromises.delete(htmlPath);
                });

            this.loadingPromises.set(htmlPath, loadPromise);
            return await loadPromise;
            
        } catch (error) {
            this.logger.error('Failed to fetch HTML page:', error);
            throw error;
        }
    }

    /**
     * Process HTML template with context data
     */
    processHtmlTemplate(html, context) {
        // Simple template engine - replace {{variable}} with context data
        return html.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
            const keys = key.trim().split('.');
            let value = context;
            
            for (const k of keys) {
                value = value?.[k];
            }
            
            return value !== undefined ? String(value) : match;
        });
    }

    /**
     * Render component
     */
    async renderComponent(component, context) {
        if (typeof component === 'function') {
            return await component(context);
        }
        
        if (typeof component === 'string' && this.routeComponents.has(component)) {
            const componentFunc = this.routeComponents.get(component);
            return await componentFunc(context);
        }
        
        throw new Error(`Component not found: ${component}`);
    }

    /**
     * Register component
     */
    registerComponent(name, componentFunction) {
        this.routeComponents.set(name, componentFunction);
        return this;
    }

    /**
     * Apply layout to content
     */
    async applyLayout(layoutName, content, context) {
        let layoutHandler;
        
        if (typeof layoutName === 'function') {
            layoutHandler = layoutName;
        } else if (this.layouts.has(layoutName)) {
            layoutHandler = this.layouts.get(layoutName);
        } else {
            this.logger.warn('Layout not found:', layoutName);
            return content;
        }

        // Check layout cache
        const layoutCacheKey = `${layoutName}_${context.path}`;
        if (this.layoutCache.has(layoutCacheKey)) {
            const cachedLayout = this.layoutCache.get(layoutCacheKey);
            return cachedLayout.replace('{{content}}', content);
        }

        try {
            const layoutContent = await layoutHandler(context);
            
            // Cache layout
            this.layoutCache.set(layoutCacheKey, layoutContent);
            
            // Replace content placeholder
            return layoutContent.replace('{{content}}', content);
            
        } catch (error) {
            this.logger.error('Layout rendering failed:', error);
            return content;
        }
    }

    /**
     * Load lazy route
     */
    async loadLazyRoute(path) {
        if (!this.lazyRoutes.has(path)) {
            throw new Error(`Lazy route not found: ${path}`);
        }

        const modulePath = this.lazyRoutes.get(path);
        this.logger.info('Loading lazy route:', modulePath);

        try {
            const module = await import(modulePath);
            const handler = module.default || module;
            
            // Update route handler
            const route = this.routes.get(path);
            route.handler = handler;
            route.lazy = false;
            
            return handler;
            
        } catch (error) {
            this.logger.error('Failed to load lazy route:', error);
            throw error;
        }
    }

    /**
     * Run route guards
     */
    async runRouteGuards(path, context) {
        const guards = this.routeGuards.get(path) || [];
        
        for (const guard of guards) {
            try {
                const result = await guard(context);
                if (result === false) {
                    this.logger.info('Navigation blocked by route guard');
                    return false;
                }
            } catch (error) {
                this.logger.error('Route guard error:', error);
                return false;
            }
        }
        
        return true;
    }

    /**
     * Apply transition effects
     */
    async applyTransitionOut(route) {
        if (!route.config.transition) return;
        
        const transition = this.transitions.get(route.config.transition);
        if (transition && transition.out) {
            await transition.out();
        } else {
            // Default fade out
            await this.defaultTransitionOut();
        }
    }

    /**
     * Apply transition in effects
     */
    async applyTransitionIn(routeConfig) {
        if (!routeConfig.transition) return;
        
        const transition = this.transitions.get(routeConfig.transition);
        if (transition && transition.in) {
            await transition.in();
        } else {
            // Default fade in
            await this.defaultTransitionIn();
        }
    }

    /**
     * Default transition out
     */
    async defaultTransitionOut() {
        const app = document.getElementById('app');
        if (app) {
            app.style.opacity = '0';
            await new Promise(resolve => setTimeout(resolve, 150));
        }
    }

    /**
     * Default transition in
     */
    async defaultTransitionIn() {
        const app = document.getElementById('app');
        if (app) {
            app.style.opacity = '1';
            await new Promise(resolve => setTimeout(resolve, 150));
        }
    }

    /**
     * Setup scroll restoration
     */
    setupScrollRestoration() {
        // Disable browser's scroll restoration
        if (history.scrollRestoration) {
            history.scrollRestoration = 'manual';
        }
    }

    /**
     * Save scroll position
     */
    saveScrollPosition(path) {
        if (path) {
            this.scrollPositions.set(path, {
                x: window.scrollX,
                y: window.scrollY
            });
        }
    }

    /**
     * Handle scroll restoration
     */
    handleScrollRestoration(routeConfig, path) {
        if (routeConfig.scrollToTop !== false) {
            // Check if we have a saved position
            if (this.scrollPositions.has(path)) {
                const position = this.scrollPositions.get(path);
                window.scrollTo(position.x, position.y);
            } else {
                window.scrollTo(0, 0);
            }
        }
    }

    /**
     * Preload route
     */
    async preloadRoute(path) {
        try {
            const { pathname } = this.parseUrl(path);
            const route = this.matchRoute(pathname);
            
            if (route && route.config.preload !== false) {
                this.logger.info('Preloading route:', path);
                
                // Preload lazy routes
                if (route.config.lazy) {
                    await this.loadLazyRoute(route.path);
                }
                
                // Preload HTML pages
                if (route.config.fetchHtml && route.config.htmlPath) {
                    await this.fetchHtmlPage(route.config.htmlPath, { 
                        path: pathname, 
                        params: {}, 
                        query: {} 
                    });
                }
                
                // Preload regular handlers
                if (typeof route.config.handler === 'string') {
                    await this.loadPage(route.config.handler);
                }
            }
        } catch (error) {
            this.logger.warn('Failed to preload route', path, error);
        }
    }

    /**
     * Set page title
     */
    setTitle(title) {
        document.title = title;
        this.logger.debug('Title updated:', title);
    }

    /**
     * Set meta tags
     */
    setMeta(metaData) {
        Object.entries(metaData).forEach(([name, content]) => {
            let metaTag = document.querySelector(`meta[name="${name}"]`);
            if (!metaTag) {
                metaTag = document.createElement('meta');
                metaTag.name = name;
                document.head.appendChild(metaTag);
            }
            metaTag.content = content;
        });
        this.logger.debug('Meta tags updated:', metaData);
    }

    /**
     * Get layout data
     */
    getLayoutData() {
        return {
            currentRoute: this.currentRoute,
            navigation: this.getNavigationData(),
            user: this.getUserData()
        };
    }

    /**
     * Get navigation data
     */
    getNavigationData() {
        return Array.from(this.routes.keys()).map(path => ({
            path,
            title: this.routeMetadata.get(path)?.title || path,
            meta: this.routeMetadata.get(path)?.meta || {}
        }));
    }

    /**
     * Get user data (placeholder)
     */
    getUserData() {
        // This would typically come from your app's state management
        return null;
    }

    /**
     * Enhanced route matching with nested routes
     */
    matchRoute(pathname) {
        // First try exact matches
        for (const [path, config] of this.routes) {
            if (config.regex.test(pathname)) {
                return { path, config };
            }
        }
        
        // Try nested route matching
        const segments = pathname.split('/').filter(Boolean);
        for (let i = segments.length; i > 0; i--) {
            const partialPath = '/' + segments.slice(0, i).join('/');
            for (const [path, config] of this.routes) {
                if (config.regex.test(partialPath)) {
                    return { path, config };
                }
            }
        }
        
        return null;
    }

    /**
     * Convert path to regex with improved pattern matching
     */
    pathToRegex(path) {
        // Handle catch-all routes [...param]
        let pattern = path.replace(this.catchAllRouteRegex, '(.*)');
        
        // Handle dynamic routes [param]
        pattern = pattern.replace(this.dynamicRouteRegex, '([^/]+)');
        
        // Escape special regex characters
        pattern = pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        
        // Restore replaced patterns
        pattern = pattern.replace(/\\\(\\\.\\\*\\\)/g, '(.*)');
        pattern = pattern.replace(/\\\(\\\[\\^\\\/\\\]\\\+\\\)/g, '([^/]+)');
        
        return new RegExp(`^${pattern}$`);
    }

    /**
     * Prefetch routes on link hover
     */
    setupLinkPrefetching() {
        document.addEventListener('mouseover', (event) => {
            const link = event.target.closest('a[href]');
            if (link && link.href.startsWith(window.location.origin)) {
                const path = new URL(link.href).pathname;
                this.preloadRoute(path);
            }
        });
    }

    /**
     * Add multiple routes
     */
    addRoutes(routes) {
        Object.entries(routes).forEach(([path, config]) => {
            if (typeof config === 'function') {
                this.addRoute(path, config);
            } else {
                this.addRoute(path, config.handler, config);
            }
        });
        return this;
    }

    use(middleware) {
        this.middlewares.push(middleware);
        return this;
    }

    async loadPage(pageUrl) {
        if (this.loadingPromises.has(pageUrl)) {
            return await this.loadingPromises.get(pageUrl);
        }

        const loadPromise = fetch(pageUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load page: ${response.status}`);
                }
                return response.text();
            })
            .finally(() => {
                this.loadingPromises.delete(pageUrl);
            });

        this.loadingPromises.set(pageUrl, loadPromise);
        return await loadPromise;
    }

    extractKeys(path) {
        const keys = [];
        let match;
        
        const catchAllRegex = /\[\.\.\.([^\]]+)\]/g;
        while ((match = catchAllRegex.exec(path)) !== null) {
            keys.push({ name: match[1], catchAll: true });
        }
        
        const dynamicRegex = /\[([^\]]+)\]/g;
        while ((match = dynamicRegex.exec(path)) !== null) {
            if (!match[1].startsWith('...')) {
                keys.push({ name: match[1], catchAll: false });
            }
        }
        
        return keys;
    }

    extractParams(pathname, route) {
        const params = {};
        const matches = pathname.match(route.config.regex);
        
        if (matches && route.config.keys) {
            route.config.keys.forEach((key, index) => {
                params[key.name] = matches[index + 1];
            });
        }
        
        return params;
    }

    parseUrl(url) {
        // Handle undefined or null URL
        if (!url) {
            url = window.location.pathname + window.location.search;
        }
        
        const [pathname, search = ''] = url.split('?');
        return { pathname, search };
    }

    parseQuery(search) {
        const params = {};
        if (search) {
            const urlParams = new URLSearchParams(search);
            for (const [key, value] of urlParams) {
                params[key] = value;
            }
        }
        return params;
    }

    async handlePopState(event) {
        const path = event.state?.path || window.location.pathname + window.location.search;
        await this.handleRoute(path);
    }

    async redirect(path, replace = true) {
        await this.navigate(path, { replace });
    }

    renderContent(content) {
        const appElement = document.getElementById('app') || document.body;
        
        if (typeof content === 'string') {
            appElement.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            appElement.innerHTML = '';
            appElement.appendChild(content);
        }
        
        this.initializePageScripts();
    }

    initializePageScripts() {
        const scripts = document.querySelectorAll('script[data-velocity-reinit]');
        scripts.forEach(script => {
            if (script.src) {
                const newScript = document.createElement('script');
                newScript.src = script.src;
                script.parentNode.replaceChild(newScript, script);
            } else {
                eval(script.textContent);
            }
        });
    }

    updatePageMeta(routeConfig, context) {
        if (routeConfig.title) {
            document.title = typeof routeConfig.title === 'function' 
                ? routeConfig.title(context)
                : routeConfig.title;
        }

        Object.entries(routeConfig.meta || {}).forEach(([name, content]) => {
            let metaTag = document.querySelector(`meta[name="${name}"]`);
            if (!metaTag) {
                metaTag = document.createElement('meta');
                metaTag.name = name;
                document.head.appendChild(metaTag);
            }
            metaTag.content = typeof content === 'function' ? content(context) : content;
        });
    }

    handle404(pathname) {
        this.logger.warn('Route not found:', pathname);
        
        const notFoundRoute = this.routes.get('*') || this.routes.get('/404');
        if (notFoundRoute) {
            this.executeRouteWithLayout(notFoundRoute, { 
                path: pathname, 
                params: {}, 
                query: {} 
            });
        } else {
            this.renderContent('<h1>404 - Page Not Found</h1><p>The requested page could not be found.</p>');
        }
    }

    handleNavigationError(error, path) {
        this.logger.error('Navigation error:', error);
        this.renderContent(`<h1>Navigation Error</h1><p>Failed to navigate to ${path}</p><p>${error.message}</p>`);
    }

    handleRouteError(error, context) {
        this.logger.error('Route error:', error);
        this.renderContent(`<h1>Route Error</h1><p>Failed to load ${context.path}</p><p>${error.message}</p>`);
    }

    showLoading() {
        document.body.classList.add('velocity-loading');
        
        if (!document.getElementById('velocity-loader')) {
            const loader = document.createElement('div');
            loader.id = 'velocity-loader';
            document.body.appendChild(loader);
        }
    }

    hideLoading() {
        document.body.classList.remove('velocity-loading');
        
        const loader = document.getElementById('velocity-loader');
        if (loader) {
            loader.remove();
        }
    }

    emitRouteChange(context) {
        // Emit router event
        this.emit('route:change', context);
        
        // Also emit as DOM event for compatibility
        const event = new CustomEvent('velocity:route:change', {
            detail: context
        });
        window.dispatchEvent(event);
    }

    clearCache() {
        this.pageCache.clear();
        this.layoutCache.clear();
        this.logger.info('Route caches cleared');
    }

    getCurrentRoute() {
        return this.currentRoute;
    }

    /**
     * Event system methods
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
        return this;
    }

    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
        return this;
    }

    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    this.logger.error('Router event callback error:', error);
                }
            });
        }
        return this;
    }

    /**
     * Get router statistics
     */
    getStats() {
        return {
            routeCount: this.routes.size,
            cacheSize: this.pageCache.size,
            currentRoute: this.currentRoute?.path || null,
            layoutCount: this.layouts.size,
            guardCount: this.routeGuards.size,
            transitionCount: this.transitions.size
        };
    }
} 