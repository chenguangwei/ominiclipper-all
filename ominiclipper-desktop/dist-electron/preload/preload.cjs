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
        deleteFile: (filePath) => ipcRenderer.invoke("file:deleteFile", filePath),
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
        calculateHash: (filePath) => ipcRenderer.invoke("fs:calculateHash", filePath),
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
        // File Move API (for moving files between folders)
        // ============================================
        fileAPI: {
          // Move a file from source path to target path
          moveFile: (sourcePath, targetPath) => ipcRenderer.invoke("file:moveFile", sourcePath, targetPath),
          // Delete a file by path
          deleteFile: (filePath) => ipcRenderer.invoke("file:deleteFile", filePath)
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlbG9hZC5janMiLCJzb3VyY2VzIjpbIi4uLy4uL2VsZWN0cm9uL3ByZWxvYWQvaW5kZXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBPbW5pQ29sbGVjdG9yIERlc2t0b3AgLSBFbGVjdHJvbiBQcmVsb2FkIFNjcmlwdFxuICovXG5cbmNvbnN0IHsgY29udGV4dEJyaWRnZSwgaXBjUmVuZGVyZXIgfSA9IHJlcXVpcmUoJ2VsZWN0cm9uJyk7XG5cbmNvbnNvbGUubG9nKCdbUHJlbG9hZF0gU2NyaXB0IHN0YXJ0aW5nLi4uJyk7XG5jb25zb2xlLmxvZygnW1ByZWxvYWRdIGNvbnRleHRCcmlkZ2U6JywgISFjb250ZXh0QnJpZGdlKTtcbmNvbnNvbGUubG9nKCdbUHJlbG9hZF0gaXBjUmVuZGVyZXI6JywgISFpcGNSZW5kZXJlcik7XG5cbi8vIEV4cG9zZSBwcm90ZWN0ZWQgbWV0aG9kcyB0aGF0IGFsbG93IHRoZSByZW5kZXJlciBwcm9jZXNzIHRvIHVzZVxuLy8gdGhlIGlwY1JlbmRlcmVyIHdpdGhvdXQgZXhwb3NpbmcgdGhlIGVudGlyZSBvYmplY3RcbnRyeSB7XG4gIGNvbnRleHRCcmlkZ2UuZXhwb3NlSW5NYWluV29ybGQoJ2VsZWN0cm9uQVBJJywge1xuICAgIC8vIEZpbGUgZGlhbG9nIGZvciBpbXBvcnRpbmcgZmlsZXNcbiAgICBzaG93T3BlbkRpYWxvZzogKG9wdGlvbnMpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZGlhbG9nOm9wZW5GaWxlJywgb3B0aW9ucyksXG5cbiAgICAvLyBTaG93IG5vdGlmaWNhdGlvblxuICAgIHNob3dOb3RpZmljYXRpb246ICh0aXRsZSwgYm9keSkgPT4ge1xuICAgICAgbmV3IE5vdGlmaWNhdGlvbih0aXRsZSwgeyBib2R5IH0pLnNob3coKTtcbiAgICB9LFxuXG4gICAgLy8gR2V0IHBsYXRmb3JtIGluZm9cbiAgICBwbGF0Zm9ybTogcHJvY2Vzcy5wbGF0Zm9ybSxcblxuICAgIC8vIEFwcCB2ZXJzaW9uXG4gICAgZ2V0VmVyc2lvbjogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdhcHA6Z2V0VmVyc2lvbicpLFxuXG4gICAgLy8gUGF0aHNcbiAgICBnZXRVc2VyRGF0YVBhdGg6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgncGF0aDpnZXRVc2VyRGF0YScpLFxuXG4gICAgLy8gRmlsZSBvcGVyYXRpb25zIChmb3IgYWN0dWFsIGZpbGUgbWFuYWdlbWVudClcbiAgICByZWFkRmlsZTogKGZpbGVQYXRoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2ZzOnJlYWRGaWxlJywgZmlsZVBhdGgpLFxuICAgIHJlYWRGaWxlQXNEYXRhVXJsOiAoZmlsZVBhdGgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZnM6cmVhZEZpbGVBc0RhdGFVcmwnLCBmaWxlUGF0aCksXG4gICAgZmlsZUV4aXN0czogKGZpbGVQYXRoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2ZzOmZpbGVFeGlzdHMnLCBmaWxlUGF0aCksXG4gICAgaXNEaXJlY3Rvcnk6IChmaWxlUGF0aCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdmczppc0RpcmVjdG9yeScsIGZpbGVQYXRoKSxcbiAgICBkZWxldGVGaWxlOiAoZmlsZVBhdGgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZmlsZTpkZWxldGVGaWxlJywgZmlsZVBhdGgpLFxuXG4gICAgLy8gU2hlbGwgb3BlcmF0aW9uc1xuICAgIG9wZW5QYXRoOiAoZmlsZVBhdGgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnc2hlbGw6b3BlblBhdGgnLCBmaWxlUGF0aCksXG4gICAgb3BlbkV4dGVybmFsOiAodXJsKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3NoZWxsOm9wZW5FeHRlcm5hbCcsIHVybCksXG4gICAgc2hvd0l0ZW1JbkZvbGRlcjogKGZpbGVQYXRoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3NoZWxsOnNob3dJdGVtSW5Gb2xkZXInLCBmaWxlUGF0aCksXG5cbiAgICAvLyBEaXJlY3Rvcnkgb3BlcmF0aW9uc1xuICAgIHNjYW5EaXJlY3Rvcnk6IChkaXJQYXRoLCBvcHRpb25zKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2ZzOnNjYW5EaXJlY3RvcnknLCBkaXJQYXRoLCBvcHRpb25zKSxcbiAgICBjb3B5RmlsZVRvU3RvcmFnZTogKHNvdXJjZVBhdGgsIHRhcmdldEZpbGVOYW1lKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2ZzOmNvcHlGaWxlVG9TdG9yYWdlJywgc291cmNlUGF0aCwgdGFyZ2V0RmlsZU5hbWUpLFxuICAgIHNlbGVjdERpcmVjdG9yeTogKHRpdGxlKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2RpYWxvZzpzZWxlY3REaXJlY3RvcnknLCB0aXRsZSksXG4gICAgc2F2ZUVtYmVkZGVkRmlsZTogKGJhc2U2NERhdGEsIGZpbGVOYW1lLCBpdGVtSWQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZnM6c2F2ZUVtYmVkZGVkRmlsZScsIGJhc2U2NERhdGEsIGZpbGVOYW1lLCBpdGVtSWQpLFxuICAgIGltcG9ydEZpbGVUb0lkU3RvcmFnZTogKHNvdXJjZVBhdGgsIGl0ZW1JZCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdmczppbXBvcnRGaWxlVG9JZFN0b3JhZ2UnLCBzb3VyY2VQYXRoLCBpdGVtSWQpLFxuICAgIGV4cG9ydEZpbGU6IChzb3VyY2VQYXRoLCB0YXJnZXREaXIsIHRhcmdldEZpbGVOYW1lKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2ZzOmV4cG9ydEZpbGUnLCBzb3VyY2VQYXRoLCB0YXJnZXREaXIsIHRhcmdldEZpbGVOYW1lKSxcbiAgICBjYWxjdWxhdGVIYXNoOiAoZmlsZVBhdGgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZnM6Y2FsY3VsYXRlSGFzaCcsIGZpbGVQYXRoKSxcblxuICAgIC8vIEJyb3dzZXIgZXh0ZW5zaW9uIHN5bmNcbiAgICBzeW5jRnJvbUJyb3dzZXJFeHRlbnNpb246IChpdGVtKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3N5bmM6YnJvd3NlckV4dGVuc2lvbicsIGl0ZW0pLFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBKU09OIEZpbGUgU3RvcmFnZSBBUElcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHN0b3JhZ2VBUEk6IHtcbiAgICAgIC8vIEdldCB0aGUgZGF0YSBkaXJlY3RvcnkgcGF0aFxuICAgICAgZ2V0RGF0YVBhdGg6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnc3RvcmFnZTpnZXREYXRhUGF0aCcpLFxuXG4gICAgICAvLyBMaWJyYXJ5IGRhdGEgKGl0ZW1zLCB0YWdzLCBmb2xkZXJzKVxuICAgICAgcmVhZExpYnJhcnk6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnc3RvcmFnZTpyZWFkTGlicmFyeScpLFxuICAgICAgd3JpdGVMaWJyYXJ5OiAoZGF0YSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdzdG9yYWdlOndyaXRlTGlicmFyeScsIGRhdGEpLFxuXG4gICAgICAvLyBTZXR0aW5ncyBkYXRhICh0aGVtZSwgbG9jYWxlLCBwcmVmZXJlbmNlcylcbiAgICAgIHJlYWRTZXR0aW5nczogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdzdG9yYWdlOnJlYWRTZXR0aW5ncycpLFxuICAgICAgd3JpdGVTZXR0aW5nczogKGRhdGEpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnc3RvcmFnZTp3cml0ZVNldHRpbmdzJywgZGF0YSksXG5cbiAgICAgIC8vIE1pZ3JhdGUgZnJvbSBsb2NhbFN0b3JhZ2UgdG8gSlNPTiBmaWxlc1xuICAgICAgbWlncmF0ZTogKGxlZ2FjeURhdGEpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnc3RvcmFnZTptaWdyYXRlJywgbGVnYWN5RGF0YSksXG4gICAgfSxcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gRmlsZSBTdG9yYWdlIEFQSSAoRWFnbGUtc3R5bGUgc3RydWN0dXJlKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgZmlsZVN0b3JhZ2VBUEk6IHtcbiAgICAgIC8vIEdldCB0aGUgZmlsZXMgc3RvcmFnZSBwYXRoXG4gICAgICBnZXRTdG9yYWdlUGF0aDogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdmaWxlU3RvcmFnZTpnZXRTdG9yYWdlUGF0aCcpLFxuXG4gICAgICAvLyBDcmVhdGUgaXRlbSBzdG9yYWdlIGRpcmVjdG9yeVxuICAgICAgY3JlYXRlSXRlbVN0b3JhZ2U6IChpdGVtSWQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZmlsZVN0b3JhZ2U6Y3JlYXRlSXRlbVN0b3JhZ2UnLCBpdGVtSWQpLFxuXG4gICAgICAvLyBTYXZlIGZpbGUgdG8gaXRlbSBzdG9yYWdlXG4gICAgICBzYXZlRmlsZVRvU3RvcmFnZTogKGl0ZW1JZCwgZmlsZU5hbWUsIGJhc2U2NERhdGEpID0+XG4gICAgICAgIGlwY1JlbmRlcmVyLmludm9rZSgnZmlsZVN0b3JhZ2U6c2F2ZUZpbGVUb1N0b3JhZ2UnLCBpdGVtSWQsIGZpbGVOYW1lLCBiYXNlNjREYXRhKSxcblxuICAgICAgLy8gUmVhZCBmaWxlIGZyb20gaXRlbSBzdG9yYWdlXG4gICAgICByZWFkRmlsZUZyb21TdG9yYWdlOiAoaXRlbUlkLCBmaWxlTmFtZSkgPT5cbiAgICAgICAgaXBjUmVuZGVyZXIuaW52b2tlKCdmaWxlU3RvcmFnZTpyZWFkRmlsZUZyb21TdG9yYWdlJywgaXRlbUlkLCBmaWxlTmFtZSksXG5cbiAgICAgIC8vIEdldCBmaWxlIHBhdGggaW4gc3RvcmFnZVxuICAgICAgZ2V0RmlsZVBhdGg6IChpdGVtSWQsIGZpbGVOYW1lKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2ZpbGVTdG9yYWdlOmdldEZpbGVQYXRoJywgaXRlbUlkLCBmaWxlTmFtZSksXG5cbiAgICAgIC8vIERlbGV0ZSBpdGVtIHN0b3JhZ2UgZGlyZWN0b3J5XG4gICAgICBkZWxldGVJdGVtU3RvcmFnZTogKGl0ZW1JZCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdmaWxlU3RvcmFnZTpkZWxldGVJdGVtU3RvcmFnZScsIGl0ZW1JZCksXG5cbiAgICAgIC8vIFNhdmUgaXRlbSBtZXRhZGF0YVxuICAgICAgc2F2ZUl0ZW1NZXRhZGF0YTogKGl0ZW1JZCwgbWV0YWRhdGEpID0+XG4gICAgICAgIGlwY1JlbmRlcmVyLmludm9rZSgnZmlsZVN0b3JhZ2U6c2F2ZUl0ZW1NZXRhZGF0YScsIGl0ZW1JZCwgbWV0YWRhdGEpLFxuXG4gICAgICAvLyBSZWFkIGl0ZW0gbWV0YWRhdGFcbiAgICAgIHJlYWRJdGVtTWV0YWRhdGE6IChpdGVtSWQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZmlsZVN0b3JhZ2U6cmVhZEl0ZW1NZXRhZGF0YScsIGl0ZW1JZCksXG5cbiAgICAgIC8vIE1vdmUgZmlsZSB0byBmb2xkZXIgZGlyZWN0b3J5IChmb3IgZm9sZGVyIG1pZ3JhdGlvbilcbiAgICAgIG1vdmVGaWxlVG9Gb2xkZXI6IChpdGVtSWQsIGZpbGVOYW1lLCBmb2xkZXJJZCkgPT5cbiAgICAgICAgaXBjUmVuZGVyZXIuaW52b2tlKCdmaWxlU3RvcmFnZTptb3ZlRmlsZVRvRm9sZGVyJywgaXRlbUlkLCBmaWxlTmFtZSwgZm9sZGVySWQpLFxuXG4gICAgICAvLyBTYXZlIHRodW1ibmFpbFxuICAgICAgc2F2ZVRodW1ibmFpbDogKGl0ZW1JZCwgZGF0YVVybCkgPT5cbiAgICAgICAgaXBjUmVuZGVyZXIuaW52b2tlKCdmaWxlU3RvcmFnZTpzYXZlVGh1bWJuYWlsJywgaXRlbUlkLCBkYXRhVXJsKSxcblxuICAgICAgLy8gUmVhZCB0aHVtYm5haWxcbiAgICAgIHJlYWRUaHVtYm5haWw6IChpdGVtSWQpID0+XG4gICAgICAgIGlwY1JlbmRlcmVyLmludm9rZSgnZmlsZVN0b3JhZ2U6cmVhZFRodW1ibmFpbCcsIGl0ZW1JZCksXG5cbiAgICAgIC8vIERlbGV0ZSB0aHVtYm5haWxcbiAgICAgIGRlbGV0ZVRodW1ibmFpbDogKGl0ZW1JZCkgPT5cbiAgICAgICAgaXBjUmVuZGVyZXIuaW52b2tlKCdmaWxlU3RvcmFnZTpkZWxldGVUaHVtYm5haWwnLCBpdGVtSWQpLFxuICAgIH0sXG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIE1UaW1lIFRyYWNraW5nIEFQSSAoRWFnbGUtc3R5bGUgbXRpbWUuanNvbilcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIG10aW1lQVBJOiB7XG4gICAgICAvLyBSZWFkIGFsbCBtdGltZSBkYXRhXG4gICAgICByZWFkTVRpbWU6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnbXRpbWU6cmVhZE1UaW1lJyksXG5cbiAgICAgIC8vIFVwZGF0ZSBtdGltZSBmb3IgYW4gaXRlbSAoc2V0cyB0byBjdXJyZW50IHRpbWUpXG4gICAgICB1cGRhdGVNVGltZTogKGl0ZW1JZCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdtdGltZTp1cGRhdGVNVGltZScsIGl0ZW1JZCksXG5cbiAgICAgIC8vIFNldCBtdGltZSBmb3IgYW4gaXRlbSB0byBhIHNwZWNpZmljIHRpbWVzdGFtcFxuICAgICAgc2V0TVRpbWU6IChpdGVtSWQsIHRpbWVzdGFtcCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdtdGltZTpzZXRNVGltZScsIGl0ZW1JZCwgdGltZXN0YW1wKSxcblxuICAgICAgLy8gUmVtb3ZlIG10aW1lIGVudHJ5XG4gICAgICByZW1vdmVNVGltZTogKGl0ZW1JZCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdtdGltZTpyZW1vdmVNVGltZScsIGl0ZW1JZCksXG5cbiAgICAgIC8vIEdldCBtdGltZSBmb3IgYSBzcGVjaWZpYyBpdGVtXG4gICAgICBnZXRNVGltZTogKGl0ZW1JZCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdtdGltZTpnZXRNVGltZScsIGl0ZW1JZCksXG5cbiAgICAgIC8vIEdldCBhbGwgbXRpbWUgZW50cmllc1xuICAgICAgZ2V0QWxsOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ210aW1lOmdldEFsbCcpLFxuXG4gICAgICAvLyBHZXQgaXRlbSBjb3VudFxuICAgICAgZ2V0Q291bnQ6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnbXRpbWU6Z2V0Q291bnQnKSxcbiAgICB9LFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBCYWNrdXAgQVBJIChFYWdsZS1zdHlsZSBiYWNrdXAgc3lzdGVtKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgYmFja3VwQVBJOiB7XG4gICAgICAvLyBDcmVhdGUgYSBiYWNrdXBcbiAgICAgIGNyZWF0ZUJhY2t1cDogKGRhdGEpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnYmFja3VwOmNyZWF0ZUJhY2t1cCcsIGRhdGEpLFxuXG4gICAgICAvLyBMaXN0IGFsbCBiYWNrdXBzXG4gICAgICBsaXN0QmFja3VwczogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdiYWNrdXA6bGlzdEJhY2t1cHMnKSxcblxuICAgICAgLy8gUmVzdG9yZSBmcm9tIGEgYmFja3VwXG4gICAgICByZXN0b3JlQmFja3VwOiAoYmFja3VwUGF0aCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdiYWNrdXA6cmVzdG9yZUJhY2t1cCcsIGJhY2t1cFBhdGgpLFxuXG4gICAgICAvLyBEZWxldGUgYSBzcGVjaWZpYyBiYWNrdXBcbiAgICAgIGRlbGV0ZUJhY2t1cDogKGJhY2t1cFBhdGgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnYmFja3VwOmRlbGV0ZUJhY2t1cCcsIGJhY2t1cFBhdGgpLFxuXG4gICAgICAvLyBDbGVhbiB1cCBvbGQgYmFja3Vwc1xuICAgICAgY2xlYW51cE9sZEJhY2t1cHM6IChrZWVwQ291bnQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnYmFja3VwOmNsZWFudXBPbGRCYWNrdXBzJywga2VlcENvdW50KSxcblxuICAgICAgLy8gR2V0IGJhY2t1cCBkaXJlY3RvcnkgcGF0aFxuICAgICAgZ2V0QmFja3VwUGF0aDogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdiYWNrdXA6Z2V0QmFja3VwUGF0aCcpLFxuICAgIH0sXG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEZpbGUgTW92ZSBBUEkgKGZvciBtb3ZpbmcgZmlsZXMgYmV0d2VlbiBmb2xkZXJzKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgZmlsZUFQSToge1xuICAgICAgLy8gTW92ZSBhIGZpbGUgZnJvbSBzb3VyY2UgcGF0aCB0byB0YXJnZXQgcGF0aFxuICAgICAgbW92ZUZpbGU6IChzb3VyY2VQYXRoLCB0YXJnZXRQYXRoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2ZpbGU6bW92ZUZpbGUnLCBzb3VyY2VQYXRoLCB0YXJnZXRQYXRoKSxcblxuICAgICAgLy8gRGVsZXRlIGEgZmlsZSBieSBwYXRoXG4gICAgICBkZWxldGVGaWxlOiAoZmlsZVBhdGgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZmlsZTpkZWxldGVGaWxlJywgZmlsZVBhdGgpLFxuICAgIH0sXG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFZlY3RvciBTdG9yZSBBUEkgKFNlbWFudGljIFNlYXJjaClcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHZlY3RvckFQSToge1xuICAgICAgLy8gSW5pdGlhbGl6ZSB2ZWN0b3Igc3RvcmUgKGxvYWQgbW9kZWwgYW5kIGNvbm5lY3QgdG8gZGF0YWJhc2UpXG4gICAgICBpbml0aWFsaXplOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3ZlY3Rvcjppbml0aWFsaXplJyksXG5cbiAgICAgIC8vIEluZGV4IGEgZG9jdW1lbnQgZm9yIHNlbWFudGljIHNlYXJjaFxuICAgICAgaW5kZXg6IChpZCwgdGV4dCwgbWV0YWRhdGEpID0+IGlwY1JlbmRlcmVyLmludm9rZSgndmVjdG9yOmluZGV4JywgeyBpZCwgdGV4dCwgbWV0YWRhdGEgfSksXG5cbiAgICAgIC8vIFNlYXJjaCBmb3Igc2ltaWxhciBkb2N1bWVudHNcbiAgICAgIHNlYXJjaDogKHF1ZXJ5LCBsaW1pdCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCd2ZWN0b3I6c2VhcmNoJywgeyBxdWVyeSwgbGltaXQgfSksXG5cbiAgICAgIC8vIERlbGV0ZSBhIGRvY3VtZW50IGZyb20gdGhlIGluZGV4XG4gICAgICBkZWxldGU6IChpZCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCd2ZWN0b3I6ZGVsZXRlJywgeyBpZCB9KSxcblxuICAgICAgLy8gR2V0IHZlY3RvciBzdG9yZSBzdGF0aXN0aWNzXG4gICAgICBnZXRTdGF0czogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCd2ZWN0b3I6Z2V0U3RhdHMnKSxcbiAgICB9LFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBTZWFyY2ggSW5kZXggQVBJIChCTTI1IEZ1bGwtVGV4dCBTZWFyY2gpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBzZWFyY2hBUEk6IHtcbiAgICAgIC8vIEluZGV4IGEgZG9jdW1lbnQgZm9yIGZ1bGwtdGV4dCBzZWFyY2hcbiAgICAgIGluZGV4OiAoaWQsIHRleHQsIG1ldGFkYXRhKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3NlYXJjaDppbmRleCcsIHsgaWQsIHRleHQsIG1ldGFkYXRhIH0pLFxuXG4gICAgICAvLyBEZWxldGUgYSBkb2N1bWVudCBmcm9tIHRoZSBpbmRleFxuICAgICAgZGVsZXRlOiAoaWQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnc2VhcmNoOmRlbGV0ZScsIHsgaWQgfSksXG5cbiAgICAgIC8vIEJNMjUgZnVsbC10ZXh0IHNlYXJjaFxuICAgICAgYm0yNVNlYXJjaDogKHF1ZXJ5LCBsaW1pdCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdzZWFyY2g6Ym0yNScsIHsgcXVlcnksIGxpbWl0IH0pLFxuXG4gICAgICAvLyBIeWJyaWQgc2VhcmNoIChWZWN0b3IgKyBCTTI1IHdpdGggUlJGKVxuICAgICAgaHlicmlkU2VhcmNoOiAocXVlcnksIGxpbWl0LCB2ZWN0b3JXZWlnaHQsIGJtMjVXZWlnaHQsIGdyb3VwQnlEb2MpID0+XG4gICAgICAgIGlwY1JlbmRlcmVyLmludm9rZSgnc2VhcmNoOmh5YnJpZCcsIHsgcXVlcnksIGxpbWl0LCB2ZWN0b3JXZWlnaHQsIGJtMjVXZWlnaHQsIGdyb3VwQnlEb2MgfSksXG5cbiAgICAgIC8vIEdldCBzZWFyY2ggaW5kZXggc3RhdGlzdGljc1xuICAgICAgZ2V0U3RhdHM6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnc2VhcmNoOmdldFN0YXRzJyksXG4gICAgfSxcbiAgfSk7XG59IGNhdGNoIChlcnJvcikge1xuICBjb25zb2xlLmVycm9yKCdbUHJlbG9hZF0gRmFpbGVkIHRvIGV4cG9zZSBlbGVjdHJvbkFQSTonLCBlcnJvcik7XG59XG5cbi8vIEhhbmRsZSBkaWFsb2cgbWVzc2FnZXMgZnJvbSBtYWluIHByb2Nlc3NcbmlwY1JlbmRlcmVyLm9uKCdkaWFsb2c6bWVzc2FnZScsIChldmVudCwgbWVzc2FnZSkgPT4ge1xuICBjb25zb2xlLmxvZygnRGlhbG9nIG1lc3NhZ2U6JywgbWVzc2FnZSk7XG59KTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7O0FBSUE7QUFBQTtBQUFBLFVBQU0sRUFBRSxlQUFlLGdCQUFnQixRQUFRLFVBQVU7QUFFekQsWUFBUSxJQUFJ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
