/**
 * VelocityJS SEO Engine
 * Advanced SEO optimization and meta management
 */

class VelocitySEO {
    constructor(config = {}) {
        this.config = {
            // Site Configuration
            siteName: 'VelocityJS App',
            siteUrl: window.location.origin,
            defaultTitle: 'VelocityJS - Modern Web Framework',
            titleTemplate: '%s | VelocityJS',
            defaultDescription: 'A modern, fast, and lightweight web framework for building progressive web applications.',
            defaultKeywords: ['javascript', 'framework', 'spa', 'pwa', 'web development'],
            defaultAuthor: 'VelocityJS',
            defaultImage: '/assets/images/og-image.jpg',
            twitterHandle: '@velocityjs',
            
            // SEO Features
            enableJsonLd: true,
            enableOpenGraph: true,
            enableTwitterCards: true,
            enableCanonical: true,
            enableRobots: true,
            enableSitemap: true,
            enableAnalytics: false,
            
            // Analytics
            googleAnalyticsId: null,
            googleTagManagerId: null,
            facebookPixelId: null,
            
            // Schema.org
            organizationSchema: null,
            websiteSchema: null,
            
            ...config
        };
        
        this.metaTags = new Map();
        this.structuredData = [];
        this.breadcrumbs = [];
        this.currentPage = null;
        
        this.init();
    }
    
    /**
     * Initialize SEO engine
     */
    init() {
        this.setupDefaultMetas();
        this.setupAnalytics();
        this.setupStructuredData();
        this.observePageChanges();
        
        console.log('VelocitySEO initialized');
    }
    
    /**
     * Setup default meta tags
     */
    setupDefaultMetas() {
        // Basic metas
        this.setTitle(this.config.defaultTitle);
        this.setDescription(this.config.defaultDescription);
        this.setKeywords(this.config.defaultKeywords);
        this.setAuthor(this.config.defaultAuthor);
        this.setCanonical(window.location.href);
        
        // Viewport and mobile optimization
        this.setMeta('viewport', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
        this.setMeta('mobile-web-app-capable', 'yes');
        this.setMeta('apple-mobile-web-app-capable', 'yes');
        this.setMeta('apple-mobile-web-app-status-bar-style', 'default');
        this.setMeta('format-detection', 'telephone=no');
        
        // Security headers
        this.setMeta('referrer', 'strict-origin-when-cross-origin');
        this.setMeta('content-security-policy', this.generateCSP());
        
        // Performance hints
        this.addPreconnectLinks();
        this.addResourceHints();
        
        // Robots
        if (this.config.enableRobots) {
            this.setRobots('index, follow');
        }
    }
    
    /**
     * Generate Content Security Policy
     */
    generateCSP() {
        return [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google-analytics.com https://www.googletagmanager.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https: blob:",
            "connect-src 'self' https://www.google-analytics.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ].join('; ');
    }
    
    /**
     * Add preconnect links for performance
     */
    addPreconnectLinks() {
        const preconnects = [
            'https://fonts.googleapis.com',
            'https://fonts.gstatic.com',
            'https://www.google-analytics.com',
            'https://www.googletagmanager.com'
        ];
        
        preconnects.forEach(href => {
            this.addLink('preconnect', href, { crossorigin: 'anonymous' });
        });
    }
    
    /**
     * Add resource hints
     */
    addResourceHints() {
        // DNS prefetch for external domains
        const dnsPrefetch = [
            'https://cdnjs.cloudflare.com',
            'https://unpkg.com'
        ];
        
        dnsPrefetch.forEach(href => {
            this.addLink('dns-prefetch', href);
        });
        
        // Preload critical resources
        this.addLink('preload', '/assets/velocity.css', { as: 'style' });
        this.addLink('preload', '/src/velocity.js', { as: 'script' });
    }
    
    /**
     * Set page title
     */
    setTitle(title) {
        document.title = title.includes('|') ? title : 
            this.config.titleTemplate.replace('%s', title);
        
        // Update Open Graph
        if (this.config.enableOpenGraph) {
            this.setMeta('og:title', title, 'property');
        }
        
        // Update Twitter Cards
        if (this.config.enableTwitterCards) {
            this.setMeta('twitter:title', title);
        }
    }
    
    /**
     * Set meta description
     */
    setDescription(description) {
        this.setMeta('description', description);
        
        if (this.config.enableOpenGraph) {
            this.setMeta('og:description', description, 'property');
        }
        
        if (this.config.enableTwitterCards) {
            this.setMeta('twitter:description', description);
        }
    }
    
    /**
     * Set meta keywords
     */
    setKeywords(keywords) {
        const keywordString = Array.isArray(keywords) ? keywords.join(', ') : keywords;
        this.setMeta('keywords', keywordString);
    }
    
    /**
     * Set author
     */
    setAuthor(author) {
        this.setMeta('author', author);
    }
    
    /**
     * Set canonical URL
     */
    setCanonical(url) {
        if (!this.config.enableCanonical) return;
        
        this.removeLink('canonical');
        this.addLink('canonical', url);
        
        if (this.config.enableOpenGraph) {
            this.setMeta('og:url', url, 'property');
        }
        
        if (this.config.enableTwitterCards) {
            this.setMeta('twitter:url', url);
        }
    }
    
    /**
     * Set robots meta
     */
    setRobots(content) {
        this.setMeta('robots', content);
    }
    
    /**
     * Set Open Graph image
     */
    setImage(imageUrl, options = {}) {
        const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : 
            `${this.config.siteUrl}${imageUrl}`;
        
        if (this.config.enableOpenGraph) {
            this.setMeta('og:image', fullImageUrl, 'property');
            this.setMeta('og:image:type', options.type || 'image/jpeg', 'property');
            this.setMeta('og:image:width', options.width || '1200', 'property');
            this.setMeta('og:image:height', options.height || '630', 'property');
            this.setMeta('og:image:alt', options.alt || this.config.defaultTitle, 'property');
        }
        
        if (this.config.enableTwitterCards) {
            this.setMeta('twitter:image', fullImageUrl);
            this.setMeta('twitter:image:alt', options.alt || this.config.defaultTitle);
        }
    }
    
    /**
     * Setup Open Graph tags
     */
    setupOpenGraph(data = {}) {
        if (!this.config.enableOpenGraph) return;
        
        const ogData = {
            type: 'website',
            site_name: this.config.siteName,
            locale: 'en_US',
            ...data
        };
        
        Object.entries(ogData).forEach(([key, value]) => {
            this.setMeta(`og:${key}`, value, 'property');
        });
    }
    
    /**
     * Setup Twitter Cards
     */
    setupTwitterCards(data = {}) {
        if (!this.config.enableTwitterCards) return;
        
        const twitterData = {
            card: 'summary_large_image',
            site: this.config.twitterHandle,
            creator: this.config.twitterHandle,
            ...data
        };
        
        Object.entries(twitterData).forEach(([key, value]) => {
            this.setMeta(`twitter:${key}`, value);
        });
    }
    
    /**
     * Setup structured data (JSON-LD)
     */
    setupStructuredData() {
        if (!this.config.enableJsonLd) return;
        
        // Website schema
        this.addStructuredData({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            'name': this.config.siteName,
            'url': this.config.siteUrl,
            'description': this.config.defaultDescription,
            'potentialAction': {
                '@type': 'SearchAction',
                'target': `${this.config.siteUrl}/search?q={search_term_string}`,
                'query-input': 'required name=search_term_string'
            }
        });
        
        // Organization schema
        if (this.config.organizationSchema) {
            this.addStructuredData({
                '@context': 'https://schema.org',
                '@type': 'Organization',
                ...this.config.organizationSchema
            });
        }
        
        // WebPage schema (will be updated per page)
        this.updateWebPageSchema();
    }
    
    /**
     * Update WebPage structured data
     */
    updateWebPageSchema(pageData = {}) {
        const webPageSchema = {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            'name': document.title,
            'description': this.getMeta('description'),
            'url': window.location.href,
            'inLanguage': 'en-US',
            'isPartOf': {
                '@type': 'WebSite',
                'name': this.config.siteName,
                'url': this.config.siteUrl
            },
            ...pageData
        };
        
        // Add breadcrumbs if available
        if (this.breadcrumbs.length > 0) {
            webPageSchema.breadcrumb = {
                '@type': 'BreadcrumbList',
                'itemListElement': this.breadcrumbs.map((crumb, index) => ({
                    '@type': 'ListItem',
                    'position': index + 1,
                    'name': crumb.name,
                    'item': crumb.url
                }))
            };
        }
        
        this.removeStructuredData('WebPage');
        this.addStructuredData(webPageSchema);
    }
    
    /**
     * Add structured data
     */
    addStructuredData(data) {
        const existingIndex = this.structuredData.findIndex(
            item => item['@type'] === data['@type']
        );
        
        if (existingIndex !== -1) {
            this.structuredData[existingIndex] = data;
        } else {
            this.structuredData.push(data);
        }
        
        this.renderStructuredData();
    }
    
    /**
     * Remove structured data by type
     */
    removeStructuredData(type) {
        this.structuredData = this.structuredData.filter(
            item => item['@type'] !== type
        );
        this.renderStructuredData();
    }
    
    /**
     * Render structured data to DOM
     */
    renderStructuredData() {
        // Remove existing JSON-LD scripts
        document.querySelectorAll('script[type="application/ld+json"]').forEach(
            script => script.remove()
        );
        
        // Add current structured data
        this.structuredData.forEach(data => {
            const script = document.createElement('script');
            script.type = 'application/ld+json';
            script.textContent = JSON.stringify(data, null, 2);
            document.head.appendChild(script);
        });
    }
    
    /**
     * Set breadcrumbs
     */
    setBreadcrumbs(breadcrumbs) {
        this.breadcrumbs = breadcrumbs;
        this.updateWebPageSchema();
        this.renderBreadcrumbs();
    }
    
    /**
     * Render breadcrumbs to DOM
     */
    renderBreadcrumbs() {
        const breadcrumbContainer = document.querySelector('#velocity-breadcrumbs');
        if (!breadcrumbContainer) return;
        
        const breadcrumbHTML = this.breadcrumbs.map((crumb, index) => {
            const isLast = index === this.breadcrumbs.length - 1;
            return `
                <span class="breadcrumb-item ${isLast ? 'active' : ''}">
                    ${isLast ? crumb.name : `<a href="${crumb.url}">${crumb.name}</a>`}
                </span>
            `;
        }).join(' › ');
        
        breadcrumbContainer.innerHTML = breadcrumbHTML;
    }
    
    /**
     * Setup analytics
     */
    setupAnalytics() {
        if (this.config.googleAnalyticsId) {
            this.setupGoogleAnalytics();
        }
        
        if (this.config.googleTagManagerId) {
            this.setupGoogleTagManager();
        }
        
        if (this.config.facebookPixelId) {
            this.setupFacebookPixel();
        }
    }
    
    /**
     * Setup Google Analytics
     */
    setupGoogleAnalytics() {
        // Global site tag (gtag.js)
        const gtagScript = document.createElement('script');
        gtagScript.async = true;
        gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${this.config.googleAnalyticsId}`;
        document.head.appendChild(gtagScript);
        
        const configScript = document.createElement('script');
        configScript.textContent = `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${this.config.googleAnalyticsId}', {
                page_title: document.title,
                page_location: window.location.href
            });
        `;
        document.head.appendChild(configScript);
    }
    
    /**
     * Setup Google Tag Manager
     */
    setupGoogleTagManager() {
        // GTM script
        const gtmScript = document.createElement('script');
        gtmScript.textContent = `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${this.config.googleTagManagerId}');
        `;
        document.head.appendChild(gtmScript);
        
        // GTM noscript
        const noscript = document.createElement('noscript');
        noscript.innerHTML = `
            <iframe src="https://www.googletagmanager.com/ns.html?id=${this.config.googleTagManagerId}"
                    height="0" width="0" style="display:none;visibility:hidden"></iframe>
        `;
        document.body.insertBefore(noscript, document.body.firstChild);
    }
    
    /**
     * Setup Facebook Pixel
     */
    setupFacebookPixel() {
        const fbScript = document.createElement('script');
        fbScript.textContent = `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${this.config.facebookPixelId}');
            fbq('track', 'PageView');
        `;
        document.head.appendChild(fbScript);
        
        // Pixel noscript
        const noscript = document.createElement('noscript');
        noscript.innerHTML = `
            <img height="1" width="1" style="display:none"
                 src="https://www.facebook.com/tr?id=${this.config.facebookPixelId}&ev=PageView&noscript=1" />
        `;
        document.body.appendChild(noscript);
    }
    
    /**
     * Observe page changes for SPA
     */
    observePageChanges() {
        // Listen for router navigation
        window.addEventListener('velocityNavigate', (e) => {
            this.updatePageSEO(e.detail);
        });
        
        // Listen for history changes
        window.addEventListener('popstate', () => {
            this.updateCurrentPage();
        });
    }
    
    /**
     * Update SEO for current page
     */
    updatePageSEO(pageData = {}) {
        // Update basic metas
        if (pageData.title) {
            this.setTitle(pageData.title);
        }
        
        if (pageData.description) {
            this.setDescription(pageData.description);
        }
        
        if (pageData.keywords) {
            this.setKeywords(pageData.keywords);
        }
        
        if (pageData.image) {
            this.setImage(pageData.image, pageData.imageOptions);
        }
        
        if (pageData.canonical !== false) {
            this.setCanonical(pageData.canonical || window.location.href);
        }
        
        if (pageData.robots) {
            this.setRobots(pageData.robots);
        }
        
        // Update Open Graph
        if (pageData.openGraph) {
            this.setupOpenGraph(pageData.openGraph);
        }
        
        // Update Twitter Cards
        if (pageData.twitterCards) {
            this.setupTwitterCards(pageData.twitterCards);
        }
        
        // Update structured data
        if (pageData.structuredData) {
            this.addStructuredData(pageData.structuredData);
        } else {
            this.updateWebPageSchema();
        }
        
        // Update breadcrumbs
        if (pageData.breadcrumbs) {
            this.setBreadcrumbs(pageData.breadcrumbs);
        }
        
        // Track page view
        this.trackPageView();
        
        this.currentPage = pageData;
    }
    
    /**
     * Track page view in analytics
     */
    trackPageView() {
        // Google Analytics
        if (window.gtag) {
            gtag('config', this.config.googleAnalyticsId, {
                page_title: document.title,
                page_location: window.location.href
            });
        }
        
        // Facebook Pixel
        if (window.fbq) {
            fbq('track', 'PageView');
        }
        
        // Custom analytics event
        window.dispatchEvent(new CustomEvent('velocityPageView', {
            detail: {
                title: document.title,
                url: window.location.href,
                timestamp: Date.now()
            }
        }));
    }
    
    /**
     * Generate sitemap
     */
    generateSitemap(pages = []) {
        if (!this.config.enableSitemap) return null;
        
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(page => `
    <url>
        <loc>${this.config.siteUrl}${page.url}</loc>
        <lastmod>${page.lastmod || new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>${page.changefreq || 'weekly'}</changefreq>
        <priority>${page.priority || '0.8'}</priority>
    </url>
`).join('')}
</urlset>`;
        
        return sitemap;
    }
    
    /**
     * Generate robots.txt
     */
    generateRobotsTxt() {
        return `User-agent: *
Allow: /

Sitemap: ${this.config.siteUrl}/sitemap.xml`;
    }
    
    /**
     * Utility methods
     */
    setMeta(name, content, type = 'name') {
        this.removeMeta(name, type);
        
        const meta = document.createElement('meta');
        meta.setAttribute(type, name);
        meta.setAttribute('content', content);
        document.head.appendChild(meta);
        
        this.metaTags.set(`${type}:${name}`, meta);
    }
    
    removeMeta(name, type = 'name') {
        const key = `${type}:${name}`;
        const existing = this.metaTags.get(key);
        if (existing) {
            existing.remove();
            this.metaTags.delete(key);
        }
    }
    
    getMeta(name, type = 'name') {
        const meta = document.querySelector(`meta[${type}="${name}"]`);
        return meta ? meta.getAttribute('content') : null;
    }
    
    addLink(rel, href, attributes = {}) {
        const link = document.createElement('link');
        link.rel = rel;
        link.href = href;
        
        Object.entries(attributes).forEach(([key, value]) => {
            link.setAttribute(key, value);
        });
        
        document.head.appendChild(link);
        return link;
    }
    
    removeLink(rel) {
        const existing = document.querySelector(`link[rel="${rel}"]`);
        if (existing) {
            existing.remove();
        }
    }
    
    /**
     * Update current page info
     */
    updateCurrentPage() {
        this.updateWebPageSchema();
        this.trackPageView();
    }
    
    /**
     * Get SEO status
     */
    getStatus() {
        return {
            title: document.title,
            description: this.getMeta('description'),
            canonical: document.querySelector('link[rel="canonical"]')?.href,
            robots: this.getMeta('robots'),
            structuredDataCount: this.structuredData.length,
            breadcrumbsCount: this.breadcrumbs.length,
            metaTagsCount: this.metaTags.size,
            hasAnalytics: !!(this.config.googleAnalyticsId || this.config.googleTagManagerId)
        };
    }
}

export default VelocitySEO; 