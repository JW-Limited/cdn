/*
*
* File: Feature.js
* Project: simply_mail
* Type: JS
* Author: Joe_Valentino_Lengefeld
* Created: 2025-02-10
* Modified: 2025-02-21
*
* Copyright (c) 2025 JW Limited. All rights reserved.
* This file is part of simply_mail and is provided under the terms of the
* license agreement accompanying it. This file may not be copied, modified,
* or distributed except according to those terms.
*
*/

class ModernFeatureAnnouncement extends EventEmitter {
    constructor(config) {
        super();
        this.version = config.version;
        this.title = config.title;
        this.features = config.features;
        this.previewFeatures = config.previewFeatures || [];
        this.storageKey = 'featureAnnouncementLastSeen';
        this.flagsStorageKey = 'featureFlags';
        this.featureFlags = this.loadFeatureFlags();
        this.injectStyles();
    }

    loadFeatureFlags() {
        const stored = localStorage.getItem(this.flagsStorageKey);
        return stored ? JSON.parse(stored) : {};
    }

    saveFeatureFlags() {
        localStorage.setItem(this.flagsStorageKey, JSON.stringify(this.featureFlags));
    }

    injectStyles() {
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translate(-50%, -40%);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, -50%);
                }
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            .feature-announcement-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(8px);
                z-index: 999;
                opacity: 0;
                animation: fadeIn 0.3s ease-out forwards;
            }

            .feature-announcement-container {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -40%);
                background: rgba(32, 33, 35, 0.9);
                backdrop-filter: blur(12px);
                color: white;
                border-radius: 16px;
                max-width: 400px;
                width: 90%;
                max-height: 89%;
                box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
                z-index: 1000;
                opacity: 0;
                animation: slideIn 0.4s ease-out 0.1s forwards;
                overflow-y: auto;
            }

            .feature-header {
                padding: 24px 24px 16px 24px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .feature-title {
                font-size: 24px;
                font-weight: 600;
                margin: 0;
                color: rgba(255, 255, 255, 0.95);
            }

            .feature-version {
                font-size: 14px;
                color: rgba(255, 255, 255, 0.6);
                margin-top: 4px;
            }

            .feature-content {
                padding: 20px 24px;
            }

            .feature-list {
                margin: 0;
                padding: 0;
                list-style: none;
            }

            .feature-item {
                display: flex;
                align-items: center;
                padding: 8px 0;
                color: rgba(255, 255, 255, 0.9);
                opacity: 0;
                transform: translateY(10px);
                animation: featureSlideIn 0.3s ease-out forwards;
            }

            @keyframes featureSlideIn {
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .feature-item:before {
                content: '';
                width: 18px;
                height: 18px;
                margin-right: 12px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 4px;
                flex-shrink: 0;
            }

            .feature-actions {
                padding: 16px 24px 24px;
                display: flex;
                justify-content: flex-end;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }

                        .feature-actions {
                padding: 16px 24px;
                display: flex;
                flex-direction: column;
                gap: 16px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }

            .primary-actions {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            }

            .got-it-button {
                background: white;
                color: black;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                font-weight: 500;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .got-it-button:hover {
                background: rgba(255, 255, 255, 0.9);
                transform: translateY(-1px);
            }

            .preview-features-button {
                background: transparent;
                color: rgba(255, 255, 255, 0.7);
                border: 1px solid rgba(255, 255, 255, 0.2);
                padding: 10px 20px;
                border-radius: 8px;
                font-weight: 500;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .preview-features-button:hover {
                background: rgba(255, 255, 255, 0.1);
                color: white;
            }

            .preview-features-button svg {
                transition: transform 0.3s ease;
            }

            .preview-features-button.expanded svg {
                transform: rotate(180deg);
            }

            .preview-features-section {
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.3s ease-out;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
            }

            .preview-features-section.expanded {
                max-height: 500px;
                transition: max-height 0.5s ease-in;
            }

            .preview-features-content {
                padding: 16px;
            }

            .preview-features-header {
                font-size: 14px;
                color: rgba(255, 255, 255, 0.6);
                margin-bottom: 16px;
                line-height: 1.5;
            }

            .feature-flag-item {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                padding: 12px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }

            .feature-flag-item:last-child {
                border-bottom: none;
                padding-bottom: 0;
            }

            .feature-flag-info {
                flex: 1;
                margin-right: 16px;
            }

            .feature-flag-name {
                font-size: 14px;
                font-weight: 500;
                color: rgba(255, 255, 255, 0.9);
                margin-bottom: 4px;
            }

            .feature-flag-description {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.6);
                line-height: 1.5;
            }

            /* Toggle Switch Styles */
            .toggle-switch {
                position: relative;
                width: 36px;
                height: 20px;
                flex-shrink: 0;
            }

            .toggle-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }

            .toggle-slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(255, 255, 255, 0.2);
                transition: .3s;
                border-radius: 20px;
            }

            .toggle-slider:before {
                position: absolute;
                content: "";
                height: 16px;
                width: 16px;
                left: 2px;
                bottom: 2px;
                background-color: white;
                transition: .3s;
                border-radius: 50%;
            }

            input:checked + .toggle-slider {
                background-color: #64D2FF;
            }

            input:checked + .toggle-slider:before {
                transform: translateX(16px);
            }

            .beta-tag {
                display: inline-block;
                padding: 2px 6px;
                background: rgba(100, 210, 255, 0.2);
                color: #64D2FF;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 600;
                text-transform: uppercase;
                margin-left: 8px;
                vertical-align: middle;
            }
        `;
        document.head.appendChild(styleSheet);
    }

    getLastSeenVersion() {
        return localStorage.getItem(this.storageKey) || '0.0.0';
    }

    setLastSeenVersion(version) {
        localStorage.setItem(this.storageKey, version);
    }

    shouldShowAnnouncement() {
        const lastSeen = this.getLastSeenVersion();
        return this.compareVersions(this.version, lastSeen) > 0;
    }

    compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        
        for (let i = 0; i < 3; i++) {
            if (parts1[i] > parts2[i]) return 1;
            if (parts1[i] < parts2[i]) return -1;
        }
        return 0;
    }

    createPreviewFeaturesSection() {
        const section = document.createElement('div');
        section.className = 'preview-features-section';

        const content = document.createElement('div');
        content.className = 'preview-features-content';

        const header = document.createElement('div');
        header.className = 'preview-features-header';
        header.textContent = 'Preview features are experimental and may change. Enable them to try out new capabilities before theyre fully released.';

        const flagsList = document.createElement('div');
        flagsList.className = 'feature-flags-list';

        this.previewFeatures.forEach(feature => {
            const item = document.createElement('div');
            item.className = 'feature-flag-item';

            const info = document.createElement('div');
            info.className = 'feature-flag-info';

            const nameContainer = document.createElement('div');
            nameContainer.className = 'feature-flag-name';
            
            const name = document.createElement('span');
            name.textContent = feature.name;
            
            const betaTag = document.createElement('span');
            betaTag.className = 'beta-tag';
            betaTag.textContent = 'Beta';

            nameContainer.appendChild(name);
            nameContainer.appendChild(betaTag);

            const description = document.createElement('div');
            description.className = 'feature-flag-description';
            description.textContent = feature.description;

            info.appendChild(nameContainer);
            info.appendChild(description);

            const toggleContainer = document.createElement('label');
            toggleContainer.className = 'toggle-switch';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = this.featureFlags[feature.id] || false;
            input.addEventListener('change', (e) => {
                this.featureFlags[feature.id] = e.target.checked;
                this.saveFeatureFlags();
                if (feature.onChange) {
                    feature.onChange(e.target.checked);
                }
            });

            const slider = document.createElement('span');
            slider.className = 'toggle-slider';

            toggleContainer.appendChild(input);
            toggleContainer.appendChild(slider);

            item.appendChild(info);
            item.appendChild(toggleContainer);
            flagsList.appendChild(item);
        });

        content.appendChild(header);
        content.appendChild(flagsList);
        section.appendChild(content);

        return section;
    }


    createDialog() {
        const container = document.createElement('div');
        container.className = 'feature-announcement-container';

        const overlay = document.createElement('div');
        overlay.className = 'feature-announcement-overlay';
        const header = document.createElement('div');
        header.className = 'feature-header';

        const titleEl = document.createElement('h2');
        titleEl.className = 'feature-title';
        titleEl.textContent = this.title;

        const versionText = document.createElement('div');
        versionText.className = 'feature-version';
        versionText.textContent = `Version ${this.version}`;

        header.appendChild(titleEl);
        header.appendChild(versionText);

        const content = document.createElement('div');
        content.className = 'feature-content';

        const featureList = document.createElement('ul');
        featureList.className = 'feature-list';

        this.features.forEach((feature, index) => {
            const li = document.createElement('li');
            li.className = 'feature-item';
            li.textContent = feature;
            li.style.animationDelay = `${0.2 + (index * 0.1)}s`;
            featureList.appendChild(li);
        });

        content.appendChild(featureList);
        const actions = document.createElement('div');
        actions.className = 'feature-actions';

        const primaryActions = document.createElement('div');
        primaryActions.className = 'primary-actions';
        const gotItButton = document.createElement('button');
        gotItButton.className = 'got-it-button';
        gotItButton.textContent = 'Got it';
        const previewButton = document.createElement('button');
        previewButton.className = 'preview-features-button';
        previewButton.innerHTML = `
            <span>Preview Features</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;

        primaryActions.appendChild(previewButton);
        primaryActions.appendChild(gotItButton);
        actions.appendChild(primaryActions);
        const previewSection = this.createPreviewFeaturesSection();
        actions.appendChild(previewSection);

        previewButton.addEventListener('click', () => {
            previewButton.classList.toggle('expanded');
            previewSection.classList.toggle('expanded');
        });
        container.appendChild(header);
        container.appendChild(content);
        container.appendChild(actions);
        const handleClose = () => {
            container.style.animation = 'slideIn 0.3s ease-in reverse';
            overlay.style.animation = 'fadeIn 0.3s ease-in reverse';
            
            setTimeout(() => {
                this.setLastSeenVersion(this.version);
                container.remove();
                overlay.remove();
            }, 300);
        };

        gotItButton.addEventListener('click', handleClose);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) handleClose();
        });

        return { container, overlay };
    }

    show() {
        if (this.shouldShowAnnouncement()) {
            const { container, overlay } = this.createDialog();
            document.body.appendChild(overlay);
            document.body.appendChild(container);
        }
    }
}

