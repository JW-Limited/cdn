// VS Code-inspired Demo page functionality
window.addEventListener('velocity:route:change', (context) => {
    console.log(context);
    if(!context.detail.path.includes('/demo')) return;

    initVSCodeInterface();
});

function initVSCodeInterface() {
    const codeEditor = document.getElementById('code-editor');
    const previewFrame = document.getElementById('preview-frame');
    const runButton = document.getElementById('run-code');
    const copyButton = document.getElementById('copy-code');
    const refreshButton = document.getElementById('refresh-preview');
    const formatButton = document.getElementById('format-code');
    const activeTabName = document.getElementById('active-tab-name');
    const breadcrumbFile = document.getElementById('breadcrumb-file');
    const cursorPosition = document.getElementById('cursor-position');
    const executionTime = document.getElementById('execution-time');
    const execTime = document.getElementById('exec-time');
    const lineNumbersContent = document.getElementById('line-numbers-content');
    if (!codeEditor) return; // Exit if not on demo page
    
    // Code examples
    const examples = {
        'hello-world': `
const container = document.getElementById('preview-container');
container.innerHTML = \`
    <div class="text-center py-20">
        <h1 class="text-4xl font-bold velocity-text-primary mb-4">
            Hello VelocityJS! 👋
        </h1>
        <p class="velocity-text-secondary">
            Your first VelocityJS application is running on \${app.version}!
        </p>
    </div>
\`;`,

        'component': `// Component Example
app.component('UserCard', {
    template: (props) => \`
        <div class="velocity-card p-6 max-w-sm mx-auto">
            <div class="flex items-center gap-4">
                <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl">
                    \${props.name[0]}
                </div>
                <div>
                    <h3 class="text-xl font-bold velocity-text-primary">\${props.name}</h3>
                    <p class="velocity-text-secondary">\${props.role}</p>
                    <p class="text-sm velocity-text-secondary">\${props.email}</p>
                </div>
            </div>
        </div>
    \`
});

// Render the component
const container = document.getElementById('preview-container');
container.innerHTML = app.renderComponent('UserCard', {
    name: 'Alex Smith',
    role: 'Frontend Developer',
    email: 'alex@example.com'
});`,

        'theme-toggle': `// Theme Toggle Example
const container = document.getElementById('preview-container');
container.innerHTML = \`
    <div class="text-center py-20">
        <h2 class="text-2xl font-bold velocity-text-primary mb-6">Theme Demo</h2>
        <div class="space-y-4">
            <button id="light-btn" class="velocity-btn velocity-btn-primary mx-2">☀️ Light</button>
            <button id="dark-btn" class="velocity-btn velocity-btn-secondary mx-2">🌙 Dark</button>
            <button id="auto-btn" class="velocity-btn velocity-btn-outline mx-2">🔄 Auto</button>
        </div>
        <div class="mt-8 velocity-card p-6 max-w-md mx-auto">
            <h3 class="text-lg font-bold velocity-text-primary mb-2">Sample Card</h3>
            <p class="velocity-text-secondary">This card changes with the theme!</p>
        </div>
    </div>
\`;

// Add event listeners
document.getElementById('light-btn').onclick = () => app.setTheme('light');
document.getElementById('dark-btn').onclick = () => app.setTheme('dark');
document.getElementById('auto-btn').onclick = () => app.setTheme('auto');`,

        'counter': `// Counter App Example
let count = 0;

function updateDisplay() {
    document.getElementById('count-display').textContent = count;
}

const container = document.getElementById('preview-container');
container.innerHTML = \`
    <div class="text-center py-20">
        <h2 class="text-2xl font-bold velocity-text-primary mb-6">Counter App</h2>
        <div class="velocity-card p-8 max-w-md mx-auto">
            <div id="count-display" class="text-6xl font-bold gradient-text mb-6">0</div>
            <div class="flex gap-4 justify-center">
                <button id="decrement" class="velocity-btn velocity-btn-secondary">➖ -1</button>
                <button id="reset" class="velocity-btn velocity-btn-outline">🔄 Reset</button>
                <button id="increment" class="velocity-btn velocity-btn-primary">➕ +1</button>
            </div>
            <p class="mt-4 velocity-text-secondary">Click buttons to change the count!</p>
        </div>
    </div>
\`;

// Event listeners
document.getElementById('increment').onclick = () => { count++; updateDisplay(); };
document.getElementById('decrement').onclick = () => { count--; updateDisplay(); };
document.getElementById('reset').onclick = () => { count = 0; updateDisplay(); };`,

        'todo-app': `// Advanced Todo App with State Management
const store = app.createStore({
    todos: [],
    filter: 'all',
    nextId: 1
});

store.mutations.set('ADD_TODO', (state, text) => {
    state.todos.push({
        id: state.nextId++,
        text: text,
        completed: false,
        createdAt: new Date().toLocaleString()
    });
});

store.mutations.set('TOGGLE_TODO', (state, id) => {
    const todo = state.todos.find(t => t.id === id);
    if (todo) todo.completed = !todo.completed;
});

store.mutations.set('DELETE_TODO', (state, id) => {
    state.todos = state.todos.filter(t => t.id !== id);
});

store.mutations.set('SET_FILTER', (state, filter) => {
    state.filter = filter;
});

function renderTodos() {
    const todos = store.state.todos;
    const filter = store.state.filter;
    
    const filteredTodos = todos.filter(todo => {
        if (filter === 'active') return !todo.completed;
        if (filter === 'completed') return todo.completed;
        return true;
    });

    return filteredTodos.map(todo => \`
        <div class="flex items-center gap-3 p-3 velocity-bg-secondary rounded-lg \${todo.completed ? 'opacity-60' : ''}">
            <input type="checkbox" \${todo.completed ? 'checked' : ''} 
                   onchange="toggleTodo(\${todo.id})" 
                   class="w-4 h-4 text-blue-600 rounded">
            <div class="flex-1">
                <span class="\${todo.completed ? 'line-through' : ''} velocity-text-primary">
                    \${todo.text}
                </span>
                <div class="text-xs velocity-text-secondary">\${todo.createdAt}</div>
            </div>
            <button onclick="deleteTodo(\${todo.id})" 
                    class="text-red-500 hover:text-red-700 p-1">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
            </button>
        </div>
    \`).join('');
}

function render() {
    const stats = store.state.todos;
    const completed = stats.filter(t => t.completed).length;
    const total = stats.length;
    const active = total - completed;

    document.getElementById('todo-list').innerHTML = renderTodos();
    document.getElementById('stats').innerHTML = \`
        <span>Total: \${total}</span>
        <span>Active: \${active}</span>
        <span>Completed: \${completed}</span>
    \`;
}

function addTodo() {
    const input = document.getElementById('todo-input');
    const text = input.value.trim();
    if (text) {
        store.commit('ADD_TODO', text);
        input.value = '';
        render();
    }
}

function toggleTodo(id) {
    store.commit('TOGGLE_TODO', id);
    render();
}

function deleteTodo(id) {
    store.commit('DELETE_TODO', id);
    render();
}

function setFilter(filter) {
    store.commit('SET_FILTER', filter);
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('velocity-btn-primary', btn.dataset.filter === filter);
        btn.classList.toggle('velocity-btn-outline', btn.dataset.filter !== filter);
    });
    render();
}

const container = document.getElementById('preview-container');
container.innerHTML = \`
    <div class="max-w-2xl mx-auto p-6">
        <h2 class="text-3xl font-bold velocity-text-primary mb-6 text-center">📝 Advanced Todo App</h2>
        
        <!-- Add Todo Form -->
        <div class="velocity-card p-6 mb-6">
            <div class="flex gap-3">
                <input type="text" id="todo-input" placeholder="Add a new todo..." 
                       class="flex-1 p-3 rounded border velocity-border-color velocity-bg-primary velocity-text-primary"
                       onkeypress="if(event.key==='Enter') addTodo()">
                <button onclick="addTodo()" class="velocity-btn velocity-btn-primary px-6">Add</button>
            </div>
        </div>

        <!-- Filters -->
        <div class="flex justify-center gap-2 mb-6">
            <button class="filter-btn velocity-btn velocity-btn-primary" data-filter="all" onclick="setFilter('all')">All</button>
            <button class="filter-btn velocity-btn velocity-btn-outline" data-filter="active" onclick="setFilter('active')">Active</button>
            <button class="filter-btn velocity-btn velocity-btn-outline" data-filter="completed" onclick="setFilter('completed')">Completed</button>
        </div>

        <!-- Todo List -->
        <div class="velocity-card p-6 mb-6">
            <div id="todo-list" class="space-y-3 min-h-[200px]">
                <div class="text-center velocity-text-secondary py-8">No todos yet. Add one above!</div>
            </div>
        </div>

        <!-- Stats -->
        <div id="stats" class="flex justify-center gap-6 text-sm velocity-text-secondary"></div>
    </div>
\`;

// Initialize with sample data
setTimeout(() => {
    store.commit('ADD_TODO', 'Learn VelocityJS framework');
    store.commit('ADD_TODO', 'Build an awesome app');
    store.commit('ADD_TODO', 'Share with the community');
    render();
}, 100);`,

        'api-dashboard': `// API Dashboard with Real-time Data
let updateInterval;
let isConnected = false;

// Mock API endpoints
const mockAPI = {
    users: () => Promise.resolve({
        total: Math.floor(Math.random() * 10000) + 5000,
        online: Math.floor(Math.random() * 1000) + 500,
        growth: (Math.random() * 20 - 10).toFixed(1)
    }),
    
    performance: () => Promise.resolve({
        cpu: Math.floor(Math.random() * 100),
        memory: Math.floor(Math.random() * 100),
        latency: Math.floor(Math.random() * 200) + 10,
        uptime: '99.9%'
    }),

    analytics: () => Promise.resolve({
        pageViews: Math.floor(Math.random() * 50000) + 10000,
        bounceRate: (Math.random() * 30 + 20).toFixed(1),
        avgSession: Math.floor(Math.random() * 300) + 120,
        conversion: (Math.random() * 5 + 2).toFixed(2)
    })
};

async function fetchDashboardData() {
    try {
        const [users, performance, analytics] = await Promise.all([
            mockAPI.users(),
            mockAPI.performance(),
            mockAPI.analytics()
        ]);

        updateUserStats(users);
        updatePerformanceMetrics(performance);
        updateAnalytics(analytics);
        setConnectionStatus(true);
    } catch (error) {
        console.error('Failed to fetch data:', error);
        setConnectionStatus(false);
    }
}

function updateUserStats(data) {
    document.getElementById('total-users').textContent = data.total.toLocaleString();
    document.getElementById('online-users').textContent = data.online.toLocaleString();
    const growthEl = document.getElementById('user-growth');
    growthEl.textContent = \`\${data.growth}%\`;
    growthEl.className = \`text-sm \${data.growth > 0 ? 'text-green-500' : 'text-red-500'}\`;
}

function updatePerformanceMetrics(data) {
    document.getElementById('cpu-usage').textContent = \`\${data.cpu}%\`;
    document.getElementById('memory-usage').textContent = \`\${data.memory}%\`;
    document.getElementById('latency').textContent = \`\${data.latency}ms\`;
    document.getElementById('uptime').textContent = data.uptime;
    
    // Update progress bars
    document.getElementById('cpu-bar').style.width = \`\${data.cpu}%\`;
    document.getElementById('memory-bar').style.width = \`\${data.memory}%\`;
    
    // Color based on usage
    const cpuColor = data.cpu > 80 ? 'bg-red-500' : data.cpu > 60 ? 'bg-yellow-500' : 'bg-green-500';
    const memColor = data.memory > 80 ? 'bg-red-500' : data.memory > 60 ? 'bg-yellow-500' : 'bg-green-500';
    
    document.getElementById('cpu-bar').className = \`h-2 rounded transition-all duration-500 \${cpuColor}\`;
    document.getElementById('memory-bar').className = \`h-2 rounded transition-all duration-500 \${memColor}\`;
}

function updateAnalytics(data) {
    document.getElementById('page-views').textContent = data.pageViews.toLocaleString();
    document.getElementById('bounce-rate').textContent = \`\${data.bounceRate}%\`;
    document.getElementById('avg-session').textContent = \`\${Math.floor(data.avgSession / 60)}m \${data.avgSession % 60}s\`;
    document.getElementById('conversion').textContent = \`\${data.conversion}%\`;
}

function setConnectionStatus(connected) {
    isConnected = connected;
    const statusEl = document.getElementById('connection-status');
    const indicatorEl = document.getElementById('status-indicator');
    
    if (connected) {
        statusEl.textContent = 'Connected';
        statusEl.className = 'text-green-500 text-sm';
        indicatorEl.className = 'w-2 h-2 bg-green-500 rounded-full animate-pulse';
    } else {
        statusEl.textContent = 'Disconnected';
        statusEl.className = 'text-red-500 text-sm';
        indicatorEl.className = 'w-2 h-2 bg-red-500 rounded-full';
    }
}

function startRealTimeUpdates() {
    fetchDashboardData(); // Initial load
    updateInterval = setInterval(fetchDashboardData, 3000); // Update every 3 seconds
}

function stopRealTimeUpdates() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

const container = document.getElementById('preview-container');
container.innerHTML = \`
    <div class="p-6 max-w-6xl mx-auto">
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-3xl font-bold velocity-text-primary">📊 Real-time Dashboard</h2>
            <div class="flex items-center gap-2">
                <div id="status-indicator" class="w-2 h-2 bg-gray-500 rounded-full"></div>
                <span id="connection-status" class="text-gray-500 text-sm">Connecting...</span>
            </div>
        </div>

        <!-- User Statistics -->
        <div class="grid md:grid-cols-3 gap-6 mb-6">
            <div class="velocity-card p-6">
                <h3 class="text-lg font-semibold velocity-text-primary mb-2">👥 Users</h3>
                <div class="text-3xl font-bold velocity-text-primary" id="total-users">-</div>
                <div class="text-sm velocity-text-secondary">Total Users</div>
                <div id="user-growth" class="text-sm">-</div>
            </div>
            <div class="velocity-card p-6">
                <h3 class="text-lg font-semibold velocity-text-primary mb-2">🟢 Online</h3>
                <div class="text-3xl font-bold text-green-500" id="online-users">-</div>
                <div class="text-sm velocity-text-secondary">Active Now</div>
            </div>
            <div class="velocity-card p-6">
                <h3 class="text-lg font-semibold velocity-text-primary mb-2">📈 Analytics</h3>
                <div class="text-3xl font-bold velocity-text-primary" id="page-views">-</div>
                <div class="text-sm velocity-text-secondary">Page Views Today</div>
            </div>
        </div>

        <!-- Performance Metrics -->
        <div class="velocity-card p-6 mb-6">
            <h3 class="text-xl font-semibold velocity-text-primary mb-4">⚡ System Performance</h3>
            <div class="grid md:grid-cols-2 gap-6">
                <div>
                    <div class="flex justify-between mb-2">
                        <span class="velocity-text-primary">CPU Usage</span>
                        <span id="cpu-usage" class="velocity-text-primary font-bold">-</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div id="cpu-bar" class="h-2 bg-blue-500 rounded transition-all duration-500" style="width: 0%"></div>
                    </div>
                </div>
                <div>
                    <div class="flex justify-between mb-2">
                        <span class="velocity-text-primary">Memory Usage</span>
                        <span id="memory-usage" class="velocity-text-primary font-bold">-</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div id="memory-bar" class="h-2 bg-blue-500 rounded transition-all duration-500" style="width: 0%"></div>
                    </div>
                </div>
            </div>
            <div class="grid md:grid-cols-2 gap-6 mt-4">
                <div class="text-center">
                    <div class="text-2xl font-bold velocity-text-primary" id="latency">-</div>
                    <div class="text-sm velocity-text-secondary">Average Latency</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-green-500" id="uptime">-</div>
                    <div class="text-sm velocity-text-secondary">Uptime</div>
                </div>
            </div>
        </div>

        <!-- Additional Metrics -->
        <div class="grid md:grid-cols-3 gap-6">
            <div class="velocity-card p-6 text-center">
                <div class="text-2xl font-bold velocity-text-primary" id="bounce-rate">-</div>
                <div class="text-sm velocity-text-secondary">Bounce Rate</div>
            </div>
            <div class="velocity-card p-6 text-center">
                <div class="text-2xl font-bold velocity-text-primary" id="avg-session">-</div>
                <div class="text-sm velocity-text-secondary">Avg Session Duration</div>
            </div>
            <div class="velocity-card p-6 text-center">
                <div class="text-2xl font-bold text-green-500" id="conversion">-</div>
                <div class="text-sm velocity-text-secondary">Conversion Rate</div>
            </div>
        </div>

        <div class="mt-6 text-center">
            <button onclick="startRealTimeUpdates()" class="velocity-btn velocity-btn-primary mr-2">Start Live Updates</button>
            <button onclick="stopRealTimeUpdates()" class="velocity-btn velocity-btn-secondary">Stop Updates</button>
        </div>
    </div>
\`;

// Auto-start updates
setTimeout(startRealTimeUpdates, 500);`,

        'chat-app': `// Real-time Chat Application
let messages = [];
let currentUser = 'User' + Math.floor(Math.random() * 1000);

// Mock chat bot responses
const botResponses = [
    "That's interesting! Tell me more.",
    "I see what you mean.",
    "Thanks for sharing that with me!",
    "How does that make you feel?",
    "That's a great point!",
    "I hadn't thought of it that way.",
    "Can you elaborate on that?",
    "That sounds exciting!",
    "I'm here to help if you need anything.",
    "What would you like to talk about next?"
];

function addMessage(text, sender = currentUser, isBot = false) {
    const timestamp = new Date().toLocaleTimeString();
    const message = {
        id: Date.now(),
        text,
        sender,
        timestamp,
        isBot
    };
    
    messages.push(message);
    renderMessages();
    
    // Auto-scroll to bottom
    setTimeout(() => {
        const chatContainer = document.getElementById('chat-messages');
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
    
    // Simulate bot response
    if (!isBot && Math.random() > 0.3) {
        setTimeout(() => {
            const response = botResponses[Math.floor(Math.random() * botResponses.length)];
            addMessage(response, 'VelocityBot', true);
        }, 1000 + Math.random() * 2000);
    }
}

function renderMessages() {
    const container = document.getElementById('chat-messages');
    container.innerHTML = messages.map(msg => \`
        <div class="flex \${msg.sender === currentUser ? 'justify-end' : 'justify-start'} mb-4">
            <div class="max-w-xs lg:max-w-md">
                \${msg.sender !== currentUser ? \`
                    <div class="flex items-center gap-2 mb-1">
                        <div class="w-6 h-6 rounded-full \${msg.isBot ? 'bg-purple-500' : 'bg-blue-500'} flex items-center justify-center text-white text-xs">
                            \${msg.isBot ? '🤖' : msg.sender[0]}
                        </div>
                        <span class="text-xs velocity-text-secondary">\${msg.sender}</span>
                    </div>
                \` : ''}
                <div class="p-3 rounded-lg \${msg.sender === currentUser 
                    ? 'bg-blue-500 text-white' 
                    : msg.isBot 
                        ? 'bg-purple-100 velocity-text-primary' 
                        : 'velocity-bg-secondary velocity-text-primary'
                }">
                    <p class="text-sm">\${msg.text}</p>
                    <p class="text-xs mt-1 opacity-70">\${msg.timestamp}</p>
                </div>
            </div>
        </div>
    \`).join('');
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    
    if (text) {
        addMessage(text);
        input.value = '';
        
        // Show typing indicator
        const typingEl = document.getElementById('typing-indicator');
        typingEl.classList.remove('hidden');
        setTimeout(() => {
            typingEl.classList.add('hidden');
        }, 2000);
    }
}

function simulateOnlineUsers() {
    const users = [
        'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'
    ];
    const onlineUsers = users.slice(0, Math.floor(Math.random() * users.length) + 2);
    
    document.getElementById('online-users').innerHTML = onlineUsers.map(user => \`
        <div class="flex items-center gap-2 p-2 hover:velocity-bg-secondary rounded">
            <div class="w-2 h-2 bg-green-500 rounded-full"></div>
            <span class="text-sm velocity-text-primary">\${user}</span>
        </div>
    \`).join('');
    
    document.getElementById('online-count').textContent = onlineUsers.length;
}

const container = document.getElementById('preview-container');
container.innerHTML = \`
    <div class="max-w-4xl mx-auto p-4 h-full">
        <div class="velocity-card h-[600px] flex">
            <!-- Sidebar -->
            <div class="w-64 border-r velocity-border-color p-4">
                <h3 class="font-semibold velocity-text-primary mb-4">💬 VelocityChat</h3>
                
                <div class="mb-6">
                    <div class="flex items-center gap-2 mb-2">
                        <div class="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span class="text-sm velocity-text-primary">Online (<span id="online-count">0</span>)</span>
                    </div>
                    <div id="online-users" class="space-y-1"></div>
                </div>
                
                <div class="velocity-bg-secondary p-3 rounded">
                    <div class="text-xs velocity-text-secondary mb-1">You are:</div>
                    <div class="font-medium velocity-text-primary">\${currentUser}</div>
                </div>
            </div>
            
            <!-- Chat Area -->
            <div class="flex-1 flex flex-col">
                <!-- Chat Header -->
                <div class="p-4 border-b velocity-border-color">
                    <h4 class="font-semibold velocity-text-primary">#general</h4>
                    <p class="text-sm velocity-text-secondary">Welcome to the VelocityJS chat demo!</p>
                </div>
                
                <!-- Messages -->
                <div id="chat-messages" class="flex-1 p-4 overflow-y-auto velocity-bg-primary">
                    <div class="text-center velocity-text-secondary text-sm py-8">
                        Welcome to the chat! Start a conversation below.
                    </div>
                </div>
                
                <!-- Typing Indicator -->
                <div id="typing-indicator" class="hidden px-4 py-2 text-sm velocity-text-secondary">
                    VelocityBot is typing...
                </div>
                
                <!-- Message Input -->
                <div class="p-4 border-t velocity-border-color">
                    <div class="flex gap-2">
                        <input 
                            type="text" 
                            id="message-input" 
                            placeholder="Type a message..." 
                            class="flex-1 p-3 rounded border velocity-border-color velocity-bg-primary velocity-text-primary"
                            onkeypress="if(event.key==='Enter') sendMessage()"
                        >
                        <button onclick="sendMessage()" class="velocity-btn velocity-btn-primary px-6">
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
\`;

// Initialize
setTimeout(() => {
    simulateOnlineUsers();
    addMessage("Welcome to VelocityChat! I'm your friendly bot assistant.", "VelocityBot", true);
    
    // Periodic online users update
    setInterval(simulateOnlineUsers, 10000);
}, 500);`,

        'data-viz': `// Interactive Data Visualization
let chartData = [];
let currentChart = 'line';

// Generate sample data
function generateData(type = 'sales') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    if (type === 'sales') {
        return months.map(month => ({
            label: month,
            value: Math.floor(Math.random() * 100000) + 20000,
            growth: (Math.random() * 40 - 20).toFixed(1)
        }));
    } else if (type === 'traffic') {
        return months.map(month => ({
            label: month,
            value: Math.floor(Math.random() * 50000) + 10000,
            growth: (Math.random() * 30 - 15).toFixed(1)
        }));
    }
}

function renderBarChart(data) {
    const maxValue = Math.max(...data.map(d => d.value));
    
    return \`
        <div class="space-y-4">
            <h4 class="text-lg font-semibold velocity-text-primary text-center">📊 Monthly Performance</h4>
            <div class="flex items-end justify-between h-64 velocity-bg-secondary p-4 rounded">
                \${data.map(item => {
                    const height = (item.value / maxValue) * 200;
                    const isPositive = parseFloat(item.growth) > 0;
                    return \`
                        <div class="flex flex-col items-center group cursor-pointer" title="\${item.label}: \${item.value.toLocaleString()}">
                            <div class="text-xs velocity-text-secondary mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                \${item.value.toLocaleString()}
                            </div>
                            <div class="w-8 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all duration-500 hover:from-blue-500 hover:to-blue-300" 
                                 style="height: \${height}px; min-height: 10px;"></div>
                            <div class="text-xs velocity-text-primary mt-2 font-medium">\${item.label}</div>
                            <div class="text-xs \${isPositive ? 'text-green-500' : 'text-red-500'}">\${item.growth}%</div>
                        </div>
                    \`;
                }).join('')}
            </div>
        </div>
    \`;
}

function renderLineChart(data) {
    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue;
    
    // Create SVG path
    const points = data.map((item, index) => {
        const x = (index / (data.length - 1)) * 280 + 20;
        const y = 220 - ((item.value - minValue) / range) * 180;
        return \`\${x},\${y}\`;
    }).join(' ');
    
    return \`
        <div class="space-y-4">
            <h4 class="text-lg font-semibold velocity-text-primary text-center">📈 Trend Analysis</h4>
            <div class="velocity-bg-secondary p-4 rounded">
                <svg width="320" height="240" class="w-full">
                    <!-- Grid lines -->
                    <defs>
                        <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#374151" stroke-width="0.5" opacity="0.5"/>
                        </pattern>
                    </defs>
                    <rect width="320" height="240" fill="url(#grid)" />
                    
                    <!-- Line -->
                    <polyline fill="none" stroke="url(#gradient)" stroke-width="3" points="\${points}" />
                    
                    <!-- Points -->
                    \${data.map((item, index) => {
                        const x = (index / (data.length - 1)) * 280 + 20;
                        const y = 220 - ((item.value - minValue) / range) * 180;
                        return \`
                            <circle cx="\${x}" cy="\${y}" r="4" fill="#3b82f6" stroke="white" stroke-width="2" class="hover:r-6 transition-all">
                                <title>\${item.label}: \${item.value.toLocaleString()}</title>
                            </circle>
                        \`;
                    }).join('')}
                    
                    <!-- Gradient -->
                    <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
                        </linearGradient>
                    </defs>
                </svg>
                
                <!-- Legend -->
                <div class="flex justify-between mt-4 text-xs velocity-text-secondary">
                    \${data.map(item => \`<span>\${item.label}</span>\`).join('')}
                </div>
            </div>
        </div>
    \`;
}

function renderPieChart(data) {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = 0;
    
    const slices = data.slice(0, 6).map((item, index) => {
        const percentage = (item.value / total) * 100;
        const sliceAngle = (item.value / total) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + sliceAngle;
        
        const x1 = 150 + 80 * Math.cos((startAngle * Math.PI) / 180);
        const y1 = 120 + 80 * Math.sin((startAngle * Math.PI) / 180);
        const x2 = 150 + 80 * Math.cos((endAngle * Math.PI) / 180);
        const y2 = 120 + 80 * Math.sin((endAngle * Math.PI) / 180);
        
        const largeArc = sliceAngle > 180 ? 1 : 0;
        const pathData = \`M 150 120 L \${x1} \${y1} A 80 80 0 \${largeArc} 1 \${x2} \${y2} Z\`;
        
        const colors = ['#3b82f6', '#8b5cf6', '#ef4444', '#10b981', '#f59e0b', '#ec4899'];
        
        currentAngle += sliceAngle;
        
        return { pathData, color: colors[index], percentage: percentage.toFixed(1), label: item.label };
    });
    
    return \`
        <div class="space-y-4">
            <h4 class="text-lg font-semibold velocity-text-primary text-center">🥧 Distribution Chart</h4>
            <div class="flex items-center gap-6">
                <div class="velocity-bg-secondary p-4 rounded">
                    <svg width="300" height="240">
                        \${slices.map(slice => \`
                            <path d="\${slice.pathData}" fill="\${slice.color}" stroke="white" stroke-width="2" 
                                  class="hover:opacity-80 transition-opacity cursor-pointer">
                                <title>\${slice.label}: \${slice.percentage}%</title>
                            </path>
                        \`).join('')}
                        <text x="150" y="125" text-anchor="middle" class="text-sm font-bold" fill="currentColor">
                            Total: \${total.toLocaleString()}
                        </text>
                    </svg>
                </div>
                <div class="space-y-2">
                    \${slices.map(slice => \`
                        <div class="flex items-center gap-2">
                            <div class="w-4 h-4 rounded" style="background-color: \${slice.color}"></div>
                            <span class="text-sm velocity-text-primary">\${slice.label}</span>
                            <span class="text-sm velocity-text-secondary">(\${slice.percentage}%)</span>
                        </div>
                    \`).join('')}
                </div>
            </div>
        </div>
    \`;
}

function switchChart(type) {
    currentChart = type;
    
    // Update button states
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.classList.toggle('velocity-btn-primary', btn.dataset.chart === type);
        btn.classList.toggle('velocity-btn-outline', btn.dataset.chart !== type);
    });
    
    const chartContainer = document.getElementById('chart-container');
    
    switch(type) {
        case 'bar':
            chartContainer.innerHTML = renderBarChart(chartData);
            break;
        case 'line':
            chartContainer.innerHTML = renderLineChart(chartData);
            break;
        case 'pie':
            chartContainer.innerHTML = renderPieChart(chartData);
            break;
    }
}

function refreshData() {
    chartData = generateData(Math.random() > 0.5 ? 'sales' : 'traffic');
    switchChart(currentChart);
    
    // Show refresh animation
    const refreshBtn = document.querySelector('[onclick="refreshData()"]');
    refreshBtn.style.transform = 'rotate(360deg)';
    setTimeout(() => {
        refreshBtn.style.transform = 'rotate(0deg)';
    }, 500);
}

const container = document.getElementById('preview-container');
container.innerHTML = \`
    <div class="max-w-4xl mx-auto p-6">
        <div class="text-center mb-6">
            <h2 class="text-3xl font-bold velocity-text-primary mb-2">📊 Interactive Data Visualization</h2>
            <p class="velocity-text-secondary">Explore different chart types with dynamic data</p>
        </div>

        <div class="velocity-card p-6">
            <!-- Controls -->
            <div class="flex flex-wrap justify-center gap-4 mb-6">
                <button class="chart-btn velocity-btn velocity-btn-outline" data-chart="bar" onclick="switchChart('bar')">
                    📊 Bar Chart
                </button>
                <button class="chart-btn velocity-btn velocity-btn-primary" data-chart="line" onclick="switchChart('line')">
                    📈 Line Chart
                </button>
                <button class="chart-btn velocity-btn velocity-btn-outline" data-chart="pie" onclick="switchChart('pie')">
                    🥧 Pie Chart
                </button>
                <button onclick="refreshData()" class="velocity-btn velocity-btn-secondary transition-transform duration-500">
                    🔄 Refresh Data
                </button>
            </div>

            <!-- Chart Container -->
            <div id="chart-container" class="min-h-[300px] flex items-center justify-center">
                <div class="text-center velocity-text-secondary">
                    Loading chart...
                </div>
            </div>
        </div>

        <!-- Stats Summary -->
        <div class="grid md:grid-cols-3 gap-4 mt-6">
            <div class="velocity-card p-4 text-center">
                <div class="text-2xl font-bold velocity-text-primary" id="total-value">-</div>
                <div class="text-sm velocity-text-secondary">Total Value</div>
            </div>
            <div class="velocity-card p-4 text-center">
                <div class="text-2xl font-bold velocity-text-primary" id="avg-value">-</div>
                <div class="text-sm velocity-text-secondary">Average</div>
            </div>
            <div class="velocity-card p-4 text-center">
                <div class="text-2xl font-bold velocity-text-primary" id="trend">-</div>
                <div class="text-sm velocity-text-secondary">Overall Trend</div>
            </div>
        </div>
    </div>
\`;

// Initialize
setTimeout(() => {
    chartData = generateData('sales');
    switchChart('line');
    
    // Update stats
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    const average = Math.round(total / chartData.length);
    const firstValue = chartData[0].value;
    const lastValue = chartData[chartData.length - 1].value;
    const trendPercent = ((lastValue - firstValue) / firstValue * 100).toFixed(1);
    
    document.getElementById('total-value').textContent = total.toLocaleString();
    document.getElementById('avg-value').textContent = average.toLocaleString();
    const trendEl = document.getElementById('trend');
    trendEl.textContent = \`\${trendPercent}%\`;
    trendEl.className = \`text-2xl font-bold \${parseFloat(trendPercent) > 0 ? 'text-green-500' : 'text-red-500'}\`;
}, 500);`
    };
    
    // Load initial example
    if (codeEditor) {
        codeEditor.value = examples['hello-world'];
    }
    
    // Update line numbers when content changes
    function updateLineNumbers() {
        if (!lineNumbersContent || !codeEditor) return;
        const lines = codeEditor.value.split('\n');
        const lineNumbers = lines.map((_, index) => index + 1).join('\n');
        lineNumbersContent.textContent = lineNumbers;
    }
    
    // Update cursor position
    function updateCursorPosition() {
        if (!cursorPosition || !codeEditor) return;
        const lines = codeEditor.value.substr(0, codeEditor.selectionStart).split('\n');
        const line = lines.length;
        const col = lines[lines.length - 1].length + 1;
        cursorPosition.textContent = `Ln ${line}, Col ${col}`;
    }
    
    // Update active file name
    function updateActiveFile(filename) {
        if (activeTabName) activeTabName.textContent = filename;
        if (breadcrumbFile) breadcrumbFile.textContent = filename;
    }
    
    // File explorer handlers
    document.querySelectorAll('.example-file').forEach(file => {
        file.addEventListener('click', () => {
            document.querySelectorAll('.example-file').forEach(f => f.classList.remove('active'));
            file.classList.add('active');
            
            const example = file.getAttribute('data-example');
            const filename = file.querySelector('span').textContent;
            
            if (examples[example] && codeEditor) {
                codeEditor.value = examples[example];
                updateActiveFile(filename);
                updateLineNumbers();
                updateCursorPosition();
                runCode();
            }
        });
    });
    
    // Editor functionality
    function runCode() {
        if (!codeEditor || !previewFrame) return;
        
        const startTime = performance.now();
        const code = codeEditor.value;
        
        if (previewFrame.contentWindow) {
            previewFrame.contentWindow.postMessage({
                type: 'EXECUTE_CODE',
                code: code
            }, '*');
            
            // Show execution time
            if (executionTime && execTime) {
                const endTime = performance.now();
                const duration = Math.round(endTime - startTime);
                execTime.textContent = `${duration}ms`;
                executionTime.classList.remove('hidden');
                setTimeout(() => executionTime.classList.add('hidden'), 3000);
            }
        }
    }
    
    // Format code (basic implementation)
    function formatCode() {
        if (!codeEditor) return;
        
        let code = codeEditor.value;
        // Basic formatting - add proper indentation
        const lines = code.split('\n');
        let indentLevel = 0;
        const formattedLines = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed.includes('}')) indentLevel = Math.max(0, indentLevel - 1);
            const formatted = '    '.repeat(indentLevel) + trimmed;
            if (trimmed.includes('{') && !trimmed.includes('}')) indentLevel++;
            return formatted;
        });
        
        codeEditor.value = formattedLines.join('\n');
        updateLineNumbers();
    }
    
    // Event listeners
    if (runButton) {
        runButton.addEventListener('click', runCode);
    }
    
    if (formatButton) {
        formatButton.addEventListener('click', formatCode);
    }
    
    if (copyButton) {
        copyButton.addEventListener('click', async () => {
            if (!codeEditor) return;
            
            try {
                await navigator.clipboard.writeText(codeEditor.value);
                const originalContent = copyButton.innerHTML;
                copyButton.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>';
                setTimeout(() => {
                    copyButton.innerHTML = originalContent;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy: ', err);
            }
        });
    }
    
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            if (previewFrame) {
                previewFrame.src = previewFrame.src;
                setTimeout(() => runCode(), 1000);
            }
        });
    }
    
    // Enhanced keyboard shortcuts and editor behavior
    if (codeEditor) {
        // Update line numbers and cursor position on input
        codeEditor.addEventListener('input', () => {
            updateLineNumbers();
            updateCursorPosition();
        });
        
        codeEditor.addEventListener('click', updateCursorPosition);
        codeEditor.addEventListener('keyup', updateCursorPosition);
        
        codeEditor.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Enter to run
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                runCode();
            }
            
            // Shift + Alt + F to format
            if (e.shiftKey && e.altKey && e.key === 'F') {
                e.preventDefault();
                formatCode();
            }
            
            // Tab for indentation
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = codeEditor.selectionStart;
                const end = codeEditor.selectionEnd;
                codeEditor.value = codeEditor.value.substring(0, start) + '    ' + codeEditor.value.substring(end);
                codeEditor.selectionStart = codeEditor.selectionEnd = start + 4;
                updateLineNumbers();
            }
            
            // Auto-indent on Enter
            if (e.key === 'Enter') {
                const start = codeEditor.selectionStart;
                const lines = codeEditor.value.substr(0, start).split('\n');
                const currentLine = lines[lines.length - 1];
                const indent = currentLine.match(/^(\s*)/)[1];
                
                // Add extra indent for opening braces
                const extraIndent = currentLine.trim().endsWith('{') ? '    ' : '';
                
                setTimeout(() => {
                    const newStart = codeEditor.selectionStart;
                    const newIndent = '\n' + indent + extraIndent;
                    codeEditor.value = codeEditor.value.substring(0, newStart - 1) + newIndent + codeEditor.value.substring(newStart - 1);
                    codeEditor.selectionStart = codeEditor.selectionEnd = newStart + indent.length + extraIndent.length;
                    updateLineNumbers();
                }, 0);
            }
        });
    }
    
    // Auto-run initial example after preview loads
    window.addEventListener('message', (event) => {
        if (event.data.type === 'PREVIEW_READY') {
            setTimeout(() => runCode(), 500);
        }
    });
    
    // Activity bar functionality
    document.querySelectorAll('.activity-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.activity-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const view = btn.getAttribute('data-view');
            const sidebarTitle = document.getElementById('sidebar-title');
            if (sidebarTitle) {
                sidebarTitle.textContent = view.toUpperCase();
            }
        });
    });
    
    // Initialize
    if (codeEditor) {
        codeEditor.value = examples['hello-world'];
        updateLineNumbers();
        updateCursorPosition();
        updateActiveFile('hello-world.js');
    }
    
    // Auto-run initial example after preview loads
    setTimeout(() => {
        if (codeEditor && codeEditor.value) {
            runCode();
        }
    }, 1500);
}

// Additional utility functions
function initDemo() {
    console.log('VS Code-inspired demo page initialized');
}