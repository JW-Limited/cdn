/*
*
* File: Enviroment.js
* Project: simply_mail
* Type: JS
* Author: Joe_Valentino_Lengefeld
* Created: 2025-03-05
* Modified: 2025-03-11
*
* Copyright (c) 2025 JW Limited. All rights reserved.
* This file is part of simply_mail and is provided under the terms of the
* license agreement accompanying it. This file may not be copied, modified,
* or distributed except according to those terms.
*
*/

let env = {};

class Environment extends JWBase {
    constructor() {
        super();
    }
    async loadFromFile(filePath) {
        try {
            const response = await fetch(filePath);
            const content = await response.text();
            
            const lines = content.split('\n');
            
            for (const line of lines) {
                if (!line.trim() || line.startsWith('#')) {
                    continue;
                }

                const [key, ...valueParts] = line.split('=');
                const value = valueParts.join('=').trim();
                
                const cleanValue = value.replace(/^["']|["']$/g, '');
                
                env[key.trim()] = cleanValue;
            }
        } catch (error) {
            console.error(`Failed to load environment file ${filePath}:`, error);
            throw error;
        }
    }
    get(key, defaultValue = undefined) {
        return env[key] || defaultValue;
    }

    set(key, value) {
        env[key] = value;
    }

    getAll() {
        return { ...env };
    }

    has(key) {
        return key in env;
    }

    clear() {
        env = {};
    }
}

if(!document.currentScript.dataset.self){
    const e = new Environment();
    e.loadFromFile("/email/env.env");
    console.log(e.getAll());    
    const consoleController = new ConsoleController(e);
}



