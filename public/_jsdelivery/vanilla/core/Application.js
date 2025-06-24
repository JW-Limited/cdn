/*
*
* File: Application.js
* Project: simply_mail
* Type: JS
* Author: Joe_Valentino_Lengefeld
* Created: 2025-02-22
* Modified: 2025-03-15
*
* Copyright (c) 2025 JW Limited. All rights reserved.
* This file is part of simply_mail and is provided under the terms of the
* license agreement accompanying it. This file may not be copied, modified,
* or distributed except according to those terms.
*
*/

class Application extends EventEmitter {
    constructor() {
        super();
        this.network = new NetworkController();
        this.state = new Observable({
            init: false,
            loading: false,
            error: null,
            events: [],
            contacts: [],
            folders: [],
            currentFolderId: null,
            emails: [],
            selectedEmail: null,
        })
    }
}