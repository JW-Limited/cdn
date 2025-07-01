export interface Env {
    ASSETS: {
        fetch: (request: Request) => Promise<Response>;
    };
    MTS_STV0_WORKER: {
        fetch: (request: Request) => Promise<Response>;
    };
    SMPWEB_2X_AUTH_WORKER: {
        fetch: (request: Request) => Promise<Response>;
    };

    CDN_CACHE: KVNamespace;
    CDN_METADATA: KVNamespace;
    FILE_VERSIONS: KVNamespace;
    FILE_CONTENT: KVNamespace;
    ASSETS_DB: D1Database;
}