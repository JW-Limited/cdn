/**
 * Interface representing metrics for individual resources loaded by the page
 */
interface ResourceMetrics {
    /** Duration of resource load in milliseconds */
    duration: number;
    /** Type of resource initiator (e.g. script, link, img) */
    initiatorType: string;
    /** Size of transferred resource in bytes */
    transferSize?: number;
    /** Size of encoded resource body in bytes */
    encodedBodySize?: number;
    /** Size of decoded resource body in bytes */
    decodedBodySize?: number;
}

/**
 * Interface representing core web vital performance metrics
 */
interface PerformanceMetrics {
    /** First Contentful Paint in milliseconds */
    fcp: number;
    /** Largest Contentful Paint in milliseconds */
    lcp: number;
    /** First Input Delay in milliseconds */
    fid: number;
    /** Cumulative Layout Shift score */
    cls: number;
}

/**
 * Interface representing all Quality of Service metrics
 */
interface QoSMetrics {
    /** Total page load time in milliseconds */
    pageLoadTime: number;
    /** Map of resource URLs to their load metrics */
    resourceLoadTimes: {[key: string]: ResourceMetrics};
    /** Memory usage statistics */
    memoryUsage: {
        /** Currently used heap size in bytes */
        usedHeap: number;
        /** Total allocated heap size in bytes */
        totalHeap: number;
        /** Maximum heap size limit in bytes */
        heapLimit: number;
    };
    /** Frame rate statistics */
    frameRate: {
        /** Current frame rate */
        current: number;
        /** Minimum recorded frame rate */
        min: number;
        /** Maximum recorded frame rate */
        max: number;
        /** Average frame rate */
        average: number;
    };
    /** Network performance metrics */
    networkMetrics: {
        /** Network latency in milliseconds */
        latency: number;
        /** Effective bandwidth estimate in Mbps */
        downlink: number;
        /** Round trip time in milliseconds */
        rtt: number;
        /** Effective connection type */
        effectiveType: string;
    };
    /** Core web vital metrics */
    performanceMetrics: PerformanceMetrics;
    /** Array of recorded errors */
    errors: Array<{
        /** Error message */
        message: string;
        /** Timestamp when error occurred */
        timestamp: number;
        /** Error stack trace if available */
        stack?: string;
        /** Type of error */
        type: 'error' | 'unhandledrejection' | 'network';
    }>;
    /** Timestamp of last metrics update */
    lastUpdate: number;
}

/** 
   ------------------------------------------------------------------------------
   Copyright (c) 2025 JW Limited. All rights reserved.

   Project: JWLimited.WebFramework
   @module: Service
   @class: QoSManager
   
   @file: quality.ts 
   @constructor Creates a new instance of QoSManager.

   Company: JW Limited (licensed);
   Author: Joe Valentino Lengefeld (CEO)
   

   This software is proprietary to JW Limited and constitutes valuable 
   intellectual property. It is entrusted solely to employees named above
   and may not be disclosed, copied, reproduced, transmitted, or used in 
   any manner outside of the scope of its license without prior written
   authorization from JW Limited.
   ------------------------------------------------------------------------------
*/
class QoSManager {
    private static instance: QoSManager;
    private metrics: QoSMetrics;
    private frameHistory: number[] = [];
    private readonly MAX_FRAME_HISTORY = 60;
    private frameCounter: number = 0;
    private lastFrameTime: number = 0;
    private readonly NETWORK_CHECK_INTERVAL = 30000;
    private readonly MEMORY_CHECK_INTERVAL = 5000;

    private constructor() {
        this.metrics = {
            pageLoadTime: 0,
            resourceLoadTimes: {},
            memoryUsage: {
                usedHeap: 0,
                totalHeap: 0,
                heapLimit: 0
            },
            frameRate: {
                current: 0,
                min: Infinity,
                max: 0,
                average: 0
            },
            networkMetrics: {
                latency: 0,
                downlink: 0,
                rtt: 0,
                effectiveType: 'unknown'
            },
            performanceMetrics: {
                fcp: 0,
                lcp: 0,
                fid: 0,
                cls: 0
            },
            errors: [],
            lastUpdate: Date.now()
        };

        this.initializeMetrics();
        this.startMonitoring();
    }

    /**
     * Initializes performance and resource metrics
     */
    private async initializeMetrics(): Promise<void> {
        if (window.performance) {
            const perfEntries = performance.getEntriesByType('navigation');
            this.metrics.pageLoadTime = perfEntries.length > 0 
                ? (perfEntries[0] as PerformanceNavigationTiming).loadEventEnd
                : performance.now();

            await this.initializeWebVitals();
        }

        if (window.performance && window.performance.getEntriesByType) {
            const resources = window.performance.getEntriesByType('resource');
            resources.forEach(resource => {
                const resourceMetric: ResourceMetrics = {
                    duration: resource.duration,
                    initiatorType: (resource as PerformanceResourceTiming).initiatorType,
                    transferSize: (resource as PerformanceResourceTiming).transferSize,
                    encodedBodySize: (resource as PerformanceResourceTiming).encodedBodySize,
                    decodedBodySize: (resource as PerformanceResourceTiming).decodedBodySize
                };
                this.metrics.resourceLoadTimes[resource.name] = resourceMetric;
            });
        }
    }

    /**
     * Initializes web vitals monitoring
     */
    private async initializeWebVitals(): Promise<void> {
        const observer = new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
                if (entry.entryType === 'largest-contentful-paint') {
                    this.metrics.performanceMetrics.lcp = entry.startTime;
                } else if (entry.entryType === 'first-input') {
                    this.metrics.performanceMetrics.fid = (entry as PerformanceEventTiming).processingStart - entry.startTime;
                }
            }
        });

        observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
    }

    /**
     * Starts all monitoring processes
     */
    private startMonitoring(): void {
        this.monitorFrameRate();
        this.monitorMemory();
        //this.monitorNetwork();
        this.setupErrorListeners();
    }

    /**
     * Monitors frame rate using requestAnimationFrame
     */
    private monitorFrameRate(): void {
        const measureFrameRate = () => {
            const now = performance.now();
            this.frameCounter++;

            if (now - this.lastFrameTime >= 1000) {
                const currentFPS = this.frameCounter;
                this.frameHistory.push(currentFPS);
                if (this.frameHistory.length > this.MAX_FRAME_HISTORY) {
                    this.frameHistory.shift();
                }

                this.metrics.frameRate.current = currentFPS;
                this.metrics.frameRate.min = Math.min(this.metrics.frameRate.min, currentFPS);
                this.metrics.frameRate.max = Math.max(this.metrics.frameRate.max, currentFPS);
                this.metrics.frameRate.average = this.frameHistory.reduce((a, b) => a + b, 0) / this.frameHistory.length;

                this.frameCounter = 0;
                this.lastFrameTime = now;
            }

            requestAnimationFrame(measureFrameRate);
        };
        requestAnimationFrame(measureFrameRate);
    }

    /**
     * Monitors memory usage at regular intervals
     */
    private monitorMemory(): void {
        setInterval(() => {
            if (window.performance && (performance as any).memory) {
                const memory = (performance as any).memory;
                this.metrics.memoryUsage = {
                    usedHeap: memory.usedJSHeapSize,
                    totalHeap: memory.totalJSHeapSize,
                    heapLimit: memory.jsHeapSizeLimit
                };
            }
        }, this.MEMORY_CHECK_INTERVAL);
    }

    /**
     * Monitors network performance at regular intervals
     */
    private monitorNetwork(): void {
        setInterval(async () => {
            const start = Date.now();
            try {
                const connection = (navigator as any).connection;
                if (connection) {
                    this.metrics.networkMetrics.downlink = connection.downlink;
                    this.metrics.networkMetrics.rtt = connection.rtt;
                    this.metrics.networkMetrics.effectiveType = connection.effectiveType;
                }

                const response = await fetch('./email/icon.png');
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                this.metrics.networkMetrics.latency = Date.now() - start;
            } catch (error) {
                this.metrics.errors.push({
                    message: error.message,
                    timestamp: Date.now(),
                    stack: error.stack,
                    type: 'network'
                });
            }
        }, this.NETWORK_CHECK_INTERVAL);
    }

    /**
     * Sets up error event listeners
     */
    private setupErrorListeners(): void {
        window.addEventListener('error', (event) => {
            this.metrics.errors.push({
                message: event.message,
                timestamp: Date.now(),
                stack: event.error?.stack,
                type: 'error'
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.metrics.errors.push({
                message: event.reason.toString(),
                timestamp: Date.now(),
                stack: event.reason?.stack,
                type: 'unhandledrejection'
            });
        });
    }

    /**
     * Gets singleton instance of QoSManager
     * @returns QoSManager instance
     */
    public static getInstance(): QoSManager {
        if (!QoSManager.instance) {
            QoSManager.instance = new QoSManager();
        }
        return QoSManager.instance;
    }

    /**
     * Gets current metrics
     * @returns Copy of current QoS metrics
     */
    public getMetrics(): QoSMetrics {
        this.metrics.lastUpdate = Date.now();
        return structuredClone(this.metrics);
    }
}

/**
 * Initializes QoSManager
 * @returns QoSManager singleton instance
 */
export function init(): QoSManager {
    return QoSManager.getInstance();
}
