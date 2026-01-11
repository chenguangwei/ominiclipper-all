const { contextBridge, ipcRenderer } = require("electron");
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
  readFile: (path) => ipcRenderer.invoke("fs:readFile", path),
  writeFile: (path, data) => ipcRenderer.invoke("fs:writeFile", path, path),
  deleteFile: (path) => ipcRenderer.invoke("fs:deleteFile", path)
});
ipcRenderer.on("dialog:message", (event, message) => {
  console.log("Dialog message:", message);
});
