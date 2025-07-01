export interface FileMetadata {
    id: string;
    name: string;
    originalName: string;
    path: string;
    mimeType: string;
    size: number;
    owner: string;
    ownerId: string;
    created: number;
    modified: number;
    version: number;
    isPublic: boolean;
    tags: string[];
    description?: string;
    customFields?: Record<string, any>;
}