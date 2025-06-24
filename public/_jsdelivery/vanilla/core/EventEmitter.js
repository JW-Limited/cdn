/*
*
* File: EventEmitter.js
* Project: simply_mail
* Type: JS
* Author: Joe_Valentino_Lengefeld
* Created: 2025-02-20
* Modified: 2025-03-15
*
* Copyright (c) 2025 JW Limited. All rights reserved.
* This file is part of simply_mail and is provided under the terms of the
* license agreement accompanying it. This file may not be copied, modified,
* or distributed except according to those terms.
*
*/

"use strict";

class EventError extends Error {
    constructor(message) {
        super(message);
        this.name = 'EventError';
    }
}

class EventOptions extends JWBase {
    constructor({
        maxListeners = 10,
        async = false,
        timeout = 5000,
        priority = 0
    } = {}) {
        super();
        this.maxListeners = maxListeners;
        this.async = async;
        this.timeout = timeout;
        this.priority = priority;
    }
}

class EventListener extends JWBase {
    constructor(callback, options = new EventOptions()) {
        super();
        this.callback = callback;
        this.options = options;
        this.executionCount = 0;
        this.lastExecuted = null;
    }

    async execute(data) {
        try {
            if (this.options.async) {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new EventError('Listener execution timeout')), this.options.timeout);
                });
                
                await Promise.race([
                    Promise.resolve(this.callback(data)),
                    timeoutPromise
                ]);
            } else {
                this.callback(data);
            }
            
            this.executionCount++;
            this.lastExecuted = new Date();
        } catch (error) {
            throw new EventError(`Listener execution failed: ${error.message}`);
        }
    }
}

class EventQueue extends JWBase {
    constructor() {
        super();
        this.queue = new Map();
    }

    add(event, listener) {
        if (!this.queue.has(event)) {
            this.queue.set(event, []);
        }
        
        const listeners = this.queue.get(event);
        listeners.push(listener);
        
        listeners.sort((a, b) => b.options.priority - a.options.priority);
    }

    remove(event, callback) {
        if (!this.queue.has(event)) return;
        const listeners = this.queue.get(event);
        const index = listeners.findIndex(listener => listener.callback === callback);
        if (index !== -1) {
            listeners.splice(index, 1);
        }
    }

    get(event) {
        return this.queue.get(event) || [];
    }

    clear(event) {
        if (event) {
            this.queue.delete(event);
        } else {
            this.queue.clear();
        }
    }
}

class EventMetrics extends JWBase {
    constructor() {
        super();
        this.emitCount = new Map();
        this.listenerStats = new Map();
    }

    recordEmit(event) {
        this.emitCount.set(event, (this.emitCount.get(event) || 0) + 1);
    }

    recordListenerExecution(event, executionTime) {
        if (!this.listenerStats.has(event)) {
            this.listenerStats.set(event, {
                totalExecutions: 0,
                averageExecutionTime: 0,
                lastExecuted: null
            });
        }

        const stats = this.listenerStats.get(event);
        stats.totalExecutions++;
        stats.averageExecutionTime = (stats.averageExecutionTime * (stats.totalExecutions - 1) + executionTime) / stats.totalExecutions;
        stats.lastExecuted = new Date();
    }

    getEventStats(event) {
        return {
            emitCount: this.emitCount.get(event) || 0,
            listenerStats: this.listenerStats.get(event) || null
        };
    }

    reset() {
        this.emitCount.clear();
        this.listenerStats.clear();
    }
}

class EventEmitter extends JWBase {
    constructor(options = new EventOptions()) {
        super();
        this.defaultOptions = options;
        this.queue = new EventQueue();
        this.metrics = new EventMetrics();
    }

    on(event, callback, options = this.defaultOptions) {
        const listener = new EventListener(callback, options);
        
        if (this.queue.get(event).length >= options.maxListeners) {
            throw new EventError(`Max listeners (${options.maxListeners}) exceeded for event: ${event}`);
        }
        
        this.queue.add(event, listener);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        this.queue.remove(event, callback);
    }

    async emit(event, data) {
        const start = Date.now();
        const listeners = this.queue.get(event);
        
        this.metrics.recordEmit(event);
        
        try {
            if (listeners.some(listener => listener.options.async)) {
                await Promise.all(
                    listeners.map(listener => listener.execute(data))
                );
            } else {
                for (const listener of listeners) {
                    await listener.execute(data);
                }
            }
        } catch (error) {
            throw new EventError(`Event emission failed: ${error.message}`);
        }
        
        const executionTime = Date.now() - start;
        this.metrics.recordListenerExecution(event, executionTime);
    }

    once(event, callback, options = this.defaultOptions) {
        const onceCallback = async (data) => {
            this.off(event, onceCallback);
            await callback(data);
        };
        
        return this.on(event, onceCallback, options);
    }

    removeAllListeners(event) {
        this.queue.clear(event);
    }

    listenerCount(event) {
        return this.queue.get(event).length;
    }

    eventNames() {
        return Array.from(this.queue.queue.keys());
    }

    getMetrics(event) {
        return this.metrics.getEventStats(event);
    }

    resetMetrics() {
        this.metrics.reset();
    }
}

class PrioritizedEventEmitter extends EventEmitter {
    constructor(options = new EventOptions()) {
        super(options);
    }

    addHighPriority(event, callback, options = this.defaultOptions) {
        return this.on(event, callback, { ...options, priority: 100 });
    }

    addLowPriority(event, callback, options = this.defaultOptions) {
        return this.on(event, callback, { ...options, priority: -100 });
    }
}

class AsyncEventEmitter extends EventEmitter {
    constructor(options = new EventOptions()) {
        super({ ...options, async: true });
    }

    async emitSequential(event, data) {
        const listeners = this.queue.get(event);
        for (const listener of listeners) {
            await listener.execute(data);
        }
    }

    async emitParallel(event, data) {
        const listeners = this.queue.get(event);
        await Promise.all(listeners.map(listener => listener.execute(data)));
    }
}

class DebugEventEmitter extends EventEmitter {
    constructor(options = new EventOptions()) {
        super(options);
        this.debug = true;
    }

    on(event, callback, options = this.defaultOptions) {
        console.debug(`Adding listener for event: ${event}`);
        return super.on(event, async (data) => {
            console.debug(`Executing listener for event: ${event}`, { data });
            await callback(data);
        }, options);
    }

    async emit(event, data) {
        console.debug(`Emitting event: ${event}`, { data });
        await super.emit(event, data);
        console.debug(`Finished emitting event: ${event}`);
    }
}

class DOMEventBridge extends JWBase {
    constructor(element, eventEmitter) {
        super();
        this.element = element;
        this.emitter = eventEmitter;
        this.domListeners = new Map();
    }

    bind(domEvent, emitterEvent) {
        const handler = (e) => this.emitter.emit(emitterEvent, e);
        this.element.addEventListener(domEvent, handler);
        this.domListeners.set(domEvent, handler);
        return this;
    }

    unbind(domEvent) {
        const handler = this.domListeners.get(domEvent);
        if (handler) {
            this.element.removeEventListener(domEvent, handler);
            this.domListeners.delete(domEvent);
        }
        return this;
    }

    unbindAll() {
        this.domListeners.forEach((handler, event) => {
            this.element.removeEventListener(event, handler);
        });
        this.domListeners.clear();
        return this;
    }
}

class Component extends JWBase {
    constructor(options = {}) {
        super();
        this.emitter = new EventEmitter();
        this.children = new Set();
        this.parent = null;
        this.state = {};
        this.template = options.template || '';
        this.element = null;
    }

    setState(newState) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...newState };
        this.emitter.emit('stateChange', { oldState, newState: this.state });
    }

    mount(parentElement) {
        if (typeof this.template === 'string') {
            const temp = document.createElement('div');
            temp.innerHTML = this.template.trim();
            this.element = temp.firstChild;
        }
        parentElement.appendChild(this.element);
        this.emitter.emit('mounted', this);
    }

    unmount() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.emitter.emit('unmounted', this);
    }

    addChild(child) {
        this.children.add(child);
        child.parent = this;
        this.emitter.emit('childAdded', child);
    }

    removeChild(child) {
        this.children.delete(child);
        child.parent = null;
        this.emitter.emit('childRemoved', child);
    }
}

class Observable extends JWBase {
    constructor(initialValue) {
        super();
        this.value = initialValue;
        this.emitter = new EventEmitter();
    }

    get() {
        return this.value;
    }

    set(newValue) {
        const oldValue = this.value;
        this.value = newValue;
        this.emitter.emit('change', { oldValue, newValue });
    }

    subscribe(callback) {
        return this.emitter.on('change', callback);
    }
}


class EventBus extends JWBase {
    static instance = null;

    constructor() {
        if (EventBus.instance) {
            return EventBus.instance;
        }
        super();
        EventBus.instance = this;
        this.middlewares = [];
    }

    static getInstance() {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }

    use(middleware) {
        this.middlewares.push(middleware);
        return this;
    }

    async emit(event, data) {
        let currentData = data;
        
        
        for (const middleware of this.middlewares) {
            currentData = await middleware(event, currentData);
            if (currentData === null) return; 
        }

        await super.emit(event, currentData);
    }
}


class EventBatchProcessor extends JWBase {
    constructor(eventEmitter, options = {}) {
        super();
        this.emitter = eventEmitter;
        this.batchSize = options.batchSize || 100;
        this.flushInterval = options.flushInterval || 1000;
        this.batches = new Map();
        this.timeouts = new Map();
    }

    queueEvent(event, data) {
        if (!this.batches.has(event)) {
            this.batches.set(event, []);
        }
        
        const batch = this.batches.get(event);
        batch.push(data);

        if (batch.length >= this.batchSize) {
            this.flush(event);
        } else {
            this.scheduleFlush(event);
        }
    }

    scheduleFlush(event) {
        if (this.timeouts.has(event)) {
            clearTimeout(this.timeouts.get(event));
        }

        const timeout = setTimeout(() => this.flush(event), this.flushInterval);
        this.timeouts.set(event, timeout);
    }

    flush(event) {
        if (!this.batches.has(event)) return;

        const batch = this.batches.get(event);
        if (batch.length === 0) return;

        this.emitter.emit(event, batch);
        this.batches.set(event, []);

        if (this.timeouts.has(event)) {
            clearTimeout(this.timeouts.get(event));
            this.timeouts.delete(event);
        }
    }

    flushAll() {
        for (const event of this.batches.keys()) {
            this.flush(event);
        }
    }
}


class TemplateEngine extends JWBase {
    constructor(eventEmitter) {
        super();
        this.emitter = eventEmitter;
        this.templates = new Map();
    }

    registerTemplate(name, template) {
        this.templates.set(name, template);
    }

    compile(template, data = {}) {
        return template.replace(/\${(.*?)}/g, (match, expr) => {
            return eval(`with(data) { ${expr} }`);
        });
    }

    render(name, data = {}, target = null) {
        const template = this.templates.get(name);
        if (!template) throw new Error(`Template '${name}' not found`);

        const html = this.compile(template, data);
        
        if (target) {
            target.innerHTML = html;
            this.bindEvents(target);
        }
        
        return html;
    }

    bindEvents(element) {
        const eventElements = element.querySelectorAll('[data-event]');
        eventElements.forEach(el => {
            const [event, handler] = el.dataset.event.split(':');
            el.addEventListener(event, (e) => {
                this.emitter.emit(handler, { event: e, element: el });
            });
        });
    }
}

class EventCache extends JWBase {
    constructor(options = {}) {
        super();
        this.cache = new Map();
        this.maxAge = options.maxAge || 5000; 
        this.maxSize = options.maxSize || 1000; 
    }

    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > this.maxAge) {
            this.cache.delete(key);
            return null;
        }

        return entry.value;
    }

    clear() {
        this.cache.clear();
    }

    prune() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.maxAge) {
                this.cache.delete(key);
            }
        }
    }
}



class JWValidator extends JWBase {
    static validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    static validatePhone(phone) {
        return /^\+?[\d\s-]{10,}$/.test(phone);
    }

    static validateURL(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    static validateJSON(str) {
        try {
            JSON.parse(str);
            return true;
        } catch {
            return false;
        }
    }
}

class JWFormatter extends JWBase {
    static formatDate(date, format = 'YYYY-MM-DD') {
        const d = new Date(date);
        return format
            .replace('YYYY', d.getFullYear())
            .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
            .replace('DD', String(d.getDate()).padStart(2, '0'));
    }

    static formatNumber(num, decimals = 2) {
        return Number(num).toFixed(decimals);
    }

    static formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Byte';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    }
}

class JWPerformance extends JWBase {
    constructor() {
        super();
        this.metrics = new Map();
    }

    startMeasure(label) {
        this.metrics.set(label, {
            start: performance.now(),
            measurements: []
        });
    }

    endMeasure(label) {
        const metric = this.metrics.get(label);
        if (!metric) return null;

        const duration = performance.now() - metric.start;
        metric.measurements.push(duration);
        
        return {
            duration,
            average: metric.measurements.reduce((a, b) => a + b, 0) / metric.measurements.length
        };
    }

    getMetrics(label) {
        return this.metrics.get(label);
    }

    clearMetrics() {
        this.metrics.clear();
    }
}
