
export { };

declare global {
    interface Window {
        electronAPI?: {
            // File dialogs
            showOpenDialog: (options: any) => Promise<any>;
            selectDirectory: (title?: string) => Promise<{ success: boolean; path: string | null }>;

            // File operations
            readFile: (filePath: string) => Promise<{ success: boolean; content?: string; buffer?: any; error?: string }>;
            readFileAsDataUrl: (filePath: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>;
            fileExists: (filePath: string) => Promise<boolean>;
            isDirectory: (filePath: string) => Promise<boolean>;
            scanDirectory: (dirPath: string, options?: any) => Promise<{ success: boolean; files?: any[]; error?: string }>;
            copyFileToStorage: (sourcePath: string, targetFileName: string, customStoragePath?: string | null) => Promise<{ success: boolean; targetPath?: string; error?: string }>;
            saveEmbeddedFile: (base64Data: string, fileName: string, itemId: string | null) => Promise<{ success: boolean; targetPath?: string; error?: string }>;
            importFileToIdStorage: (sourcePath: string, itemId: string) => Promise<{ success: boolean; targetPath?: string; error?: string }>;
            exportFile: (sourcePath: string, targetDir: string, targetFileName: string) => Promise<{ success: boolean; path?: string; error?: string }>;
            deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;

            // Shell operations
            openPath: (filePath: string) => Promise<{ success: boolean; error?: string }>;
            openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
            showItemInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>;

            // Browser extension
            syncFromBrowserExtension: (item: any) => Promise<number>;

            // Storage API (Legacy/General)
            storageAPI: {
                getDataPath: () => Promise<string>;
                readLibrary: () => Promise<any>;
                writeLibrary: (data: any) => Promise<{ success: boolean; error?: string }>;
                readSettings: () => Promise<any>;
                writeSettings: (data: any) => Promise<{ success: boolean; error?: string }>;
                migrate: (legacyData: any) => Promise<{ success: boolean; error?: string }>;
            };

            // File Storage API
            fileStorageAPI?: {
                getStoragePath: () => Promise<string>;
                getFilesPath: () => Promise<string>;
                createItemStorage: (itemId: string) => Promise<{ success: boolean; path?: string; error?: string }>;
                saveFileToStorage: (itemId: string, fileName: string, base64Data: string) => Promise<{ success: boolean; path?: string; error?: string }>;
                readFileFromStorage: (itemId: string, fileName: string) => Promise<{ success: boolean; dataUrl?: string; error?: string }>;
                getFilePath: (itemId: string, fileName: string) => Promise<string | null>;
                deleteItemStorage: (itemId: string) => Promise<{ success: boolean; error?: string }>;
                saveItemMetadata: (itemId: string, metadata: any) => Promise<{ success: boolean; path?: string; error?: string }>;
                readItemMetadata: (itemId: string) => Promise<any>;
                moveFileToFolder: (itemId: string, fileName: string, folderId: string) => Promise<{ success: boolean; path?: string; error?: string }>;
                saveThumbnail: (itemId: string, dataUrl: string) => Promise<{ success: boolean; path?: string; error?: string }>;
                readThumbnail: (itemId: string) => Promise<{ dataUrl: string; path: string } | null>;
                deleteThumbnail: (itemId: string) => Promise<{ success: boolean; error?: string }>;
            };

            // Vector API
            vectorAPI?: {
                initialize: () => Promise<{ success: boolean; error?: string }>;
                index: (id: string, text: string, metadata: any) => Promise<{ success: boolean; error?: string }>;
                search: (query: string, limit: number) => Promise<any[]>;
                delete: (id: string) => Promise<{ success: boolean; error?: string }>;
                getStats: () => Promise<{ totalDocs: number; lastUpdated: string; modelLoaded: boolean; dbPath: string }>;
                checkMissing: (ids: string[]) => Promise<string[]>;
            };

            // Search API (BM25)
            searchAPI?: {
                index: (id: string, text: string, metadata: any) => Promise<{ success: boolean; error?: string }>;
                delete: (id: string) => Promise<{ success: boolean; error?: string }>;
                bm25Search: (query: string, limit: number) => Promise<any[]>;
                hybridSearch: (query: string, limit: number, vectorWeight: number, bm25Weight: number, groupByDoc?: boolean) => Promise<any[]>;
                getStats: () => Promise<any>;
            };
        };
    }
}
