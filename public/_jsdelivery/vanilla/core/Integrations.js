/*
*
* File: Integrations.js
* Project: simply_mail
* Type: JS
* Author: Joe_Valentino_Lengefeld
* Created: 2025-03-11
* Modified: 2025-03-15
*
* Copyright (c) 2025 JW Limited. All rights reserved.
* This file is part of simply_mail and is provided under the terms of the
* license agreement accompanying it. This file may not be copied, modified,
* or distributed except according to those terms.
*
*/

class IntegrationManager extends EventEmitter {
    constructor() {
        super();
        this.container = document.getElementById('integrations-container');
        this.integrations = [];
        this.userData = null;
        this.initialized = false;
        this.eventEmitter = new EventEmitter();
    }
    
    async init() {
        if (this.initialized) return;
        
        try {
            this.userData = SXAPStorageManager.getUserData();
            await this.registerIntegrations();
            this.render();
            this.attachEventListeners();
            this.initialized = true;
            
            setInterval(() => this.refreshIntegrationStatus(), 60000);
            
            this.eventEmitter.emit('initialized');
        } catch (error) {
            console.error('Failed to initialize integration manager:', error);
        }
    }
    
    async registerIntegrations() {
        this.registerIntegration({
            id: 'telegram',
            name: 'Telegram Bot',
            description: 'Receive email notifications and manage your inbox via Telegram',
            icon: '/email/assets/media/telegram_icon-icons.com_72055.png',
            isConnected: () => !!this.userData.telegram_chat_id,
            connectUrl: `https://t.me/simply_mail_bot?start=start_${this.generateUniqueToken()}`,
            disconnectAction: () => this.disconnectTelegram(),
            statusText: {
                connected: 'Receive notifications via Telegram',
                disconnected: 'Connect to receive notifications'
            }
        });
        this.registerIntegration({
            id: 'gmail',
            name: 'Gmail Import',
            description: 'Import all youre emails, folders, events and contacts from gmail and forward them in to SimplyMail.',
            icon: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico',
            isConnected: () => !!this.userData.telegram_chat_id,
            connectUrl: `https://email-service.the-simply-web.com/migration?source=integration_hub&apiKey=${SXAPStorageManager.getUserData().apiKey}`,
            disconnectAction: () => this.disconnectTelegram(),
            statusText: {
                connected: 'Receive notifications via Telegram',
                disconnected: 'Connect to receive notifications'
            }
        });
    }
    
    registerIntegration(integration) {
        this.integrations.push(integration);
        this.eventEmitter.emit('integration-registered', integration);
    }
    
    render() {
        if (!this.container) return;
        
        this.container.innerHTML = '';
        
        this.integrations.forEach(integration => {
            const isConnected = integration.isConnected();
            const card = document.createElement('div');
            card.className = 'integration-card mb-2 relative overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-lg transition-all duration-500';
            card.setAttribute('data-integration-id', integration.id);
            
            const statusClass = isConnected ? 
                'bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20' : 
                'bg-gradient-to-br from-slate-800/50 to-slate-900/30 border-slate-700/30';
            card.className += ` ${statusClass}`;
            
            const comingSoonBadge = integration.comingSoon ? 
                `<div class="absolute top-3 right-3 backdrop-blur-md bg-amber-500/10 text-amber-400 text-xs px-3 py-1.5 rounded-full font-medium border border-amber-500/20 shadow-lg">
                    <span class="relative z-10">Coming Soon</span>
                    <div class="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-full"></div>
                </div>` : '';
            
            const actionButton = integration.comingSoon ? 
                `<button class="opacity-50 cursor-not-allowed mt-2 group inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 bg-primary/80 text-primary-foreground shadow-lg hover:shadow-primary/25 hover:bg-primary/90 h-10 px-5 py-2">
                    <span>Coming Soon</span>
                </button>` :
                isConnected ?
                `<button class="disconnect-integration border border-border-300 mt-2 group inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:ring-destructive disabled:pointer-events-none disabled:opacity-50 bg-destructive/80 text-destructive-foreground shadow-lg hover:shadow-destructive/25 hover:bg-destructive h-10 px-5 py-2">
                    <svg class="w-4 h-4 transition-transform duration-300 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                    <span>Disconnect</span>
                </button>` :
                `<a href="${integration.connectUrl}" target="_blank" class="connect-integration mt-2 group inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 bg-primary/80 text-primary-foreground shadow-lg hover:shadow-primary/25 hover:bg-primary/90 h-10 px-5 py-2">
                    <svg class="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                    </svg>
                    <span>Connect</span>
                </a>`;
            
            const statusIndicator = isConnected ?
                `<div class="flex items-center gap-2">
                    <span class="relative flex h-2 w-2">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span class="text-sm text-green-400 font-medium">${integration.statusText.connected}</span>
                </div>` :
                `<div class="flex items-center gap-2">
                    <span class="relative flex h-2 w-2">
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
                    </span>
                    <span class="text-sm text-slate-400 font-medium">${integration.statusText.disconnected}</span>
                </div>`;
            
            card.innerHTML = `
                ${comingSoonBadge}
                <div class="p-3">
                    <div class="flex items-start gap-5">
                        <div class="w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br from-card/80 to-card shadow-lg backdrop-blur-sm border border-white/5">
                            <img src="${integration.icon}" alt="${integration.name}" class="w-10 h-10 transition-transform duration-300 transform group-hover:scale-110">
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-4">
                                <h4 class="text-lg font-semibold tracking-tight truncate">${integration.name}</h4>
                            </div>
                            <p class="mt-1 text-sm text-muted-foreground leading-relaxed">${integration.description}</p>
                        </div>
                        
                        ${actionButton}
                    </div>
                </div>
                <div class="absolute bottom-0 left-0 right-0">
                    <div class="h-[2px] bg-gradient-to-r ${isConnected ? 'from-green-500/50 via-emerald-500/30 to-green-500/0' : 'from-slate-700/50 via-slate-700/20 to-slate-700/0'}"></div>
                </div>
            `;
            
            this.container.appendChild(card);
        });
        
        this.attachCardEventListeners();
    }
    
    attachCardEventListeners() {
        const disconnectButtons = document.querySelectorAll('.disconnect-integration');
        disconnectButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const card = e.target.closest('.integration-card');
                const integrationId = card.getAttribute('data-integration-id');
                const integration = this.integrations.find(i => i.id === integrationId);
                
                if (integration && integration.disconnectAction) {
                    integration.disconnectAction();
                }
            });
        });
    }
    
    attachEventListeners() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'sxap_user_data') {
                this.userData = SXAPStorageManager.getUserData();
                this.render();
            }
        });
    }
    
    async refreshIntegrationStatus() {
        this.userData = SXAPStorageManager.getUserData();
        this.render();
        this.eventEmitter.emit('status-refreshed');
    }
    
    async disconnectTelegram() {
        try {
            if (!confirm('Are you sure you want to disconnect Telegram integration?')) {
                return;
            }
            
            const userData = SXAPStorageManager.getUserData();
            userData.telegramChatId = '';
            SXAPStorageManager.setUserData(userData);
            
            this.userData = userData;
            this.render();
            this.showToast('Telegram integration disconnected successfully', 'success');
            
            this.eventEmitter.emit('telegram-disconnected');
        } catch (error) {
            console.error('Failed to disconnect Telegram:', error);
            this.showToast('Failed to disconnect Telegram integration', 'error');
        }
    }
    
    generateUniqueToken() {
        const userData = SXAPStorageManager.getUserData();
        const userId = userData.id || '';
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        return this.hashString(`${userId}-${timestamp}-${randomString}`);
    }
    
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16).replace('-', 'a');
    }
    
    showToast(message, type = 'info') {
        if (showToast === 'function') {
            showToast(message, type);
        } else {
            alert(message);
        }
    }
}
