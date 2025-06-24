/*
*
* File: ImgLazy.js
* Project: simply_mail
* Type: JS
* Author: Joe_Valentino_Lengefeld
* Created: 2025-02-28
* Modified: 2025-02-28
*
* Copyright (c) 2025 JW Limited. All rights reserved.
* This file is part of simply_mail and is provided under the terms of the
* license agreement accompanying it. This file may not be copied, modified,
* or distributed except according to those terms.
*
*/
class ImgLazy extends HTMLElement {
	constructor() {
		super(), this._loaded = !1, this._observer = null, this._retryCount = 0, this._maxRetries = 3, this._intersectionThreshold = 0.1, this._intersectionRootMargin = '50px', this._uniqueId = `img-lazy-${ Math.random().toString(36).substr(2, 9) }`, this.setupStyles();
	}
	static get observedAttributes() {
		return [
			'src',
			'alt',
			'loading-style',
			'fallback-src',
			'threshold',
			'root-margin',
			'retry-count',
			'loading-strategy',
			'error-text'
		];
	}
	setupStyles() {
		if (!document.getElementById('img-lazy-styles')) {
			const t = document.createElement('style');
			t.id = 'img-lazy-styles', t.textContent = "\n                .img-lazy-container {\n                    position: relative;\n                    display: inline-block;\n                    overflow: hidden;\n                }\n\n                .img-lazy-image {\n                    opacity: 0;\n                    transition: opacity 0.5s ease-in-out;\n                    backface-visibility: hidden;\n                    -webkit-backface-visibility: hidden;\n                }\n\n                .img-lazy-image.loaded {\n                    opacity: 1;\n                }\n\n                .img-lazy-spinner {\n                    position: absolute;\n                    top: 50%;\n                    left: 50%;\n                    transform: translate(-50%, -50%);\n                    width: 48px;\n                    height: 48px;\n                    pointer-events: none;\n                    transform-origin: center center;\n                }\n\n                .img-lazy-spinner::before,\n                .img-lazy-spinner::after {\n                    content: '';\n                    position: absolute;\n                    top: 50%;\n                    left: 50%;\n                    width: 48px;\n                    height: 48px;\n                    border-radius: 50%;\n                    background: rgba(255, 255, 255, 0.7);\n                    backdrop-filter: blur(4px);\n                    -webkit-backdrop-filter: blur(4px);\n                    animation: img-lazy-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;\n                }\n\n                .img-lazy-spinner::after {\n                    animation-delay: -1s;\n                }\n\n                @keyframes img-lazy-pulse {\n                    0% {\n                        transform: translate(-50%, -50%) scale(0);\n                        opacity: 1;\n                    }\n                    100% {\n                        transform: translate(-50%, -50%) scale(1);\n                        opacity: 0;\n                    }\n                }\n\n                .img-lazy-spinner .dot {\n                    position: absolute;\n                    width: 10px;\n                    height: 10px;\n                    background: white;\n                    border-radius: 50%;\n                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);\n                    animation: img-lazy-dots 2s linear infinite;\n                }\n\n                .img-lazy-spinner .dot:nth-child(1) { animation-delay: -0.4s; }\n                .img-lazy-spinner .dot:nth-child(2) { animation-delay: -0.8s; }\n                .img-lazy-spinner .dot:nth-child(3) { animation-delay: -1.2s; }\n                .img-lazy-spinner .dot:nth-child(4) { animation-delay: -1.6s; }\n\n                @keyframes img-lazy-dots {\n                    0% {\n                        transform: rotate(0deg) translateX(15px) rotate(0deg);\n                    }\n                    100% {\n                        transform: rotate(360deg) translateX(15px) rotate(-360deg);\n                    }\n                }\n\n                .img-lazy-error {\n                    position: absolute;\n                    top: 0;\n                    left: 0;\n                    right: 0;\n                    bottom: 0;\n                    display: none;\n                    align-items: center;\n                    justify-content: center;\n                    background: rgba(0, 0, 0, 0.7);\n                    backdrop-filter: blur(4px);\n                    -webkit-backdrop-filter: blur(4px);\n                    color: white;\n                    font-size: 14px;\n                    pointer-events: none;\n                    opacity: 0;\n                    transition: opacity 0.3s ease;\n                }\n\n                .img-lazy-error.visible {\n                    opacity: 1;\n                    display: flex;\n                }\n\n                .img-lazy-blur-up {\n                    filter: blur(20px);\n                    transition: filter 0.8s ease-out;\n                }\n\n                .img-lazy-blur-up.loaded {\n                    filter: blur(0);\n                }\n            ", document.head.appendChild(t);
		}
	}
	connectedCallback() {
		this.classList.add('img-lazy-container'), this.render(), this.setupIntersectionObserver();
		'blur-up' === (this.getAttribute('loading-strategy') || 'default') && this.setupBlurUpStrategy();
	}
	disconnectedCallback() {
		this.disconnectObserver(), this.cleanup();
	}
	attributeChangedCallback(t, e, n) {
		if (e !== n)
			switch (t) {
			case 'threshold':
				this._intersectionThreshold = parseFloat(n) || 0.1, this.setupIntersectionObserver();
				break;
			case 'root-margin':
				this._intersectionRootMargin = n || '50px', this.setupIntersectionObserver();
				break;
			case 'retry-count':
				this._maxRetries = parseInt(n) || 3;
				break;
			default:
				this.render();
			}
	}
	cleanup() {
		const t = this.querySelector('.img-lazy-image');
		t && (t.removeEventListener('load', this._handleLoad), t.removeEventListener('error', this._handleError));
	}
	render() {
		this.cleanup(), this.innerHTML = '';
		const t = document.createElement('img');
		t.className = 'img-lazy-image', t.alt = this.getAttribute('alt') || '', t.dataset.src = this.getAttribute('src') || '';
		const e = document.createElement('div');
		e.className = 'img-lazy-spinner';
		for (let t = 0; t < 4; t++) {
			const t = document.createElement('div');
			t.className = 'dot', e.appendChild(t);
		}
		const n = document.createElement('div');
		n.className = 'img-lazy-error', n.innerHTML = `\n            <div class="error-content">\n                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n                    <circle cx="12" cy="12" r="10"></circle>\n                    <line x1="15" y1="9" x2="9" y2="15"></line>\n                    <line x1="9" y1="9" x2="15" y2="15"></line>\n                </svg>\n                <span style="margin-left: 8px">${ this.getAttribute('error-text') || 'Failed to load image' }</span>\n            </div>\n        `, this._handleLoad = () => this.handleImageLoad(t, e), this._handleError = () => this.handleImageError(t, e, n), t.addEventListener('load', this._handleLoad), t.addEventListener('error', this._handleError), this.appendChild(t), this.appendChild(e), this.appendChild(n);
	}
	setupBlurUpStrategy() {
		const t = this.querySelector('.img-lazy-image');
		if (t) {
			t.classList.add('img-lazy-blur-up');
			const e = this.getAttribute('src');
			e && this.generateTinyPlaceholder(e).then(e => {
				t.src = e;
			});
		}
	}
	async generateTinyPlaceholder(t) {
		return new Promise(e => {
			const n = new Image();
			n.crossOrigin = 'anonymous', n.onload = () => {
				const t = document.createElement('canvas'), i = t.getContext('2d');
				t.width = 20, t.height = n.height / n.width * 20, i.drawImage(n, 0, 0, t.width, t.height), e(t.toDataURL('image/jpeg', 0.1));
			}, n.onerror = () => e(null), n.src = t;
		});
	}
	setupIntersectionObserver() {
		this.disconnectObserver(), this._observer = new IntersectionObserver(t => {
			t.forEach(t => {
				t.isIntersecting && !this._loaded && this.loadImage();
			});
		}, {
			threshold: this._intersectionThreshold,
			rootMargin: this._intersectionRootMargin
		}), this._observer.observe(this);
	}
	disconnectObserver() {
		this._observer && (this._observer.disconnect(), this._observer = null);
	}
	loadImage() {
		const t = this.querySelector('.img-lazy-image');
		t && t.dataset.src && (t.src = t.dataset.src);
	}
	handleImageLoad(t, e) {
		this._loaded = !0, e.style.display = 'none', t.classList.add('loaded'), t.classList.contains('img-lazy-blur-up') && setTimeout(() => {
			t.classList.remove('img-lazy-blur-up');
		}, 300), this.dispatchEvent(new CustomEvent('imgLoaded', {
			detail: {
				success: !0,
				src: t.src,
				naturalWidth: t.naturalWidth,
				naturalHeight: t.naturalHeight
			}
		}));
	}
	handleImageError(t, e, n) {
		if (this._retryCount < this._maxRetries)
			this._retryCount++, setTimeout(() => {
				t.src = t.dataset.src;
			}, 1000 * this._retryCount);
		else {
			const i = this.getAttribute('fallback-src');
			i ? t.src = i : (e.style.display = 'none', n.classList.add('visible'), this.dispatchEvent(new CustomEvent('imgError', {
				detail: {
					error: 'Failed to load image',
					retries: this._retryCount,
					src: t.dataset.src
				}
			})));
		}
	}
	reload() {
		this._loaded = !1, this._retryCount = 0, this.render(), this.loadImage();
	}
	setSrc(t) {
		this.setAttribute('src', t);
	}
	setAlt(t) {
		this.setAttribute('alt', t);
	}
	setLoadingStrategy(t) {
		this.setAttribute('loading-strategy', t);
	}
	setThreshold(t) {
		this.setAttribute('threshold', t);
	}
	setRootMargin(t) {
		this.setAttribute('root-margin', t);
	}
	setRetryCount(t) {
		this.setAttribute('retry-count', t);
	}
	setErrorText(t) {
		this.setAttribute('error-text', t);
	}
	isLoaded() {
		return this._loaded;
	}
}
customElements.define('img-lazy', ImgLazy);