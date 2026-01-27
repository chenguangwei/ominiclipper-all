var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var require_preload = __commonJS({
  "preload.cjs"() {
    const { contextBridge, ipcRenderer } = require("electron");
    console.log("[Preload] Script starting...");
    console.log("[Preload] contextBridge:", !!contextBridge);
    console.log("[Preload] ipcRenderer:", !!ipcRenderer);
    try {
      contextBridge.exposeInMainWorld("electronAPI", {
        // File dialog for importing files
        showOpenDialog: (options) => ipcRenderer.invoke("dialog:openFile", options),
        // Show notification
        showNotification: (title, body) => {
          new Notification(title, { body }).show();
        },
        // Get platform info
        platform: process.platform,
        // App version
        getVersion: () => ipcRenderer.invoke("app:getVersion"),
        // Paths
        getUserDataPath: () => ipcRenderer.invoke("path:getUserData"),
        // File operations (for actual file management)
        readFile: (filePath) => ipcRenderer.invoke("fs:readFile", filePath),
        readFileAsDataUrl: (filePath) => ipcRenderer.invoke("fs:readFileAsDataUrl", filePath),
        fileExists: (filePath) => ipcRenderer.invoke("fs:fileExists", filePath),
        isDirectory: (filePath) => ipcRenderer.invoke("fs:isDirectory", filePath),
        // Shell operations
        openPath: (filePath) => ipcRenderer.invoke("shell:openPath", filePath),
        openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
        showItemInFolder: (filePath) => ipcRenderer.invoke("shell:showItemInFolder", filePath),
        // Directory operations
        scanDirectory: (dirPath, options) => ipcRenderer.invoke("fs:scanDirectory", dirPath, options),
        copyFileToStorage: (sourcePath, targetFileName) => ipcRenderer.invoke("fs:copyFileToStorage", sourcePath, targetFileName),
        selectDirectory: (title) => ipcRenderer.invoke("dialog:selectDirectory", title),
        saveEmbeddedFile: (base64Data, fileName, itemId) => ipcRenderer.invoke("fs:saveEmbeddedFile", base64Data, fileName, itemId),
        importFileToIdStorage: (sourcePath, itemId) => ipcRenderer.invoke("fs:importFileToIdStorage", sourcePath, itemId),
        exportFile: (sourcePath, targetDir, targetFileName) => ipcRenderer.invoke("fs:exportFile", sourcePath, targetDir, targetFileName),
        // Browser extension sync
        syncFromBrowserExtension: (item) => ipcRenderer.invoke("sync:browserExtension", item),
        // ============================================
        // JSON File Storage API
        // ============================================
        storageAPI: {
          // Get the data directory path
          getDataPath: () => ipcRenderer.invoke("storage:getDataPath"),
          // Library data (items, tags, folders)
          readLibrary: () => ipcRenderer.invoke("storage:readLibrary"),
          writeLibrary: (data) => ipcRenderer.invoke("storage:writeLibrary", data),
          // Settings data (theme, locale, preferences)
          readSettings: () => ipcRenderer.invoke("storage:readSettings"),
          writeSettings: (data) => ipcRenderer.invoke("storage:writeSettings", data),
          // Migrate from localStorage to JSON files
          migrate: (legacyData) => ipcRenderer.invoke("storage:migrate", legacyData)
        },
        // ============================================
        // File Storage API (Eagle-style structure)
        // ============================================
        fileStorageAPI: {
          // Get the files storage path
          getStoragePath: () => ipcRenderer.invoke("fileStorage:getStoragePath"),
          // Create item storage directory
          createItemStorage: (itemId) => ipcRenderer.invoke("fileStorage:createItemStorage", itemId),
          // Save file to item storage
          saveFileToStorage: (itemId, fileName, base64Data) => ipcRenderer.invoke("fileStorage:saveFileToStorage", itemId, fileName, base64Data),
          // Read file from item storage
          readFileFromStorage: (itemId, fileName) => ipcRenderer.invoke("fileStorage:readFileFromStorage", itemId, fileName),
          // Get file path in storage
          getFilePath: (itemId, fileName) => ipcRenderer.invoke("fileStorage:getFilePath", itemId, fileName),
          // Delete item storage directory
          deleteItemStorage: (itemId) => ipcRenderer.invoke("fileStorage:deleteItemStorage", itemId),
          // Save item metadata
          saveItemMetadata: (itemId, metadata) => ipcRenderer.invoke("fileStorage:saveItemMetadata", itemId, metadata),
          // Read item metadata
          readItemMetadata: (itemId) => ipcRenderer.invoke("fileStorage:readItemMetadata", itemId),
          // Move file to folder directory (for folder migration)
          moveFileToFolder: (itemId, fileName, folderId) => ipcRenderer.invoke("fileStorage:moveFileToFolder", itemId, fileName, folderId),
          // Save thumbnail
          saveThumbnail: (itemId, dataUrl) => ipcRenderer.invoke("fileStorage:saveThumbnail", itemId, dataUrl),
          // Read thumbnail
          readThumbnail: (itemId) => ipcRenderer.invoke("fileStorage:readThumbnail", itemId),
          // Delete thumbnail
          deleteThumbnail: (itemId) => ipcRenderer.invoke("fileStorage:deleteThumbnail", itemId)
        },
        // ============================================
        // MTime Tracking API (Eagle-style mtime.json)
        // ============================================
        mtimeAPI: {
          // Read all mtime data
          readMTime: () => ipcRenderer.invoke("mtime:readMTime"),
          // Update mtime for an item (sets to current time)
          updateMTime: (itemId) => ipcRenderer.invoke("mtime:updateMTime", itemId),
          // Set mtime for an item to a specific timestamp
          setMTime: (itemId, timestamp) => ipcRenderer.invoke("mtime:setMTime", itemId, timestamp),
          // Remove mtime entry
          removeMTime: (itemId) => ipcRenderer.invoke("mtime:removeMTime", itemId),
          // Get mtime for a specific item
          getMTime: (itemId) => ipcRenderer.invoke("mtime:getMTime", itemId),
          // Get all mtime entries
          getAll: () => ipcRenderer.invoke("mtime:getAll"),
          // Get item count
          getCount: () => ipcRenderer.invoke("mtime:getCount")
        },
        // ============================================
        // Backup API (Eagle-style backup system)
        // ============================================
        backupAPI: {
          // Create a backup
          createBackup: (data) => ipcRenderer.invoke("backup:createBackup", data),
          // List all backups
          listBackups: () => ipcRenderer.invoke("backup:listBackups"),
          // Restore from a backup
          restoreBackup: (backupPath) => ipcRenderer.invoke("backup:restoreBackup", backupPath),
          // Delete a specific backup
          deleteBackup: (backupPath) => ipcRenderer.invoke("backup:deleteBackup", backupPath),
          // Clean up old backups
          cleanupOldBackups: (keepCount) => ipcRenderer.invoke("backup:cleanupOldBackups", keepCount),
          // Get backup directory path
          getBackupPath: () => ipcRenderer.invoke("backup:getBackupPath")
        },
        // ============================================
        // Folder Directory API (Eagle-style folders)
        // ============================================
        folderAPI: {
          // Get the folders base path
          getFoldersPath: () => ipcRenderer.invoke("folder:getFoldersPath"),
          // Create a physical folder
          createFolder: (folderId) => ipcRenderer.invoke("folder:create", folderId),
          // Delete a physical folder
          deleteFolder: (folderId) => ipcRenderer.invoke("folder:delete", folderId),
          // Check if folder exists
          folderExists: (folderId) => ipcRenderer.invoke("folder:exists", folderId)
        },
        // ============================================
        // Item Metadata API (Eagle-style items/{id}/metadata.json)
        // ============================================
        itemAPI: {
          // Get the items base path
          getItemsPath: () => ipcRenderer.invoke("item:getItemsPath"),
          // Save item metadata to file
          saveItemMetadata: (itemId, metadata) => ipcRenderer.invoke("item:saveMetadata", itemId, metadata),
          // Read item metadata from file
          readItemMetadata: (itemId) => ipcRenderer.invoke("item:readMetadata", itemId),
          // Delete item metadata file
          deleteItemMetadata: (itemId) => ipcRenderer.invoke("item:deleteMetadata", itemId),
          // Save items index
          saveItemsIndex: (index) => ipcRenderer.invoke("item:saveIndex", index),
          // Read items index
          readItemsIndex: () => ipcRenderer.invoke("item:readIndex")
        },
        // ============================================
        // File Move API (for moving files between folders)
        // ============================================
        fileAPI: {
          // Move a file from source path to target path
          moveFile: (sourcePath, targetPath) => ipcRenderer.invoke("file:moveFile", sourcePath, targetPath)
        },
        // ============================================
        // Vector Store API (Semantic Search)
        // ============================================
        vectorAPI: {
          // Initialize vector store (load model and connect to database)
          initialize: () => ipcRenderer.invoke("vector:initialize"),
          // Index a document for semantic search
          index: (id, text, metadata) => ipcRenderer.invoke("vector:index", { id, text, metadata }),
          // Search for similar documents
          search: (query, limit) => ipcRenderer.invoke("vector:search", { query, limit }),
          // Delete a document from the index
          delete: (id) => ipcRenderer.invoke("vector:delete", { id }),
          // Get vector store statistics
          getStats: () => ipcRenderer.invoke("vector:getStats")
        },
        // ============================================
        // Search Index API (BM25 Full-Text Search)
        // ============================================
        searchAPI: {
          // Index a document for full-text search
          index: (id, text, metadata) => ipcRenderer.invoke("search:index", { id, text, metadata }),
          // Delete a document from the index
          delete: (id) => ipcRenderer.invoke("search:delete", { id }),
          // BM25 full-text search
          bm25Search: (query, limit) => ipcRenderer.invoke("search:bm25", { query, limit }),
          // Hybrid search (Vector + BM25 with RRF)
          hybridSearch: (query, limit, vectorWeight, bm25Weight, groupByDoc) => ipcRenderer.invoke("search:hybrid", { query, limit, vectorWeight, bm25Weight, groupByDoc }),
          // Get search index statistics
          getStats: () => ipcRenderer.invoke("search:getStats")
        }
      });
    } catch (error) {
      console.error("[Preload] Failed to expose electronAPI:", error);
    }
    ipcRenderer.on("dialog:message", (event, message) => {
      console.log("Dialog message:", message);
    });
  }
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlbG9hZC5janMiLCJzb3VyY2VzIjpbIi4uLy4uL2VsZWN0cm9uL3ByZWxvYWQvaW5kZXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBPbW5pQ29sbGVjdG9yIERlc2t0b3AgLSBFbGVjdHJvbiBQcmVsb2FkIFNjcmlwdFxuICovXG5cbmNvbnN0IHsgY29udGV4dEJyaWRnZSwgaXBjUmVuZGVyZXIgfSA9IHJlcXVpcmUoJ2VsZWN0cm9uJyk7XG5cbmNvbnNvbGUubG9nKCdbUHJlbG9hZF0gU2NyaXB0IHN0YXJ0aW5nLi4uJyk7XG5jb25zb2xlLmxvZygnW1ByZWxvYWRdIGNvbnRleHRCcmlkZ2U6JywgISFjb250ZXh0QnJpZGdlKTtcbmNvbnNvbGUubG9nKCdbUHJlbG9hZF0gaXBjUmVuZGVyZXI6JywgISFpcGNSZW5kZXJlcik7XG5cbi8vIEV4cG9zZSBwcm90ZWN0ZWQgbWV0aG9kcyB0aGF0IGFsbG93IHRoZSByZW5kZXJlciBwcm9jZXNzIHRvIHVzZVxuLy8gdGhlIGlwY1JlbmRlcmVyIHdpdGhvdXQgZXhwb3NpbmcgdGhlIGVudGlyZSBvYmplY3RcbnRyeSB7XG4gIGNvbnRleHRCcmlkZ2UuZXhwb3NlSW5NYWluV29ybGQoJ2VsZWN0cm9uQVBJJywge1xuICAgIC8vIEZpbGUgZGlhbG9nIGZvciBpbXBvcnRpbmcgZmlsZXNcbiAgICBzaG93T3BlbkRpYWxvZzogKG9wdGlvbnMpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZGlhbG9nOm9wZW5GaWxlJywgb3B0aW9ucyksXG5cbiAgICAvLyBTaG93IG5vdGlmaWNhdGlvblxuICAgIHNob3dOb3RpZmljYXRpb246ICh0aXRsZSwgYm9keSkgPT4ge1xuICAgICAgbmV3IE5vdGlmaWNhdGlvbih0aXRsZSwgeyBib2R5IH0pLnNob3coKTtcbiAgICB9LFxuXG4gICAgLy8gR2V0IHBsYXRmb3JtIGluZm9cbiAgICBwbGF0Zm9ybTogcHJvY2Vzcy5wbGF0Zm9ybSxcblxuICAgIC8vIEFwcCB2ZXJzaW9uXG4gICAgZ2V0VmVyc2lvbjogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdhcHA6Z2V0VmVyc2lvbicpLFxuXG4gICAgLy8gUGF0aHNcbiAgICBnZXRVc2VyRGF0YVBhdGg6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgncGF0aDpnZXRVc2VyRGF0YScpLFxuXG4gICAgLy8gRmlsZSBvcGVyYXRpb25zIChmb3IgYWN0dWFsIGZpbGUgbWFuYWdlbWVudClcbiAgICByZWFkRmlsZTogKGZpbGVQYXRoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2ZzOnJlYWRGaWxlJywgZmlsZVBhdGgpLFxuICAgIHJlYWRGaWxlQXNEYXRhVXJsOiAoZmlsZVBhdGgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZnM6cmVhZEZpbGVBc0RhdGFVcmwnLCBmaWxlUGF0aCksXG4gICAgZmlsZUV4aXN0czogKGZpbGVQYXRoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2ZzOmZpbGVFeGlzdHMnLCBmaWxlUGF0aCksXG4gICAgaXNEaXJlY3Rvcnk6IChmaWxlUGF0aCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdmczppc0RpcmVjdG9yeScsIGZpbGVQYXRoKSxcblxuICAgIC8vIFNoZWxsIG9wZXJhdGlvbnNcbiAgICBvcGVuUGF0aDogKGZpbGVQYXRoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3NoZWxsOm9wZW5QYXRoJywgZmlsZVBhdGgpLFxuICAgIG9wZW5FeHRlcm5hbDogKHVybCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdzaGVsbDpvcGVuRXh0ZXJuYWwnLCB1cmwpLFxuICAgIHNob3dJdGVtSW5Gb2xkZXI6IChmaWxlUGF0aCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdzaGVsbDpzaG93SXRlbUluRm9sZGVyJywgZmlsZVBhdGgpLFxuXG4gICAgLy8gRGlyZWN0b3J5IG9wZXJhdGlvbnNcbiAgICBzY2FuRGlyZWN0b3J5OiAoZGlyUGF0aCwgb3B0aW9ucykgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdmczpzY2FuRGlyZWN0b3J5JywgZGlyUGF0aCwgb3B0aW9ucyksXG4gICAgY29weUZpbGVUb1N0b3JhZ2U6IChzb3VyY2VQYXRoLCB0YXJnZXRGaWxlTmFtZSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdmczpjb3B5RmlsZVRvU3RvcmFnZScsIHNvdXJjZVBhdGgsIHRhcmdldEZpbGVOYW1lKSxcbiAgICBzZWxlY3REaXJlY3Rvcnk6ICh0aXRsZSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdkaWFsb2c6c2VsZWN0RGlyZWN0b3J5JywgdGl0bGUpLFxuICAgIHNhdmVFbWJlZGRlZEZpbGU6IChiYXNlNjREYXRhLCBmaWxlTmFtZSwgaXRlbUlkKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2ZzOnNhdmVFbWJlZGRlZEZpbGUnLCBiYXNlNjREYXRhLCBmaWxlTmFtZSwgaXRlbUlkKSxcbiAgICBpbXBvcnRGaWxlVG9JZFN0b3JhZ2U6IChzb3VyY2VQYXRoLCBpdGVtSWQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZnM6aW1wb3J0RmlsZVRvSWRTdG9yYWdlJywgc291cmNlUGF0aCwgaXRlbUlkKSxcbiAgICBleHBvcnRGaWxlOiAoc291cmNlUGF0aCwgdGFyZ2V0RGlyLCB0YXJnZXRGaWxlTmFtZSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdmczpleHBvcnRGaWxlJywgc291cmNlUGF0aCwgdGFyZ2V0RGlyLCB0YXJnZXRGaWxlTmFtZSksXG5cbiAgICAvLyBCcm93c2VyIGV4dGVuc2lvbiBzeW5jXG4gICAgc3luY0Zyb21Ccm93c2VyRXh0ZW5zaW9uOiAoaXRlbSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdzeW5jOmJyb3dzZXJFeHRlbnNpb24nLCBpdGVtKSxcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gSlNPTiBGaWxlIFN0b3JhZ2UgQVBJXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBzdG9yYWdlQVBJOiB7XG4gICAgICAvLyBHZXQgdGhlIGRhdGEgZGlyZWN0b3J5IHBhdGhcbiAgICAgIGdldERhdGFQYXRoOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3N0b3JhZ2U6Z2V0RGF0YVBhdGgnKSxcblxuICAgICAgLy8gTGlicmFyeSBkYXRhIChpdGVtcywgdGFncywgZm9sZGVycylcbiAgICAgIHJlYWRMaWJyYXJ5OiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3N0b3JhZ2U6cmVhZExpYnJhcnknKSxcbiAgICAgIHdyaXRlTGlicmFyeTogKGRhdGEpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnc3RvcmFnZTp3cml0ZUxpYnJhcnknLCBkYXRhKSxcblxuICAgICAgLy8gU2V0dGluZ3MgZGF0YSAodGhlbWUsIGxvY2FsZSwgcHJlZmVyZW5jZXMpXG4gICAgICByZWFkU2V0dGluZ3M6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnc3RvcmFnZTpyZWFkU2V0dGluZ3MnKSxcbiAgICAgIHdyaXRlU2V0dGluZ3M6IChkYXRhKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3N0b3JhZ2U6d3JpdGVTZXR0aW5ncycsIGRhdGEpLFxuXG4gICAgICAvLyBNaWdyYXRlIGZyb20gbG9jYWxTdG9yYWdlIHRvIEpTT04gZmlsZXNcbiAgICAgIG1pZ3JhdGU6IChsZWdhY3lEYXRhKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3N0b3JhZ2U6bWlncmF0ZScsIGxlZ2FjeURhdGEpLFxuICAgIH0sXG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEZpbGUgU3RvcmFnZSBBUEkgKEVhZ2xlLXN0eWxlIHN0cnVjdHVyZSlcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGZpbGVTdG9yYWdlQVBJOiB7XG4gICAgICAvLyBHZXQgdGhlIGZpbGVzIHN0b3JhZ2UgcGF0aFxuICAgICAgZ2V0U3RvcmFnZVBhdGg6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZmlsZVN0b3JhZ2U6Z2V0U3RvcmFnZVBhdGgnKSxcblxuICAgICAgLy8gQ3JlYXRlIGl0ZW0gc3RvcmFnZSBkaXJlY3RvcnlcbiAgICAgIGNyZWF0ZUl0ZW1TdG9yYWdlOiAoaXRlbUlkKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2ZpbGVTdG9yYWdlOmNyZWF0ZUl0ZW1TdG9yYWdlJywgaXRlbUlkKSxcblxuICAgICAgLy8gU2F2ZSBmaWxlIHRvIGl0ZW0gc3RvcmFnZVxuICAgICAgc2F2ZUZpbGVUb1N0b3JhZ2U6IChpdGVtSWQsIGZpbGVOYW1lLCBiYXNlNjREYXRhKSA9PlxuICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoJ2ZpbGVTdG9yYWdlOnNhdmVGaWxlVG9TdG9yYWdlJywgaXRlbUlkLCBmaWxlTmFtZSwgYmFzZTY0RGF0YSksXG5cbiAgICAgIC8vIFJlYWQgZmlsZSBmcm9tIGl0ZW0gc3RvcmFnZVxuICAgICAgcmVhZEZpbGVGcm9tU3RvcmFnZTogKGl0ZW1JZCwgZmlsZU5hbWUpID0+XG4gICAgICAgIGlwY1JlbmRlcmVyLmludm9rZSgnZmlsZVN0b3JhZ2U6cmVhZEZpbGVGcm9tU3RvcmFnZScsIGl0ZW1JZCwgZmlsZU5hbWUpLFxuXG4gICAgICAvLyBHZXQgZmlsZSBwYXRoIGluIHN0b3JhZ2VcbiAgICAgIGdldEZpbGVQYXRoOiAoaXRlbUlkLCBmaWxlTmFtZSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdmaWxlU3RvcmFnZTpnZXRGaWxlUGF0aCcsIGl0ZW1JZCwgZmlsZU5hbWUpLFxuXG4gICAgICAvLyBEZWxldGUgaXRlbSBzdG9yYWdlIGRpcmVjdG9yeVxuICAgICAgZGVsZXRlSXRlbVN0b3JhZ2U6IChpdGVtSWQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZmlsZVN0b3JhZ2U6ZGVsZXRlSXRlbVN0b3JhZ2UnLCBpdGVtSWQpLFxuXG4gICAgICAvLyBTYXZlIGl0ZW0gbWV0YWRhdGFcbiAgICAgIHNhdmVJdGVtTWV0YWRhdGE6IChpdGVtSWQsIG1ldGFkYXRhKSA9PlxuICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoJ2ZpbGVTdG9yYWdlOnNhdmVJdGVtTWV0YWRhdGEnLCBpdGVtSWQsIG1ldGFkYXRhKSxcblxuICAgICAgLy8gUmVhZCBpdGVtIG1ldGFkYXRhXG4gICAgICByZWFkSXRlbU1ldGFkYXRhOiAoaXRlbUlkKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2ZpbGVTdG9yYWdlOnJlYWRJdGVtTWV0YWRhdGEnLCBpdGVtSWQpLFxuXG4gICAgICAvLyBNb3ZlIGZpbGUgdG8gZm9sZGVyIGRpcmVjdG9yeSAoZm9yIGZvbGRlciBtaWdyYXRpb24pXG4gICAgICBtb3ZlRmlsZVRvRm9sZGVyOiAoaXRlbUlkLCBmaWxlTmFtZSwgZm9sZGVySWQpID0+XG4gICAgICAgIGlwY1JlbmRlcmVyLmludm9rZSgnZmlsZVN0b3JhZ2U6bW92ZUZpbGVUb0ZvbGRlcicsIGl0ZW1JZCwgZmlsZU5hbWUsIGZvbGRlcklkKSxcblxuICAgICAgLy8gU2F2ZSB0aHVtYm5haWxcbiAgICAgIHNhdmVUaHVtYm5haWw6IChpdGVtSWQsIGRhdGFVcmwpID0+XG4gICAgICAgIGlwY1JlbmRlcmVyLmludm9rZSgnZmlsZVN0b3JhZ2U6c2F2ZVRodW1ibmFpbCcsIGl0ZW1JZCwgZGF0YVVybCksXG5cbiAgICAgIC8vIFJlYWQgdGh1bWJuYWlsXG4gICAgICByZWFkVGh1bWJuYWlsOiAoaXRlbUlkKSA9PlxuICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoJ2ZpbGVTdG9yYWdlOnJlYWRUaHVtYm5haWwnLCBpdGVtSWQpLFxuXG4gICAgICAvLyBEZWxldGUgdGh1bWJuYWlsXG4gICAgICBkZWxldGVUaHVtYm5haWw6IChpdGVtSWQpID0+XG4gICAgICAgIGlwY1JlbmRlcmVyLmludm9rZSgnZmlsZVN0b3JhZ2U6ZGVsZXRlVGh1bWJuYWlsJywgaXRlbUlkKSxcbiAgICB9LFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBNVGltZSBUcmFja2luZyBBUEkgKEVhZ2xlLXN0eWxlIG10aW1lLmpzb24pXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBtdGltZUFQSToge1xuICAgICAgLy8gUmVhZCBhbGwgbXRpbWUgZGF0YVxuICAgICAgcmVhZE1UaW1lOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ210aW1lOnJlYWRNVGltZScpLFxuXG4gICAgICAvLyBVcGRhdGUgbXRpbWUgZm9yIGFuIGl0ZW0gKHNldHMgdG8gY3VycmVudCB0aW1lKVxuICAgICAgdXBkYXRlTVRpbWU6IChpdGVtSWQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnbXRpbWU6dXBkYXRlTVRpbWUnLCBpdGVtSWQpLFxuXG4gICAgICAvLyBTZXQgbXRpbWUgZm9yIGFuIGl0ZW0gdG8gYSBzcGVjaWZpYyB0aW1lc3RhbXBcbiAgICAgIHNldE1UaW1lOiAoaXRlbUlkLCB0aW1lc3RhbXApID0+IGlwY1JlbmRlcmVyLmludm9rZSgnbXRpbWU6c2V0TVRpbWUnLCBpdGVtSWQsIHRpbWVzdGFtcCksXG5cbiAgICAgIC8vIFJlbW92ZSBtdGltZSBlbnRyeVxuICAgICAgcmVtb3ZlTVRpbWU6IChpdGVtSWQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnbXRpbWU6cmVtb3ZlTVRpbWUnLCBpdGVtSWQpLFxuXG4gICAgICAvLyBHZXQgbXRpbWUgZm9yIGEgc3BlY2lmaWMgaXRlbVxuICAgICAgZ2V0TVRpbWU6IChpdGVtSWQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnbXRpbWU6Z2V0TVRpbWUnLCBpdGVtSWQpLFxuXG4gICAgICAvLyBHZXQgYWxsIG10aW1lIGVudHJpZXNcbiAgICAgIGdldEFsbDogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdtdGltZTpnZXRBbGwnKSxcblxuICAgICAgLy8gR2V0IGl0ZW0gY291bnRcbiAgICAgIGdldENvdW50OiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ210aW1lOmdldENvdW50JyksXG4gICAgfSxcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQmFja3VwIEFQSSAoRWFnbGUtc3R5bGUgYmFja3VwIHN5c3RlbSlcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGJhY2t1cEFQSToge1xuICAgICAgLy8gQ3JlYXRlIGEgYmFja3VwXG4gICAgICBjcmVhdGVCYWNrdXA6IChkYXRhKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2JhY2t1cDpjcmVhdGVCYWNrdXAnLCBkYXRhKSxcblxuICAgICAgLy8gTGlzdCBhbGwgYmFja3Vwc1xuICAgICAgbGlzdEJhY2t1cHM6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnYmFja3VwOmxpc3RCYWNrdXBzJyksXG5cbiAgICAgIC8vIFJlc3RvcmUgZnJvbSBhIGJhY2t1cFxuICAgICAgcmVzdG9yZUJhY2t1cDogKGJhY2t1cFBhdGgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnYmFja3VwOnJlc3RvcmVCYWNrdXAnLCBiYWNrdXBQYXRoKSxcblxuICAgICAgLy8gRGVsZXRlIGEgc3BlY2lmaWMgYmFja3VwXG4gICAgICBkZWxldGVCYWNrdXA6IChiYWNrdXBQYXRoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2JhY2t1cDpkZWxldGVCYWNrdXAnLCBiYWNrdXBQYXRoKSxcblxuICAgICAgLy8gQ2xlYW4gdXAgb2xkIGJhY2t1cHNcbiAgICAgIGNsZWFudXBPbGRCYWNrdXBzOiAoa2VlcENvdW50KSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2JhY2t1cDpjbGVhbnVwT2xkQmFja3VwcycsIGtlZXBDb3VudCksXG5cbiAgICAgIC8vIEdldCBiYWNrdXAgZGlyZWN0b3J5IHBhdGhcbiAgICAgIGdldEJhY2t1cFBhdGg6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnYmFja3VwOmdldEJhY2t1cFBhdGgnKSxcbiAgICB9LFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBGb2xkZXIgRGlyZWN0b3J5IEFQSSAoRWFnbGUtc3R5bGUgZm9sZGVycylcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGZvbGRlckFQSToge1xuICAgICAgLy8gR2V0IHRoZSBmb2xkZXJzIGJhc2UgcGF0aFxuICAgICAgZ2V0Rm9sZGVyc1BhdGg6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZm9sZGVyOmdldEZvbGRlcnNQYXRoJyksXG5cbiAgICAgIC8vIENyZWF0ZSBhIHBoeXNpY2FsIGZvbGRlclxuICAgICAgY3JlYXRlRm9sZGVyOiAoZm9sZGVySWQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZm9sZGVyOmNyZWF0ZScsIGZvbGRlcklkKSxcblxuICAgICAgLy8gRGVsZXRlIGEgcGh5c2ljYWwgZm9sZGVyXG4gICAgICBkZWxldGVGb2xkZXI6IChmb2xkZXJJZCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdmb2xkZXI6ZGVsZXRlJywgZm9sZGVySWQpLFxuXG4gICAgICAvLyBDaGVjayBpZiBmb2xkZXIgZXhpc3RzXG4gICAgICBmb2xkZXJFeGlzdHM6IChmb2xkZXJJZCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdmb2xkZXI6ZXhpc3RzJywgZm9sZGVySWQpLFxuICAgIH0sXG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEl0ZW0gTWV0YWRhdGEgQVBJIChFYWdsZS1zdHlsZSBpdGVtcy97aWR9L21ldGFkYXRhLmpzb24pXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBpdGVtQVBJOiB7XG4gICAgICAvLyBHZXQgdGhlIGl0ZW1zIGJhc2UgcGF0aFxuICAgICAgZ2V0SXRlbXNQYXRoOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2l0ZW06Z2V0SXRlbXNQYXRoJyksXG5cbiAgICAgIC8vIFNhdmUgaXRlbSBtZXRhZGF0YSB0byBmaWxlXG4gICAgICBzYXZlSXRlbU1ldGFkYXRhOiAoaXRlbUlkLCBtZXRhZGF0YSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdpdGVtOnNhdmVNZXRhZGF0YScsIGl0ZW1JZCwgbWV0YWRhdGEpLFxuXG4gICAgICAvLyBSZWFkIGl0ZW0gbWV0YWRhdGEgZnJvbSBmaWxlXG4gICAgICByZWFkSXRlbU1ldGFkYXRhOiAoaXRlbUlkKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2l0ZW06cmVhZE1ldGFkYXRhJywgaXRlbUlkKSxcblxuICAgICAgLy8gRGVsZXRlIGl0ZW0gbWV0YWRhdGEgZmlsZVxuICAgICAgZGVsZXRlSXRlbU1ldGFkYXRhOiAoaXRlbUlkKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2l0ZW06ZGVsZXRlTWV0YWRhdGEnLCBpdGVtSWQpLFxuXG4gICAgICAvLyBTYXZlIGl0ZW1zIGluZGV4XG4gICAgICBzYXZlSXRlbXNJbmRleDogKGluZGV4KSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2l0ZW06c2F2ZUluZGV4JywgaW5kZXgpLFxuXG4gICAgICAvLyBSZWFkIGl0ZW1zIGluZGV4XG4gICAgICByZWFkSXRlbXNJbmRleDogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdpdGVtOnJlYWRJbmRleCcpLFxuICAgIH0sXG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEZpbGUgTW92ZSBBUEkgKGZvciBtb3ZpbmcgZmlsZXMgYmV0d2VlbiBmb2xkZXJzKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgZmlsZUFQSToge1xuICAgICAgLy8gTW92ZSBhIGZpbGUgZnJvbSBzb3VyY2UgcGF0aCB0byB0YXJnZXQgcGF0aFxuICAgICAgbW92ZUZpbGU6IChzb3VyY2VQYXRoLCB0YXJnZXRQYXRoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2ZpbGU6bW92ZUZpbGUnLCBzb3VyY2VQYXRoLCB0YXJnZXRQYXRoKSxcbiAgICB9LFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBWZWN0b3IgU3RvcmUgQVBJIChTZW1hbnRpYyBTZWFyY2gpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICB2ZWN0b3JBUEk6IHtcbiAgICAgIC8vIEluaXRpYWxpemUgdmVjdG9yIHN0b3JlIChsb2FkIG1vZGVsIGFuZCBjb25uZWN0IHRvIGRhdGFiYXNlKVxuICAgICAgaW5pdGlhbGl6ZTogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCd2ZWN0b3I6aW5pdGlhbGl6ZScpLFxuXG4gICAgICAvLyBJbmRleCBhIGRvY3VtZW50IGZvciBzZW1hbnRpYyBzZWFyY2hcbiAgICAgIGluZGV4OiAoaWQsIHRleHQsIG1ldGFkYXRhKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3ZlY3RvcjppbmRleCcsIHsgaWQsIHRleHQsIG1ldGFkYXRhIH0pLFxuXG4gICAgICAvLyBTZWFyY2ggZm9yIHNpbWlsYXIgZG9jdW1lbnRzXG4gICAgICBzZWFyY2g6IChxdWVyeSwgbGltaXQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgndmVjdG9yOnNlYXJjaCcsIHsgcXVlcnksIGxpbWl0IH0pLFxuXG4gICAgICAvLyBEZWxldGUgYSBkb2N1bWVudCBmcm9tIHRoZSBpbmRleFxuICAgICAgZGVsZXRlOiAoaWQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgndmVjdG9yOmRlbGV0ZScsIHsgaWQgfSksXG5cbiAgICAgIC8vIEdldCB2ZWN0b3Igc3RvcmUgc3RhdGlzdGljc1xuICAgICAgZ2V0U3RhdHM6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgndmVjdG9yOmdldFN0YXRzJyksXG4gICAgfSxcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gU2VhcmNoIEluZGV4IEFQSSAoQk0yNSBGdWxsLVRleHQgU2VhcmNoKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgc2VhcmNoQVBJOiB7XG4gICAgICAvLyBJbmRleCBhIGRvY3VtZW50IGZvciBmdWxsLXRleHQgc2VhcmNoXG4gICAgICBpbmRleDogKGlkLCB0ZXh0LCBtZXRhZGF0YSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdzZWFyY2g6aW5kZXgnLCB7IGlkLCB0ZXh0LCBtZXRhZGF0YSB9KSxcblxuICAgICAgLy8gRGVsZXRlIGEgZG9jdW1lbnQgZnJvbSB0aGUgaW5kZXhcbiAgICAgIGRlbGV0ZTogKGlkKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3NlYXJjaDpkZWxldGUnLCB7IGlkIH0pLFxuXG4gICAgICAvLyBCTTI1IGZ1bGwtdGV4dCBzZWFyY2hcbiAgICAgIGJtMjVTZWFyY2g6IChxdWVyeSwgbGltaXQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnc2VhcmNoOmJtMjUnLCB7IHF1ZXJ5LCBsaW1pdCB9KSxcblxuICAgICAgLy8gSHlicmlkIHNlYXJjaCAoVmVjdG9yICsgQk0yNSB3aXRoIFJSRilcbiAgICAgIGh5YnJpZFNlYXJjaDogKHF1ZXJ5LCBsaW1pdCwgdmVjdG9yV2VpZ2h0LCBibTI1V2VpZ2h0LCBncm91cEJ5RG9jKSA9PlxuICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoJ3NlYXJjaDpoeWJyaWQnLCB7IHF1ZXJ5LCBsaW1pdCwgdmVjdG9yV2VpZ2h0LCBibTI1V2VpZ2h0LCBncm91cEJ5RG9jIH0pLFxuXG4gICAgICAvLyBHZXQgc2VhcmNoIGluZGV4IHN0YXRpc3RpY3NcbiAgICAgIGdldFN0YXRzOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3NlYXJjaDpnZXRTdGF0cycpLFxuICAgIH0sXG4gIH0pO1xufSBjYXRjaCAoZXJyb3IpIHtcbiAgY29uc29sZS5lcnJvcignW1ByZWxvYWRdIEZhaWxlZCB0byBleHBvc2UgZWxlY3Ryb25BUEk6JywgZXJyb3IpO1xufVxuXG4vLyBIYW5kbGUgZGlhbG9nIG1lc3NhZ2VzIGZyb20gbWFpbiBwcm9jZXNzXG5pcGNSZW5kZXJlci5vbignZGlhbG9nOm1lc3NhZ2UnLCAoZXZlbnQsIG1lc3NhZ2UpID0+IHtcbiAgY29uc29sZS5sb2coJ0RpYWxvZyBtZXNzYWdlOicsIG1lc3NhZ2UpO1xufSk7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7OztBQUlBO0FBQUE7QUFBQSxVQUFNLEVBQUUsZUFBZSxnQkFBZ0IsUUFBUSxVQUFVO0FBRXpELFlBQVEsSUFBSSw4QkFBOEI7QUFDMUMsWUFBUSxJQUFJLDRCQUE0QixDQUFDLENBQUMsYUFBYTtBQUN2RCxZQUFRLElBQUksMEJBQTBCLENBQUMsQ0FBQyxXQUFXO0FBSW5ELFFBQUk7QUFDRixvQkFBYyxrQkFBa0IsZUFBZTtBQUFBO0FBQUEsUUFFN0MsZ0JBQWdCLENBQUMsWUFBWSxZQUFZLE9BQU8sbUJBQW1CLE9BQU87QUFBQTtBQUFBLFFBRzFFLGtCQUFrQixDQUFDLE9BQU8sU0FBUztBQUNqQyxjQUFJLGFBQWEsT0FBTyxFQUFFLEtBQUEsQ0FBTSxFQUFFLEtBQUE7QUFBQSxRQUNwQztBQUFBO0FBQUEsUUFHQSxVQUFVLFFBQVE7QUFBQTtBQUFBLFFBR2xCLFlBQVksTUFBTSxZQUFZLE9BQU8sZ0JBQWdCO0FBQUE7QUFBQSxRQUdyRCxpQkFBaUIsTUFBTSxZQUFZLE9BQU8sa0JBQWtCO0FBQUE7QUFBQSxRQUc1RCxVQUFVLENBQUMsYUFBYSxZQUFZLE9BQU8sZUFBZSxRQUFRO0FBQUEsUUFDbEUsbUJBQW1CLENBQUMsYUFBYSxZQUFZLE9BQU8sd0JBQXdCLFFBQVE7QUFBQSxRQUNwRixZQUFZLENBQUMsYUFBYSxZQUFZLE9BQU8saUJBQWlCLFFB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
