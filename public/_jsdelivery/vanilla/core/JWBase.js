
/** 
   ------------------------------------------------------------------------------
   Copyright (c) 2025 JW Limited. All rights reserved.

   Project: JWLimited.WebFramework
   @module: Core
   @class: JWBase
   
   @file: JWBase.js 
   @constructor Creates a new instance of JWBase.

   Company: JW Limited (licensed);
   Author: Joe Valentino Lengefeld (CEO)
   

   This software is proprietary to JW Limited and constitutes valuable 
   intellectual property. It is entrusted solely to employees named above
   and may not be disclosed, copied, reproduced, transmitted, or used in 
   any manner outside of the scope of its license without prior written
   authorization from JW Limited.
   ------------------------------------------------------------------------------
*/
class JWBase {
    /**
     * Initializes the JWBase instance with a unique ID, creation timestamp, and debug mode disabled.
     */
    constructor() {
        /**
         * Unique identifier for the JWBase instance.
         * @type {string}
         */
        this._id = JWBase.generateUUID();

        /**
         * Timestamp when the JWBase instance was created.
         * @type {number}
         */
        this._created = Date.now();

        /**
         * Timestamp when the JWBase instance was last modified.
         * @type {number}
         */
        this._modified = Date.now();

        /**
         * Flag indicating whether debug mode is enabled.
         * @type {boolean}
         */
        this._debug = env?.dev_mode == 'true' || false;

        /**
         * Flag indicating whether the JWBase instance has been destroyed.
         * @type {boolean}
         */
        this._destroyed = false;
    }

    /**
     * Generates a unique identifier for the JWBase instance.
     * @static
     * @returns {string} Unique identifier.
     */
    static generateUUID() {
        return 'jw-component.xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Enables debug mode for the JWBase instance.
     * @returns {JWBase} The JWBase instance.
     */
    enableDebug() {
        if(env?.dev_mode == 'true'){
            this._debug = true;
        }
        return this;
    }

    /**
     * Disables debug mode for the JWBase instance.
     * @returns {JWBase} The JWBase instance.
     */
    disableDebug() {
        if(env?.dev_mode == 'true'){
            this._debug = false;
        }
        return this;
    }

    /**
     * Logs a message to the console if debug mode is enabled.
     * @param {...*} args Message to log.
     */
    log(...args) {
        if (this._debug) {
            const color = this.getColorForComponent();
            const styles = [
                `color: ${color}`,
                'font-weight: bold',
                'padding: 2px 4px',
                'border-radius: 3px',
                `background: ${this.getBackgroundColor(color)}`
            ].join(';');
            console.log(`%c[${this.constructor.name}:${this._id}]`, styles, ...args);
        }
    }

    /**
     * Logs a warning message to the console if debug mode is enabled.
     * @param {...*} args Message to log.
     */
    warn(...args) {
        if (this._debug) {
            const color = '#FF9800';
            const styles = [
                `color: ${color}`,
                'font-weight: bold',
                'padding: 2px 4px',
                'border-radius: 3px',
                `background: ${this.getBackgroundColor(color)}`
            ].join(';');
            console.warn(`%c[${this.constructor.name}:${this._id}]`, styles, ...args);
        }
    }

    /**
     * Logs an error message to the console.
     * @param {...*} args Message to log.
     */
    error(...args) {
        const color = '#F44336';
        const styles = [
            `color: ${color}`,
            'font-weight: bold',
            'padding: 2px 4px',
            'border-radius: 3px',
            `background: ${this.getBackgroundColor(color)}`
        ].join(';');
        console.error(`%c[${this.constructor.name}:${this._id}]`, styles, ...args);
    }

    /**
     * Generates a color for the component based on its name.
     * @returns {string} Color for the component.
     */
    getColorForComponent() {
        let hash = 0;
        for (let i = 0; i < this.constructor.name.length; i++) {
            hash = this.constructor.name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = hash % 360;
        return `hsl(${h}, 70%, 70%)`;
    }

    /**
     * Generates a background color for the component based on its color.
     * @param {string} color Color for the component.
     * @returns {string} Background color for the component.
     */
    getBackgroundColor(color) {
        return color.startsWith('#')
            ? `${color}1A`
            : color.replace(')', ', 0.1)');
    }

    /**
     * Starts a timer for the component.
     * @param {string} label Label for the timer.
     */
    startTimer(label) {
        if (!this._timers) this._timers = new Map();
        this._timers.set(label, performance.now());
    }

    /**
     * Ends a timer for the component and returns the duration.
     * @param {string} label Label for the timer.
     * @returns {number} Duration of the timer.
     */
    endTimer(label) {
        if (!this._timers || !this._timers.has(label)) return 0;
        const duration = performance.now() - this._timers.get(label);
        this._timers.delete(label);
        return duration;
    }

    /**
     * Destroys the JWBase instance and its dependencies.
     */
    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;
        this.log('Instance destroyed');

        Object.keys(this).forEach(key => {
            if (this[key] && typeof this[key].destroy === 'function') {
                this[key].destroy();
            }
            this[key] = null;
        });
    }

    /**
     * Checks if the JWBase instance has been destroyed.
     * @returns {boolean} Whether the JWBase instance has been destroyed.
     */
    isDestroyed() {
        return this._destroyed;
    }

    /**
     * Returns metadata for the JWBase instance.
     * @returns {object} Metadata for the JWBase instance.
     */
    getMetadata() {
        return {
            id: this._id,
            type: this.constructor.name,
            created: this._created,
            modified: this._modified,
            debug: this._debug
        };
    }

    /**
     * Clones the JWBase instance.
     * @returns {JWBase} Cloned JWBase instance.
     */
    clone() {
        return JSON.parse(JSON.stringify(this));
    }

    /**
     * Guards a promise against execution timeout.
     * @param {Promise} operation Promise to guard.
     * @param {Integer} time Timeout paramater
     * @returns {Promise} Guarded promise.
     */
    timeoutGuard(operation, time = 5000) {
        return Promise.race([
            operation,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Execution timeout')), time)
            )
        ]);
    }

    /**
     * Safely executes a function and returns its result.
     * @param {function} fn Function to execute.
     * @param {*} fallback Fallback value to return if execution fails.
     * @returns {*} Result of the function execution.
     */
    safeExecute(fn, fallback = null) {
        try {
            const handler = {
                get: (target, prop) => {
                    if (prop === 'constructor') return target[prop];
                    return new Proxy(target[prop], handler);
                }
            };

            const proxyTarget = Object.create(null);
            const proxy = new Proxy(proxyTarget, handler);

            const result = fn.call(proxy);
            return result;

        } catch (error) {
            this.error('Execution failed:', error);
            return fallback;
        }
    }

    /**
     * Safely executes an asynchronous function and returns its result.
     * @param {function} fn Function to execute.
     * @param {*} fallback Fallback value to return if execution fails.
     * @returns {Promise} Result of the function execution.
     */
    async safeExecuteAsync(fn, fallback = null) {
        try {
            const handler = {
                get: (target, prop) => {
                    if (prop === 'constructor') return target[prop];
                    return new Proxy(target[prop], handler);
                }
            };

            const proxyTarget = Object.create(null);
            const proxy = new Proxy(proxyTarget, handler);

            const result = await fn.call(proxy);
            return result;

        } catch (error) {
            this.error('Async execution failed:', error);
            return fallback;
        }
    }

    /**
     * Inherently sets the prototype of a class.
     * @param {function} t Class to set prototype for.
     * @param {function} o Parent class.
     */
    inheritsLoose(t, o = this) {
        (t.prototype = Object.create(o.prototype)),
            (t.prototype.constructor = t),
            _setPrototypeOf(t, o);
    }

    /**
     * Sets the prototype of an object.
     * @param {object} t Object to set prototype for.
     * @param {object} e Prototype to set.
     * @returns {object} Object with set prototype.
     */
    setPrototypeOf(t, e) {
        return (
            (_setPrototypeOf = Object.setPrototypeOf
                ? Object.setPrototypeOf.bind()
                : function (t, e) {
                    return (t.__proto__ = e), t;
                }),
            _setPrototypeOf(t, e)
        );
    }
}

