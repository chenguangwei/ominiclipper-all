/**
 * OmniClipper Desktop - Electron Preload Script
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
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
  selectDirectory: (title) => ipcRenderer.invoke('dialog:selectDirectory', title),

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
});

// Handle dialog messages from main process
ipcRenderer.on('dialog:message', (event, message) => {
  console.log('Dialog message:', message);
});
