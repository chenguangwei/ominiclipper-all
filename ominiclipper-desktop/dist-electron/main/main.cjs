"use strict";
const path = require("path");
const fs = require("fs");
let electron;
try {
  electron = require("electron");
} catch (e) {
  console.error("Failed to require electron:", e);
  process.exit(1);
}
console.log("Electron type:", typeof electron);
console.log("Electron is string:", typeof electron === "string");
let app, BrowserWindow, Menu, shell, ipcMain, dialog, protocol, net;
if (typeof electron === "string") {
  console.log("Electron returned a path string, loading actual electron from:", electron);
  const electronPath = path.join(__dirname, "..", "..", "node_modules", "electron", "dist", "Electron.app", "Contents", "MacOS", "Electron");
  console.log("Full electron path:", electronPath);
  try {
    const electronModule = require(electron);
    console.log("Loaded electron module type:", typeof electronModule);
    if (electronModule && typeof electronModule === "object") {
      ({ app, BrowserWindow, Menu, shell, ipcMain, dialog, protocol, net } = electronModule);
    }
  } catch (e2) {
    console.error("Failed to load electron binary:", e2);
  }
} else {
  ({ app, BrowserWindow, Menu, shell, ipcMain, dialog, protocol, net } = electron);
}
console.log("After parsing - ipcMain:", typeof ipcMain);
console.log("After parsing - protocol:", typeof protocol);
const { pathToFileURL } = require("url");
const httpServer = require("./httpServer.cjs");
const vectorService = require("./vectorService.cjs");
const searchIndexManager = require("./searchIndexManager.cjs");
console.log("✅ 依赖加载完成");
console.log("Electron module keys:", Object.keys(electron));
console.log("ipcMain:", typeof ipcMain);
console.log("protocol:", typeof protocol);
const isDev = process.env.NODE_ENV === "development";
let mainWindow;
function createWindow() {
  const preloadPath = path.resolve(__dirname, "../../electron/preload/manual.cjs");
  console.log("[createWindow] ==========================================");
  console.log("[createWindow] __dirname:", __dirname);
  console.log("[createWindow] Target Preload Path:", preloadPath);
  console.log("[createWindow] Preload Exists:", fs.existsSync(preloadPath));
  if (!fs.existsSync(preloadPath)) {
    console.error("❌ CRITICAL: Preload script missing at", preloadPath);
  }
  const iconPath = path.join(__dirname, "../../dist/assets/icon.png");
  fs.existsSync(iconPath);
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "OmniCollector",
    // icon: iconExists ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      // Keep this false to ensure require('electron') works in preload
      preload: preloadPath
    },
    backgroundColor: "#1e1e1e",
    titleBarStyle: "hiddenInset",
    show: true
  });
  console.log("[createWindow] BrowserWindow created");
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error("[createWindow] Failed to load:", errorCode, errorDescription);
  });
  if (isDev) {
    console.log("[createWindow] Loading dev URL...");
    mainWindow.loadURL("http://localhost:3000").then(() => {
      console.log("[createWindow] Dev URL loaded successfully");
    }).catch((err) => {
      console.error("[createWindow] Failed to load dev URL:", err);
    });
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, "../../dist/index.html");
    console.log("[createWindow] Loading production file:", indexPath);
    mainWindow.loadFile(indexPath).then(() => {
      console.log("[createWindow] Production file loaded successfully");
    }).catch((err) => {
      console.error("[createWindow] Failed to load production file:", err);
    });
  }
  mainWindow.once("ready-to-show", () => {
    console.log("[createWindow] Window ready to show");
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url).catch((err) => console.error("Failed to open URL:", err));
    }
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isDev && url.startsWith("http://localhost")) {
      return;
    }
    if (url.startsWith("file://")) {
      return;
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      event.preventDefault();
      shell.openExternal(url).catch((err) => console.error("Failed to open URL:", err));
    }
  });
  console.log("🔍 准备配置 HttpServer...");
  httpServer.setMainWindow(mainWindow);
  mainWindow.on("closed", () => {
    mainWindow = null;
    httpServer.setMainWindow(null);
  });
}
function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "New Resource",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            mainWindow == null ? void 0 : mainWindow.webContents.executeJavaScript('window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", metaKey: true }))');
          }
        },
        {
          label: "Import/Export",
          accelerator: "CmdOrCtrl+E",
          click: () => {
            mainWindow == null ? void 0 : mainWindow.webContents.executeJavaScript('window.dispatchEvent(new KeyboardEvent("keydown", { key: "e", metaKey: true }))');
          }
        },
        { type: "separator" },
        {
          label: "Close",
          accelerator: "CmdOrCtrl+W",
          role: "close"
        }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", role: "undo" },
        { label: "Redo", accelerator: "CmdOrCtrl+Shift+Z", role: "redo" },
        { type: "separator" },
        { label: "Cut", accelerator: "CmdOrCtrl+X", role: "cut" },
        { label: "Copy", accelerator: "CmdOrCtrl+C", role: "copy" },
        { label: "Paste", accelerator: "CmdOrCtrl+V", role: "paste" },
        { label: "Select All", accelerator: "CmdOrCtrl+A", role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        {
          label: "Table View",
          accelerator: "CmdOrCtrl+1",
          click: () => {
            mainWindow == null ? void 0 : mainWindow.webContents.executeJavaScript(`document.querySelectorAll("button[title*='Table View']")[0]?.click()`);
          }
        },
        {
          label: "Split View",
          accelerator: "CmdOrCtrl+2",
          click: () => {
            mainWindow == null ? void 0 : mainWindow.webContents.executeJavaScript(`document.querySelectorAll("button[title*='Split View']")[0]?.click()`);
          }
        },
        {
          label: "Grid View",
          accelerator: "CmdOrCtrl+3",
          click: () => {
            mainWindow == null ? void 0 : mainWindow.webContents.executeJavaScript(`document.querySelectorAll("button[title*='Grid View']")[0]?.click()`);
          }
        },
        { type: "separator" },
        { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => mainWindow == null ? void 0 : mainWindow.reload() },
        { label: "Force Reload", accelerator: "CmdOrCtrl+Shift+R", click: () => mainWindow == null ? void 0 : mainWindow.reload() },
        { type: "separator" },
        { label: "Toggle DevTools", accelerator: "CmdOrCtrl+Option+I", click: () => mainWindow == null ? void 0 : mainWindow.webContents.toggleDevTools() }
      ]
    },
    {
      label: "Window",
      submenu: [
        { label: "Minimize", accelerator: "CmdOrCtrl+M", role: "minimize" },
        { label: "Zoom", role: "zoom" },
        { type: "separator" },
        { label: "Bring All to Front", role: "front" }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Documentation",
          click: () => {
            shell.openExternal("https://github.com/omniclipper/omniclipper-all");
          }
        },
        {
          label: "Report Issue",
          click: () => {
            shell.openExternal("https://github.com/omniclipper/omniclipper-all/issues");
          }
        }
      ]
    }
  ];
  if (process.platform === "darwin") {
    template.unshift({
      label: app.getName(),
      submenu: [
        { label: "About OmniCollector", role: "about" },
        { type: "separator" },
        {
          label: "Settings",
          accelerator: "CmdOrCtrl+,",
          click: () => {
            mainWindow == null ? void 0 : mainWindow.webContents.executeJavaScript(`document.querySelector("button[title*='Settings']")?.click()`);
          }
        },
        { type: "separator" },
        { label: "Services", role: "services" },
        { type: "separator" },
        { label: "Hide OmniCollector", accelerator: "Command+H", role: "hide" },
        { label: "Hide Others", accelerator: "Command+Option+H", role: "hideOthers" },
        { label: "Show All", role: "unhide" },
        { type: "separator" },
        { label: "Quit", accelerator: "Command+Q", role: "quit" }
      ]
    });
  }
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
function isAbsolutePath(filePath) {
  if (!filePath || typeof filePath !== "string") return false;
  return filePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(filePath);
}
function registerIPCHandlers() {
  ipcMain.handle("fs:readFile", async (event, filePath) => {
    try {
      if (!isAbsolutePath(filePath)) {
        return { success: false, error: `Invalid file path` };
      }
      let targetPath = filePath;
      if (!fs.existsSync(targetPath)) {
        const dir = path.dirname(filePath);
        const basename = path.basename(filePath);
        if (fs.existsSync(dir)) {
          const entries = fs.readdirSync(dir);
          const normalizedTarget = basename.normalize("NFC");
          const foundEntry = entries.find(
            (entry) => entry.normalize("NFC") === normalizedTarget || entry.normalize("NFD") === normalizedTarget
          );
          if (foundEntry) {
            targetPath = path.join(dir, foundEntry);
          } else {
            return { success: false, error: `File not found in dir: "${filePath}"` };
          }
        } else {
          return { success: false, error: `Directory not found: "${dir}"` };
        }
      }
      const stats = fs.statSync(targetPath);
      if (stats.size === 0) {
        return { success: false, error: "File is empty (0 bytes)" };
      }
      const data = fs.readFileSync(targetPath);
      const mimeType = getMimeType(targetPath);
      const ext = path.extname(targetPath).toLowerCase();
      const textExtensions = [".md", ".markdown", ".txt", ".json", ".xml", ".html", ".css", ".js", ".ts", ".sql"];
      const isTextFile = textExtensions.includes(ext);
      return {
        success: true,
        buffer: data,
        // 直接返回 Buffer
        content: isTextFile ? data.toString("utf-8") : null,
        mimeType
      };
    } catch (error) {
      console.error("[fs:readFile] Error:", error.message);
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("fs:readFileAsDataUrl", async (event, filePath) => {
    try {
      if (!isAbsolutePath(filePath)) {
        console.error("[fs:readFileAsDataUrl] Invalid path (not absolute):", filePath);
        return {
          success: false,
          error: `Invalid file path: "${filePath}". Expected an absolute path.`
        };
      }
      if (!fs.existsSync(filePath)) {
        console.error("[fs:readFileAsDataUrl] File not found:", filePath);
        return {
          success: false,
          error: `File not found: "${filePath}". The file may have been moved or deleted.`
        };
      }
      const data = fs.readFileSync(filePath);
      const mimeType = getMimeType(filePath);
      const base64 = data.toString("base64");
      return { success: true, dataUrl: `data:${mimeType};base64,${base64}` };
    } catch (error) {
      console.error("[fs:readFileAsDataUrl] Error reading file:", filePath, error.message);
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("fs:fileExists", async (event, filePath) => {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  });
  ipcMain.handle("fs:isDirectory", async (event, filePath) => {
    try {
      const stats = fs.statSync(filePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  });
  ipcMain.handle("dialog:openFile", async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
  });
  ipcMain.handle("app:getVersion", () => {
    return app.getVersion();
  });
  ipcMain.handle("path:getUserData", () => {
    return app.getPath("userData");
  });
  ipcMain.handle("shell:openPath", async (event, filePath) => {
    try {
      const result = await shell.openPath(filePath);
      if (result) {
        return { success: false, error: result };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("shell:openExternal", async (event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("shell:showItemInFolder", async (event, filePath) => {
    try {
      await shell.showItemInFolder(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("fs:scanDirectory", async (event, dirPath, options = {}) => {
    const { recursive = true, maxDepth = 5 } = options;
    const supportedExtensions = [".pdf", ".doc", ".docx", ".epub", ".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const files = [];
    function scanDir(currentPath, depth = 0) {
      if (depth > maxDepth) return;
      try {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          if (entry.name.startsWith(".")) continue;
          if (entry.isDirectory() && recursive) {
            scanDir(fullPath, depth + 1);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (supportedExtensions.includes(ext)) {
              try {
                const stats = fs.statSync(fullPath);
                files.push({
                  name: entry.name,
                  path: fullPath,
                  extension: ext,
                  size: stats.size,
                  mimeType: getMimeType(fullPath),
                  modifiedAt: stats.mtime.toISOString()
                });
              } catch (statErr) {
                console.error("Failed to stat file:", fullPath, statErr);
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to scan directory:", currentPath, err);
      }
    }
    try {
      scanDir(dirPath);
      return { success: true, files };
    } catch (error) {
      return { success: false, error: error.message, files: [] };
    }
  });
  ipcMain.handle("fs:copyFileToStorage", async (event, sourcePath, targetFileName, customStoragePath = null) => {
    try {
      const userDataPath = app.getPath("userData");
      console.log('app.getPath("userData"):', userDataPath);
      const baseStoragePath = customStoragePath || userDataPath;
      const storagePath = path.join(baseStoragePath, "OmniCollector", "documents");
      if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
      }
      let safeFileName = (targetFileName || path.basename(sourcePath)).normalize("NFC");
      let targetPath = path.join(storagePath, safeFileName);
      if (fs.existsSync(targetPath)) {
        const ext = path.extname(safeFileName);
        const baseName = path.basename(safeFileName, ext);
        safeFileName = `${baseName}_${Date.now()}${ext}`;
        targetPath = path.join(storagePath, safeFileName);
      }
      fs.copyFileSync(sourcePath, targetPath);
      const finalDir = path.dirname(targetPath);
      const writtenName = fs.readdirSync(finalDir).find((f) => f.normalize("NFC") === safeFileName) || safeFileName;
      const finalTargetPath = path.join(finalDir, writtenName);
      console.log("copyFileToStorage - copied to:", finalTargetPath);
      return { success: true, targetPath: finalTargetPath, fileName: writtenName };
    } catch (error) {
      console.error("copyFileToStorage error:", error);
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("fs:saveEmbeddedFile", async (event, base64Data, fileName, itemId) => {
    try {
      const userDataPath = app.getPath("userData");
      const storagePath = path.join(userDataPath, "OmniCollector", "documents");
      if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
      }
      const safeFileName = fileName.replace(/[<>:"/\\|?*]/g, "_").normalize("NFC");
      const targetFileName = itemId ? `${itemId}_${safeFileName}` : safeFileName;
      const targetPath = path.join(storagePath, targetFileName);
      const buffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(targetPath, buffer);
      console.log("saveEmbeddedFile - saved to:", targetPath);
      return { success: true, targetPath, fileName: targetFileName };
    } catch (error) {
      console.error("saveEmbeddedFile error:", error);
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("dialog:selectDirectory", async (event, title = "Select Storage Directory") => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title,
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, path: null };
    }
    return { success: true, path: result.filePaths[0] };
  });
  function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".pdf": "application/pdf",
      ".epub": "application/epub+zip",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp"
    };
    return mimeTypes[ext] || "application/octet-stream";
  }
  function getStoragePaths() {
    const userDataPath = app.getPath("userData");
    const basePath = path.join(userDataPath, "OmniCollector");
    return {
      base: basePath,
      data: path.join(basePath, "data"),
      backups: path.join(basePath, "backups"),
      libraryFile: path.join(basePath, "data", "library.json"),
      settingsFile: path.join(basePath, "data", "settings.json")
    };
  }
  function ensureStorageDirectories() {
    const paths = getStoragePaths();
    [paths.data, paths.backups].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }
  function createLibraryBackup() {
    const paths = getStoragePaths();
    if (!fs.existsSync(paths.libraryFile)) return;
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(paths.backups, `library-${timestamp}.json`);
    try {
      fs.copyFileSync(paths.libraryFile, backupFile);
      console.log("[Storage] Created backup:", backupFile);
      const backups = fs.readdirSync(paths.backups).filter((f) => f.startsWith("library-") && f.endsWith(".json")).sort().reverse();
      if (backups.length > 5) {
        backups.slice(5).forEach((oldBackup) => {
          const oldPath = path.join(paths.backups, oldBackup);
          fs.unlinkSync(oldPath);
          console.log("[Storage] Removed old backup:", oldBackup);
        });
      }
    } catch (error) {
      console.error("[Storage] Backup failed:", error);
    }
  }
  function getFileStoragePaths() {
    const userDataPath = app.getPath("userData");
    const basePath = path.join(userDataPath, "OmniCollector");
    return {
      base: basePath,
      files: path.join(basePath, "files")
    };
  }
  ipcMain.handle("fileStorage:getStoragePath", () => {
    const paths = getFileStoragePaths();
    if (!fs.existsSync(paths.files)) {
      fs.mkdirSync(paths.files, { recursive: true });
    }
    return paths.files;
  });
  ipcMain.handle("fileStorage:createItemStorage", async (event, itemId) => {
    const paths = getFileStoragePaths();
    const itemDir = path.join(paths.files, itemId);
    try {
      if (!fs.existsSync(itemDir)) {
        fs.mkdirSync(itemDir, { recursive: true });
      }
      return { success: true, path: itemDir };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("fileStorage:saveFileToStorage", async (event, itemId, fileName, base64Data) => {
    const paths = getFileStoragePaths();
    const itemDir = path.join(paths.files, itemId);
    const filePath = path.join(itemDir, fileName);
    try {
      if (!fs.existsSync(itemDir)) {
        fs.mkdirSync(itemDir, { recursive: true });
      }
      const buffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(filePath, buffer);
      return { success: true, path: filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("fileStorage:readFileFromStorage", async (event, itemId, fileName) => {
    const paths = getFileStoragePaths();
    const filePath = path.join(paths.files, itemId, fileName);
    try {
      const data = fs.readFileSync(filePath);
      const mimeType = getMimeType(fileName);
      const base64 = data.toString("base64");
      return { success: true, dataUrl: `data:${mimeType};base64,${base64}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("fileStorage:getFilePath", async (event, itemId, fileName) => {
    const paths = getFileStoragePaths();
    const itemDir = path.join(paths.files, itemId);
    const userDataPath = app.getPath("userData");
    const legacyStoragePath = path.join(userDataPath, "OmniCollector", "documents");
    const findFileInDir = (dir, name) => {
      if (!fs.existsSync(dir) || !name) return null;
      const exactPath = path.join(dir, name);
      if (fs.existsSync(exactPath)) return exactPath;
      try {
        const entries = fs.readdirSync(dir);
        const normalizedTarget = name.normalize("NFC");
        const nameMatch = entries.find(
          (entry) => entry.normalize("NFC") === normalizedTarget || entry.normalize("NFD") === normalizedTarget
        );
        if (nameMatch) return path.join(dir, nameMatch);
        if (dir.includes(itemId)) {
          const contentFile = entries.find(
            (entry) => !entry.startsWith(".") && entry !== "metadata.json" && !entry.endsWith(".tmp") && !entry.endsWith(".png")
            // 排除缩略图
          );
          if (contentFile) {
            console.log(`[getFilePath] Auto-matched content file: ${contentFile}`);
            return path.join(dir, contentFile);
          }
        }
      } catch (e) {
        console.warn("[getFilePath] Scan failed:", e);
      }
      return null;
    };
    const eaglePath = findFileInDir(itemDir, fileName);
    if (eaglePath) return eaglePath;
    const legacyPath = findFileInDir(legacyStoragePath, fileName);
    if (legacyPath) {
      console.log(`[getFilePath] Found file in legacy storage: ${legacyPath}`);
      return legacyPath;
    }
    try {
      if (fs.existsSync(legacyStoragePath)) {
        const entries = fs.readdirSync(legacyStoragePath);
        const idMatch = entries.find(
          (entry) => entry.includes(itemId.split("-")[0]) || entry.includes(itemId)
        );
        if (idMatch) {
          const foundPath = path.join(legacyStoragePath, idMatch);
          console.log(`[getFilePath] Found by ID pattern: ${foundPath}`);
          return foundPath;
        }
        if (fileName && !fileName.includes(".")) {
          const exts = [".pdf", ".docx", ".doc", ".epub", ".jpg", ".png"];
          for (const ext of exts) {
            const withExt = fileName + ext;
            const withExtPath = path.join(legacyStoragePath, withExt);
            if (fs.existsSync(withExtPath)) {
              console.log(`[getFilePath] Found with extension: ${withExtPath}`);
              return withExtPath;
            }
          }
        }
      }
    } catch (e) {
      console.warn("[getFilePath] Legacy scan failed:", e);
    }
    try {
      const foldersPath = path.join(paths.base, "folders");
      if (fs.existsSync(foldersPath)) {
        const folderDirs = fs.readdirSync(foldersPath, { withFileTypes: true });
        for (const dir of folderDirs) {
          if (dir.isDirectory()) {
            const folderPath = path.join(foldersPath, dir.name);
            const foundPath = findFileInDir(folderPath, fileName);
            if (foundPath) {
              console.log(`[getFilePath] Found in folders directory: ${foundPath}`);
              return foundPath;
            }
          }
        }
      }
    } catch (e) {
      console.warn("[getFilePath] Folders scan failed:", e);
    }
    console.log(`[getFilePath] File not found for item ${itemId}, fileName: ${fileName}`);
    return null;
  });
  ipcMain.handle("fileStorage:deleteItemStorage", async (event, itemId) => {
    const paths = getFileStoragePaths();
    const itemDir = path.join(paths.files, itemId);
    try {
      if (fs.existsSync(itemDir)) {
        fs.rmSync(itemDir, { recursive: true, force: true });
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("fileStorage:saveItemMetadata", async (event, itemId, metadata) => {
    const paths = getFileStoragePaths();
    const metadataPath = path.join(paths.files, itemId, "metadata.json");
    try {
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("fileStorage:readItemMetadata", async (event, itemId) => {
    const paths = getFileStoragePaths();
    const metadataPath = path.join(paths.files, itemId, "metadata.json");
    try {
      if (!fs.existsSync(metadataPath)) return null;
      const content = fs.readFileSync(metadataPath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  });
  ipcMain.handle("fileStorage:moveFileToFolder", async (event, itemId, fileName, folderId) => {
    const paths = getFileStoragePaths();
    const foldersDir = path.join(paths.base, "folders");
    const sourcePath = path.join(paths.files, itemId, fileName);
    const targetDir = path.join(foldersDir, folderId || "uncategorized");
    const targetPath = path.join(targetDir, fileName);
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      if (!fs.existsSync(sourcePath)) {
        return { success: false, error: "Source file not found" };
      }
      fs.renameSync(sourcePath, targetPath);
      console.log(`[fileStorage] Moved file to folder: ${sourcePath} -> ${targetPath}`);
      return { success: true, path: targetPath };
    } catch (error) {
      console.error("[fileStorage] Failed to move file to folder:", error);
      return { success: false, error: error.message };
    }
  });
  function getMTimeFilePath() {
    const paths = getStoragePaths();
    return path.join(paths.data, "mtime.json");
  }
  ipcMain.handle("mtime:readMTime", async () => {
    const mtimePath = getMTimeFilePath();
    try {
      if (!fs.existsSync(mtimePath)) {
        return { times: {}, count: 0, lastModified: (/* @__PURE__ */ new Date()).toISOString() };
      }
      const content = fs.readFileSync(mtimePath, "utf-8");
      const data = JSON.parse(content);
      const count = data.all || Object.keys(data).filter((k) => k !== "all").length;
      return { times: data, count, lastModified: (/* @__PURE__ */ new Date()).toISOString() };
    } catch (error) {
      return { times: {}, count: 0, lastModified: (/* @__PURE__ */ new Date()).toISOString() };
    }
  });
  ipcMain.handle("mtime:updateMTime", async (event, itemId) => {
    const mtimePath = getMTimeFilePath();
    ensureStorageDirectories();
    try {
      let data = {};
      if (fs.existsSync(mtimePath)) {
        try {
          data = JSON.parse(fs.readFileSync(mtimePath, "utf-8"));
        } catch (e) {
          data = {};
        }
      }
      data[itemId] = Date.now();
      data.all = Object.keys(data).filter((k) => k !== "all").length;
      fs.writeFileSync(mtimePath, JSON.stringify(data, null, 2), "utf-8");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("mtime:setMTime", async (event, itemId, timestamp) => {
    const mtimePath = getMTimeFilePath();
    ensureStorageDirectories();
    try {
      let data = {};
      if (fs.existsSync(mtimePath)) {
        try {
          data = JSON.parse(fs.readFileSync(mtimePath, "utf-8"));
        } catch (e) {
          data = {};
        }
      }
      data[itemId] = timestamp;
      data.all = Object.keys(data).filter((k) => k !== "all").length;
      fs.writeFileSync(mtimePath, JSON.stringify(data, null, 2), "utf-8");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("mtime:removeMTime", async (event, itemId) => {
    const mtimePath = getMTimeFilePath();
    try {
      if (!fs.existsSync(mtimePath)) return { success: true };
      let data = JSON.parse(fs.readFileSync(mtimePath, "utf-8"));
      delete data[itemId];
      data.all = Object.keys(data).filter((k) => k !== "all").length;
      fs.writeFileSync(mtimePath, JSON.stringify(data, null, 2), "utf-8");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("mtime:getMTime", async (event, itemId) => {
    const mtimePath = getMTimeFilePath();
    try {
      if (!fs.existsSync(mtimePath)) return null;
      const content = fs.readFileSync(mtimePath, "utf-8");
      const data = JSON.parse(content);
      return data[itemId] || null;
    } catch (error) {
      return null;
    }
  });
  ipcMain.handle("mtime:getAll", async () => {
    const mtimePath = getMTimeFilePath();
    try {
      if (!fs.existsSync(mtimePath)) return {};
      const content = fs.readFileSync(mtimePath, "utf-8");
      const data = JSON.parse(content);
      const { all, ...times } = data;
      return times;
    } catch (error) {
      return {};
    }
  });
  ipcMain.handle("mtime:getCount", async () => {
    const mtimePath = getMTimeFilePath();
    try {
      if (!fs.existsSync(mtimePath)) return 0;
      const content = fs.readFileSync(mtimePath, "utf-8");
      const data = JSON.parse(content);
      return data.all || Object.keys(data).filter((k) => k !== "all").length;
    } catch (error) {
      return 0;
    }
  });
  function getBackupPaths() {
    const paths = getStoragePaths();
    return { backupDir: path.join(paths.base, "backups") };
  }
  ipcMain.handle("backup:createBackup", async (event, data) => {
    const { backupDir } = getBackupPaths();
    try {
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const now = /* @__PURE__ */ new Date();
      const timestamp = now.toISOString().replace(/[-:]/g, "").replace(/\./g, "-").replace("T", " ").split(" ")[0] + " " + now.toTimeString().split(" ")[0].replace(/:/g, ".");
      const backupFile = path.join(backupDir, `backup-${timestamp}.${Date.now()}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(data, null, 2), "utf-8");
      return { success: true, path: backupFile };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("backup:listBackups", async () => {
    const { backupDir } = getBackupPaths();
    try {
      if (!fs.existsSync(backupDir)) return [];
      const files = fs.readdirSync(backupDir).filter((f) => f.startsWith("backup-") && f.endsWith(".json")).sort().reverse();
      return files.map((fileName) => {
        var _a, _b;
        const filePath = path.join(backupDir, fileName);
        const stats = fs.statSync(filePath);
        let timestamp = /* @__PURE__ */ new Date();
        const match = fileName.match(/backup-(.+)\.\d+\.json/);
        if (match && match[1]) {
          try {
            timestamp = new Date(match[1].replace(" ", "T"));
          } catch (e) {
          }
        }
        let itemCount = 0;
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const d = JSON.parse(content);
          itemCount = ((_a = d._backupInfo) == null ? void 0 : _a.itemCount) || ((_b = d.items) == null ? void 0 : _b.length) || 0;
        } catch (e) {
        }
        return { path: filePath, fileName, timestamp, size: stats.size, itemCount };
      });
    } catch (error) {
      return [];
    }
  });
  ipcMain.handle("backup:restoreBackup", async (event, backupPath) => {
    try {
      if (!fs.existsSync(backupPath)) return { success: false, error: "Backup file not found" };
      const content = fs.readFileSync(backupPath, "utf-8");
      const data = JSON.parse(content);
      const { _backupInfo, ...restoreData } = data;
      return { success: true, data: restoreData };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("backup:deleteBackup", async (event, backupPath) => {
    try {
      if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("backup:cleanupOldBackups", async (event, keepCount = 30) => {
    const { backupDir } = getBackupPaths();
    try {
      if (!fs.existsSync(backupDir)) return { deleted: 0 };
      const files = fs.readdirSync(backupDir).filter((f) => f.startsWith("backup-") && f.endsWith(".json")).sort().reverse();
      if (files.length <= keepCount) return { deleted: 0 };
      const toDelete = files.slice(keepCount);
      let deleted = 0;
      for (const fileName of toDelete) {
        const filePath = path.join(backupDir, fileName);
        try {
          fs.unlinkSync(filePath);
          deleted++;
        } catch (e) {
          console.error("Failed to delete backup:", filePath);
        }
      }
      return { deleted };
    } catch (error) {
      return { deleted: 0, error: error.message };
    }
  });
  ipcMain.handle("backup:getBackupPath", async () => {
    const { backupDir } = getBackupPaths();
    ensureStorageDirectories();
    return backupDir;
  });
  function getFolderPaths() {
    const paths = getStoragePaths();
    return {
      base: path.join(paths.base, "folders")
    };
  }
  ipcMain.handle("folder:getFoldersPath", () => {
    const paths = getFolderPaths();
    if (!fs.existsSync(paths.base)) {
      fs.mkdirSync(paths.base, { recursive: true });
    }
    return paths.base;
  });
  ipcMain.handle("folder:create", async (event, folderId) => {
    const paths = getFolderPaths();
    const folderPath = path.join(paths.base, folderId);
    try {
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      return { success: true, path: folderPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("folder:delete", async (event, folderId) => {
    const paths = getFolderPaths();
    const folderPath = path.join(paths.base, folderId);
    try {
      if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true });
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("folder:exists", async (event, folderId) => {
    const paths = getFolderPaths();
    const folderPath = path.join(paths.base, folderId);
    return fs.existsSync(folderPath);
  });
  function getItemsPaths() {
    const paths = getStoragePaths();
    return {
      base: path.join(paths.base, "items"),
      indexFile: path.join(paths.base, "items", "index.json")
    };
  }
  ipcMain.handle("item:getItemsPath", () => {
    const paths = getItemsPaths();
    if (!fs.existsSync(paths.base)) {
      fs.mkdirSync(paths.base, { recursive: true });
    }
    return paths.base;
  });
  ipcMain.handle("item:saveMetadata", async (event, itemId, metadata) => {
    const paths = getItemsPaths();
    const metadataPath = path.join(paths.base, itemId, "metadata.json");
    try {
      if (!fs.existsSync(path.join(paths.base, itemId))) {
        fs.mkdirSync(path.join(paths.base, itemId), { recursive: true });
      }
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
      return { success: true, path: metadataPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("item:readMetadata", async (event, itemId) => {
    const paths = getItemsPaths();
    const metadataPath = path.join(paths.base, itemId, "metadata.json");
    try {
      if (!fs.existsSync(metadataPath)) return null;
      const content = fs.readFileSync(metadataPath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  });
  ipcMain.handle("item:deleteMetadata", async (event, itemId) => {
    const paths = getItemsPaths();
    const itemDir = path.join(paths.base, itemId);
    try {
      if (fs.existsSync(itemDir)) {
        fs.rmSync(itemDir, { recursive: true, force: true });
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("item:saveIndex", async (event, index) => {
    const paths = getItemsPaths();
    try {
      fs.writeFileSync(paths.indexFile, JSON.stringify(index, null, 2), "utf-8");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("item:readIndex", async () => {
    const paths = getItemsPaths();
    try {
      if (!fs.existsSync(paths.indexFile)) return null;
      const content = fs.readFileSync(paths.indexFile, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  });
  ipcMain.handle("file:moveFile", async (event, sourcePath, targetPath) => {
    try {
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      if (!fs.existsSync(sourcePath)) {
        return { success: false, error: "Source file does not exist" };
      }
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      fs.copyFileSync(sourcePath, targetPath);
      const storagePaths = getStoragePaths();
      const storageFilesDir = path.join(storagePaths.base, "files");
      if (sourcePath.startsWith(storageFilesDir)) {
        fs.unlinkSync(sourcePath);
      }
      return { success: true, path: targetPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  function getThumbnailsPath() {
    const paths = getStoragePaths();
    return {
      base: path.join(paths.base, "thumbnails"),
      thumbnailsDir: path.join(paths.base, "thumbnails", "images")
    };
  }
  ipcMain.handle("fileStorage:saveThumbnail", async (event, itemId, dataUrl) => {
    const paths = getThumbnailsPath();
    try {
      if (!fs.existsSync(paths.thumbnailsDir)) {
        fs.mkdirSync(paths.thumbnailsDir, { recursive: true });
      }
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const thumbnailPath = path.join(paths.thumbnailsDir, `${itemId}.png`);
      fs.writeFileSync(thumbnailPath, buffer);
      return { success: true, path: thumbnailPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("fileStorage:readThumbnail", async (event, itemId) => {
    const paths = getThumbnailsPath();
    try {
      const thumbnailPath = path.join(paths.thumbnailsDir, `${itemId}.png`);
      if (!fs.existsSync(thumbnailPath)) {
        return null;
      }
      const data = fs.readFileSync(thumbnailPath);
      const dataUrl = `data:image/png;base64,${data.toString("base64")}`;
      return { dataUrl, path: thumbnailPath };
    } catch (error) {
      return null;
    }
  });
  ipcMain.handle("fileStorage:deleteThumbnail", async (event, itemId) => {
    const paths = getThumbnailsPath();
    try {
      const thumbnailPath = path.join(paths.thumbnailsDir, `${itemId}.png`);
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("storage:getDataPath", () => {
    const paths = getStoragePaths();
    ensureStorageDirectories();
    return paths.data;
  });
  ipcMain.handle("storage:readLibrary", async () => {
    var _a;
    const paths = getStoragePaths();
    ensureStorageDirectories();
    try {
      if (!fs.existsSync(paths.libraryFile)) {
        console.log("[Storage] library.json not found, returning null");
        return null;
      }
      const content = fs.readFileSync(paths.libraryFile, "utf-8");
      try {
        const data = JSON.parse(content);
        console.log("[Storage] Loaded library.json, items:", ((_a = data.items) == null ? void 0 : _a.length) || 0);
        return data;
      } catch (parseError) {
        console.error("[Storage] CRITICAL: Failed to parse library.json:", parseError);
        return null;
      }
    } catch (error) {
      console.error("[Storage] Failed to read library.json:", error);
      return null;
    }
  });
  ipcMain.handle("storage:writeLibrary", async (event, data) => {
    var _a;
    const paths = getStoragePaths();
    ensureStorageDirectories();
    try {
      if (fs.existsSync(paths.libraryFile)) {
        createLibraryBackup();
      }
      data.lastModified = (/* @__PURE__ */ new Date()).toISOString();
      const tempFile = paths.libraryFile + ".tmp";
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf-8");
      fs.renameSync(tempFile, paths.libraryFile);
      console.log("[Storage] Saved library.json, items:", ((_a = data.items) == null ? void 0 : _a.length) || 0);
      return { success: true };
    } catch (error) {
      console.error("[Storage] Failed to write library.json:", error);
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("storage:readSettings", async () => {
    const paths = getStoragePaths();
    ensureStorageDirectories();
    try {
      if (!fs.existsSync(paths.settingsFile)) {
        console.log("[Storage] settings.json not found, returning null");
        return null;
      }
      const content = fs.readFileSync(paths.settingsFile, "utf-8");
      const data = JSON.parse(content);
      console.log("[Storage] Loaded settings.json");
      return data;
    } catch (error) {
      console.error("[Storage] Failed to read settings.json:", error);
      return null;
    }
  });
  ipcMain.handle("storage:writeSettings", async (event, data) => {
    const paths = getStoragePaths();
    ensureStorageDirectories();
    try {
      const tempFile = paths.settingsFile + ".tmp";
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf-8");
      fs.renameSync(tempFile, paths.settingsFile);
      console.log("[Storage] Saved settings.json");
      return { success: true };
    } catch (error) {
      console.error("[Storage] Failed to write settings.json:", error);
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("storage:migrate", async (event, legacyData) => {
    const paths = getStoragePaths();
    ensureStorageDirectories();
    try {
      const libraryData = {
        version: 1,
        lastModified: (/* @__PURE__ */ new Date()).toISOString(),
        items: legacyData.items || [],
        tags: legacyData.tags || [],
        folders: legacyData.folders || []
      };
      const settingsData = {
        version: 1,
        colorMode: legacyData.colorMode || "dark",
        themeId: legacyData.themeId || "blue",
        locale: legacyData.locale || "en",
        customStoragePath: legacyData.storagePath || null,
        viewMode: legacyData.viewMode || "list",
        filterState: legacyData.filterState || { search: "", tagId: null, folderId: "all" },
        recentFiles: legacyData.recentFiles || [],
        favoriteFolders: legacyData.favoriteFolders || []
      };
      fs.writeFileSync(paths.libraryFile, JSON.stringify(libraryData, null, 2), "utf-8");
      fs.writeFileSync(paths.settingsFile, JSON.stringify(settingsData, null, 2), "utf-8");
      console.log("[Storage] Migration completed successfully");
      console.log("[Storage] - Items:", libraryData.items.length);
      console.log("[Storage] - Tags:", libraryData.tags.length);
      console.log("[Storage] - Folders:", libraryData.folders.length);
      return { success: true, libraryData, settingsData };
    } catch (error) {
      console.error("[Storage] Migration failed:", error);
      return { success: false, error: error.message };
    }
  });
}
console.log("🔍 准备注册协议...");
try {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "localfile",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true,
        allowFileAccess: true
      }
    }
  ]);
} catch (err) {
  console.error("❌ 严重错误：无法注册协议，跳过以启动窗口:", err);
}
console.log("⏳ 等待 app.whenReady...");
app.whenReady().then(async () => {
  console.log("[App] whenReady fired");
  const userDataPath = app.getPath("userData");
  console.log("[App] userDataPath:", userDataPath);
  try {
    console.log("[App] Initializing Vector Search Service...");
    let modelId = "bge-m3";
    try {
      const settingsPath = path.join(userDataPath, "OmniCollector", "data", "settings.json");
      if (fs.existsSync(settingsPath)) {
        const settingsContent = fs.readFileSync(settingsPath, "utf-8");
        const settings = JSON.parse(settingsContent);
        if (settings.locale === "en") {
          modelId = "all-MiniLM-L6-v2";
        }
        console.log("[App] Auto-selected model based on locale:", settings.locale, "->", modelId);
      }
    } catch (e) {
      console.warn("[App] Failed to detect locale for model selection, using default:", modelId);
    }
    const vectorResult = await vectorService.initialize(userDataPath, modelId);
    console.log("[App] Vector Search:", vectorResult.success ? "✅ Ready" : "❌ Failed -", vectorResult.error || "");
  } catch (err) {
    console.error("[App] Vector Service initialization error:", err);
  }
  try {
    console.log("[App] Initializing BM25 Search Service...");
    const bm25Result = await searchIndexManager.initialize(userDataPath);
    console.log("[App] BM25 Search:", bm25Result.success ? "✅ Ready" : "❌ Failed -", bm25Result.error || "");
  } catch (err) {
    console.error("[App] BM25 Service initialization error:", err);
  }
  registerIPCHandlers();
  protocol.registerFileProtocol("localfile", (request, callback) => {
    try {
      const url = request.url;
      console.log("[localfile protocol] raw URL:", url);
      let filePath = url.replace("localfile://", "");
      if (!filePath.startsWith("/")) {
        filePath = "/" + filePath;
      }
      if (filePath.startsWith("/users/")) {
        filePath = "/Users" + filePath.slice(6);
      }
      const finalPath = path.normalize(filePath);
      console.log("[localfile protocol] final path:", finalPath);
      callback({ path: finalPath });
    } catch (error) {
      console.error("[localfile protocol] error:", error);
      callback({ error: -6 });
    }
  });
  createWindow();
  createMenu();
  httpServer.startServer();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("before-quit", () => {
  httpServer.stopServer();
});
ipcMain.handle("vector:initialize", async () => {
  const userDataPath = app.getPath("userData");
  return await vectorService.initialize(userDataPath);
});
ipcMain.handle("vector:index", async (event, { id, text, metadata }) => {
  return await vectorService.indexDocument(id, text, metadata);
});
ipcMain.handle("vector:search", async (event, { query, limit }) => {
  return await vectorService.search(query, limit || 10);
});
ipcMain.handle("vector:delete", async (event, { id }) => {
  return await vectorService.deleteDocument(id);
});
ipcMain.handle("vector:getStats", async () => {
  return await vectorService.getStats();
});
ipcMain.handle("vector:checkMissing", async (event, { ids }) => {
  return await vectorService.checkMissing(ids);
});
ipcMain.handle("search:index", async (event, { id, text, metadata }) => {
  return await searchIndexManager.indexDocument(id, text, metadata);
});
ipcMain.handle("search:delete", async (event, { id }) => {
  return await searchIndexManager.deleteDocument(id);
});
ipcMain.handle("search:bm25", async (event, { query, limit }) => {
  return await searchIndexManager.search(query, limit || 10);
});
ipcMain.handle("search:getStats", async () => {
  return await searchIndexManager.getStats();
});
ipcMain.handle("search:hybrid", async (event, { query, limit = 10, vectorWeight: paramVectorWeight, bm25Weight: paramBM25Weight }) => {
  console.log("[HybridSearch] Query:", query, "limit:", limit);
  let vectorWeight = paramVectorWeight !== void 0 ? paramVectorWeight : 0.7;
  let bm25Weight = paramBM25Weight !== void 0 ? paramBM25Weight : 0.3;
  let searchThreshold = 0.5;
  try {
    const userDataPath = app.getPath("userData");
    const settingsPath = path.join(userDataPath, "OmniCollector", "data", "settings.json");
    if (fs.existsSync(settingsPath)) {
      try {
        const settingsContent = fs.readFileSync(settingsPath, "utf-8");
        const settings = JSON.parse(settingsContent);
        if (paramVectorWeight === void 0 && settings.vectorWeight !== void 0) {
          vectorWeight = Number(settings.vectorWeight);
        }
        if (paramBM25Weight === void 0 && settings.bm25Weight !== void 0) {
          bm25Weight = Number(settings.bm25Weight);
        }
        if (settings.searchThreshold !== void 0) {
          searchThreshold = Number(settings.searchThreshold);
        }
        console.log(`[HybridSearch] Using configuration - vectorWeight: ${vectorWeight}, bm25Weight: ${bm25Weight}, threshold: ${searchThreshold}`);
      } catch (e) {
        console.warn("[HybridSearch] Failed to read settings.json:", e);
      }
    }
    const [vectorResults, bm25Results] = await Promise.all([
      // Pass threshold to vector search
      vectorService.search(query, limit * 2, searchThreshold),
      searchIndexManager.search(query, limit * 2)
    ]);
    console.log("[HybridSearch] Vector results:", (vectorResults == null ? void 0 : vectorResults.length) || 0);
    console.log("[HybridSearch] BM25 results:", (bm25Results == null ? void 0 : bm25Results.length) || 0);
    const k = 60;
    const scoreMap = /* @__PURE__ */ new Map();
    if (Array.isArray(vectorResults)) {
      vectorResults.forEach((result, index) => {
        const id = result.id;
        const rrfScore = vectorWeight * (1 / (k + index + 1));
        if (!scoreMap.has(id)) {
          scoreMap.set(id, { score: 0, data: result });
        }
        const entry = scoreMap.get(id);
        entry.score += rrfScore;
        entry.vectorRank = index + 1;
      });
    }
    if (Array.isArray(bm25Results)) {
      bm25Results.forEach((result, index) => {
        const id = result.id;
        const rrfScore = bm25Weight * (1 / (k + index + 1));
        if (!scoreMap.has(id)) {
          scoreMap.set(id, { score: 0, data: { ...result, metadata: { title: result.title, type: result.type, tags: [] } } });
        }
        const entry = scoreMap.get(id);
        entry.score += rrfScore;
        entry.bm25Rank = index + 1;
      });
    }
    const combinedResults = Array.from(scoreMap.entries()).sort((a, b) => b[1].score - a[1].score).slice(0, limit).map(([id, { score, vectorRank, bm25Rank, data }]) => ({
      id,
      text: data.text || "",
      score,
      vectorRank,
      bm25Rank,
      metadata: data.metadata || { title: data.title || "", type: data.type || "", tags: [] }
    }));
    console.log("[HybridSearch] Combined results:", combinedResults.length);
    return combinedResults;
  } catch (error) {
    console.error("[HybridSearch] Error:", error);
    return [];
  }
});
//# sourceMappingURL=main.cjs.map
