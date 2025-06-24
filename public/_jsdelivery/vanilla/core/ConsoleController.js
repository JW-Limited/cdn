class ConsoleController {
    static LOG_LEVELS = {
        DEBUG: { value: 0, label: 'DEBUG', color: '#6c757d' },
        LOG: { value: 1, label: 'LOG', color: '#0d6efd' },
        INFO: { value: 2, label: 'INFO', color: '#20c997' },
        WARN: { value: 3, label: 'WARN', color: '#fd7e14' },
        ERROR: { value: 4, label: 'ERROR', color: '#dc3545' }
    };

    constructor(environment, options = {}) {
        this.environment = environment;
        this.options = {
            enableSourceTracking: true,
            logLevel: 'DEBUG',
            showTimestamp: true,
            maxStackDepth: 3,
            persistLogs: true,
            logStorage: [],
            maxStoredLogs: 1000,
            ...options
        };

        
        this.originalConsole = {
            log: console.log,
            info: console.info,
            warn: console.warn,
            debug: console.debug,
            error: console.error,
            trace: console.trace,
            group: console.group,
            groupCollapsed: console.groupCollapsed,
            groupEnd: console.groupEnd
        };
        
        
        this.hooks = [];

        
        this.stats = {
            debug: 0,
            log: 0,
            info: 0,
            warn: 0,
            error: 0,
            total: 0
        };

        this.init();
    }
    
    

    init() {
        console.log = this.createConsoleMethod('log', ConsoleController.LOG_LEVELS.LOG);
        console.info = this.createConsoleMethod('info', ConsoleController.LOG_LEVELS.INFO);
        console.warn = this.createConsoleMethod('warn', ConsoleController.LOG_LEVELS.WARN);
        console.debug = this.createConsoleMethod('debug', ConsoleController.LOG_LEVELS.DEBUG);
        console.error = this.createConsoleMethod('error', ConsoleController.LOG_LEVELS.ERROR);
        
        
        this.originalConsole.group = console.group;
        this.originalConsole.groupCollapsed = console.groupCollapsed;
        this.originalConsole.groupEnd = console.groupEnd;
        
        console.group = this.createGroupMethod('group');
        console.groupCollapsed = this.createGroupMethod('groupCollapsed');
        console.groupEnd = (...args) => {
            this.originalConsole.groupEnd(...args);
        };
        
        
        console.logWithSource = this.logWithSource.bind(this);
        console.getStats = this.getStatistics.bind(this);
        console.clearLogs = this.clearLogs.bind(this);
        
        
        console.exportLogs = this.exportLogs.bind(this);
        console.saveLogs = this.saveLogsToFile.bind(this);
        console.copyLogs = this.copyLogsToClipboard.bind(this);
        console.setLogLevel = this.setLogLevel.bind(this);
    }
    
    

    createConsoleMethod(methodName, level) {
        return (...args) => {
            
            if (this.environment.get('dev_mode') !== 'true' || 
                level.value < ConsoleController.LOG_LEVELS[this.options.logLevel].value) {
                return;
            }

            
            const sourceInfo = this.options.enableSourceTracking ? 
                this.getSourceInfo() : null;

            
            this.stats[methodName]++;
            this.stats.total++;
            
            
            const timestamp = this.options.showTimestamp ? 
                `[${new Date().toISOString()}]` : '';
            
            
            const logEntry = {
                level: level.label,
                timestamp: new Date(),
                source: sourceInfo,
                args: [...args],
            };

            
            this.hooks.forEach(hook => hook(logEntry));

            
            if (this.options.persistLogs) {
                this.storeLog(logEntry);
            }

            
            const styles = [];
            const formattedParts = [];

            
            if (this.options.showTimestamp) {
                formattedParts.push(`%c${timestamp}`);
                styles.push('color: gray; font-style: italic;');
            }
            
            
            formattedParts.push(`%c[${level.label}]`);
            styles.push(`color: ${level.color}; font-weight: bold;`);
            
            
            if (sourceInfo) {
                formattedParts.push(`%c[${sourceInfo.file}:${sourceInfo.line}]`);
                styles.push('color: #6610f2; font-weight: normal;');
            }

            
            let formattedArgs = [...args];
            const firstArg = args[0];
            
            
            if (typeof firstArg === 'string' && firstArg.includes('%c')) {
                
                formattedParts.push('%c'); 
                styles.push('color: inherit;'); 
            } else {
                
                formattedParts.push('%c');
                styles.push('color: inherit; font-weight: normal;');
            }
            
            
            this.originalConsole[methodName](
                `${formattedParts.join(' ')} ${typeof firstArg === 'string' ? firstArg : ''}`,
                ...styles,
                ...(typeof firstArg === 'string' ? args.slice(1) : args)
            );
        };
    }

    

    getSourceInfo() {
        const stack = new Error().stack.split('\n');
        
        
        let callerLine = '';
        for (let i = 0; i < Math.min(stack.length, this.options.maxStackDepth + 3); i++) {
            if (i < 3) continue; 
            
            callerLine = stack[i].trim();
            if (!callerLine.includes('ConsoleController.js')) {
                break;
            }
        }

        if (!callerLine) return { file: 'unknown', line: 0, function: 'unknown' };
        
        
        const locationMatch = callerLine.match(/at\s+(?:(.+?)\s+\()?(?:(.+)):(\d+):(\d+)/);
        if (!locationMatch) return { file: 'unknown', line: 0, function: 'unknown' };
        
        const [, fnName, filePath, line] = locationMatch;
        const file = filePath ? filePath.split('/').pop() : 'unknown';
        
        return {
            file,
            line: Number(line),
            function: fnName || 'anonymous'
        };
    }

    

    logWithSource(...args) {
        const sourceInfo = this.getSourceInfo();
        const firstArg = args[0];
        const styles = [
            'color: #0dcaf0; font-weight: bold;', 
            'color: #6610f2; font-weight: normal;', 
            'color: #d63384; font-style: italic;' 
        ];
        
        if (typeof firstArg === 'string') {
            this.originalConsole.log(
                `%c[SOURCE] %c[${sourceInfo.file}:${sourceInfo.line}] %c${sourceInfo.function}() %c${firstArg}`,
                ...styles,
                'color: inherit; font-weight: normal;',
                ...args.slice(1)
            );
        } else {
            this.originalConsole.log(
                `%c[SOURCE] %c[${sourceInfo.file}:${sourceInfo.line}] %c${sourceInfo.function}()`,
                ...styles,
                ...args
            );
        }
    }

    

    storeLog(logEntry) {
        this.options.logStorage.push(logEntry);
        if (this.options.logStorage.length > this.options.maxStoredLogs) {
            this.options.logStorage.shift();
        }
    }

    

    clearLogs() {
        this.options.logStorage = [];
    }

    

    getStatistics() {
        return { ...this.stats };
    }

    

    addHook(hookFn) {
        if (typeof hookFn === 'function') {
            this.hooks.push(hookFn);
        }
    }

    

    removeHook(hookFn) {
        const index = this.hooks.indexOf(hookFn);
        if (index !== -1) {
            this.hooks.splice(index, 1);
        }
    }
    
    

    setLogLevel(level) {
        if (ConsoleController.LOG_LEVELS[level]) {
            this.options.logLevel = level;
        }
    }

    

    getLogs(filters = {}) {
        if (!this.options.persistLogs) {
            return [];
        }
        
        let logs = [...this.options.logStorage];
        
        
        if (filters.level) {
            logs = logs.filter(log => log.level === filters.level);
        }
        
        if (filters.source) {
            logs = logs.filter(log => 
                log.source && log.source.file && 
                log.source.file.includes(filters.source)
            );
        }
        
        if (filters.timeRange) {
            const { start, end } = filters.timeRange;
            if (start) {
                logs = logs.filter(log => new Date(log.timestamp) >= new Date(start));
            }
            if (end) {
                logs = logs.filter(log => new Date(log.timestamp) <= new Date(end));
            }
        }
        
        return logs;
    }
    
    

    exportLogs(format = 'json', filters = {}) {
        const logs = this.getLogs(filters);
        
        if (logs.length === 0) {
            return '';
        }
        
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(logs, null, 2);
                
            case 'text':
                return logs.map(log => {
                    const timestamp = new Date(log.timestamp).toISOString();
                    const source = log.source ? `[${log.source.file}:${log.source.line}]` : '';
                    const args = log.args.map(arg => 
                        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
                    ).join(' ');
                    
                    return `[${timestamp}] [${log.level}] ${source} ${args}`;
                }).join('\n');
                
            case 'csv':
                const header = 'Timestamp,Level,File,Line,Function,Message\n';
                const rows = logs.map(log => {
                    const timestamp = new Date(log.timestamp).toISOString();
                    const file = log.source ? log.source.file : '';
                    const line = log.source ? log.source.line : '';
                    const func = log.source ? log.source.function : '';
                    const message = log.args.map(arg => 
                        typeof arg === 'string' ? `"${arg.replace(/"/g, '""')}"` : String(arg)
                    ).join(' ');
                    
                    return `${timestamp},${log.level},${file},${line},${func},${message}`;
                }).join('\n');
                
                return header + rows;
                
            case 'html':
                const styles = `
                <style>
                    .log-table { border-collapse: collapse; width: 100%; font-family: sans-serif; }
                    .log-table th, .log-table td { padding: 8px; text-align: left; border: 1px solid #ddd; }
                    .log-table tr:nth-child(even) { background-color: #f2f2f2; }
                    .log-table th { background-color: #4CAF50; color: white; }
                    .level-DEBUG { color: #6c757d; }
                    .level-LOG { color: #0d6efd; }
                    .level-INFO { color: #20c997; }
                    .level-WARN { color: #fd7e14; font-weight: bold; }
                    .level-ERROR { color: #dc3545; font-weight: bold; }
                </style>`;
                
                const table = `
                <table class="log-table">
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>Level</th>
                            <th>Source</th>
                            <th>Message</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map(log => {
                            const timestamp = new Date(log.timestamp).toISOString();
                            const source = log.source ? 
                                `${log.source.file}:${log.source.line} (${log.source.function})` : '';
                            const message = log.args.map(arg => 
                                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
                            ).join(' ');
                            
                            return `
                            <tr>
                                <td>${timestamp}</td>
                                <td class="level-${log.level}">${log.level}</td>
                                <td>${source}</td>
                                <td>${message}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>`;
                
                return `<!DOCTYPE html><html><head>${styles}</head><body>${table}</body></html>`;
                
            default:
                return JSON.stringify(logs);
        }
    }
    
    

    saveLogsToFile(format = 'json', filters = {}, filename = '') {
        
        if (typeof window === 'undefined' || !window.document || !window.Blob || !window.URL) {
            this.originalConsole.error('saveLogsToFile is only available in browser environments');
            return;
        }
        
        const content = this.exportLogs(format, filters);
        if (!content) {
            this.originalConsole.warn('No logs to export');
            return;
        }
        
        
        let mimeType, ext;
        switch (format.toLowerCase()) {
            case 'json':
                mimeType = 'application/json';
                ext = 'json';
                break;
            case 'text':
                mimeType = 'text/plain';
                ext = 'txt';
                break;
            case 'csv':
                mimeType = 'text/csv';
                ext = 'csv';
                break;
            case 'html':
                mimeType = 'text/html';
                ext = 'html';
                break;
            default:
                mimeType = 'text/plain';
                ext = 'txt';
        }
        
        
        if (!filename) {
            const date = new Date().toISOString().replace(/:/g, '-').split('.')[0];
            filename = `simply-mail-logs_${date}.${ext}`;
        }
        
        
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        
        
        document.body.appendChild(a);
        a.click();
        
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
    
    

    copyLogsToClipboard(format = 'text', filters = {}) {
        
        if (typeof navigator === 'undefined' || !navigator.clipboard) {
            this.originalConsole.error('copyLogsToClipboard is only available in modern browsers');
            return false;
        }
        
        
        if (!['text', 'json'].includes(format.toLowerCase())) {
            format = 'text';
        }
        
        const content = this.exportLogs(format, filters);
        if (!content) {
            this.originalConsole.warn('No logs to copy');
            return false;
        }
        
        
        try {
            navigator.clipboard.writeText(content);
            return true;
        } catch (err) {
            this.originalConsole.error('Failed to copy logs to clipboard:', err);
            return false;
        }
    }
    
    

    restore() {
        Object.keys(this.originalConsole).forEach(method => {
            console[method] = this.originalConsole[method];
        });
        
        
        delete console.logWithSource;
        delete console.getStats;
        delete console.clearLogs;
        delete console.exportLogs;
        delete console.saveLogs;
        delete console.copyLogs;
        delete console.setLogLevel;
    }

    

    createGroupMethod(methodName) {
        return (...args) => {
            if (this.environment.get('dev_mode') !== 'true') {
                return;
            }
            
            
            const sourceInfo = this.options.enableSourceTracking ?
                this.getSourceInfo() : null;
                
            
            if (args.length > 0 && typeof args[0] === 'string' && sourceInfo) {
                const groupLabel = `${args[0]} [${sourceInfo.file}:${sourceInfo.line}]`;
                this.originalConsole[methodName](groupLabel, ...args.slice(1));
            } else {
                this.originalConsole[methodName](...args);
            }
        };
    }
}

