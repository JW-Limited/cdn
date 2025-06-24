/**
 * VelocityJS - Enhanced Modern Web Framework
 * A comprehensive framework providing Next.js-like features with vanilla JavaScript
 */

import { VelocityRouter } from './core/router.js';
import { VelocityStorage } from './core/storage.js';
import { VelocityNetwork } from './core/network.js';
import { VelocityLogger } from './core/logger.js';
import { VelocityUtils } from './core/utils.js';
import VelocityPWA from './core/pwa.js';
import VelocitySEO from './core/seo.js';
import VelocityWorkers from './core/workers.js';

export class VelocityJS {
    constructor(options = {}) {
        this.version = '2.0.0';
        this.options = {
            debug: true,
            historyMode: true,
            enableCache: true,
            enableOffline: true,
            logLevel: 'info',
            theme: 'auto',
            ...options
        };

        // Enhanced core modules
        this.logger = new VelocityLogger(this.options.debug);
        this.router = new VelocityRouter(this.options, this.logger);
        this.storage = new VelocityStorage(this.logger);
        this.network = new VelocityNetwork(this.logger);
        this.utils = new VelocityUtils(this.logger);
        
        // PWA and Modern Features
        this.pwa = new VelocityPWA({
            appName: this.options.appName || 'VelocityJS App',
            enableOffline: this.options.enableOffline,
            enablePushNotifications: this.options.enablePushNotifications || false,
            enableBackgroundSync: this.options.enableBackgroundSync !== false,
            ...this.options.pwa
        });
        
        this.seoEngine = new VelocitySEO({
            siteName: this.options.siteName || 'VelocityJS App',
            defaultTitle: this.options.defaultTitle || 'VelocityJS Application',
            defaultDescription: this.options.defaultDescription || 'A modern web application built with VelocityJS',
            ...this.options.seo
        });
        
        this.workers = new VelocityWorkers({
            maxWorkers: this.options.maxWorkers || navigator.hardwareConcurrency || 4,
            ...this.options.workers
        });

        // NEW: Enhanced features
        this.plugins = new Map();
        this.components = new Map();
        this.middlewares = [];
        this.hooks = new Map();
        this.state = new VelocityState(this.logger);
        this.head = new VelocityHead(this.logger);
        this.errorBoundary = new VelocityErrorBoundary(this.logger);
        this.devTools = new VelocityDevTools(this.logger, this.options.debug);
        
        
        // Component lifecycle
        this.lifecycle = {
            beforeMount: [],
            mounted: [],
            beforeUpdate: [],
            updated: [],
            beforeDestroy: [],
            destroyed: []
        };

        // Performance monitoring
        this.performance = {
            marks: new Map(),
            measures: new Map(),
            vitals: {}
        };

        // Event system
        this.events = new VelocityEventSystem(this.logger);
        
        // Theme system
        this.theme = new VelocityTheme(this.options.theme, this.logger);
        
        // I18n system
        this.i18n = new VelocityI18n(this.logger);
        
        // SEO utilities
        this.seo = new VelocitySEO(this.head, this.logger);

        this.initialized = false;
        this.mountedComponents = new Set();
        
        this.logger.info(`VelocityJS v${this.version} created`, this.options);
    }

    /**
     * Enhanced initialization with plugins and lifecycle
     */
    async init() {
        if (this.initialized) {
            this.logger.warn('VelocityJS already initialized');
            return this;
        }

        try {
            this.logger.time('velocity-init');
            
            // Initialize core modules
            await this.initializeCore();
            
            // Setup global features
            this.setupGlobalFeatures();
            
            // Initialize plugins
            await this.initializePlugins();
            
            // Setup history mode
            if (this.options.historyMode) {
                this.setupHistoryMode();
            }
            
            // Setup theme
            await this.theme.init();
            
            // Setup error boundary
            this.errorBoundary.setup();
            
            // Setup dev tools
            if (this.options.debug) {
                this.devTools.init();
            }
            
            // Initialize router
            await this.router.init();

            this.createErrorReporting();
            // Emit initialized event
            this.events.emit('velocity:initialized', this);
            
            this.initialized = true;
            
            this.logger.time('velocity-init').end();
            this.logger.info('VelocityJS fully initialized');
            
            return this;
            
        } catch (error) {
            this.logger.error('VelocityJS initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize core modules
     */
    async initializeCore() {
        // Router setup with enhanced features
        this.router.setDefaultLayout(this.createDefaultLayout());
        
        // Network setup
        this.network.setBaseURL(this.options.baseURL || '');
        this.network.setTimeout(this.options.timeout || 30000);
        
        this.logger.info('Core modules initialized');
    }

    /**
     * Setup global features
     */
    setupGlobalFeatures() {
        // Global error handling
        this.setupGlobalErrorHandling();
        
        // Performance monitoring
        this.setupPerformanceMonitoring();
        
        // Accessibility features
        this.setupAccessibility();
        
        // Service worker registration
        if (this.options.enableServiceWorker) {
            this.registerServiceWorker();
        }
        
        this.logger.debug('Global features setup complete');
    }

    /**
     * Plugin System
     */
    use(plugin, options = {}) {
        if (typeof plugin === 'function') {
            plugin = plugin(this, options);
        }
        
        if (plugin && plugin.name) {
            if (this.plugins.has(plugin.name)) {
                this.logger.warn(`Plugin ${plugin.name} already registered`);
                return this;
            }
            
            this.plugins.set(plugin.name, {
                plugin,
                options,
                enabled: true
            });
            
            this.logger.info(`Plugin registered: ${plugin.name}`);
        }
        
        return this;
    }

    /**
     * Initialize all plugins
     */
    async initializePlugins() {
        for (const [name, { plugin, options }] of this.plugins) {
            try {
                if (plugin.install) {
                    await plugin.install(this, options);
                }
                this.logger.debug(`Plugin initialized: ${name}`);
            } catch (error) {
                this.logger.error(`Plugin initialization failed: ${name}`, error);
            }
        }
    }

    /**
     * Component System
     */
    component(name, definition) {
        if (typeof definition === 'function') {
            definition = { render: definition };
        }
        
        const component = new VelocityComponent(name, definition, this);
        this.components.set(name, component);
        
        this.logger.info(`Component registered: ${name}`);
        return component;
    }

    /**
     * Create component instance
     */
    createComponent(name, props = {}) {
        const ComponentClass = this.components.get(name);
        if (!ComponentClass) {
            throw new Error(`Component not found: ${name}`);
        }
        
        return new ComponentClass(props);
    }

    /**
     * Mount component to DOM
     */
    async mountComponent(name, target, props = {}) {
        try {
            const component = this.createComponent(name, props);
            const element = typeof target === 'string' ? document.querySelector(target) : target;
            
            if (!element) {
                throw new Error(`Mount target not found: ${target}`);
            }
            
            // Run lifecycle hooks
            await this.runLifecycleHooks('beforeMount', component);
            
            // Render component
            const rendered = await component.render(props);
            if (typeof rendered === 'string') {
                element.innerHTML = rendered;
            } else if (rendered instanceof HTMLElement) {
                element.appendChild(rendered);
            }
            
            // Run mounted hooks
            await this.runLifecycleHooks('mounted', component);
            
            this.mountedComponents.add(component);
            this.logger.info(`Component mounted: ${name}`);
            
            return component;
            
        } catch (error) {
            this.logger.error(`Component mount failed: ${name}`, error);
            throw error;
        }
    }

    /**
     * State Management System
     */
    createStore(initialState = {}) {
        return this.state.createStore(initialState);
    }

    /**
     * Global state access
     */
    getState(key) {
        return this.state.get(key);
    }

    setState(key, value) {
        return this.state.set(key, value);
    }

    /**
     * Lifecycle Hooks
     */
    addLifecycleHook(phase, hook) {
        if (!this.lifecycle[phase]) {
            this.lifecycle[phase] = [];
        }
        this.lifecycle[phase].push(hook);
        return this;
    }

    async runLifecycleHooks(phase, component = null) {
        const hooks = this.lifecycle[phase] || [];
        for (const hook of hooks) {
            try {
                await hook(component, this);
            } catch (error) {
                this.logger.error(`Lifecycle hook error (${phase}):`, error);
            }
        }
    }

    /**
     * Enhanced Route Management
     */
    route(path, handler, options = {}) {
        // If handler is an object (route configuration), merge with options
        if (typeof handler === 'object' && handler !== null) {
            options = { ...handler, ...options };
            handler = null; // No specific handler function
        }
        
        // Enhanced route options
        const routeOptions = {
            ...options,
            middleware: [...this.middlewares, ...(options.middleware || [])],
            layout: options.layout || this.options.defaultLayout,
            meta: {
                title: options.title,
                description: options.description,
                keywords: options.keywords,
                ...options.meta
            }
        };
        
        this.router.addRoute(path, handler, routeOptions);
        return this;
    }

    /**
     * Page component with enhanced features
     */
    page(path, component, options = {}) {
        const pageHandler = async (context) => {
            try {
                // Create page component
                const pageComponent = this.createComponent(component, {
                    ...context,
                    query: context.query,
                    params: context.params
                });
                
                // Update head tags
                if (options.head) {
                    this.head.update(options.head, context);
                }
                
                // Update SEO
                if (options.seo) {
                    this.seo.update(options.seo, context);
                }
                
                // Render page
                return await pageComponent.render();
                
            } catch (error) {
                return this.errorBoundary.handlePageError(error, context);
            }
        };
        
        return this.route(path, pageHandler, options);
    }

    /**
     * API routes simulation
     */
    async api(path, handler, options = {}) {
        this.network.addMockResponse(path, options.method || 'GET', {
            data: typeof handler === 'function' ? await handler() : handler,
            status: options.status || 200,
            headers: options.headers || {}
        });
        
        this.logger.debug(`API route registered: ${options.method || 'GET'} ${path}`);
        return this;
    }

    /**
     * Head Management
     */
    setHead(headConfig) {
        this.head.update(headConfig);
        return this;
    }

    /**
     * SEO utilities
     */
    setSEO(seoConfig) {
        this.seo.update(seoConfig);
        return this;
    }

    /**
     * Theme Management
     */
    setTheme(theme) {
        this.theme.setTheme(theme);
        return this;
    }

    /**
     * Internationalization
     */
    setLocale(locale) {
        this.i18n.setLocale(locale);
        return this;
    }

    t(key, params = {}) {
        return this.i18n.translate(key, params);
    }

    /**
     * Enhanced Navigation
     */
    navigate(path, options = {}) {
        return this.router.navigate(path, options);
    }

    redirect(path, replace = true) {
        return this.router.redirect(path, replace);
    }

    back() {
        history.back();
    }

    forward() {
        history.forward();
    }

    /**
     * Performance Monitoring
     */
    setupPerformanceMonitoring() {
        // Web Vitals tracking
        this.trackWebVitals();
        
        // Custom performance marks
        this.addPerformanceMark = (name) => {
            performance.mark(name);
            this.performance.marks.set(name, performance.now());
        };
        
        this.measurePerformance = (name, startMark, endMark) => {
            performance.measure(name, startMark, endMark);
            const measure = performance.getEntriesByName(name, 'measure')[0];
            this.performance.measures.set(name, measure.duration);
            return measure.duration;
        };
    }

    trackWebVitals() {
        // This would integrate with web-vitals library if available
        if (typeof webVitals !== 'undefined') {
            webVitals.getCLS((metric) => {
                this.performance.vitals.CLS = metric.value;
                this.logger.info('CLS measured:', metric.value);
            });
            
            webVitals.getFID((metric) => {
                this.performance.vitals.FID = metric.value;
                this.logger.info('FID measured:', metric.value);
            });
            
            webVitals.getFCP((metric) => {
                this.performance.vitals.FCP = metric.value;
                this.logger.info('FCP measured:', metric.value);
            });
            
            webVitals.getLCP((metric) => {
                this.performance.vitals.LCP = metric.value;
                this.logger.info('LCP measured:', metric.value);
            });
        }
    }

    /**
     * Setup history mode
     */
    setupHistoryMode() {
        window.addEventListener('popstate', async (event) => {
            await this.router.handlePopState(event);
        });
        
        // Intercept link clicks
        document.addEventListener('click', (event) => {
            const link = event.target.closest('a[href]');
            if (link && !link.target && link.href.startsWith(window.location.origin)) {
                event.preventDefault();
                this.navigate(link.pathname + link.search);
            }
        });
    }

    /**
     * Global error handling
     */
    setupGlobalErrorHandling() {
        this.errorBoundary.setup();
        
        // Enhanced error reporting
        this.events.on('velocity:error', (error) => {
            if (this.options.errorReporting) {
                this.reportError(error);
            }
        });
    }

    /**
     * Accessibility setup
     */
    setupAccessibility() {
        // Skip link for screen readers
        this.createSkipLink();
        
        // Focus management
        this.setupFocusManagement();
        
        // ARIA live regions
        this.createLiveRegions();
    }

    createSkipLink() {
        const skipLink = document.createElement('a');
        skipLink.href = '#main-content';
        skipLink.className = 'velocity-skip-link';
        skipLink.textContent = 'Skip to main content';
        skipLink.style.cssText = `
            position: absolute;
            top: -40px;
            left: 6px;
            background: #000;
            color: #fff;
            padding: 8px;
            text-decoration: none;
            z-index: 1000;
        `;
        
        skipLink.addEventListener('focus', () => {
            skipLink.style.top = '6px';
        });
        
        skipLink.addEventListener('blur', () => {
            skipLink.style.top = '-40px';
        });
        
        document.body.insertBefore(skipLink, document.body.firstChild);
    }

    setupFocusManagement() {
        this.router.on('route:change', () => {
            // Focus management on route change
            const mainContent = document.getElementById('main-content') || document.querySelector('main');
            if (mainContent) {
                mainContent.focus();
            }
        });
    }

    createLiveRegions() {
        // Create ARIA live regions for announcements
        const liveRegion = document.createElement('div');
        liveRegion.id = 'velocity-live-region';
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        document.body.appendChild(liveRegion);
        
        // Create the announce method on the app instance
        this.announce = (message) => {
            const region = document.getElementById('velocity-live-region');
            if (region) {
                region.textContent = message;
                this.logger.debug('Announced:', message);
            }
        };

    }

    createErrorReporting() {
        const trackScript = document.createElement('script');
        trackScript.src = 'https://cdn.trackjs.com/agent/v3/latest/t.js';
        trackScript.async = true;
        
        trackScript.onload = () => {
            if (window.TrackJS) {
                window.TrackJS.install({
                    token: '2e92fe44a08f4fe7805549e3ea687b65',
                    application: "velocityjs",
                    version: this.version,
                });
            }
        };
        
        document.head.appendChild(trackScript);
    }

    /**
     * Service Worker registration
     */
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                this.logger.info('Service Worker registered:', registration);
            } catch (error) {
                this.logger.error('Service Worker registration failed:', error);
            }
        }
    }

    /**
     * Development tools
     */
    enableDevTools() {
        if (this.options.debug) {
            this.devTools.enable();
        }
    }

    /**
     * Default layout creator
     */
    createDefaultLayout() {
        return async (context) => {
            return `
                <!DOCTYPE html>
                <html lang="${this.i18n.currentLocale}">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    ${this.head.render()}
                </head>
                <body class="${this.theme.getBodyClasses()}">
                    <div id="app">
                        {{content}}
                    </div>
                    ${this.devTools.render()}
                </body>
                </html>
            `;
        };
    }

    /**
     * Utility methods
     */
    getStats() {
        return {
            version: this.version,
            initialized: this.initialized,
            components: this.components.size,
            plugins: this.plugins.size,
            mountedComponents: this.mountedComponents.size,
            router: this.router.getStats?.() || {},
            network: this.network.getStats(),
            storage: this.storage.getStats?.() || {},
            performance: this.performance
        };
    }

    /**
     * Clean up
     */
    destroy() {
        // Cleanup mounted components
        for (const component of this.mountedComponents) {
            if (component.destroy) {
                component.destroy();
            }
        }
        
        // Cleanup plugins
        for (const [name, { plugin }] of this.plugins) {
            if (plugin.destroy) {
                plugin.destroy();
            }
        }
        
        // Clear caches
        this.router.clearCache?.();
        this.network.clearCache();
        this.storage.clear?.();
        
        this.logger.info('VelocityJS destroyed');
    }

    /**
     * Factory method
     */
    static createApp(options = {}) {
        return new VelocityJS(options);
    }
}

// Additional Classes for Enhanced Features

/**
 * Enhanced State Management
 */
class VelocityState {
    constructor(logger) {
        this.logger = logger;
        this.stores = new Map();
        this.globalState = new Map();
        this.listeners = new Map();
    }

    createStore(initialState = {}) {
        const store = new VelocityStore(initialState, this.logger);
        this.stores.set(store.id, store);
        return store;
    }

    get(key) {
        return this.globalState.get(key);
    }

    set(key, value) {
        const oldValue = this.globalState.get(key);
        this.globalState.set(key, value);
        
        // Notify listeners
        const listeners = this.listeners.get(key) || [];
        listeners.forEach(listener => listener(value, oldValue));
    }

    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
        
        return () => {
            const listeners = this.listeners.get(key);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        };
    }
}

class VelocityStore {
    constructor(initialState, logger) {
        this.id = Date.now().toString(36);
        this.state = { ...initialState };
        this.logger = logger;
        this.mutations = new Map();
        this.actions = new Map();
        this.getters = new Map();
        this.listeners = [];
    }

    commit(mutation, payload) {
        const mutationFn = this.mutations.get(mutation);
        if (mutationFn) {
            const oldState = { ...this.state };
            mutationFn(this.state, payload);
            this.notify(oldState);
        }
    }

    dispatch(action, payload) {
        const actionFn = this.actions.get(action);
        if (actionFn) {
            return actionFn({
                commit: this.commit.bind(this),
                state: this.state,
                getters: this.getters
            }, payload);
        }
    }

    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    notify(oldState) {
        this.listeners.forEach(listener => listener(this.state, oldState));
    }
}

/**
 * Head Management
 */
class VelocityHead {
    constructor(logger) {
        this.logger = logger;
        this.tags = {
            title: '',
            meta: new Map(),
            link: new Map(),
            script: new Map()
        };
    }

    update(headConfig, context = {}) {
        if (headConfig.title) {
            this.setTitle(headConfig.title, context);
        }

        if (headConfig.meta) {
            Object.entries(headConfig.meta).forEach(([name, content]) => {
                this.setMeta(name, content, context);
            });
        }

        if (headConfig.link) {
            Object.entries(headConfig.link).forEach(([rel, href]) => {
                this.setLink(rel, href, context);
            });
        }

        this.updateDOM();
    }

    setTitle(title, context = {}) {
        this.tags.title = typeof title === 'function' ? title(context) : title;
        document.title = this.tags.title;
    }

    setMeta(name, content, context = {}) {
        const processedContent = typeof content === 'function' ? content(context) : content;
        this.tags.meta.set(name, processedContent);
    }

    setLink(rel, href, context = {}) {
        const processedHref = typeof href === 'function' ? href(context) : href;
        this.tags.link.set(rel, processedHref);
    }

    updateDOM() {
        // Update meta tags
        for (const [name, content] of this.tags.meta) {
            let metaTag = document.querySelector(`meta[name="${name}"]`);
            if (!metaTag) {
                metaTag = document.createElement('meta');
                metaTag.name = name;
                document.head.appendChild(metaTag);
            }
            metaTag.content = content;
        }

        // Update link tags
        for (const [rel, href] of this.tags.link) {
            let linkTag = document.querySelector(`link[rel="${rel}"]`);
            if (!linkTag) {
                linkTag = document.createElement('link');
                linkTag.rel = rel;
                document.head.appendChild(linkTag);
            }
            linkTag.href = href;
        }
    }

    render() {
        let html = '';
        
        if (this.tags.title) {
            html += `<title>${this.tags.title}</title>\n`;
        }

        for (const [name, content] of this.tags.meta) {
            html += `<meta name="${name}" content="${content}">\n`;
        }

        for (const [rel, href] of this.tags.link) {
            html += `<link rel="${rel}" href="${href}">\n`;
        }

        return html;
    }
}

/**
 * Component System
 */
class VelocityComponent {
    constructor(name, definition, app) {
        this.name = name;
        this.app = app;
        this.props = {};
        this.state = {};
        this.mounted = false;
        
        Object.assign(this, definition);
    }

    async render(props = {}) {
        this.props = { ...this.props, ...props };
        
        if (this.beforeRender) {
            await this.beforeRender();
        }
        
        const result = await this.template(this.props, this.state);
        
        if (this.afterRender) {
            await this.afterRender();
        }
        
        return result;
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        if (this.mounted && this.onStateChange) {
            this.onStateChange(this.state);
        }
    }

    template() {
        return '<div>Component Template Not Defined</div>';
    }
}

/**
 * Error Boundary
 */
class VelocityErrorBoundary {
    constructor(logger) {
        this.logger = logger;
        this.errorHandlers = new Map();
    }

    setup() {
        window.addEventListener('error', this.handleError.bind(this));
        window.addEventListener('unhandledrejection', this.handlePromiseError.bind(this));
    }

    handleError(event) {
        this.logger.error('Global Error:', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack
        });
    }

    handlePromiseError(event) {
        this.logger.error('Unhandled Promise Rejection:', event.reason);
    }

    handlePageError(error, context) {
        this.logger.error('Page Error:', error);
        return `
            <div class="error-boundary">
                <h1>Something went wrong</h1>
                <p>An error occurred while loading this page.</p>
                ${this.logger.debug ? `<pre>${error.stack}</pre>` : ''}
            </div>
        `;
    }
}

/**
 * Theme System
 */
class VelocityTheme {
    constructor(initialTheme, logger) {
        this.logger = logger;
        this.currentTheme = initialTheme;
        this.themes = new Map();
        this.customProperties = new Map();
    }

    async init() {
        this.applyTheme(this.currentTheme);
    }

    setTheme(theme) {
        this.currentTheme = theme;
        this.applyTheme(theme);
        localStorage.setItem('velocity-theme', theme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        // Apply custom properties
        if (this.themes.has(theme)) {
            const themeConfig = this.themes.get(theme);
            Object.entries(themeConfig.properties || {}).forEach(([prop, value]) => {
                document.documentElement.style.setProperty(prop, value);
            });
        }
    }

    getBodyClasses() {
        return `velocity-theme-${this.currentTheme}`;
    }
}

/**
 * Event System
 */
class VelocityEventSystem {
    constructor(logger) {
        this.logger = logger;
        this.listeners = new Map();
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    this.logger.error('Event callback error:', error);
                }
            });
        }
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const listeners = this.listeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
}

/**
 * Internationalization
 */
class VelocityI18n {
    constructor(logger) {
        this.logger = logger;
        this.currentLocale = 'en';
        this.messages = new Map();
        this.fallbackLocale = 'en';
    }

    setLocale(locale) {
        this.currentLocale = locale;
        document.documentElement.lang = locale;
    }

    addMessages(locale, messages) {
        this.messages.set(locale, { ...this.messages.get(locale), ...messages });
    }

    translate(key, params = {}) {
        const messages = this.messages.get(this.currentLocale) || this.messages.get(this.fallbackLocale) || {};
        let message = messages[key] || key;
        
        // Simple parameter replacement
        Object.entries(params).forEach(([param, value]) => {
            message = message.replace(`{${param}}`, value);
        });
        
        return message;
    }
}

/**
 * Development Tools
 */
class VelocityDevTools {
    constructor(logger, enabled = false) {
        this.logger = logger;
        this.enabled = enabled;
        this.panel = null;
    }

    init() {
        if (this.enabled) {
            this.createDevPanel();
        }
    }

    enable() {
        this.enabled = true;
        this.createDevPanel();
    }

    createDevPanel() {
        // Create a simple dev panel
        this.panel = document.createElement('div');
        this.panel.id = 'velocity-dev-tools';
        this.panel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #333;
            color: #fff;
            padding: 10px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 10000;
            max-width: 300px;
        `;
        
        this.updatePanel();
        document.body.appendChild(this.panel);
    }

    updatePanel() {
        if (this.panel) {
            this.panel.innerHTML = `
                <strong>VelocityJS DevTools</strong><br>
                Version: ${VelocityJS.prototype.version || '2.0.0'}<br>
                <button onclick="console.log(window.velocity.getStats())">Log Stats</button>
            `;
        }
    }

    render() {
        return this.enabled ? `<script>window.velocity = arguments[0];</script>` : '';
    }
}

// Export the main class
export default VelocityJS;

// Also export factory function
export const createApp = (options) => new VelocityJS(options);