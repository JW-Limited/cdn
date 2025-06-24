# VelocityJS v2.0.0 - Enhanced Modern Web Framework

**VelocityJS** is a blazing fast, feature-rich web framework that brings Next.js-like capabilities to vanilla JavaScript. With zero external dependencies, it provides powerful routing, state management, component system, and much more.

## 🚀 New in v2.0.0

### Next.js-like Features
- **HTML Page Fetching** - Load HTML pages dynamically with AJAX
- **Layout System** - Nested layouts with content injection  
- **Head Management** - Dynamic meta tags, titles, and SEO optimization
- **Component System** - Reusable components with lifecycle hooks
- **Static Generation** - Pre-render pages for better performance
- **API Routes** - Mock API endpoints for development

### Enhanced Capabilities
- **Plugin Architecture** - Extensible plugin system
- **State Management** - Built-in reactive state with Vuex-like API
- **Theme System** - Dark/light mode with auto-detection
- **Internationalization** - Multi-language support
- **Error Boundaries** - Graceful error handling
- **Performance Monitoring** - Web Vitals tracking
- **Accessibility** - ARIA support, focus management, screen reader compatibility
- **Development Tools** - Enhanced debugging and dev experience

### Advanced Networking
- **Request Caching** - Intelligent response caching with TTL
- **Offline Support** - Queue requests when offline
- **Request Interceptors** - Transform requests/responses
- **Rate Limiting** - Prevent API abuse
- **Mock Responses** - Test with fake data
- **File Upload/Download** - Built-in file handling

## 📦 Installation

```bash
npm install velocity-js-framework
```

Or use via CDN:
```html
<script type="module">
  import VelocityJS from 'https://cdn.jsdelivr.net/npm/velocity-js-framework/src/velocity.js';
</script>
```

## 🎯 Quick Start

### Basic Setup
```javascript
import { createApp } from './src/velocity.js';

const app = createApp({
  debug: true,
  theme: 'auto',
  baseURL: '/api'
});

// Define routes with enhanced options
app.route('/', () => '<h1>Welcome to VelocityJS v2.0!</h1>', {
  title: 'Home Page',
  meta: {
    description: 'VelocityJS enhanced framework demo'
  }
});

// Initialize the app
await app.init();
```

### HTML Page Fetching (NEW!)
```javascript
app.route('/about', null, {
  fetchHtml: true,
  htmlPath: '/pages/about.html',
  title: 'About Us',
  cache: true
});
```

### Component-Based Pages
```javascript
// Register a component
app.component('UserCard', {
  template: (props) => `
    <div class="velocity-card">
      <h3>${props.name}</h3>
      <p>${props.email}</p>
    </div>
  `
});

// Use component in page
app.page('/user/[id]', 'UserCard', {
  title: (context) => `User ${context.params.id}`,
  head: {
    meta: {
      description: 'User profile page'
    }
  }
});
```

## 🧩 Enhanced Features

### 1. Layout System
```javascript
// Define a layout
app.router.addLayout('main', (context) => `
  <!DOCTYPE html>
  <html>
    <head>
      <title>${context.title || 'VelocityJS App'}</title>
    </head>
    <body>
      <nav>...</nav>
      <main>{{content}}</main>
      <footer>...</footer>
    </body>
  </html>
`);

// Use layout in routes
app.route('/dashboard', dashboardHandler, {
  layout: 'main',
  title: 'Dashboard'
});
```

### 2. State Management
```javascript
// Create a store
const store = app.createStore({
  user: null,
  posts: []
});

// Add mutations
store.mutations.set('setUser', (state, user) => {
  state.user = user;
});

// Add actions
store.actions.set('fetchUser', async ({ commit }, userId) => {
  const user = await app.network.get(`/users/${userId}`);
  commit('setUser', user);
});

// Use in components
store.dispatch('fetchUser', 123);
```

### 3. Plugin System
```javascript
// Create a plugin
const analyticsPlugin = {
  name: 'analytics',
  install(app, options) {
    app.track = (event, data) => {
      console.log('Analytics:', event, data);
    };
  }
};

// Use plugin
app.use(analyticsPlugin, { apiKey: 'your-key' });
```

### 4. Theme Management
```javascript
// Set theme
app.setTheme('dark'); // 'light', 'dark', or 'auto'

// Listen for theme changes
app.events.on('theme:changed', (theme) => {
  console.log('Theme changed to:', theme);
});
```

### 5. Head Management
```javascript
app.setHead({
  title: 'My App',
  meta: {
    description: 'Amazing web application',
    keywords: 'web, app, javascript',
    'og:title': 'My App',
    'og:description': 'Share description',
    'twitter:card': 'summary'
  },
  link: {
    canonical: 'https://myapp.com',
    icon: '/favicon.ico'
  }
});
```

### 6. Internationalization
```javascript
// Add translations
app.i18n.addMessages('en', {
  welcome: 'Welcome to {name}!',
  goodbye: 'Goodbye, {name}!'
});

app.i18n.addMessages('es', {
  welcome: '¡Bienvenido a {name}!',
  goodbye: '¡Adiós, {name}!'
});

// Use translations
app.setLocale('es');
const message = app.t('welcome', { name: 'VelocityJS' });
```

## 🌐 Advanced Networking

### Request Caching
```javascript
// Cache responses for 5 minutes
const response = await app.network.get('/api/data', {
  cache: true,
  cacheTTL: 300000
});
```

### Request Interceptors
```javascript
// Add auth token to all requests
app.network.addRequestInterceptor((config) => {
  config.headers.Authorization = `Bearer ${getToken()}`;
  return config;
});

// Handle response errors
app.network.addResponseInterceptor(
  (response) => response,
  (error) => {
    if (error.status === 401) {
      app.navigate('/login');
    }
    return Promise.reject(error);
  }
);
```

### Offline Support
```javascript
// Requests automatically queue when offline
const response = await app.network.post('/api/data', {
  message: 'This will be sent when back online'
});
```

### File Operations
```javascript
// Upload file with progress
await app.network.upload('/api/upload', formData, {
  onProgress: (percent) => console.log(`Upload: ${percent}%`)
});

// Download file
await app.network.download('/api/file.pdf', {
  filename: 'document.pdf'
});
```

## 🎨 Enhanced CSS Framework

VelocityJS includes a comprehensive CSS framework with:

- **CSS Variables** - Full theme customization
- **Dark Mode** - Automatic system preference detection
- **Component Library** - Buttons, forms, cards, modals, etc.
- **Grid System** - Flexible 12-column layout
- **Utilities** - Spacing, typography, colors
- **Animations** - Smooth transitions and effects
- **Accessibility** - WCAG compliant components

### Example Usage
```html
<div class="velocity-container">
  <div class="velocity-row">
    <div class="velocity-col-6">
      <div class="velocity-card">
        <div class="velocity-card-body">
          <h5>Enhanced Card</h5>
          <p>With theme support and animations</p>
          <button class="velocity-btn velocity-btn-primary">
            Action
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
```

## 🔧 Router Enhancements

### Dynamic Routes with Parameters
```javascript
app.route('/user/[id]', (context) => {
  return `<h1>User ${context.params.id}</h1>`;
});

app.route('/blog/[...slug]', (context) => {
  const path = context.params.slug;
  return `<h1>Blog: ${path}</h1>`;
});
```

### Route Guards
```javascript
app.router.addGuard('/admin/*', (context) => {
  if (!user.isAdmin) {
    app.navigate('/login');
    return false;
  }
  return true;
});
```

### Nested Routes
```javascript
app.route('/dashboard', dashboardHandler, {
  children: [
    { path: '/stats', handler: statsHandler },
    { path: '/users', handler: usersHandler }
  ]
});
```

### Route Transitions
```javascript
app.router.addTransition('slide', {
  out: async () => {
    document.querySelector('#app').style.transform = 'translateX(-100%)';
    await sleep(300);
  },
  in: async () => {
    document.querySelector('#app').style.transform = 'translateX(0)';
  }
});

app.route('/page', handler, { transition: 'slide' });
```

## 📊 Performance Monitoring

### Web Vitals Tracking
```javascript
// Automatically tracks Core Web Vitals
app.performance.vitals; // { FCP, LCP, FID, CLS }

// Custom performance marks
app.addPerformanceMark('feature-start');
// ... code execution
const duration = app.measurePerformance('feature', 'feature-start', 'feature-end');
```

### Memory Usage
```javascript
const stats = app.getStats();
console.log(stats.performance.memoryUsage);
```

## 🛠 Development Tools

### Debug Mode
```javascript
const app = createApp({ debug: true });

// Enhanced logging
app.logger.time('route-render');
// ... code
app.logger.time('route-render').end();

// Component inspection
console.log(app.getStats());
```

### Error Boundaries
```javascript
app.errorBoundary.addErrorBoundary('user-component', {
  fallback: (error) => `<div>Error loading user: ${error.message}</div>`
});
```

## 🧪 Testing Support

### Mock API Responses
```javascript
// Add mock responses for testing
app.network.addMockResponse('/api/users', 'GET', {
  data: [{ id: 1, name: 'John Doe' }],
  status: 200
});

// Test will use mock data
const users = await app.network.get('/api/users');
```

## 📱 Progressive Web App Features

### Service Worker Support
```javascript
const app = createApp({ 
  enableServiceWorker: true 
});
```

### Offline First
```javascript
// Automatically handles offline scenarios
// Queues requests when offline
// Syncs when back online
```

## 🔒 Security Features

### Content Security Policy
```javascript
app.setHead({
  meta: {
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval'"
  }
});
```

### Request Sanitization
```javascript
// Automatic XSS protection in templates
app.component('SafeContent', {
  template: (props) => app.utils.sanitizeHtml(props.content)
});
```

## 📚 API Reference

### Core Methods
- `createApp(options)` - Create new VelocityJS instance
- `init()` - Initialize the framework
- `route(path, handler, options)` - Add route
- `page(path, component, options)` - Add page component
- `component(name, definition)` - Register component
- `use(plugin, options)` - Add plugin
- `navigate(path, options)` - Navigate to route
- `setTheme(theme)` - Change theme
- `setState(key, value)` - Set global state
- `getStats()` - Get performance statistics

### Router API
- `addRoute(path, handler, options)` - Add route with full options
- `addLayout(name, template)` - Add layout template
- `addGuard(path, guard)` - Add route guard
- `addTransition(name, config)` - Add page transition
- `preloadRoute(path)` - Preload route for faster navigation

### Network API
- `request(url, options)` - Make HTTP request
- `get/post/put/delete(url, data, options)` - HTTP methods
- `upload(url, formData, options)` - File upload
- `download(url, options)` - File download
- `setAuthToken(pattern, token)` - Set auth tokens
- `addRequestInterceptor(fn)` - Add request interceptor
- `setRateLimit(url, limit, window)` - Set rate limiting

### Storage API  
- `set(key, value, options)` - Store data
- `get(key, defaultValue)` - Retrieve data
- `remove(key)` - Remove data
- `clear()` - Clear all data
- `setTTL(key, ttl)` - Set expiration
- `encrypt/decrypt(data)` - Encrypt sensitive data

## 🎯 Examples

Check out the `examples/` directory for:
- **Basic SPA** - Simple single-page application
- **E-commerce App** - Shopping cart with state management  
- **Blog Platform** - Content management with routing
- **Dashboard** - Admin interface with components
- **PWA Example** - Progressive web app features

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by Next.js, Vue.js, and modern web development practices
- Built with modern web standards and accessibility in mind
- Community-driven development

---

**VelocityJS v2.0.0** - Where performance meets developer experience! 🚀 