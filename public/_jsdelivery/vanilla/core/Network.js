/*
*
* File: Network.js
* Project: simply_mail
* Type: JS
* Author: Joe_Valentino_Lengefeld
* Created: 2025-02-23
* Modified: 2025-03-05
*
* Copyright (c) 2025 JW Limited. All rights reserved.
* This file is part of simply_mail and is provided under the terms of the
* license agreement accompanying it. This file may not be copied, modified,
* or distributed except according to those terms.
*
*/

class NetworkController extends EventEmitter {
    constructor() {
        super();
        this.state = {
            isOnline: navigator.onLine,
            retryCount: 0,
            lastCheck: Date.now(),
            connectionQuality: 'good'
        };

        this._waitPromise = null;
        this._waitResolve = null;
        
        this.config = {
            maxRetries: 3,
            checkInterval: 30000,
            pingEndpoint: '/test.html',
            timeout: 5000,
            baseURL: 'https://auth.the-simply-hub.com',
            defaultHeaders: {
                'Content-Type': 'application/json'
            }
        };

        this.loadingStates = new Map();
        this.loadingOverlay = this.createLoadingOverlay();
        
        this.elements = {
            warning: null,
            statusIcon: null,
            messageText: null
        };
        
        this.init();
    }

    init() {
        this.createWarningElement();
        this.bindEventListeners();
    }

    bindEventListeners() {
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }

    createWarningElement() {
        this.elements.warning = document.createElement('div');
        this.elements.warning.className = `
            fixed top-0 left-0 right-0 
            bg-gradient-to-r from-red-500/20 via-red-500/30 to-red-500/20
            backdrop-blur-lg 
            text-white px-4 py-2 
            text-center 
            transform transition-all duration-500 ease-in-out 
            -translate-y-full z-50
        `;

        this.elements.warning.innerHTML = `
            <div class="flex items-center justify-center space-x-3 max-w-2xl mx-auto">
                <div class="transition-transform duration-700 animate-pulse" id="network-status-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="rgb(255 130 130)">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                    </svg>
                </div>
                <span id="network-message" class="text-red-300 font-medium tracking-wide">
                    Network connection lost. Retrying to connect...
                </span>
                <button class="ml-4 text-xs text-red-300 hover:text-red-200 transition-colors duration-200" onclick="this.checkConnection()">
                    Retry Now
                </button>
            </div>
        `;

        this.elements.statusIcon = this.elements.warning.querySelector('#network-status-icon');
        this.elements.messageText = this.elements.warning.querySelector('#network-message');
        
        document.body.appendChild(this.elements.warning);
    }

    updateWarningState(isOnline, quality = 'good') {
        const states = {
            'good': {
                transform: 'translateY(-100%)',
                message: '',
                iconClass: ''
            },
            'poor': {
                transform: 'translateY(0)',
                message: 'Connection is unstable. Some features may be affected...',
                iconClass: 'animate-pulse text-yellow-400'
            },
            'none': {
                transform: 'translateY(0)',
                message: 'Network connection lost. Retrying to connect...',
                iconClass: 'animate-pulse text-red-400'
            }
        };

        const state = states[quality];
        this.elements.warning.style.transform = state.transform;
        if (this.elements.messageText) {
            this.elements.messageText.textContent = state.message;
        }
        if (this.elements.statusIcon) {
            this.elements.statusIcon.className = `transition-all duration-300 ${state.iconClass}`;
        }
    }

    handleOnline() {
        this.state.isOnline = true;
        this.state.retryCount = 0;
        this.state.connectionQuality = 'good';
        
        this.emit('connectionChanged', {
            isOnline: true,
            quality: 'good',
            timestamp: Date.now()
        });
        
        this.updateWarningState(true, 'good');
        console.log('[NetworkController] Connection restored');

        if (this._waitPromise) {
            this._waitPromise = null;
            this._waitResolve();
        }
    }

    handleOffline() {
        this.state.isOnline = false;
        this.state.connectionQuality = 'none';
        
        this.emit('connectionChanged', {
            isOnline: false,
            quality: 'none',
            timestamp: Date.now()
        });
        
        this.updateWarningState(false, 'none');
        console.log('[NetworkController] Connection lost');
    }


    stopConnectionCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    async waitForOnline(timeout = null) {
        if (this.state.isOnline && this.state.connectionQuality === 'good') {
            return Promise.resolve();
        }

        if (this._waitPromise) {
            return this._waitPromise;
        }

        this._waitPromise = new Promise((resolve, reject) => {
            this._waitResolve = resolve;

            if (timeout) {
                setTimeout(() => {
                    if (this._waitPromise) {
                        this._waitPromise = null;
                        this._waitResolve = null;
                        reject(new Error('Timeout waiting for connection'));
                    }
                }, timeout);
            }
        });

        return this._waitPromise;
    }

    createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] opacity-0 transition-opacity duration-200 pointer-events-none';
        overlay.innerHTML = `
            <div class="flex flex-col items-center space-y-4 bg-slate-900/80 p-6 rounded-lg backdrop-blur-xl">
                <img src="/email/assets/VAyR.gif" width="40" class="middle">
                <div class="text-slate-200 text-sm font-medium loading-message">Processing...</div>
            </div>
        `;
        document.body.appendChild(overlay);
        return overlay;
    }

    showLoading({ id, message = 'Processing...', disableElements = [], container = null }) {
        
        this.loadingStates.set(id, { disableElements, container });

        disableElements.forEach(element => {
            element.disabled = true;
            element.classList.add('opacity-50', 'cursor-not-allowed');
        });

        if (container) {
            container.style.filter = 'blur(2px)';
            container.style.pointerEvents = 'none';
        }

        this.loadingOverlay.querySelector('.loading-message').textContent = message;
        this.loadingOverlay.classList.remove('pointer-events-none', 'opacity-0');
    }

    hideLoading(id) {
        const state = this.loadingStates.get(id);
        if (!state) return;

        state.disableElements?.forEach(element => {
            element.disabled = false;
            element.classList.remove('opacity-50', 'cursor-not-allowed');
        });

        if (state.container) {
            state.container.style.filter = '';
            state.container.style.pointerEvents = '';
        }

        this.loadingStates.delete(id);
        if (this.loadingStates.size === 0) {
            this.loadingOverlay.classList.add('pointer-events-none', 'opacity-0');
        }
    }

    async withLoading(options, fn) {
        try {
            this.showLoading(options);
            return await fn();
        } finally {
            this.hideLoading(options.id);
        }
    }

    getConnectionStatus() {
        return {
            isOnline: this.state.isOnline,
            quality: this.state.connectionQuality,
            lastCheck: this.state.lastCheck,
            retryCount: this.state.retryCount
        };
    }

    configure(config = {}) {
        this.config = { ...this.config, ...config };
    }

    async request(method, url, options = {}, callback) {
        if (!this.state.isOnline) {
            const error = new Error('No network connection');
            error.code = 'NETWORK_OFFLINE';
            callback?.(error, null);
            return;
        }

        const requestId = `fetch-${Date.now()}`;
        const requestOptions = {
            method,
            headers: {
                ...this.config.defaultHeaders,
                ...options.headers
            },
            ...options
        };

        try {
            if (options.body) {
                if (typeof options.body === 'object') {
                    requestOptions.body = JSON.stringify(options.body);
                } else if (typeof options.body === 'string') {
                    requestOptions.body = options.body;
                } else {
                    throw new Error('Invalid body type. Must be object or string.');
                }
            }
        } catch (error) {
            console.error('[NetworkController] Failed to process request body:', error);
            throw new Error('Failed to process request body: ' + error.message);
        }

        try {
            await this.waitForOnline();

            const response = await this.safeExecuteAsync(async () => {
                const fullUrl = this.config.baseURL ? `${this.config.baseURL}${url}` : url;
                    const response = await fetch(fullUrl, requestOptions);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                    return await response.json();
                }
                
                return await response.text();
            });

            callback?.(null, response);
        } catch (error) {
            console.error('[NetworkController] Request failed:', error);
            callback?.(error, null);
        }
    }

    /**
     * Make a GET request
     * @param {string} url Request URL
     * @param {Object} options Request options
     * @param {Function} callback Callback function
     */
    get(url, options = {}, callback) {
        return this.request('GET', url, options, callback);
    }

    /**
     * Make a POST request
     * @param {string} url Request URL
     * @param {Object} body Request body
     * @param {Object} options Request options
     * @param {Function} callback Callback function
     */
    post(url, body = {}, options = {}, callback) {
        return this.request('POST', url, { ...options, body }, callback);
    }

    /**
     * Make a PUT request
     * @param {string} url Request URL
     * @param {Object} body Request body
     * @param {Object} options Request options
     * @param {Function} callback Callback function
     */
    put(url, body = {}, options = {}, callback) {
        return this.request('PUT', url, { ...options, body }, callback);
    }

    /**
     * Make a DELETE request
     * @param {string} url Request URL
     * @param {Object} body Request body (optional)
     * @param {Object} options Request options
     * @param {Function} callback Callback function
     */
    delete(url, body = null, options = {}, callback) {
        return this.request('DELETE', url, body ? { ...options, body } : options, callback);
    }
}