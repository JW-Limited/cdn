/**
 * VelocityJS Web Workers
 * Advanced Web Worker management and task processing
 */

class VelocityWorkers {
    constructor(config = {}) {
        this.config = {
            maxWorkers: navigator.hardwareConcurrency || 4,
            workerTimeout: 30000, // 30 seconds
            enableSharedWorkers: true,
            enableServiceWorker: true,
            workerScripts: {},
            taskQueue: [],
            ...config
        };
        
        this.workers = new Map();
        this.sharedWorkers = new Map();
        this.taskQueue = [];
        this.runningTasks = new Map();
        this.workerPool = [];
        
        this.init();
    }
    
    /**
     * Initialize worker system
     */
    init() {
        this.createWorkerPool();
        this.registerBuiltinWorkers();
        
        console.log('VelocityWorkers initialized');
    }
    
    /**
     * Create worker pool
     */
    createWorkerPool() {
        for (let i = 0; i < this.config.maxWorkers; i++) {
            const worker = this.createGenericWorker();
            this.workerPool.push({
                worker,
                busy: false,
                id: `worker-${i}`
            });
        }
    }
    
    /**
     * Create generic worker
     */
    createGenericWorker() {
        const workerCode = `
// VelocityJS Generic Worker
let currentTask = null;

self.addEventListener('message', async function(e) {
    const { id, type, data, code } = e.data;
    currentTask = id;
    
    try {
        let result;
        
        switch(type) {
            case 'execute':
                result = await executeCode(code, data);
                break;
            case 'compute':
                result = await computeTask(data);
                break;
            case 'process':
                result = await processData(data);
                break;
            case 'fetch':
                result = await fetchData(data);
                break;
            case 'parse':
                result = await parseData(data);
                break;
            case 'transform':
                result = await transformData(data);
                break;
            default:
                throw new Error('Unknown task type: ' + type);
        }
        
        self.postMessage({
            id,
            success: true,
            result,
            timestamp: Date.now()
        });
        
    } catch (error) {
        self.postMessage({
            id,
            success: false,
            error: error.message,
            stack: error.stack,
            timestamp: Date.now()
        });
    } finally {
        currentTask = null;
    }
});

// Execute arbitrary code safely
async function executeCode(code, data) {
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const func = new AsyncFunction('data', code);
    return await func(data);
}

// Heavy computation tasks
async function computeTask(data) {
    const { operation, values, options = {} } = data;
    
    switch(operation) {
        case 'sort':
            return values.sort((a, b) => options.desc ? b - a : a - b);
        
        case 'filter':
            const condition = new Function('item', 'index', options.condition);
            return values.filter(condition);
        
        case 'map':
            const mapper = new Function('item', 'index', options.mapper);
            return values.map(mapper);
        
        case 'reduce':
            const reducer = new Function('acc', 'item', 'index', options.reducer);
            return values.reduce(reducer, options.initial);
        
        case 'fibonacci':
            return fibonacci(values);
        
        case 'prime':
            return isPrime(values);
        
        case 'factorial':
            return factorial(values);
        
        case 'matrix':
            return matrixOperation(values, options);
        
        default:
            throw new Error('Unknown computation operation: ' + operation);
    }
}

// Data processing
async function processData(data) {
    const { operation, input, options = {} } = data;
    
    switch(operation) {
        case 'hash':
            return await hashData(input, options.algorithm);
        
        case 'encrypt':
            return await encryptData(input, options.key);
        
        case 'compress':
            return await compressData(input);
        
        case 'validate':
            return validateData(input, options.schema);
        
        case 'sanitize':
            return sanitizeData(input, options.rules);
        
        default:
            throw new Error('Unknown processing operation: ' + operation);
    }
}

// Fetch data
async function fetchData(data) {
    const { url, options = {} } = data;
    
    const response = await fetch(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body,
        ...options
    });
    
    if (!response.ok) {
        throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    }
    
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
        return await response.json();
    } else if (contentType?.includes('text/')) {
        return await response.text();
    } else {
        return await response.arrayBuffer();
    }
}

// Parse data
async function parseData(data) {
    const { input, format, options = {} } = data;
    
    switch(format) {
        case 'json':
            return JSON.parse(input);
        
        case 'csv':
            return parseCSV(input, options);
        
        case 'xml':
            return parseXML(input);
        
        case 'yaml':
            return parseYAML(input);
        
        case 'markdown':
            return parseMarkdown(input);
        
        default:
            throw new Error('Unknown format: ' + format);
    }
}

// Transform data
async function transformData(data) {
    const { input, transformations } = data;
    let result = input;
    
    for (const transform of transformations) {
        result = await applyTransformation(result, transform);
    }
    
    return result;
}

// Helper functions
function fibonacci(n) {
    if (n <= 1) return n;
    let a = 0, b = 1;
    for (let i = 2; i <= n; i++) {
        [a, b] = [b, a + b];
    }
    return b;
}

function isPrime(n) {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 === 0 || n % 3 === 0) return false;
    
    for (let i = 5; i * i <= n; i += 6) {
        if (n % i === 0 || n % (i + 2) === 0) return false;
    }
    return true;
}

function factorial(n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

function matrixOperation(matrices, options) {
    const { operation } = options;
    const [a, b] = matrices;
    
    switch(operation) {
        case 'multiply':
            return multiplyMatrices(a, b);
        case 'add':
            return addMatrices(a, b);
        case 'transpose':
            return transposeMatrix(a);
        default:
            throw new Error('Unknown matrix operation');
    }
}

function multiplyMatrices(a, b) {
    const result = [];
    for (let i = 0; i < a.length; i++) {
        result[i] = [];
        for (let j = 0; j < b[0].length; j++) {
            let sum = 0;
            for (let k = 0; k < b.length; k++) {
                sum += a[i][k] * b[k][j];
            }
            result[i][j] = sum;
        }
    }
    return result;
}

function addMatrices(a, b) {
    return a.map((row, i) => row.map((val, j) => val + b[i][j]));
}

function transposeMatrix(matrix) {
    return matrix[0].map((_, i) => matrix.map(row => row[i]));
}

async function hashData(data, algorithm = 'SHA-256') {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest(algorithm, dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function parseCSV(csv, options = {}) {
    const { delimiter = ',', headers = true } = options;
    const lines = csv.trim().split('\\n');
    const headerRow = headers ? lines.shift().split(delimiter) : null;
    
    return lines.map(line => {
        const values = line.split(delimiter);
        if (headerRow) {
            const obj = {};
            headerRow.forEach((header, i) => {
                obj[header] = values[i];
            });
            return obj;
        }
        return values;
    });
}

function parseXML(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    return xmlToObject(doc.documentElement);
}

function xmlToObject(node) {
    const obj = {};
    
    if (node.attributes) {
        for (const attr of node.attributes) {
            obj[\`@\${attr.name}\`] = attr.value;
        }
    }
    
    if (node.childNodes) {
        for (const child of node.childNodes) {
            if (child.nodeType === 3) { // Text node
                const text = child.textContent.trim();
                if (text) obj.text = text;
            } else if (child.nodeType === 1) { // Element node
                const childObj = xmlToObject(child);
                if (obj[child.nodeName]) {
                    if (!Array.isArray(obj[child.nodeName])) {
                        obj[child.nodeName] = [obj[child.nodeName]];
                    }
                    obj[child.nodeName].push(childObj);
                } else {
                    obj[child.nodeName] = childObj;
                }
            }
        }
    }
    
    return obj;
}

async function applyTransformation(data, transform) {
    const { type, options } = transform;
    
    switch(type) {
        case 'filter':
            return data.filter(new Function('item', options.condition));
        case 'map':
            return data.map(new Function('item', options.mapper));
        case 'sort':
            return data.sort(new Function('a', 'b', options.comparator));
        case 'group':
            return groupBy(data, options.key);
        default:
            return data;
    }
}

function groupBy(array, key) {
    return array.reduce((groups, item) => {
        const group = item[key];
        groups[group] = groups[group] || [];
        groups[group].push(item);
        return groups;
    }, {});
}

// Terminate handler
self.addEventListener('terminate', function() {
    if (currentTask) {
        self.postMessage({
            id: currentTask,
            success: false,
            error: 'Worker terminated',
            timestamp: Date.now()
        });
    }
});
`;
        
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        return new Worker(URL.createObjectURL(blob));
    }
    
    /**
     * Register built-in workers
     */
    registerBuiltinWorkers() {
        // Image processing worker
        this.registerWorker('imageProcessor', this.createImageWorker());
        
        // Data processing worker
        this.registerWorker('dataProcessor', this.createDataWorker());
        
        // Network worker
        this.registerWorker('networkWorker', this.createNetworkWorker());
    }
    
    /**
     * Create image processing worker
     */
    createImageWorker() {
        const imageWorkerCode = `
self.addEventListener('message', async function(e) {
    const { id, operation, imageData, options = {} } = e.data;
    
    try {
        let result;
        
        switch(operation) {
            case 'resize':
                result = await resizeImage(imageData, options);
                break;
            case 'filter':
                result = await applyFilter(imageData, options);
                break;
            case 'compress':
                result = await compressImage(imageData, options);
                break;
            case 'analyze':
                result = await analyzeImage(imageData);
                break;
            default:
                throw new Error('Unknown image operation: ' + operation);
        }
        
        self.postMessage({
            id,
            success: true,
            result,
            timestamp: Date.now()
        });
        
    } catch (error) {
        self.postMessage({
            id,
            success: false,
            error: error.message,
            timestamp: Date.now()
        });
    }
});

async function resizeImage(imageData, options) {
    const { width, height } = options;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    const bitmap = await createImageBitmap(imageData);
    ctx.drawImage(bitmap, 0, 0, width, height);
    
    return canvas.transferToImageBitmap();
}

async function applyFilter(imageData, options) {
    const { filter } = options;
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    
    ctx.putImageData(imageData, 0, 0);
    ctx.filter = filter;
    ctx.drawImage(canvas, 0, 0);
    
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

async function compressImage(imageData, options) {
    const { quality = 0.8, format = 'image/jpeg' } = options;
    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    
    ctx.putImageData(imageData, 0, 0);
    const blob = await canvas.convertToBlob({ type: format, quality });
    
    return blob;
}

async function analyzeImage(imageData) {
    const { data, width, height } = imageData;
    let totalR = 0, totalG = 0, totalB = 0;
    let pixelCount = 0;
    
    for (let i = 0; i < data.length; i += 4) {
        totalR += data[i];
        totalG += data[i + 1];
        totalB += data[i + 2];
        pixelCount++;
    }
    
    return {
        averageColor: {
            r: Math.round(totalR / pixelCount),
            g: Math.round(totalG / pixelCount),
            b: Math.round(totalB / pixelCount)
        },
        dimensions: { width, height },
        pixelCount,
        size: data.length
    };
}
`;
        
        const blob = new Blob([imageWorkerCode], { type: 'application/javascript' });
        return new Worker(URL.createObjectURL(blob));
    }
    
    /**
     * Create data processing worker
     */
    createDataWorker() {
        const dataWorkerCode = `
self.addEventListener('message', async function(e) {
    const { id, operation, data, options = {} } = e.data;
    
    try {
        let result;
        
        switch(operation) {
            case 'sort':
                result = performSort(data, options);
                break;
            case 'search':
                result = performSearch(data, options);
                break;
            case 'aggregate':
                result = performAggregation(data, options);
                break;
            case 'validate':
                result = validateData(data, options);
                break;
            default:
                throw new Error('Unknown data operation: ' + operation);
        }
        
        self.postMessage({
            id,
            success: true,
            result,
            timestamp: Date.now()
        });
        
    } catch (error) {
        self.postMessage({
            id,
            success: false,
            error: error.message,
            timestamp: Date.now()
        });
    }
});

function performSort(data, options) {
    const { key, order = 'asc', algorithm = 'quick' } = options;
    
    const compareFn = (a, b) => {
        let valueA = key ? a[key] : a;
        let valueB = key ? b[key] : b;
        
        if (typeof valueA === 'string') valueA = valueA.toLowerCase();
        if (typeof valueB === 'string') valueB = valueB.toLowerCase();
        
        if (valueA < valueB) return order === 'asc' ? -1 : 1;
        if (valueA > valueB) return order === 'asc' ? 1 : -1;
        return 0;
    };
    
    return data.sort(compareFn);
}

function performSearch(data, options) {
    const { query, fields, fuzzy = false, caseSensitive = false } = options;
    let searchQuery = caseSensitive ? query : query.toLowerCase();
    
    return data.filter(item => {
        return fields.some(field => {
            let value = item[field];
            if (typeof value !== 'string') value = String(value);
            if (!caseSensitive) value = value.toLowerCase();
            
            if (fuzzy) {
                return fuzzyMatch(value, searchQuery);
            } else {
                return value.includes(searchQuery);
            }
        });
    });
}

function fuzzyMatch(text, pattern) {
    const patternLength = pattern.length;
    const textLength = text.length;
    
    if (patternLength === 0) return true;
    if (textLength === 0) return false;
    
    let patternIdx = 0;
    let textIdx = 0;
    
    while (textIdx < textLength && patternIdx < patternLength) {
        if (text[textIdx] === pattern[patternIdx]) {
            patternIdx++;
        }
        textIdx++;
    }
    
    return patternIdx === patternLength;
}

function performAggregation(data, options) {
    const { operations } = options;
    const results = {};
    
    operations.forEach(op => {
        const { type, field, alias } = op;
        const key = alias || \`\${type}_\${field}\`;
        
        switch(type) {
            case 'sum':
                results[key] = data.reduce((sum, item) => sum + (item[field] || 0), 0);
                break;
            case 'avg':
                const sum = data.reduce((sum, item) => sum + (item[field] || 0), 0);
                results[key] = sum / data.length;
                break;
            case 'min':
                results[key] = Math.min(...data.map(item => item[field] || 0));
                break;
            case 'max':
                results[key] = Math.max(...data.map(item => item[field] || 0));
                break;
            case 'count':
                results[key] = data.length;
                break;
            case 'distinct':
                results[key] = [...new Set(data.map(item => item[field]))].length;
                break;
        }
    });
    
    return results;
}

function validateData(data, options) {
    const { schema } = options;
    const errors = [];
    
    data.forEach((item, index) => {
        Object.entries(schema).forEach(([field, rules]) => {
            const value = item[field];
            
            rules.forEach(rule => {
                if (!validateRule(value, rule)) {
                    errors.push({
                        index,
                        field,
                        value,
                        rule: rule.type,
                        message: rule.message || \`Validation failed for \${field}\`
                    });
                }
            });
        });
    });
    
    return { valid: errors.length === 0, errors };
}

function validateRule(value, rule) {
    switch(rule.type) {
        case 'required':
            return value !== null && value !== undefined && value !== '';
        case 'type':
            return typeof value === rule.value;
        case 'min':
            return value >= rule.value;
        case 'max':
            return value <= rule.value;
        case 'minLength':
            return value && value.length >= rule.value;
        case 'maxLength':
            return value && value.length <= rule.value;
        case 'pattern':
            return new RegExp(rule.value).test(value);
        case 'email':
            return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);
        case 'url':
            try {
                new URL(value);
                return true;
            } catch {
                return false;
            }
        default:
            return true;
    }
}
`;
        
        const blob = new Blob([dataWorkerCode], { type: 'application/javascript' });
        return new Worker(URL.createObjectURL(blob));
    }
    
    /**
     * Create network worker
     */
    createNetworkWorker() {
        const networkWorkerCode = `
self.addEventListener('message', async function(e) {
    const { id, operation, data, options = {} } = e.data;
    
    try {
        let result;
        
        switch(operation) {
            case 'batch':
                result = await batchRequests(data, options);
                break;
            case 'download':
                result = await downloadFile(data, options);
                break;
            case 'upload':
                result = await uploadFile(data, options);
                break;
            case 'sync':
                result = await syncData(data, options);
                break;
            default:
                throw new Error('Unknown network operation: ' + operation);
        }
        
        self.postMessage({
            id,
            success: true,
            result,
            timestamp: Date.now()
        });
        
    } catch (error) {
        self.postMessage({
            id,
            success: false,
            error: error.message,
            timestamp: Date.now()
        });
    }
});

async function batchRequests(requests, options) {
    const { concurrency = 5, delay = 0 } = options;
    const results = [];
    
    for (let i = 0; i < requests.length; i += concurrency) {
        const batch = requests.slice(i, i + concurrency);
        const batchPromises = batch.map(request => 
            fetch(request.url, request.options)
                .then(response => ({ request, response, success: true }))
                .catch(error => ({ request, error, success: false }))
        );
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        if (delay > 0 && i + concurrency < requests.length) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    return results;
}

async function downloadFile(data, options) {
    const { url, onProgress } = data;
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    }
    
    const contentLength = response.headers.get('content-length');
    const total = parseInt(contentLength, 10);
    let loaded = 0;
    
    const reader = response.body.getReader();
    const chunks = [];
    
    while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        loaded += value.length;
        
        if (onProgress && total) {
            self.postMessage({
                type: 'progress',
                loaded,
                total,
                percent: (loaded / total) * 100
            });
        }
    }
    
    const blob = new Blob(chunks);
    return blob;
}

async function uploadFile(data, options) {
    const { file, url, method = 'POST', headers = {} } = data;
    
    const formData = new FormData();
    formData.append('file', file);
    
    if (options.fields) {
        Object.entries(options.fields).forEach(([key, value]) => {
            formData.append(key, value);
        });
    }
    
    const response = await fetch(url, {
        method,
        headers,
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    }
    
    return await response.json();
}

async function syncData(data, options) {
    const { localData, remoteUrl, strategy = 'merge' } = data;
    
    // Fetch remote data
    const response = await fetch(remoteUrl);
    const remoteData = await response.json();
    
    let syncedData;
    
    switch(strategy) {
        case 'merge':
            syncedData = mergeData(localData, remoteData);
            break;
        case 'remote':
            syncedData = remoteData;
            break;
        case 'local':
            syncedData = localData;
            break;
        default:
            syncedData = localData;
    }
    
    return syncedData;
}

function mergeData(local, remote) {
    // Simple merge strategy - can be enhanced
    const merged = [...local];
    
    remote.forEach(remoteItem => {
        const existingIndex = merged.findIndex(localItem => 
            localItem.id === remoteItem.id
        );
        
        if (existingIndex !== -1) {
            // Update existing item
            merged[existingIndex] = { ...merged[existingIndex], ...remoteItem };
        } else {
            // Add new item
            merged.push(remoteItem);
        }
    });
    
    return merged;
}
`;
        
        const blob = new Blob([networkWorkerCode], { type: 'application/javascript' });
        return new Worker(URL.createObjectURL(blob));
    }
    
    /**
     * Register a custom worker
     */
    registerWorker(name, worker) {
        this.workers.set(name, worker);
        
        worker.addEventListener('message', (e) => {
            this.handleWorkerMessage(name, e.data);
        });
        
        worker.addEventListener('error', (e) => {
            console.error(`Worker ${name} error:`, e);
        });
    }
    
    /**
     * Handle worker messages
     */
    handleWorkerMessage(workerName, data) {
        const { id, success, result, error, type } = data;
        
        if (type === 'progress') {
            // Handle progress updates
            const task = this.runningTasks.get(id);
            if (task && task.onProgress) {
                task.onProgress(data);
            }
            return;
        }
        
        const task = this.runningTasks.get(id);
        if (!task) return;
        
        this.runningTasks.delete(id);
        
        // Mark worker as available
        const poolWorker = this.workerPool.find(w => w.worker === task.worker);
        if (poolWorker) {
            poolWorker.busy = false;
        }
        
        // Process next task in queue
        this.processQueue();
        
        if (success) {
            task.resolve(result);
        } else {
            task.reject(new Error(error));
        }
    }
    
    /**
     * Execute task in worker
     */
    async executeTask(type, data, options = {}) {
        const taskId = this.generateTaskId();
        
        return new Promise((resolve, reject) => {
            const task = {
                id: taskId,
                type,
                data,
                options,
                resolve,
                reject,
                timestamp: Date.now(),
                timeout: options.timeout || this.config.workerTimeout,
                onProgress: options.onProgress
            };
            
            // Try to execute immediately or queue
            if (!this.tryExecuteTask(task)) {
                this.taskQueue.push(task);
            }
        });
    }
    
    /**
     * Try to execute task immediately
     */
    tryExecuteTask(task) {
        const availableWorker = this.workerPool.find(w => !w.busy);
        
        if (!availableWorker) {
            return false;
        }
        
        availableWorker.busy = true;
        task.worker = availableWorker.worker;
        
        this.runningTasks.set(task.id, task);
        
        // Set timeout
        task.timeoutId = setTimeout(() => {
            this.handleTaskTimeout(task.id);
        }, task.timeout);
        
        // Send task to worker
        availableWorker.worker.postMessage({
            id: task.id,
            type: task.type,
            data: task.data,
            code: task.options.code
        });
        
        return true;
    }
    
    /**
     * Process task queue
     */
    processQueue() {
        while (this.taskQueue.length > 0) {
            const task = this.taskQueue.shift();
            if (!this.tryExecuteTask(task)) {
                // Put back in queue if no workers available
                this.taskQueue.unshift(task);
                break;
            }
        }
    }
    
    /**
     * Handle task timeout
     */
    handleTaskTimeout(taskId) {
        const task = this.runningTasks.get(taskId);
        if (!task) return;
        
        this.runningTasks.delete(taskId);
        
        // Mark worker as available
        const poolWorker = this.workerPool.find(w => w.worker === task.worker);
        if (poolWorker) {
            poolWorker.busy = false;
        }
        
        task.reject(new Error('Task timeout'));
        this.processQueue();
    }
    
    /**
     * Execute code in worker
     */
    async execute(code, data, options = {}) {
        return this.executeTask('execute', data, { ...options, code });
    }
    
    /**
     * Compute heavy calculation
     */
    async compute(operation, values, options = {}) {
        return this.executeTask('compute', { operation, values, options });
    }
    
    /**
     * Process data
     */
    async process(operation, input, options = {}) {
        return this.executeTask('process', { operation, input, options });
    }
    
    /**
     * Fetch data in worker
     */
    async fetch(url, options = {}) {
        return this.executeTask('fetch', { url, options });
    }
    
    /**
     * Parse data in worker
     */
    async parse(input, format, options = {}) {
        return this.executeTask('parse', { input, format, options });
    }
    
    /**
     * Transform data in worker
     */
    async transform(input, transformations) {
        return this.executeTask('transform', { input, transformations });
    }
    
    /**
     * Process images
     */
    async processImage(operation, imageData, options = {}) {
        const worker = this.workers.get('imageProcessor');
        if (!worker) {
            throw new Error('Image processor worker not available');
        }
        
        const taskId = this.generateTaskId();
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Image processing timeout'));
            }, this.config.workerTimeout);
            
            const handler = (e) => {
                if (e.data.id === taskId) {
                    clearTimeout(timeout);
                    worker.removeEventListener('message', handler);
                    
                    if (e.data.success) {
                        resolve(e.data.result);
                    } else {
                        reject(new Error(e.data.error));
                    }
                }
            };
            
            worker.addEventListener('message', handler);
            worker.postMessage({ id: taskId, operation, imageData, options });
        });
    }
    
    /**
     * Create shared worker
     */
    createSharedWorker(name, script) {
        if (!this.config.enableSharedWorkers || !window.SharedWorker) {
            throw new Error('Shared Workers not supported');
        }
        
        const sharedWorker = new SharedWorker(script, name);
        this.sharedWorkers.set(name, sharedWorker);
        
        return sharedWorker;
    }
    
    /**
     * Generate unique task ID
     */
    generateTaskId() {
        return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Get worker status
     */
    getStatus() {
        return {
            totalWorkers: this.workerPool.length,
            busyWorkers: this.workerPool.filter(w => w.busy).length,
            queuedTasks: this.taskQueue.length,
            runningTasks: this.runningTasks.size,
            registeredWorkers: Array.from(this.workers.keys()),
            sharedWorkers: Array.from(this.sharedWorkers.keys())
        };
    }
    
    /**
     * Terminate all workers
     */
    terminate() {
        // Terminate pool workers
        this.workerPool.forEach(({ worker }) => {
            worker.terminate();
        });
        
        // Terminate registered workers
        this.workers.forEach(worker => {
            worker.terminate();
        });
        
        // Clear all tasks
        this.taskQueue.length = 0;
        this.runningTasks.clear();
        
        console.log('All workers terminated');
    }
}

export default VelocityWorkers; 