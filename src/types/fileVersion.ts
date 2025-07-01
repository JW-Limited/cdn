export interface FileVersion {
    version: number;
    timestamp: number;
    author: string;
    authorId: string;
    changeType: 'metadata' | 'content' | 'both';
    changes: {
        metadata?: any;
        contentSize?: number;
        contentHash?: string;
    };
    storage: {
        contentBytes: number;
        metadataBytes: number;
    };
}