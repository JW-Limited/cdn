/*
*
* File: FeatureControl.js
* Project: simply_mail
* Type: JS
* Author: Joe_Valentino_Lengefeld
* Created: 2025-02-10
* Modified: 2025-03-15
*
* Copyright (c) 2025 JW Limited. All rights reserved.
* This file is part of simply_mail and is provided under the terms of the
* license agreement accompanying it. This file may not be copied, modified,
* or distributed except according to those terms.
*
*/

class FeatureControl extends EventEmitter {
    constructor() {
        super();
        this.flagsStorageKey = 'featureFlags';
        this.features = new Map();
        this.featureStates = this.loadFeatureStates();
        this.eventEmitter = new EventTarget();
    }

    loadFeatureStates() {
        const stored = localStorage.getItem(this.flagsStorageKey);
        return stored ? JSON.parse(stored) : {};
    }

    saveFeatureStates() {
        localStorage.setItem(this.flagsStorageKey, JSON.stringify(this.featureStates));
    }

    

    registerFeature(featureId, config) {
        const feature = {
            id: featureId,
            name: config.name,
            description: config.description,
            enabledAction: config.enabledAction || (() => {}),
            disabledAction: config.disabledAction || (() => {}),
            defaultState: config.defaultState || false
        };

        this.features.set(featureId, feature);

        
        if (this.featureStates[featureId] === undefined) {
            this.featureStates[featureId] = feature.defaultState;
            this.saveFeatureStates();
        }

        
        this.executeFeatureAction(featureId, this.featureStates[featureId]);

        return this;
    }

    

    isEnabled(featureId) {
        return Boolean(this.featureStates[featureId]);
    }

    

    setFeatureState(featureId, enabled) {
        const feature = this.features.get(featureId);
        if (!feature) {
            throw new Error(`Feature '${featureId}' not registered`);
        }

        const oldState = this.featureStates[featureId];
        this.featureStates[featureId] = enabled;
        this.saveFeatureStates();

        
        this.executeFeatureAction(featureId, enabled);

        
        const event = new CustomEvent('featureStateChange', {
            detail: {
                featureId,
                oldState,
                newState: enabled
            }
        });
        this.eventEmitter.dispatchEvent(event);
    }


    executeFeatureAction(featureId, enabled) {
        const feature = this.features.get(featureId);
        if (feature) {
            if (enabled) {
                feature.enabledAction();
            } else {
                feature.disabledAction();
            }
        }
    }

    

    onFeatureChange(callback) {
        this.eventEmitter.addEventListener('featureStateChange', (event) => {
            callback(event.detail);
        });
    }


    getAllFeatures() {
        return Array.from(this.features.entries()).map(([id, feature]) => ({
            ...feature,
            enabled: this.isEnabled(id)
        }));
    }

    

    resetToDefaults() {
        this.features.forEach((feature, id) => {
            this.setFeatureState(id, feature.defaultState);
        });
    }
}

