export class VelocityUtils {
    constructor() {
        this.eventListeners = new Map();
    }

    // Event system
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Event callback error:', error);
                }
            });
        }

        const customEvent = new CustomEvent(event, { detail: data });
        window.dispatchEvent(customEvent);
    }

    // DOM utilities
    $(selector, context = document) {
        return context.querySelector(selector);
    }

    $$(selector, context = document) {
        return Array.from(context.querySelectorAll(selector));
    }

    createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'textContent') {
                element.textContent = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else if (key.startsWith('data-')) {
                element.setAttribute(key, value);
            } else {
                element[key] = value;
            }
        });

        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof HTMLElement) {
                element.appendChild(child);
            }
        });

        return element;
    }

    addClass(element, className) {
        if (element && className) {
            element.classList.add(className);
        }
    }

    removeClass(element, className) {
        if (element && className) {
            element.classList.remove(className);
        }
    }

    toggleClass(element, className) {
        if (element && className) {
            element.classList.toggle(className);
        }
    }

    hasClass(element, className) {
        return element && element.classList.contains(className);
    }

    // String utilities
    slugify(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    capitalize(text) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    camelCase(text) {
        return text.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
    }

    kebabCase(text) {
        return text.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    }

    // Object utilities
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            Object.keys(obj).forEach(key => {
                clonedObj[key] = this.deepClone(obj[key]);
            });
            return clonedObj;
        }
    }

    deepMerge(target, source) {
        const result = { ...target };
        
        Object.keys(source).forEach(key => {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        });
        
        return result;
    }

    isEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim().length === 0;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    }

    // Array utilities
    unique(array) {
        return [...new Set(array)];
    }

    chunk(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    shuffle(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Validation utilities
    isEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    isPhone(phone) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
    }

    // Performance utilities
    debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Format utilities
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    formatDate(date, format = 'YYYY-MM-DD') {
        const d = new Date(date);
        const formats = {
            'YYYY': d.getFullYear(),
            'MM': String(d.getMonth() + 1).padStart(2, '0'),
            'DD': String(d.getDate()).padStart(2, '0'),
            'HH': String(d.getHours()).padStart(2, '0'),
            'mm': String(d.getMinutes()).padStart(2, '0'),
            'ss': String(d.getSeconds()).padStart(2, '0')
        };
        
        return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => formats[match]);
    }

    // Random utilities
    randomId(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    randomNumber(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    randomColor() {
        return '#' + Math.floor(Math.random() * 16777215).toString(16);
    }

    // Device detection
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    isTablet() {
        return /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
    }

    isDesktop() {
        return !this.isMobile() && !this.isTablet();
    }

    // Browser detection
    getBrowserInfo() {
        const ua = navigator.userAgent;
        let browser = 'Unknown';
        let version = 'Unknown';

        if (ua.indexOf('Chrome') > -1) {
            browser = 'Chrome';
            version = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.indexOf('Firefox') > -1) {
            browser = 'Firefox';
            version = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.indexOf('Safari') > -1) {
            browser = 'Safari';
            version = ua.match(/Version\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.indexOf('Edge') > -1) {
            browser = 'Edge';
            version = ua.match(/Edge\/(\d+)/)?.[1] || 'Unknown';
        }

        return { browser, version };
    }

    // Cookie utilities (simple)
    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    setCookie(name, value, days = 7) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
    }

    // Animation utilities
    animate(element, keyframes, options = {}) {
        if (element && element.animate) {
            return element.animate(keyframes, {
                duration: 300,
                easing: 'ease-in-out',
                fill: 'forwards',
                ...options
            });
        }
    }

    fadeIn(element, duration = 300) {
        if (element) {
            element.style.opacity = '0';
            element.style.display = 'block';
            return this.animate(element, [
                { opacity: 0 },
                { opacity: 1 }
            ], { duration });
        }
    }

    fadeOut(element, duration = 300) {
        if (element) {
            const animation = this.animate(element, [
                { opacity: 1 },
                { opacity: 0 }
            ], { duration });
            
            if (animation) {
                animation.addEventListener('finish', () => {
                    element.style.display = 'none';
                });
            }
            
            return animation;
        }
    }

    slideUp(element, duration = 300) {
        if (element) {
            const height = element.offsetHeight;
            return this.animate(element, [
                { height: `${height}px`, opacity: 1 },
                { height: '0px', opacity: 0 }
            ], { duration });
        }
    }

    slideDown(element, duration = 300) {
        if (element) {
            element.style.height = '0px';
            element.style.display = 'block';
            const height = element.scrollHeight;
            return this.animate(element, [
                { height: '0px', opacity: 0 },
                { height: `${height}px`, opacity: 1 }
            ], { duration });
        }
    }
} 