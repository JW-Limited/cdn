/**
 * VelocityLogger - Enhanced logging system for VelocityJS
 * Provides comprehensive logging with performance monitoring and analytics
 */

export class VelocityLogger {
    constructor(debug = false) {
        this.debugEnabled = debug;
        this.logLevel = debug ? 'debug' : 'info';
        this.logs = [];
        this.maxLogs = 1000;
        this.enableConsole = true;
        this.enableStorage = true;
        this.storageKey = 'velocity_logs';
        
        // Enhanced features
        this.performanceMarks = new Map();
        this.errorBoundaries = new Map();
        this.analyticsEndpoint = null;
        this.sessionId = this.generateSessionId();
        this.userAgent = navigator.userAgent;
        this.startTime = Date.now();
        
        // Performance monitoring
        this.performanceObserver = null;
        this.vitalsMetrics = {
            FCP: null,  // First Contentful Paint
            LCP: null,  // Largest Contentful Paint
            FID: null,  // First Input Delay
            CLS: null   // Cumulative Layout Shift
        };
        
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            trace: 4
        };

        this.colors = {
            error: '#ff4757',
            warn: '#ffa502',
            info: '#3742fa',
            debug: '#2ed573',
            trace: '#a4b0be'
        };

        // Event listeners for enhanced features
        this.eventListeners = new Map();

        this.init();
    }

    /**
     * Initialize enhanced logger
     */
    init() {
        if (this.enableStorage) {
            this.loadLogsFromStorage();
        }
        
        this.setupGlobalErrorHandler();
        this.setupPerformanceMonitoring();
        this.setupUnloadHandler();
        
        this.info('VelocityLogger Enhanced initialized', {
            sessionId: this.sessionId,
            userAgent: this.userAgent,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Setup enhanced global error handler
     */
    setupGlobalErrorHandler() {
        // Capture unhandled errors
        window.addEventListener('error', (event) => {
            this.error('Global Error:', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                timestamp: Date.now(),
                url: window.location.href,
                sessionId: this.sessionId
            });
        });

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.error('Unhandled Promise Rejection:', {
                reason: event.reason,
                stack: event.reason?.stack,
                timestamp: Date.now(),
                url: window.location.href,
                sessionId: this.sessionId
            });
        });
    }

    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Web Vitals monitoring
        if ('PerformanceObserver' in window) {
            this.setupWebVitals();
        }

        // Navigation timing
        if (performance.timing) {
            this.logNavigationTiming();
        }

        // Resource timing
        this.logResourceTiming();
    }

    /**
     * Setup Web Vitals monitoring
     */
    setupWebVitals() {
        try {
            // First Contentful Paint
            const paintObserver = new PerformanceObserver((entryList) => {
                for (const entry of entryList.getEntries()) {
                    if (entry.name === 'first-contentful-paint') {
                        this.vitalsMetrics.FCP = entry.startTime;
                        this.info('Web Vital - First Contentful Paint', {
                            value: entry.startTime,
                            unit: 'ms'
                        });
                    }
                }
            });
            paintObserver.observe({ entryTypes: ['paint'] });

            // Largest Contentful Paint
            const lcpObserver = new PerformanceObserver((entryList) => {
                const entries = entryList.getEntries();
                const lastEntry = entries[entries.length - 1];
                this.vitalsMetrics.LCP = lastEntry.startTime;
                this.info('Web Vital - Largest Contentful Paint', {
                    value: lastEntry.startTime,
                    element: lastEntry.element?.tagName,
                    unit: 'ms'
                });
            });
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        } catch (error) {
            this.warn('Performance monitoring setup failed:', error);
        }
    }

    /**
     * Log navigation timing
     */
    logNavigationTiming() {
        window.addEventListener('load', () => {
            setTimeout(() => {
                const timing = performance.timing;
                const navigationMetrics = {
                    domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                    pageLoad: timing.loadEventEnd - timing.navigationStart,
                    domReady: timing.domComplete - timing.navigationStart
                };
                
                this.info('Navigation Timing', navigationMetrics);
            }, 0);
        });
    }

    /**
     * Log resource timing
     */
    logResourceTiming() {
        window.addEventListener('load', () => {
            setTimeout(() => {
                const resources = performance.getEntriesByType('resource');
                const slowResources = resources.filter(r => r.duration > 1000);
                
                if (slowResources.length > 0) {
                    this.warn('Slow Resources Detected', {
                        count: slowResources.length,
                        resources: slowResources.map(r => ({
                            name: r.name,
                            duration: r.duration,
                            size: r.transferSize
                        }))
                    });
                }
            }, 1000);
        });
    }

    /**
     * Setup unload handler
     */
    setupUnloadHandler() {
        window.addEventListener('beforeunload', () => {
            this.logSessionSummary();
            this.sendAnalytics();
        });
    }

    /**
     * Create log entry
     */
    createLogEntry(level, message, data = null) {
        const entry = {
            id: this.generateId(),
            level,
            message,
            data,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            url: window.location.href,
            userAgent: this.userAgent,
            memory: this.getMemoryUsage(),
            viewport: this.getViewportInfo(),
            connection: this.getConnectionInfo()
        };

        // Add stack trace for errors
        if (level === 'error' && !data?.stack) {
            entry.stack = new Error().stack;
        }

        return entry;
    }

    /**
     * Get memory usage information
     */
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }

    /**
     * Get viewport information
     */
    getViewportInfo() {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio
        };
    }

    /**
     * Get connection information
     */
    getConnectionInfo() {
        if (navigator.connection) {
            return {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt,
                saveData: navigator.connection.saveData
            };
        }
        return null;
    }

    /**
     * Performance timing methods
     */
    time(label) {
        const startTime = performance.now();
        const markName = `velocity-timer-${label}`;
        
        if (performance.mark) {
            performance.mark(`${markName}-start`);
        }
        
        this.performanceMarks.set(label, {
            startTime,
            markName
        });
        
        return {
            end: () => {
                const endTime = performance.now();
                const duration = endTime - startTime;
                
                if (performance.mark && performance.measure) {
                    performance.mark(`${markName}-end`);
                    performance.measure(markName, `${markName}-start`, `${markName}-end`);
                }
                
                this.performanceMarks.delete(label);
                
                this.info(`Timer ${label}:`, { 
                    duration: `${duration.toFixed(2)}ms`,
                    startTime,
                    endTime
                });
                
                return duration;
            }
        };
    }

    /**
     * Event system for logger
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
        return this;
    }

    /**
     * Emit logger events
     */
    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    this.error('Event callback error:', error);
                }
            });
        }
    }

    /**
     * Enhanced logging methods
     */
    error(message, data = null) {
        if (!this.shouldLog('error')) return;
        const entry = this.createLogEntry('error', message, data);
        this.addLog(entry);
        this.emit('error', entry);
        return entry;
    }

    warn(message, data = null) {
        if (!this.shouldLog('warn')) return;
        const entry = this.createLogEntry('warn', message, data);
        this.addLog(entry);
        this.emit('warn', entry);
        return entry;
    }

    info(message, data = null) {
        if (!this.shouldLog('info')) return;
        const entry = this.createLogEntry('info', message, data);
        this.addLog(entry);
        this.emit('info', entry);
        return entry;
    }

    debug(message, data = null) {
        if (!this.shouldLog('debug')) return;
        const entry = this.createLogEntry('debug', message, data);
        this.addLog(entry);
        this.emit('debug', entry);
        return entry;
    }

    trace(message, data = null) {
        if (!this.shouldLog('trace')) return;
        const entry = this.createLogEntry('trace', message, data);
        this.addLog(entry);
        this.emit('trace', entry);
        return entry;
    }

    shouldLog(level) {
        return this.levels[level] <= this.levels[this.logLevel];
    }

    addLog(entry) {
        this.logs.push(entry);
        
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        if (this.enableStorage) {
            this.saveLogsToStorage();
        }

        if (this.enableConsole) {
            this.outputToConsole(entry);
        }

        this.emitLogEvent(entry);
    }

    outputToConsole(entry) {
        const { level, message, data, timestamp } = entry;
        const color = this.colors[level];
        const timeStr = new Date(timestamp).toLocaleTimeString();
        
        const args = [
            `%c[${level.toUpperCase()}] %c${timeStr} %c${message}`,
            `color: ${color}; font-weight: bold;`,
            'color: #666; font-size: 0.9em;',
            'color: inherit;'
        ];

        if (data !== null) {
            args.push('\n', data);
        }

        switch (level) {
            case 'error':
                console.error(...args);
                break;
            case 'warn':
                console.warn(...args);
                break;
            case 'info':
                console.info(...args);
                break;
            case 'debug':
                console.debug(...args);
                break;
            case 'trace':
                console.trace(...args);
                break;
            default:
                console.log(...args);
        }
    }

    loadLogsFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                this.logs = JSON.parse(stored);
            }
        } catch (error) {
            console.warn('Failed to load logs from storage:', error);
        }
    }

    saveLogsToStorage() {
        try {
            const recentLogs = this.logs.slice(-100);
            localStorage.setItem(this.storageKey, JSON.stringify(recentLogs));
        } catch (error) {
            console.warn('Failed to save logs to storage:', error);
        }
    }

    emitLogEvent(entry) {
        const event = new CustomEvent('velocity:log', {
            detail: entry
        });
        window.dispatchEvent(event);
    }

    getLogs(level = null) {
        if (level) {
            return this.logs.filter(log => log.level === level);
        }
        return [...this.logs];
    }

    clearLogs() {
        this.logs = [];
        if (this.enableStorage) {
            localStorage.removeItem(this.storageKey);
        }
        this.info('Logs cleared');
    }

    setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.logLevel = level;
            this.info('Log level changed to:', level);
        } else {
            this.warn('Invalid log level:', level);
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    generateSessionId() {
        return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2);
    }

    getPerformanceSummary() {
        const summary = {
            activeTimers: this.performanceMarks.size,
            errorCount: this.logs.filter(log => log.level === 'error').length,
            warningCount: this.logs.filter(log => log.level === 'warn').length,
            sessionDuration: Date.now() - this.startTime
        };

        if (performance.timing) {
            summary.pageLoadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        }

        return summary;
    }

    logSessionSummary() {
        const summary = {
            sessionId: this.sessionId,
            duration: Date.now() - this.startTime,
            totalLogs: this.logs.length,
            errorCount: this.logs.filter(log => log.level === 'error').length,
            warningCount: this.logs.filter(log => log.level === 'warn').length,
            vitals: this.vitalsMetrics,
            performance: this.getPerformanceSummary()
        };

        this.info('Session Summary', summary);
    }

    async sendAnalytics() {
        if (!this.analyticsEndpoint) return;

        try {
            const analyticsData = {
                sessionId: this.sessionId,
                logs: this.logs.slice(-50),
                vitals: this.vitalsMetrics,
                performance: this.getPerformanceSummary(),
                userAgent: this.userAgent,
                timestamp: new Date().toISOString(),
                sessionDuration: Date.now() - this.startTime
            };

            await fetch(this.analyticsEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(analyticsData)
            });

            this.debug('Analytics data sent successfully');
        } catch (error) {
            this.warn('Failed to send analytics data:', error);
        }
    }

    getStats() {
        const stats = {
            total: this.logs.length,
            byLevel: {},
            sessionDuration: Date.now() - this.startTime,
            vitals: this.vitalsMetrics,
            performance: this.getPerformanceSummary()
        };

        Object.keys(this.levels).forEach(level => {
            stats.byLevel[level] = this.logs.filter(log => log.level === level).length;
        });

        return stats;
    }
}
 