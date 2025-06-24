/**
 * VelocityStorage - Advanced storage utilities for VelocityJS
 * Provides unified interface for cookies, localStorage, sessionStorage, and IndexedDB
 */

export class VelocityStorage {
    constructor(logger) {
        this.logger = logger;
        this.dbName = 'VelocityDB';
        this.dbVersion = 1;
        this.db = null;
        this.storeName = 'velocity_store';
        
        // Initialize IndexedDB
        this.initIndexedDB();
    }

    /**
     * Initialize IndexedDB
     */
    async initIndexedDB() {
        if (!window.indexedDB) {
            this.logger.warn('IndexedDB not supported');
            return;
        }

        try {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                this.logger.error('Failed to open IndexedDB');
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.logger.info('IndexedDB initialized');
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        } catch (error) {
            this.logger.error('IndexedDB initialization failed', error);
        }
    }

    // ==================== COOKIES ====================

    /**
     * Set a cookie
     */
    setCookie(name, value, options = {}) {
        try {
            const {
                expires = null,
                maxAge = null,
                domain = null,
                path = '/',
                secure = false,
                sameSite = 'Lax'
            } = options;

            let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

            if (expires) {
                const date = expires instanceof Date ? expires : new Date(expires);
                cookieString += `; expires=${date.toUTCString()}`;
            }

            if (maxAge !== null) {
                cookieString += `; max-age=${maxAge}`;
            }

            if (domain) {
                cookieString += `; domain=${domain}`;
            }

            if (path) {
                cookieString += `; path=${path}`;
            }

            if (secure) {
                cookieString += `; secure`;
            }

            if (sameSite) {
                cookieString += `; samesite=${sameSite}`;
            }

            document.cookie = cookieString;
            this.logger.info(`Cookie set: ${name}`);
            return true;
        } catch (error) {
            this.logger.error('Failed to set cookie', error);
            return false;
        }
    }

    /**
     * Get a cookie
     */
    getCookie(name) {
        try {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${encodeURIComponent(name)}=`);
            if (parts.length === 2) {
                const cookieValue = parts.pop().split(';').shift();
                return decodeURIComponent(cookieValue);
            }
            return null;
        } catch (error) {
            this.logger.error('Failed to get cookie', error);
            return null;
        }
    }

    /**
     * Delete a cookie
     */
    deleteCookie(name, options = {}) {
        const { domain = null, path = '/' } = options;
        return this.setCookie(name, '', {
            expires: new Date(0),
            domain,
            path
        });
    }

    /**
     * Get all cookies
     */
    getAllCookies() {
        try {
            const cookies = {};
            document.cookie.split(';').forEach(cookie => {
                const [name, value] = cookie.trim().split('=');
                if (name && value) {
                    cookies[decodeURIComponent(name)] = decodeURIComponent(value);
                }
            });
            return cookies;
        } catch (error) {
            this.logger.error('Failed to get all cookies', error);
            return {};
        }
    }

    // ==================== LOCAL STORAGE ====================

    /**
     * Set localStorage item
     */
    setLocal(key, value, options = {}) {
        try {
            if (!this.isLocalStorageAvailable()) {
                this.logger.warn('localStorage not available');
                return false;
            }

            const { ttl = null, encrypt = false } = options;
            
            let dataToStore = {
                value: value,
                timestamp: Date.now(),
                ttl: ttl
            };

            if (encrypt) {
                dataToStore = this.encrypt(dataToStore);
            }

            localStorage.setItem(key, JSON.stringify(dataToStore));
            this.logger.info(`localStorage set: ${key}`);
            return true;
        } catch (error) {
            this.logger.error('Failed to set localStorage', error);
            return false;
        }
    }

    /**
     * Get localStorage item
     */
    getLocal(key, options = {}) {
        try {
            if (!this.isLocalStorageAvailable()) {
                this.logger.warn('localStorage not available');
                return null;
            }

            const { decrypt = false } = options;
            const item = localStorage.getItem(key);
            
            if (!item) return null;

            let data = JSON.parse(item);
            
            if (decrypt) {
                data = this.decrypt(data);
            }

            if (data.ttl && Date.now() - data.timestamp > data.ttl) {
                this.removeLocal(key);
                return null;
            }

            return data.value;
        } catch (error) {
            this.logger.error('Failed to get localStorage', error);
            return null;
        }
    }

    /**
     * Remove localStorage item
     */
    removeLocal(key) {
        try {
            if (!this.isLocalStorageAvailable()) return false;
            localStorage.removeItem(key);
            this.logger.info(`localStorage removed: ${key}`);
            return true;
        } catch (error) {
            this.logger.error('Failed to remove localStorage', error);
            return false;
        }
    }

    /**
     * Clear all localStorage
     */
    clearLocal() {
        try {
            if (!this.isLocalStorageAvailable()) return false;
            localStorage.clear();
            this.logger.info('localStorage cleared');
            return true;
        } catch (error) {
            this.logger.error('Failed to clear localStorage', error);
            return false;
        }
    }

    // ==================== SESSION STORAGE ====================

    /**
     * Set sessionStorage item
     */
    setSession(key, value, options = {}) {
        try {
            if (!this.isSessionStorageAvailable()) {
                this.logger.warn('sessionStorage not available');
                return false;
            }

            const { encrypt = false } = options;
            
            let dataToStore = {
                value: value,
                timestamp: Date.now()
            };

            if (encrypt) {
                dataToStore = this.encrypt(dataToStore);
            }

            sessionStorage.setItem(key, JSON.stringify(dataToStore));
            this.logger.info(`sessionStorage set: ${key}`);
            return true;
        } catch (error) {
            this.logger.error('Failed to set sessionStorage', error);
            return false;
        }
    }

    /**
     * Get sessionStorage item
     */
    getSession(key, options = {}) {
        try {
            if (!this.isSessionStorageAvailable()) {
                this.logger.warn('sessionStorage not available');
                return null;
            }

            const { decrypt = false } = options;
            const item = sessionStorage.getItem(key);
            
            if (!item) return null;

            let data = JSON.parse(item);
            
            if (decrypt) {
                data = this.decrypt(data);
            }

            return data.value;
        } catch (error) {
            this.logger.error('Failed to get sessionStorage', error);
            return null;
        }
    }

    /**
     * Remove sessionStorage item
     */
    removeSession(key) {
        try {
            if (!this.isSessionStorageAvailable()) return false;
            sessionStorage.removeItem(key);
            this.logger.info(`sessionStorage removed: ${key}`);
            return true;
        } catch (error) {
            this.logger.error('Failed to remove sessionStorage', error);
            return false;
        }
    }

    /**
     * Clear all sessionStorage
     */
    clearSession() {
        try {
            if (!this.isSessionStorageAvailable()) return false;
            sessionStorage.clear();
            this.logger.info('sessionStorage cleared');
            return true;
        } catch (error) {
            this.logger.error('Failed to clear sessionStorage', error);
            return false;
        }
    }

    // ==================== INDEXED DB ====================

    /**
     * Set IndexedDB item
     */
    async setIndexed(key, value, options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB not available'));
                return;
            }

            try {
                const { ttl = null, tags = [] } = options;
                
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                
                const data = {
                    key: key,
                    value: value,
                    timestamp: Date.now(),
                    ttl: ttl,
                    tags: tags
                };

                const request = store.put(data);
                
                request.onsuccess = () => {
                    this.logger.info(`IndexedDB set: ${key}`);
                    resolve(true);
                };
                
                request.onerror = () => {
                    this.logger.error('Failed to set IndexedDB');
                    reject(new Error('Failed to set IndexedDB'));
                };
            } catch (error) {
                this.logger.error('IndexedDB set error', error);
                reject(error);
            }
        });
    }

    /**
     * Get IndexedDB item
     */
    async getIndexed(key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB not available'));
                return;
            }

            try {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(key);
                
                request.onsuccess = () => {
                    const result = request.result;
                    
                    if (!result) {
                        resolve(null);
                        return;
                    }

                    // Check TTL
                    if (result.ttl && Date.now() - result.timestamp > result.ttl) {
                        this.removeIndexed(key);
                        resolve(null);
                        return;
                    }

                    resolve(result.value);
                };
                
                request.onerror = () => {
                    this.logger.error('Failed to get IndexedDB');
                    reject(new Error('Failed to get IndexedDB'));
                };
            } catch (error) {
                this.logger.error('IndexedDB get error', error);
                reject(error);
            }
        });
    }

    /**
     * Remove IndexedDB item
     */
    async removeIndexed(key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB not available'));
                return;
            }

            try {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.delete(key);
                
                request.onsuccess = () => {
                    this.logger.info(`IndexedDB removed: ${key}`);
                    resolve(true);
                };
                
                request.onerror = () => {
                    this.logger.error('Failed to remove IndexedDB');
                    reject(new Error('Failed to remove IndexedDB'));
                };
            } catch (error) {
                this.logger.error('IndexedDB remove error', error);
                reject(error);
            }
        });
    }

    /**
     * Clear IndexedDB
     */
    async clearIndexed() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB not available'));
                return;
            }

            try {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.clear();
                
                request.onsuccess = () => {
                    this.logger.info('IndexedDB cleared');
                    resolve(true);
                };
                
                request.onerror = () => {
                    this.logger.error('Failed to clear IndexedDB');
                    reject(new Error('Failed to clear IndexedDB'));
                };
            } catch (error) {
                this.logger.error('IndexedDB clear error', error);
                reject(error);
            }
        });
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Check if localStorage is available
     */
    isLocalStorageAvailable() {
        try {
            const test = 'velocity_test';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Check if sessionStorage is available
     */
    isSessionStorageAvailable() {
        try {
            const test = 'velocity_test';
            sessionStorage.setItem(test, test);
            sessionStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Simple encryption (Base64 + simple XOR)
     * Note: This is for basic obfuscation, not secure encryption
     */
    encrypt(data) {
        try {
            const jsonString = JSON.stringify(data);
            const key = 'VelocityJS';
            let encrypted = '';
            
            for (let i = 0; i < jsonString.length; i++) {
                const charCode = jsonString.charCodeAt(i) ^ key.charCodeAt(i % key.length);
                encrypted += String.fromCharCode(charCode);
            }
            
            return btoa(encrypted);
        } catch (error) {
            this.logger.error('Encryption failed', error);
            return data;
        }
    }

    /**
     * Simple decryption (Base64 + simple XOR)
     */
    decrypt(encryptedData) {
        try {
            const decoded = atob(encryptedData);
            const key = 'VelocityJS';
            let decrypted = '';
            
            for (let i = 0; i < decoded.length; i++) {
                const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
                decrypted += String.fromCharCode(charCode);
            }
            
            return JSON.parse(decrypted);
        } catch (error) {
            this.logger.error('Decryption failed', error);
            return encryptedData;
        }
    }

    /**
     * Get storage size in bytes
     */
    getStorageSize(type = 'local') {
        try {
            let storage;
            switch (type) {
                case 'local':
                    storage = localStorage;
                    break;
                case 'session':
                    storage = sessionStorage;
                    break;
                default:
                    return 0;
            }

            let total = 0;
            for (let key in storage) {
                if (storage.hasOwnProperty(key)) {
                    total += storage[key].length + key.length;
                }
            }
            return total;
        } catch (error) {
            this.logger.error('Failed to calculate storage size', error);
            return 0;
        }
    }

    /**
     * Clean expired items from storage
     */
    cleanExpired(type = 'local') {
        try {
            let storage;
            switch (type) {
                case 'local':
                    storage = localStorage;
                    break;
                case 'session':
                    storage = sessionStorage;
                    break;
                default:
                    return;
            }

            const keysToRemove = [];
            const now = Date.now();

            for (let key in storage) {
                if (storage.hasOwnProperty(key)) {
                    try {
                        const data = JSON.parse(storage[key]);
                        if (data.ttl && now - data.timestamp > data.ttl) {
                            keysToRemove.push(key);
                        }
                    } catch (e) {
                        // Skip invalid JSON
                    }
                }
            }

            keysToRemove.forEach(key => storage.removeItem(key));
            this.logger.info(`Cleaned ${keysToRemove.length} expired items from ${type}Storage`);
        } catch (error) {
            this.logger.error('Failed to clean expired items', error);
        }
    }

    /**
     * Unified storage interface
     */
    async set(key, value, options = {}) {
        const { storage = 'auto', ...otherOptions } = options;
        
        switch (storage) {
            case 'cookie':
                return this.setCookie(key, value, otherOptions);
            case 'local':
                return this.setLocal(key, value, otherOptions);
            case 'session':
                return this.setSession(key, value, otherOptions);
            case 'indexed':
                return await this.setIndexed(key, value, otherOptions);
            case 'auto':
            default:
                const dataSize = JSON.stringify(value).length;
                if (dataSize > 4000) {
                    return this.setLocal(key, value, otherOptions);
                } else {
                    return this.setCookie(key, value, otherOptions);
                }
        }
    }

    /**
     * Unified get interface
     */
    async get(key, options = {}) {
        const { storage = 'auto', ...otherOptions } = options;
        
        switch (storage) {
            case 'cookie':
                return this.getCookie(key);
            case 'local':
                return this.getLocal(key, otherOptions);
            case 'session':
                return this.getSession(key, otherOptions);
            case 'indexed':
                return await this.getIndexed(key);
            case 'auto':
            default:
                let value = this.getLocal(key, otherOptions);
                if (value !== null) return value;
                return this.getCookie(key);
        }
    }

    /**
     * Unified remove interface
     */
    async remove(key, options = {}) {
        const { storage = 'all' } = options;
        
        if (storage === 'all') {
            this.deleteCookie(key);
            this.removeLocal(key);
            this.removeSession(key);
            await this.removeIndexed(key);
            return true;
        }
        
        switch (storage) {
            case 'cookie':
                return this.deleteCookie(key);
            case 'local':
                return this.removeLocal(key);
            case 'session':
                return this.removeSession(key);
            case 'indexed':
                return await this.removeIndexed(key);
            default:
                return false;
        }
    }
} 