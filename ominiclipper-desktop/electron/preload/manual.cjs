/**
 * OmniCollector Desktop - Electron Preload Script
 * MANUAL CJS VERSION to bypass build issues
 */

const { contextBridge, ipcRenderer } = require('electron');

console.log('[Preload] Script starting (MANUAL CJS)...');
console.log('[Preload] contextBridge:', !!contextBridge);
console.log('[Preload] ipcRenderer:', !!ipcRenderer);

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
try {
    contextBridge.exposeInMainWorld('electronAPI', {
        // File dialog for importing files
        showOpenDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),

        // Show notification
        showNotification: (title, body) => {
            new Notification(title, { body }).show();
        },

        // Get platform info
        platform: process.platform,

        // App version
        getVersion: () => ipcRenderer.invoke('app:getVersion'),

        // Paths
        getUserDataPath: () => ipcRenderer.invoke('path:getUserData'),

        // File operations (for actual file management)
        readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
        readFileAsDataUrl: (filePath) => ipcRenderer.invoke('fs:readFileAsDataUrl', filePath),
        fileExists: (filePath) => ipcRenderer.invoke('fs:fileExists', filePath),
        isDirectory: (filePath) => ipcRenderer.invoke('fs:isDirectory', filePath),

        // Shell operations
        openPath: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),
        openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
        showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath),

        // Directory operations
        scanDirectory: (dirPath, options) => ipcRenderer.invoke('fs:scanDirectory', dirPath, options),
        copyFileToStorage: (sourcePath, targetFileName) => ipcRenderer.invoke('fs:copyFileToStorage', sourcePath, targetFileName),
        importFileToIdStorage: (sourcePath, itemId) => ipcRenderer.invoke('fs:importFileToIdStorage', sourcePath, itemId),
        selectDirectory: (title) => ipcRenderer.invoke('dialog:selectDirectory', title),
        saveEmbeddedFile: (base64Data, fileName, itemId) => ipcRenderer.invoke('fs:saveEmbeddedFile', base64Data, fileName, itemId),

        // Browser extension sync
        syncFromBrowserExtension: (item) => ipcRenderer.invoke('sync:browserExtension', item),

        // ============================================
        // JSON File Storage API
        // ============================================
        storageAPI: {
            // Get the data directory path
            getDataPath: () => ipcRenderer.invoke('storage:getDataPath'),

            // Library data (items, tags, folders)
            readLibrary: () => ipcRenderer.invoke('storage:readLibrary'),
            writeLibrary: (data) => ipcRenderer.invoke('storage:writeLibrary', data),

            // Settings data (theme, locale, preferences)
            readSettings: () => ipcRenderer.invoke('storage:readSettings'),
            writeSettings: (data) => ipcRenderer.invoke('storage:writeSettings', data),

            // Migrate from localStorage to JSON files
            migrate: (legacyData) => ipcRenderer.invoke('storage:migrate', legacyData),
        },

        // ============================================
        // File Storage API (Eagle-style structure)
        // ============================================
        fileStorageAPI: {
            // Get the files storage path
            getStoragePath: () => ipcRenderer.invoke('fileStorage:getStoragePath'),

            // Create item storage directory
            createItemStorage: (itemId) => ipcRenderer.invoke('fileStorage:createItemStorage', itemId),

            // Save file to item storage
            saveFileToStorage: (itemId, fileName, base64Data) =>
                ipcRenderer.invoke('fileStorage:saveFileToStorage', itemId, fileName, base64Data),

            // Read file from item storage
            readFileFromStorage: (itemId, fileName) =>
                ipcRenderer.invoke('fileStorage:readFileFromStorage', itemId, fileName),

            // Get file path in storage
            getFilePath: (itemId, fileName) => ipcRenderer.invoke('fileStorage:getFilePath', itemId, fileName),

            // Delete item storage directory
            deleteItemStorage: (itemId) => ipcRenderer.invoke('fileStorage:deleteItemStorage', itemId),

            // Save item metadata
            saveItemMetadata: (itemId, metadata) =>
                ipcRenderer.invoke('fileStorage:saveItemMetadata', itemId, metadata),

            // Read item metadata
            readItemMetadata: (itemId) => ipcRenderer.invoke('fileStorage:readItemMetadata', itemId),

            // Move file to folder directory (for folder migration)
            moveFileToFolder: (itemId, fileName, folderId) =>
                ipcRenderer.invoke('fileStorage:moveFileToFolder', itemId, fileName, folderId),

            // Save thumbnail
            saveThumbnail: (itemId, dataUrl) =>
                ipcRenderer.invoke('fileStorage:saveThumbnail', itemId, dataUrl),

            // Read thumbnail
            readThumbnail: (itemId) =>
                ipcRenderer.invoke('fileStorage:readThumbnail', itemId),

            // Delete thumbnail
            deleteThumbnail: (itemId) =>
                ipcRenderer.invoke('fileStorage:deleteThumbnail', itemId),
        },

        // ============================================
        // MTime Tracking API (Eagle-style mtime.json)
        // ============================================
        mtimeAPI: {
            // Read all mtime data
            readMTime: () => ipcRenderer.invoke('mtime:readMTime'),

            // Update mtime for an item (sets to current time)
            updateMTime: (itemId) => ipcRenderer.invoke('mtime:updateMTime', itemId),

            // Set mtime for an item to a specific timestamp
            setMTime: (itemId, timestamp) => ipcRenderer.invoke('mtime:setMTime', itemId, timestamp),

            // Remove mtime entry
            removeMTime: (itemId) => ipcRenderer.invoke('mtime:removeMTime', itemId),

            // Get mtime for a specific item
            getMTime: (itemId) => ipcRenderer.invoke('mtime:getMTime', itemId),

            // Get all mtime entries
            getAll: () => ipcRenderer.invoke('mtime:getAll'),

            // Get item count
            getCount: () => ipcRenderer.invoke('mtime:getCount'),
        },

        // ============================================
        // Backup API (Eagle-style backup system)
        // ============================================
        backupAPI: {
            // Create a backup
            createBackup: (data) => ipcRenderer.invoke('backup:createBackup', data),

            // List all backups
            listBackups: () => ipcRenderer.invoke('backup:listBackups'),

            // Restore from a backup
            restoreBackup: (backupPath) => ipcRenderer.invoke('backup:restoreBackup', backupPath),

            // Delete a specific backup
            deleteBackup: (backupPath) => ipcRenderer.invoke('backup:deleteBackup', backupPath),

            // Clean up old backups
            cleanupOldBackups: (keepCount) => ipcRenderer.invoke('backup:cleanupOldBackups', keepCount),

            // Get backup directory path
            getBackupPath: () => ipcRenderer.invoke('backup:getBackupPath'),
        },

        // ============================================
        // Folder Directory API (Eagle-style folders)
        // ============================================
        folderAPI: {
            // Get the folders base path
            getFoldersPath: () => ipcRenderer.invoke('folder:getFoldersPath'),

            // Create a physical folder
            createFolder: (folderId) => ipcRenderer.invoke('folder:create', folderId),

            // Delete a physical folder
            deleteFolder: (folderId) => ipcRenderer.invoke('folder:delete', folderId),

            // Check if folder exists
            folderExists: (folderId) => ipcRenderer.invoke('folder:exists', folderId),
        },

        // ============================================
        // Item Metadata API (Eagle-style items/{id}/metadata.json)
        // ============================================
        itemAPI: {
            // Get the items base path
            getItemsPath: () => ipcRenderer.invoke('item:getItemsPath'),

            // Save item metadata to file
            saveItemMetadata: (itemId, metadata) => ipcRenderer.invoke('item:saveMetadata', itemId, metadata),

            // Read item metadata from file
            readItemMetadata: (itemId) => ipcRenderer.invoke('item:readMetadata', itemId),

            // Delete item metadata file
            deleteItemMetadata: (itemId) => ipcRenderer.invoke('item:deleteMetadata', itemId),

            // Save items index
            saveItemsIndex: (index) => ipcRenderer.invoke('item:saveIndex', index),

            // Read items index
            readItemsIndex: () => ipcRenderer.invoke('item:readIndex'),
        },

        // ============================================
        // File Move API (for moving files between folders)
        // ============================================
        fileAPI: {
            // Move a file from source path to target path
            moveFile: (sourcePath, targetPath) => ipcRenderer.invoke('file:moveFile', sourcePath, targetPath),
        },

        // ============================================
        // Vector Store API (Semantic Search)
        // ============================================
        vectorAPI: {
            // Initialize vector store (load model and connect to database)
            initialize: () => ipcRenderer.invoke('vector:initialize'),

            // Index a document for semantic search
            index: (id, text, metadata) => ipcRenderer.invoke('vector:index', { id, text, metadata }),

            // Search for similar documents
            search: (query, limit) => ipcRenderer.invoke('vector:search', { query, limit }),

            // Delete a document from the index
            delete: (id) => ipcRenderer.invoke('vector:delete', { id }),

            // Get vector store statistics
            getStats: () => ipcRenderer.invoke('vector:getStats'),

            // Check for missing indexes
            checkMissing: (ids) => ipcRenderer.invoke('vector:checkMissing', { ids }),
        },

        // ============================================
        // Search Index API (BM25 Full-Text Search)
        // ============================================
        searchAPI: {
            // Index a document for full-text search
            index: (id, text, metadata) => ipcRenderer.invoke('search:index', { id, text, metadata }),

            // Delete a document from the index
            delete: (id) => ipcRenderer.invoke('search:delete', { id }),

            // BM25 full-text search
            bm25Search: (query, limit) => ipcRenderer.invoke('search:bm25', { query, limit }),

            // Hybrid search (Vector + BM25 with RRF)
            hybridSearch: (query, limit, vectorWeight, bm25Weight, groupByDoc) =>
                ipcRenderer.invoke('search:hybrid', { query, limit, vectorWeight, bm25Weight, groupByDoc }),

            // Get search index statistics
            getStats: () => ipcRenderer.invoke('search:getStats'),
        },
    });
    console.log('[Preload] electronAPI exposed successfully');
} catch (error) {
    console.error('[Preload] Failed to expose electronAPI:', error);
}

// Handle dialog messages from main process
ipcRenderer.on('dialog:message', (event, message) => {
    console.log('Dialog message:', message);
});
