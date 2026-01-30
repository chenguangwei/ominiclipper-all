var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var require_preload = __commonJS({
  "preload.cjs"() {
    const { contextBridge, ipcRenderer, webUtils } = require("electron");
    console.log("[Preload] Script starting...");
    console.log("[Preload] contextBridge:", !!contextBridge);
    console.log("[Preload] ipcRenderer:", !!ipcRenderer);
    console.log("[Preload] webUtils:", !!webUtils);
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
        // Get file path from File object (for drag-drop with contextIsolation)
        getPathForFile: (file) => webUtils ? webUtils.getPathForFile(file) : null,
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
        ensureItemDirectory: (itemId) => ipcRenderer.invoke("fs:ensureItemDirectory", itemId),
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

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlbG9hZC5janMiLCJzb3VyY2VzIjpbIi4uLy4uL2VsZWN0cm9uL3ByZWxvYWQvaW5kZXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBPbW5pQ29sbGVjdG9yIERlc2t0b3AgLSBFbGVjdHJvbiBQcmVsb2FkIFNjcmlwdFxuICovXG5cbmNvbnN0IHsgY29udGV4dEJyaWRnZSwgaXBjUmVuZGVyZXIsIHdlYlV0aWxzIH0gPSByZXF1aXJlKCdlbGVjdHJvbicpO1xuXG5jb25zb2xlLmxvZygnW1ByZWxvYWRdIFNjcmlwdCBzdGFydGluZy4uLicpO1xuY29uc29sZS5sb2coJ1tQcmVsb2FkXSBjb250ZXh0QnJpZGdlOicsICEhY29udGV4dEJyaWRnZSk7XG5jb25zb2xlLmxvZygnW1ByZWxvYWRdIGlwY1JlbmRlcmVyOicsICEhaXBjUmVuZGVyZXIpO1xuY29uc29sZS5sb2coJ1tQcmVsb2FkXSB3ZWJVdGlsczonLCAhIXdlYlV0aWxzKTtcblxuLy8gRXhwb3NlIHByb3RlY3RlZCBtZXRob2RzIHRoYXQgYWxsb3cgdGhlIHJlbmRlcmVyIHByb2Nlc3MgdG8gdXNlXG4vLyB0aGUgaXBjUmVuZGVyZXIgd2l0aG91dCBleHBvc2luZyB0aGUgZW50aXJlIG9iamVjdFxudHJ5IHtcbiAgY29udGV4dEJyaWRnZS5leHBvc2VJbk1haW5Xb3JsZCgnZWxlY3Ryb25BUEknLCB7XG4gICAgLy8gRmlsZSBkaWFsb2cgZm9yIGltcG9ydGluZyBmaWxlc1xuICAgIHNob3dPcGVuRGlhbG9nOiAob3B0aW9ucykgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdkaWFsb2c6b3BlbkZpbGUnLCBvcHRpb25zKSxcblxuICAgIC8vIFNob3cgbm90aWZpY2F0aW9uXG4gICAgc2hvd05vdGlmaWNhdGlvbjogKHRpdGxlLCBib2R5KSA9PiB7XG4gICAgICBuZXcgTm90aWZpY2F0aW9uKHRpdGxlLCB7IGJvZHkgfSkuc2hvdygpO1xuICAgIH0sXG5cbiAgICAvLyBHZXQgcGxhdGZvcm0gaW5mb1xuICAgIHBsYXRmb3JtOiBwcm9jZXNzLnBsYXRmb3JtLFxuXG4gICAgLy8gQXBwIHZlcnNpb25cbiAgICBnZXRWZXJzaW9uOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2FwcDpnZXRWZXJzaW9uJyksXG5cbiAgICAvLyBQYXRoc1xuICAgIGdldFVzZXJEYXRhUGF0aDogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdwYXRoOmdldFVzZXJEYXRhJyksXG5cbiAgICAvLyBGaWxlIG9wZXJhdGlvbnMgKGZvciBhY3R1YWwgZmlsZSBtYW5hZ2VtZW50KVxuICAgIHJlYWRGaWxlOiAoZmlsZVBhdGgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZnM6cmVhZEZpbGUnLCBmaWxlUGF0aCksXG4gICAgcmVhZEZpbGVBc0RhdGFVcmw6IChmaWxlUGF0aCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdmczpyZWFkRmlsZUFzRGF0YVVybCcsIGZpbGVQYXRoKSxcbiAgICBmaWxlRXhpc3RzOiAoZmlsZVBhdGgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZnM6ZmlsZUV4aXN0cycsIGZpbGVQYXRoKSxcbiAgICBpc0RpcmVjdG9yeTogKGZpbGVQYXRoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2ZzOmlzRGlyZWN0b3J5JywgZmlsZVBhdGgpLFxuICAgIGRlbGV0ZUZpbGU6IChmaWxlUGF0aCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdmaWxlOmRlbGV0ZUZpbGUnLCBmaWxlUGF0aCksXG5cbiAgICAvLyBHZXQgZmlsZSBwYXRoIGZyb20gRmlsZSBvYmplY3QgKGZvciBkcmFnLWRyb3Agd2l0aCBjb250ZXh0SXNvbGF0aW9uKVxuICAgIGdldFBhdGhGb3JGaWxlOiAoZmlsZSkgPT4gd2ViVXRpbHMgPyB3ZWJVdGlscy5nZXRQYXRoRm9yRmlsZShmaWxlKSA6IG51bGwsXG5cbiAgICAvLyBTaGVsbCBvcGVyYXRpb25zXG4gICAgb3BlblBhdGg6IChmaWxlUGF0aCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdzaGVsbDpvcGVuUGF0aCcsIGZpbGVQYXRoKSxcbiAgICBvcGVuRXh0ZXJuYWw6ICh1cmwpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnc2hlbGw6b3BlbkV4dGVybmFsJywgdXJsKSxcbiAgICBzaG93SXRlbUluRm9sZGVyOiAoZmlsZVBhdGgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnc2hlbGw6c2hvd0l0ZW1JbkZvbGRlcicsIGZpbGVQYXRoKSxcblxuICAgIC8vIERpcmVjdG9yeSBvcGVyYXRpb25zXG4gICAgc2NhbkRpcmVjdG9yeTogKGRpclBhdGgsIG9wdGlvbnMpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZnM6c2NhbkRpcmVjdG9yeScsIGRpclBhdGgsIG9wdGlvbnMpLFxuICAgIGNvcHlGaWxlVG9TdG9yYWdlOiAoc291cmNlUGF0aCwgdGFyZ2V0RmlsZU5hbWUpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZnM6Y29weUZpbGVUb1N0b3JhZ2UnLCBzb3VyY2VQYXRoLCB0YXJnZXRGaWxlTmFtZSksXG4gICAgc2VsZWN0RGlyZWN0b3J5OiAodGl0bGUpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZGlhbG9nOnNlbGVjdERpcmVjdG9yeScsIHRpdGxlKSxcbiAgICBzYXZlRW1iZWRkZWRGaWxlOiAoYmFzZTY0RGF0YSwgZmlsZU5hbWUsIGl0ZW1JZCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdmczpzYXZlRW1iZWRkZWRGaWxlJywgYmFzZTY0RGF0YSwgZmlsZU5hbWUsIGl0ZW1JZCksXG4gICAgaW1wb3J0RmlsZVRvSWRTdG9yYWdlOiAoc291cmNlUGF0aCwgaXRlbUlkKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2ZzOmltcG9ydEZpbGVUb0lkU3RvcmFnZScsIHNvdXJjZVBhdGgsIGl0ZW1JZCksXG4gICAgZW5zdXJlSXRlbURpcmVjdG9yeTogKGl0ZW1JZCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdmczplbnN1cmVJdGVtRGlyZWN0b3J5JywgaXRlbUlkKSxcbiAgICBleHBvcnRGaWxlOiAoc291cmNlUGF0aCwgdGFyZ2V0RGlyLCB0YXJnZXRGaWxlTmFtZSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdmczpleHBvcnRGaWxlJywgc291cmNlUGF0aCwgdGFyZ2V0RGlyLCB0YXJnZXRGaWxlTmFtZSksXG4gICAgY2FsY3VsYXRlSGFzaDogKGZpbGVQYXRoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2ZzOmNhbGN1bGF0ZUhhc2gnLCBmaWxlUGF0aCksXG5cbiAgICAvLyBCcm93c2VyIGV4dGVuc2lvbiBzeW5jXG4gICAgc3luY0Zyb21Ccm93c2VyRXh0ZW5zaW9uOiAoaXRlbSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdzeW5jOmJyb3dzZXJFeHRlbnNpb24nLCBpdGVtKSxcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gSlNPTiBGaWxlIFN0b3JhZ2UgQVBJXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBzdG9yYWdlQVBJOiB7XG4gICAgICAvLyBHZXQgdGhlIGRhdGEgZGlyZWN0b3J5IHBhdGhcbiAgICAgIGdldERhdGFQYXRoOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3N0b3JhZ2U6Z2V0RGF0YVBhdGgnKSxcblxuICAgICAgLy8gTGlicmFyeSBkYXRhIChpdGVtcywgdGFncywgZm9sZGVycylcbiAgICAgIHJlYWRMaWJyYXJ5OiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3N0b3JhZ2U6cmVhZExpYnJhcnknKSxcbiAgICAgIHdyaXRlTGlicmFyeTogKGRhdGEpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnc3RvcmFnZTp3cml0ZUxpYnJhcnknLCBkYXRhKSxcblxuICAgICAgLy8gU2V0dGluZ3MgZGF0YSAodGhlbWUsIGxvY2FsZSwgcHJlZmVyZW5jZXMpXG4gICAgICByZWFkU2V0dGluZ3M6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnc3RvcmFnZTpyZWFkU2V0dGluZ3MnKSxcbiAgICAgIHdyaXRlU2V0dGluZ3M6IChkYXRhKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3N0b3JhZ2U6d3JpdGVTZXR0aW5ncycsIGRhdGEpLFxuXG4gICAgICAvLyBNaWdyYXRlIGZyb20gbG9jYWxTdG9yYWdlIHRvIEpTT04gZmlsZXNcbiAgICAgIG1pZ3JhdGU6IChsZWdhY3lEYXRhKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3N0b3JhZ2U6bWlncmF0ZScsIGxlZ2FjeURhdGEpLFxuICAgIH0sXG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIEZpbGUgU3RvcmFnZSBBUEkgKEVhZ2xlLXN0eWxlIHN0cnVjdHVyZSlcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGZpbGVTdG9yYWdlQVBJOiB7XG4gICAgICAvLyBHZXQgdGhlIGZpbGVzIHN0b3JhZ2UgcGF0aFxuICAgICAgZ2V0U3RvcmFnZVBhdGg6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZmlsZVN0b3JhZ2U6Z2V0U3RvcmFnZVBhdGgnKSxcblxuICAgICAgLy8gQ3JlYXRlIGl0ZW0gc3RvcmFnZSBkaXJlY3RvcnlcbiAgICAgIGNyZWF0ZUl0ZW1TdG9yYWdlOiAoaXRlbUlkKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2ZpbGVTdG9yYWdlOmNyZWF0ZUl0ZW1TdG9yYWdlJywgaXRlbUlkKSxcblxuICAgICAgLy8gU2F2ZSBmaWxlIHRvIGl0ZW0gc3RvcmFnZVxuICAgICAgc2F2ZUZpbGVUb1N0b3JhZ2U6IChpdGVtSWQsIGZpbGVOYW1lLCBiYXNlNjREYXRhKSA9PlxuICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoJ2ZpbGVTdG9yYWdlOnNhdmVGaWxlVG9TdG9yYWdlJywgaXRlbUlkLCBmaWxlTmFtZSwgYmFzZTY0RGF0YSksXG5cbiAgICAgIC8vIFJlYWQgZmlsZSBmcm9tIGl0ZW0gc3RvcmFnZVxuICAgICAgcmVhZEZpbGVGcm9tU3RvcmFnZTogKGl0ZW1JZCwgZmlsZU5hbWUpID0+XG4gICAgICAgIGlwY1JlbmRlcmVyLmludm9rZSgnZmlsZVN0b3JhZ2U6cmVhZEZpbGVGcm9tU3RvcmFnZScsIGl0ZW1JZCwgZmlsZU5hbWUpLFxuXG4gICAgICAvLyBHZXQgZmlsZSBwYXRoIGluIHN0b3JhZ2VcbiAgICAgIGdldEZpbGVQYXRoOiAoaXRlbUlkLCBmaWxlTmFtZSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdmaWxlU3RvcmFnZTpnZXRGaWxlUGF0aCcsIGl0ZW1JZCwgZmlsZU5hbWUpLFxuXG4gICAgICAvLyBEZWxldGUgaXRlbSBzdG9yYWdlIGRpcmVjdG9yeVxuICAgICAgZGVsZXRlSXRlbVN0b3JhZ2U6IChpdGVtSWQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZmlsZVN0b3JhZ2U6ZGVsZXRlSXRlbVN0b3JhZ2UnLCBpdGVtSWQpLFxuXG4gICAgICAvLyBTYXZlIGl0ZW0gbWV0YWRhdGFcbiAgICAgIHNhdmVJdGVtTWV0YWRhdGE6IChpdGVtSWQsIG1ldGFkYXRhKSA9PlxuICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoJ2ZpbGVTdG9yYWdlOnNhdmVJdGVtTWV0YWRhdGEnLCBpdGVtSWQsIG1ldGFkYXRhKSxcblxuICAgICAgLy8gUmVhZCBpdGVtIG1ldGFkYXRhXG4gICAgICByZWFkSXRlbU1ldGFkYXRhOiAoaXRlbUlkKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2ZpbGVTdG9yYWdlOnJlYWRJdGVtTWV0YWRhdGEnLCBpdGVtSWQpLFxuXG4gICAgICAvLyBNb3ZlIGZpbGUgdG8gZm9sZGVyIGRpcmVjdG9yeSAoZm9yIGZvbGRlciBtaWdyYXRpb24pXG4gICAgICBtb3ZlRmlsZVRvRm9sZGVyOiAoaXRlbUlkLCBmaWxlTmFtZSwgZm9sZGVySWQpID0+XG4gICAgICAgIGlwY1JlbmRlcmVyLmludm9rZSgnZmlsZVN0b3JhZ2U6bW92ZUZpbGVUb0ZvbGRlcicsIGl0ZW1JZCwgZmlsZU5hbWUsIGZvbGRlcklkKSxcblxuICAgICAgLy8gU2F2ZSB0aHVtYm5haWxcbiAgICAgIHNhdmVUaHVtYm5haWw6IChpdGVtSWQsIGRhdGFVcmwpID0+XG4gICAgICAgIGlwY1JlbmRlcmVyLmludm9rZSgnZmlsZVN0b3JhZ2U6c2F2ZVRodW1ibmFpbCcsIGl0ZW1JZCwgZGF0YVVybCksXG5cbiAgICAgIC8vIFJlYWQgdGh1bWJuYWlsXG4gICAgICByZWFkVGh1bWJuYWlsOiAoaXRlbUlkKSA9PlxuICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoJ2ZpbGVTdG9yYWdlOnJlYWRUaHVtYm5haWwnLCBpdGVtSWQpLFxuXG4gICAgICAvLyBEZWxldGUgdGh1bWJuYWlsXG4gICAgICBkZWxldGVUaHVtYm5haWw6IChpdGVtSWQpID0+XG4gICAgICAgIGlwY1JlbmRlcmVyLmludm9rZSgnZmlsZVN0b3JhZ2U6ZGVsZXRlVGh1bWJuYWlsJywgaXRlbUlkKSxcbiAgICB9LFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBNVGltZSBUcmFja2luZyBBUEkgKEVhZ2xlLXN0eWxlIG10aW1lLmpzb24pXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBtdGltZUFQSToge1xuICAgICAgLy8gUmVhZCBhbGwgbXRpbWUgZGF0YVxuICAgICAgcmVhZE1UaW1lOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ210aW1lOnJlYWRNVGltZScpLFxuXG4gICAgICAvLyBVcGRhdGUgbXRpbWUgZm9yIGFuIGl0ZW0gKHNldHMgdG8gY3VycmVudCB0aW1lKVxuICAgICAgdXBkYXRlTVRpbWU6IChpdGVtSWQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnbXRpbWU6dXBkYXRlTVRpbWUnLCBpdGVtSWQpLFxuXG4gICAgICAvLyBTZXQgbXRpbWUgZm9yIGFuIGl0ZW0gdG8gYSBzcGVjaWZpYyB0aW1lc3RhbXBcbiAgICAgIHNldE1UaW1lOiAoaXRlbUlkLCB0aW1lc3RhbXApID0+IGlwY1JlbmRlcmVyLmludm9rZSgnbXRpbWU6c2V0TVRpbWUnLCBpdGVtSWQsIHRpbWVzdGFtcCksXG5cbiAgICAgIC8vIFJlbW92ZSBtdGltZSBlbnRyeVxuICAgICAgcmVtb3ZlTVRpbWU6IChpdGVtSWQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnbXRpbWU6cmVtb3ZlTVRpbWUnLCBpdGVtSWQpLFxuXG4gICAgICAvLyBHZXQgbXRpbWUgZm9yIGEgc3BlY2lmaWMgaXRlbVxuICAgICAgZ2V0TVRpbWU6IChpdGVtSWQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnbXRpbWU6Z2V0TVRpbWUnLCBpdGVtSWQpLFxuXG4gICAgICAvLyBHZXQgYWxsIG10aW1lIGVudHJpZXNcbiAgICAgIGdldEFsbDogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdtdGltZTpnZXRBbGwnKSxcblxuICAgICAgLy8gR2V0IGl0ZW0gY291bnRcbiAgICAgIGdldENvdW50OiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ210aW1lOmdldENvdW50JyksXG4gICAgfSxcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQmFja3VwIEFQSSAoRWFnbGUtc3R5bGUgYmFja3VwIHN5c3RlbSlcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGJhY2t1cEFQSToge1xuICAgICAgLy8gQ3JlYXRlIGEgYmFja3VwXG4gICAgICBjcmVhdGVCYWNrdXA6IChkYXRhKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2JhY2t1cDpjcmVhdGVCYWNrdXAnLCBkYXRhKSxcblxuICAgICAgLy8gTGlzdCBhbGwgYmFja3Vwc1xuICAgICAgbGlzdEJhY2t1cHM6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnYmFja3VwOmxpc3RCYWNrdXBzJyksXG5cbiAgICAgIC8vIFJlc3RvcmUgZnJvbSBhIGJhY2t1cFxuICAgICAgcmVzdG9yZUJhY2t1cDogKGJhY2t1cFBhdGgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnYmFja3VwOnJlc3RvcmVCYWNrdXAnLCBiYWNrdXBQYXRoKSxcblxuICAgICAgLy8gRGVsZXRlIGEgc3BlY2lmaWMgYmFja3VwXG4gICAgICBkZWxldGVCYWNrdXA6IChiYWNrdXBQYXRoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2JhY2t1cDpkZWxldGVCYWNrdXAnLCBiYWNrdXBQYXRoKSxcblxuICAgICAgLy8gQ2xlYW4gdXAgb2xkIGJhY2t1cHNcbiAgICAgIGNsZWFudXBPbGRCYWNrdXBzOiAoa2VlcENvdW50KSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2JhY2t1cDpjbGVhbnVwT2xkQmFja3VwcycsIGtlZXBDb3VudCksXG5cbiAgICAgIC8vIEdldCBiYWNrdXAgZGlyZWN0b3J5IHBhdGhcbiAgICAgIGdldEJhY2t1cFBhdGg6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnYmFja3VwOmdldEJhY2t1cFBhdGgnKSxcbiAgICB9LFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBGaWxlIE1vdmUgQVBJIChmb3IgbW92aW5nIGZpbGVzIGJldHdlZW4gZm9sZGVycylcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGZpbGVBUEk6IHtcbiAgICAgIC8vIE1vdmUgYSBmaWxlIGZyb20gc291cmNlIHBhdGggdG8gdGFyZ2V0IHBhdGhcbiAgICAgIG1vdmVGaWxlOiAoc291cmNlUGF0aCwgdGFyZ2V0UGF0aCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdmaWxlOm1vdmVGaWxlJywgc291cmNlUGF0aCwgdGFyZ2V0UGF0aCksXG5cbiAgICAgIC8vIERlbGV0ZSBhIGZpbGUgYnkgcGF0aFxuICAgICAgZGVsZXRlRmlsZTogKGZpbGVQYXRoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2ZpbGU6ZGVsZXRlRmlsZScsIGZpbGVQYXRoKSxcbiAgICB9LFxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBWZWN0b3IgU3RvcmUgQVBJIChTZW1hbnRpYyBTZWFyY2gpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICB2ZWN0b3JBUEk6IHtcbiAgICAgIC8vIEluaXRpYWxpemUgdmVjdG9yIHN0b3JlIChsb2FkIG1vZGVsIGFuZCBjb25uZWN0IHRvIGRhdGFiYXNlKVxuICAgICAgaW5pdGlhbGl6ZTogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCd2ZWN0b3I6aW5pdGlhbGl6ZScpLFxuXG4gICAgICAvLyBJbmRleCBhIGRvY3VtZW50IGZvciBzZW1hbnRpYyBzZWFyY2hcbiAgICAgIGluZGV4OiAoaWQsIHRleHQsIG1ldGFkYXRhKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3ZlY3RvcjppbmRleCcsIHsgaWQsIHRleHQsIG1ldGFkYXRhIH0pLFxuXG4gICAgICAvLyBTZWFyY2ggZm9yIHNpbWlsYXIgZG9jdW1lbnRzXG4gICAgICBzZWFyY2g6IChxdWVyeSwgbGltaXQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgndmVjdG9yOnNlYXJjaCcsIHsgcXVlcnksIGxpbWl0IH0pLFxuXG4gICAgICAvLyBEZWxldGUgYSBkb2N1bWVudCBmcm9tIHRoZSBpbmRleFxuICAgICAgZGVsZXRlOiAoaWQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgndmVjdG9yOmRlbGV0ZScsIHsgaWQgfSksXG5cbiAgICAgIC8vIEdldCB2ZWN0b3Igc3RvcmUgc3RhdGlzdGljc1xuICAgICAgZ2V0U3RhdHM6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgndmVjdG9yOmdldFN0YXRzJyksXG4gICAgfSxcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gU2VhcmNoIEluZGV4IEFQSSAoQk0yNSBGdWxsLVRleHQgU2VhcmNoKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgc2VhcmNoQVBJOiB7XG4gICAgICAvLyBJbmRleCBhIGRvY3VtZW50IGZvciBmdWxsLXRleHQgc2VhcmNoXG4gICAgICBpbmRleDogKGlkLCB0ZXh0LCBtZXRhZGF0YSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdzZWFyY2g6aW5kZXgnLCB7IGlkLCB0ZXh0LCBtZXRhZGF0YSB9KSxcblxuICAgICAgLy8gRGVsZXRlIGEgZG9jdW1lbnQgZnJvbSB0aGUgaW5kZXhcbiAgICAgIGRlbGV0ZTogKGlkKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3NlYXJjaDpkZWxldGUnLCB7IGlkIH0pLFxuXG4gICAgICAvLyBCTTI1IGZ1bGwtdGV4dCBzZWFyY2hcbiAgICAgIGJtMjVTZWFyY2g6IChxdWVyeSwgbGltaXQpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnc2VhcmNoOmJtMjUnLCB7IHF1ZXJ5LCBsaW1pdCB9KSxcblxuICAgICAgLy8gSHlicmlkIHNlYXJjaCAoVmVjdG9yICsgQk0yNSB3aXRoIFJSRilcbiAgICAgIGh5YnJpZFNlYXJjaDogKHF1ZXJ5LCBsaW1pdCwgdmVjdG9yV2VpZ2h0LCBibTI1V2VpZ2h0LCBncm91cEJ5RG9jKSA9PlxuICAgICAgICBpcGNSZW5kZXJlci5pbnZva2UoJ3NlYXJjaDpoeWJyaWQnLCB7IHF1ZXJ5LCBsaW1pdCwgdmVjdG9yV2VpZ2h0LCBibTI1V2VpZ2h0LCBncm91cEJ5RG9jIH0pLFxuXG4gICAgICAvLyBHZXQgc2VhcmNoIGluZGV4IHN0YXRpc3RpY3NcbiAgICAgIGdldFN0YXRzOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3NlYXJjaDpnZXRTdGF0cycpLFxuICAgIH0sXG4gIH0pO1xufSBjYXRjaCAoZXJyb3IpIHtcbiAgY29uc29sZS5lcnJvcignW1ByZWxvYWRdIEZhaWxlZCB0byBleHBvc2UgZWxlY3Ryb25BUEk6JywgZXJyb3IpO1xufVxuXG4vLyBIYW5kbGUgZGlhbG9nIG1lc3NhZ2VzIGZyb20gbWFpbiBwcm9jZXNzXG5pcGNSZW5kZXJlci5vbignZGlhbG9nOm1lc3NhZ2UnLCAoZXZlbnQsIG1lc3NhZ2UpID0+IHtcbiAgY29uc29sZS5sb2coJ0RpYWxvZyBtZXNzYWdlOicsIG1lc3NhZ2UpO1xufSk7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7OztBQUlBO0FBQUE7QUFBQSxVQUFNLEVBQUUsZUFBZSxhQUFhLFNBQUEsSUFBYSxRQUFRLFVBQVU7QUFFbkUsWUFBUSxJQUFJLDhCQUE4QjtBQUMxQyxZQUFRLElBQUksNEJBQTRCLENBQUMsQ0FBQyxhQUFhO0FBQ3ZELFlBQVEsSUFBSSwwQkFBMEIsQ0FBQyxDQUFDLFdBQVc7QUFDbkQsWUFBUSxJQUFJLHVCQUF1QixDQUFDLENBQUMsUUFBUTtBQUk3QyxRQUFJO0FBQ0Ysb0JBQWMsa0JBQWtCLGVBQWU7QUFBQTtBQUFBLFFBRTdDLGdCQUFnQixDQUFDLFlBQVksWUFBWSxPQUFPLG1CQUFtQixPQUFPO0FBQUE7QUFBQSxRQUcxRSxrQkFBa0IsQ0FBQyxPQUFPLFNBQVM7QUFDakMsY0FBSSxhQUFhLE9BQU8sRUFBRSxLQUFBLENBQU0sRUFBRSxLQUFBO0FBQUEsUUFDcEM7QUFBQTtBQUFBLFFBR0EsVUFBVSxRQUFRO0FBQUE7QUFBQSxRQUdsQixZQUFZLE1BQU0sWUFBWSxPQUFPLGdCQUFnQjtBQUFBO0FBQUEsUUFHckQsaUJBQWlCLE1BQU0sWUFBWSxPQUFPLGtCQUFrQjtBQUFBO0FBQUEsUUFHNUQsVUFBVSxDQUFDLGFBQWEsWUFBWSxPQUFPLGVBQWUsUUFBUTtBQUFBLFFBQ2xFLG1CQUFtQixDQUFDLGFBQWEsWUFBWSxPQUFPLHdCQUF3QixRQUFRO0FBQUEsUUFDcEYsWUFBWSxDQUFDLGFBQWEsWUFBWSxPQUFPLGlCQUFpQixRQUFRO0FBQUEsUUFDdEUsYUFB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
