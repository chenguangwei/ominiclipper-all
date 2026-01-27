/**
 * OmniCollector Desktop - Electron Main Process
 */

const path = require('path');
const fs = require('fs');

// Get electron module
let electron;
try {
  electron = require('electron');
} catch (e) {
  console.error('Failed to require electron:', e);
  process.exit(1);
}

console.log('Electron type:', typeof electron);
console.log('Electron is string:', typeof electron === 'string');

// If electron is a string (path), we need to require the actual electron binary
let app, BrowserWindow, Menu, shell, ipcMain, dialog, protocol, net;
if (typeof electron === 'string') {
  console.log('Electron returned a path string, loading actual electron from:', electron);
  const electronPath = path.join(__dirname, '..', '..', 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron');
  console.log('Full electron path:', electronPath);
  // We can't require the binary directly, we need to use the correct electron package
  // Let's try requiring electron differently
  try {
    const electronModule = require(electron);
    console.log('Loaded electron module type:', typeof electronModule);
    if (electronModule && typeof electronModule === 'object') {
      ({ app, BrowserWindow, Menu, shell, ipcMain, dialog, protocol, net } = electronModule);
    }
  } catch (e2) {
    console.error('Failed to load electron binary:', e2);
  }
} else {
  ({ app, BrowserWindow, Menu, shell, ipcMain, dialog, protocol, net } = electron);
}

console.log('After parsing - ipcMain:', typeof ipcMain);
console.log('After parsing - protocol:', typeof protocol);
const { pathToFileURL } = require('url');
const httpServer = require('./httpServer.cjs');
const vectorService = require('./vectorService.cjs');
const searchIndexManager = require('./searchIndexManager.cjs');
console.log('✅ 依赖加载完成');
// Debug: check what we got from electron
console.log('Electron module keys:', Object.keys(electron));
console.log('ipcMain:', typeof ipcMain);
console.log('protocol:', typeof protocol);

const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
  // In production, __dirname is inside dist-electron/main/
  // In development, we run from dist-electron/main/main.cjs
  const preloadPath = path.join(__dirname, '../preload/preload.cjs');

  // Check for icon file
  const iconPath = path.join(__dirname, '../../dist/assets/icon.png');
  const iconExists = fs.existsSync(iconPath);
  console.log('[createWindow] Icon path:', iconPath, 'exists:', iconExists);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'OmniCollector',
    // icon: iconExists ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    },
    backgroundColor: '#1e1e1e',
    titleBarStyle: 'hiddenInset',
    show: true
  });

  console.log('[createWindow] BrowserWindow created');

  // Add error handling for window
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[createWindow] Failed to load:', errorCode, errorDescription);
  });

  // Load the app
  if (isDev) {
    console.log('[createWindow] Loading dev URL...');
    mainWindow.loadURL('http://localhost:3000').then(() => {
      console.log('[createWindow] Dev URL loaded successfully');
    }).catch(err => {
      console.error('[createWindow] Failed to load dev URL:', err);
    });
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '../../dist/index.html');
    console.log('[createWindow] Loading production file:', indexPath);
    mainWindow.loadFile(indexPath).then(() => {
      console.log('[createWindow] Production file loaded successfully');
    }).catch(err => {
      console.error('[createWindow] Failed to load production file:', err);
    });
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    console.log('[createWindow] Window ready to show');
    mainWindow.show();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Only open http/https URLs externally
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url).catch(err => console.error('Failed to open URL:', err));
    }
    return { action: 'deny' };
  });

  // Handle navigation - prevent navigating away from the app
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow localhost in development
    if (isDev && url.startsWith('http://localhost')) {
      return;
    }
    // Allow file:// URLs for production (loading local files)
    if (url.startsWith('file://')) {
      return;
    }
    // For http/https URLs, open externally instead of navigating
    if (url.startsWith('http://') || url.startsWith('https://')) {
      event.preventDefault();
      shell.openExternal(url).catch(err => console.error('Failed to open URL:', err));
    }
  });
  console.log('🔍 准备配置 HttpServer...');
  // Set main window reference for HTTP server sync
  httpServer.setMainWindow(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
    httpServer.setMainWindow(null);
  });
}

// Create menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Resource',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.executeJavaScript('window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", metaKey: true }))');
          }
        },
        {
          label: 'Import/Export',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow?.webContents.executeJavaScript('window.dispatchEvent(new KeyboardEvent("keydown", { key: "e", metaKey: true }))');
          }
        },
        { type: 'separator' },
        {
          label: 'Close',
          accelerator: 'CmdOrCtrl+W',
          role: 'close'
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Table View',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            mainWindow?.webContents.executeJavaScript('document.querySelectorAll("button[title*=\'Table View\']")[0]?.click()');
          }
        },
        {
          label: 'Split View',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            mainWindow?.webContents.executeJavaScript('document.querySelectorAll("button[title*=\'Split View\']")[0]?.click()');
          }
        },
        {
          label: 'Grid View',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            mainWindow?.webContents.executeJavaScript('document.querySelectorAll("button[title*=\'Grid View\']")[0]?.click()');
          }
        },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', click: () => mainWindow?.reload() },
        { type: 'separator' },
        { label: 'Toggle DevTools', accelerator: 'CmdOrCtrl+Option+I', click: () => mainWindow?.webContents.toggleDevTools() }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Zoom', role: 'zoom' },
        { type: 'separator' },
        { label: 'Bring All to Front', role: 'front' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://github.com/omniclipper/omniclipper-all');
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/omniclipper/omniclipper-all/issues');
          }
        }
      ]
    }
  ];

  // Add macOS specific menu items
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { label: 'About OmniCollector', role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow?.webContents.executeJavaScript('document.querySelector("button[title*=\'Settings\']")?.click()');
          }
        },
        { type: 'separator' },
        { label: 'Services', role: 'services' },
        { type: 'separator' },
        { label: 'Hide OmniCollector', accelerator: 'Command+H', role: 'hide' },
        { label: 'Hide Others', accelerator: 'Command+Option+H', role: 'hideOthers' },
        { label: 'Show All', role: 'unhide' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'Command+Q', role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Helper: Check if path is absolute
function isAbsolutePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  // Unix absolute path or Windows absolute path
  return filePath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(filePath);
}

// Register all IPC handlers (must be called after app.whenReady)
function registerIPCHandlers() {
  // IPC Handlers for file operations
  ipcMain.handle('fs:readFile', async (event, filePath) => {
    try {
      if (!isAbsolutePath(filePath)) {
        return { success: false, error: `Invalid file path` };
      }

      let targetPath = filePath;

      // 1. 检查文件是否存在
      if (!fs.existsSync(targetPath)) {
        // 尝试解决 macOS 编码问题 (NFC/NFD)
        const dir = path.dirname(filePath);
        const basename = path.basename(filePath);

        if (fs.existsSync(dir)) {
          const entries = fs.readdirSync(dir);
          const normalizedTarget = basename.normalize('NFC');
          const foundEntry = entries.find(entry =>
            entry.normalize('NFC') === normalizedTarget ||
            entry.normalize('NFD') === normalizedTarget
          );
          if (foundEntry) {
            targetPath = path.join(dir, foundEntry);
          } else {
            return { success: false, error: `File not found in dir: "${filePath}"` };
          }
        } else {
          // 如果连目录都不存在，不要抛出异常，而是返回友好的错误
          // 这通常意味着文件路径完全错误（例如 ID 目录未创建）
          return { success: false, error: `Directory not found: "${dir}"` };
        }
      }

      // 2. 检查文件大小
      const stats = fs.statSync(targetPath);
      if (stats.size === 0) {
        return { success: false, error: 'File is empty (0 bytes)' };
      }

      // 3. 读取内容
      const data = fs.readFileSync(targetPath);
      const mimeType = getMimeType(targetPath);
      const ext = path.extname(targetPath).toLowerCase();
      const textExtensions = ['.md', '.markdown', '.txt', '.json', '.xml', '.html', '.css', '.js', '.ts', '.sql'];
      const isTextFile = textExtensions.includes(ext);

      return {
        success: true,
        buffer: data, // 直接返回 Buffer
        content: isTextFile ? data.toString('utf-8') : null,
        mimeType
      };
    } catch (error) {
      console.error('[fs:readFile] Error:', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fs:readFileAsDataUrl', async (event, filePath) => {
    try {
      // Validate that the path is absolute
      if (!isAbsolutePath(filePath)) {
        console.error('[fs:readFileAsDataUrl] Invalid path (not absolute):', filePath);
        return {
          success: false,
          error: `Invalid file path: "${filePath}". Expected an absolute path.`
        };
      }

      // Check if file exists before reading
      if (!fs.existsSync(filePath)) {
        console.error('[fs:readFileAsDataUrl] File not found:', filePath);
        return {
          success: false,
          error: `File not found: "${filePath}". The file may have been moved or deleted.`
        };
      }

      const data = fs.readFileSync(filePath);
      const mimeType = getMimeType(filePath);
      const base64 = data.toString('base64');
      return { success: true, dataUrl: `data:${mimeType};base64,${base64}` };
    } catch (error) {
      console.error('[fs:readFileAsDataUrl] Error reading file:', filePath, error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fs:fileExists', async (event, filePath) => {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  });

  // Check if a path is a directory
  ipcMain.handle('fs:isDirectory', async (event, filePath) => {
    try {
      const stats = fs.statSync(filePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  });

  ipcMain.handle('dialog:openFile', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result;
  });

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle('path:getUserData', () => {
    return app.getPath('userData');
  });

  // Open a file with the system default application
  ipcMain.handle('shell:openPath', async (event, filePath) => {
    try {
      const result = await shell.openPath(filePath);
      if (result) {
        // openPath returns an empty string on success, or an error message
        return { success: false, error: result };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Open a URL in the default browser
  ipcMain.handle('shell:openExternal', async (event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Show item in folder (Finder on macOS, Explorer on Windows)
  ipcMain.handle('shell:showItemInFolder', async (event, filePath) => {
    try {
      await shell.showItemInFolder(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Scan a directory and return all supported document files
  ipcMain.handle('fs:scanDirectory', async (event, dirPath, options = {}) => {
    const { recursive = true, maxDepth = 5 } = options;
    const supportedExtensions = ['.pdf', '.doc', '.docx', '.epub', '.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const files = [];

    function scanDir(currentPath, depth = 0) {
      if (depth > maxDepth) return;

      try {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);

          // Skip hidden files and directories
          if (entry.name.startsWith('.')) continue;

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
                console.error('Failed to stat file:', fullPath, statErr);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to scan directory:', currentPath, err);
      }
    }

    try {
      scanDir(dirPath);
      return { success: true, files };
    } catch (error) {
      return { success: false, error: error.message, files: [] };
    }
  });

  // Copy file to app's document storage directory
  ipcMain.handle('fs:copyFileToStorage', async (event, sourcePath, targetFileName, customStoragePath = null) => {
    try {
      // Use custom path if provided, otherwise use default userData path
      const userDataPath = app.getPath('userData');
      console.log('app.getPath("userData"):', userDataPath);

      const baseStoragePath = customStoragePath || userDataPath;
      const storagePath = path.join(baseStoragePath, 'OmniCollector', 'documents');

      // Ensure storage directory exists
      if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
      }

      // 1. 规范化文件名 (NFC)，减少后续读取问题
      let safeFileName = (targetFileName || path.basename(sourcePath)).normalize('NFC');
      let targetPath = path.join(storagePath, safeFileName);

      // 2. 处理重名
      if (fs.existsSync(targetPath)) {
        const ext = path.extname(safeFileName);
        const baseName = path.basename(safeFileName, ext);
        safeFileName = `${baseName}_${Date.now()}${ext}`;
        targetPath = path.join(storagePath, safeFileName);
      }

      // 3. 复制文件
      fs.copyFileSync(sourcePath, targetPath);

      // 4. 再次验证并获取真实路径 (解决 macOS 自动转换 NFD 的问题)
      // 我们读取目录来确认实际落盘的文件名是什么
      const finalDir = path.dirname(targetPath);
      const writtenName = fs.readdirSync(finalDir).find(f => f.normalize('NFC') === safeFileName) || safeFileName;
      const finalTargetPath = path.join(finalDir, writtenName);

      console.log('copyFileToStorage - copied to:', finalTargetPath);

      return { success: true, targetPath: finalTargetPath, fileName: writtenName };
    } catch (error) {
      console.error('copyFileToStorage error:', error);
      return { success: false, error: error.message };
    }
  });

  // Export file to external destination
  ipcMain.handle('fs:exportFile', async (event, sourcePath, targetDir, targetFileName) => {
    try {
      if (!fs.existsSync(sourcePath)) {
        return { success: false, error: `Source file not found: ${sourcePath}` };
      }

      // Ensure target directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Safe filename
      const safeFileName = (targetFileName || path.basename(sourcePath)).normalize('NFC');

      // Handle duplicates by appending number
      let targetPath = path.join(targetDir, safeFileName);
      let counter = 1;
      const ext = path.extname(safeFileName);
      const baseName = path.basename(safeFileName, ext);

      while (fs.existsSync(targetPath)) {
        targetPath = path.join(targetDir, `${baseName} (${counter})${ext}`);
        counter++;
      }

      fs.copyFileSync(sourcePath, targetPath);
      console.log('Exported file to:', targetPath);

      return { success: true, path: targetPath };
    } catch (error) {
      console.error('fs:exportFile error:', error);
      return { success: false, error: error.message };
    }
  });

  // Import file to ID-based storage (Scheme A)
  // Import file to ID-based storage (Scheme A)
  ipcMain.handle('fs:importFileToIdStorage', async (event, sourcePath, itemId) => {
    try {
      const paths = getFileStoragePaths();
      const itemDir = path.join(paths.files, itemId);

      if (!fs.existsSync(itemDir)) {
        fs.mkdirSync(itemDir, { recursive: true });
      }

      // Normalize filename to avoid encoding issues
      const fileName = path.basename(sourcePath).normalize('NFC');
      const targetPath = path.join(itemDir, fileName);

      // Copy file
      fs.copyFileSync(sourcePath, targetPath);
      console.log('Imported file to ID storage:', targetPath);

      // Return relative path for portability if needed, but absolute is fine for now as getFilePath handles it
      return { success: true, targetPath: targetPath, fileName: fileName };
    } catch (error) {
      console.error('fs:importFileToIdStorage error:', error);
      return { success: false, error: error.message };
    }
  });

  // Select storage directory
  ipcMain.handle('dialog:selectDirectory', async (event, title = 'Select Storage Directory') => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title,
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, path: null };
    }
    return { success: true, path: result.filePaths[0] };
  });

  // Helper function to get MIME type from file extension
  function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.epub': 'application/epub+zip',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // ============================================
  // JSON File Storage System
  // ============================================

  // Get storage paths
  function getStoragePaths() {
    const userDataPath = app.getPath('userData');
    const basePath = path.join(userDataPath, 'OmniCollector');
    return {
      base: basePath,
      data: path.join(basePath, 'data'),
      backups: path.join(basePath, 'backups'),
      libraryFile: path.join(basePath, 'data', 'library.json'),
      settingsFile: path.join(basePath, 'data', 'settings.json'),
    };
  }

  // Ensure storage directories exist
  function ensureStorageDirectories() {
    const paths = getStoragePaths();
    [paths.data, paths.backups].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Create backup of library.json (keep last 5)
  function createLibraryBackup() {
    const paths = getStoragePaths();
    if (!fs.existsSync(paths.libraryFile)) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(paths.backups, `library-${timestamp}.json`);

    try {
      fs.copyFileSync(paths.libraryFile, backupFile);
      console.log('[Storage] Created backup:', backupFile);

      // Clean old backups (keep last 5)
      const backups = fs.readdirSync(paths.backups)
        .filter(f => f.startsWith('library-') && f.endsWith('.json'))
        .sort()
        .reverse();

      if (backups.length > 5) {
        backups.slice(5).forEach(oldBackup => {
          const oldPath = path.join(paths.backups, oldBackup);
          fs.unlinkSync(oldPath);
          console.log('[Storage] Removed old backup:', oldBackup);
        });
      }
    } catch (error) {
      console.error('[Storage] Backup failed:', error);
    }
  }

  // ============================================
  // File Storage System (Eagle-style structure)
  // ============================================

  function getFileStoragePaths() {
    const userDataPath = app.getPath('userData');
    const basePath = path.join(userDataPath, 'OmniCollector');
    return {
      base: basePath,
      files: path.join(basePath, 'files'),
    };
  }

  ipcMain.handle('fileStorage:getStoragePath', () => {
    const paths = getFileStoragePaths();
    if (!fs.existsSync(paths.files)) {
      fs.mkdirSync(paths.files, { recursive: true });
    }
    return paths.files;
  });

  ipcMain.handle('fileStorage:createItemStorage', async (event, itemId) => {
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

  ipcMain.handle('fileStorage:saveFileToStorage', async (event, itemId, fileName, base64Data) => {
    const paths = getFileStoragePaths();
    const itemDir = path.join(paths.files, itemId);
    const filePath = path.join(itemDir, fileName);
    try {
      if (!fs.existsSync(itemDir)) {
        fs.mkdirSync(itemDir, { recursive: true });
      }
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);
      return { success: true, path: filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fileStorage:readFileFromStorage', async (event, itemId, fileName) => {
    const paths = getFileStoragePaths();
    const filePath = path.join(paths.files, itemId, fileName);
    try {
      const data = fs.readFileSync(filePath);
      const mimeType = getMimeType(fileName);
      const base64 = data.toString('base64');
      return { success: true, dataUrl: `data:${mimeType};base64,${base64}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fileStorage:getFilePath', async (event, itemId, fileName) => {
    const paths = getFileStoragePaths();
    const itemDir = path.join(paths.files, itemId);
    const userDataPath = app.getPath('userData');
    const legacyStoragePath = path.join(userDataPath, 'OmniCollector', 'documents');

    // 辅助函数：在指定目录下查找文件（支持精确匹配、NFC/NFD 模糊匹配）
    const findFileInDir = (dir, name) => {
      if (!fs.existsSync(dir) || !name) return null;

      // 1. 精确匹配
      const exactPath = path.join(dir, name);
      if (fs.existsSync(exactPath)) return exactPath;

      // 2. 模糊匹配 (扫描目录)
      try {
        const entries = fs.readdirSync(dir);
        const normalizedTarget = name.normalize('NFC');

        // 优先找名字匹配的 (处理 Mac NFD 问题)
        const nameMatch = entries.find(entry =>
          entry.normalize('NFC') === normalizedTarget ||
          entry.normalize('NFD') === normalizedTarget
        );
        if (nameMatch) return path.join(dir, nameMatch);

        // 3. 智能回退：如果是 ID 目录，且只有一个主要文件，直接返回它
        // (排除 metadata.json, .DS_Store 等)
        if (dir.includes(itemId)) {
          const contentFile = entries.find(entry =>
            !entry.startsWith('.') &&
            entry !== 'metadata.json' &&
            !entry.endsWith('.tmp') &&
            !entry.endsWith('.png') // 排除缩略图
          );
          if (contentFile) {
            console.log(`[getFilePath] Auto-matched content file: ${contentFile}`);
            return path.join(dir, contentFile);
          }
        }
      } catch (e) {
        console.warn('[getFilePath] Scan failed:', e);
      }
      return null;
    };

    // --- 查找逻辑开始 ---

    // 1. 优先检查 Eagle 风格目录: files/{id}/{name}
    // Optimization: Directly check the most likely path first without scanning
    if (fileName) {
      const directPath = path.join(itemDir, fileName);
      if (fs.existsSync(directPath)) return directPath;
    }

    // Then try scanning the item folder for loose matches or other files
    const eaglePath = findFileInDir(itemDir, fileName);
    if (eaglePath) return eaglePath;

    // 2. 如果找不到，回退检查旧的 documents 目录: documents/{name}
    const legacyPath = findFileInDir(legacyStoragePath, fileName);
    if (legacyPath) {
      // console.log(`[getFilePath] Found file in legacy storage: ${legacyPath}`);
      return legacyPath;
    }

    // 3. 最后回退：扫描 legacy documents 目录查找任何匹配文件
    // (用于处理文件名不完全匹配的情况)
    try {
      if (fs.existsSync(legacyStoragePath)) {
        const entries = fs.readdirSync(legacyStoragePath);
        // 尝试用 ID 作为文件名的一部分来查找
        const idMatch = entries.find(entry =>
          entry.includes(itemId.split('-')[0]) ||
          entry.includes(itemId)
        );
        if (idMatch) {
          const foundPath = path.join(legacyStoragePath, idMatch);
          // console.log(`[getFilePath] Found by ID pattern: ${foundPath}`);
          return foundPath;
        }

        // 如果文件名来自 title，可能没有扩展名，尝试添加常见扩展名
        if (fileName && !fileName.includes('.')) {
          const exts = ['.pdf', '.docx', '.doc', '.epub', '.jpg', '.png'];
          for (const ext of exts) {
            const withExt = fileName + ext;
            const withExtPath = path.join(legacyStoragePath, withExt);
            if (fs.existsSync(withExtPath)) {
              // console.log(`[getFilePath] Found with extension: ${withExtPath}`);
              return withExtPath;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[getFilePath] Legacy scan failed:', e);
    }

    // 4. 搜索 folders 目录 (文件迁移后可能在这里)
    try {
      const foldersPath = path.join(paths.base, 'folders');
      if (fs.existsSync(foldersPath)) {
        const folderDirs = fs.readdirSync(foldersPath, { withFileTypes: true });
        for (const dir of folderDirs) {
          if (dir.isDirectory()) {
            const folderPath = path.join(foldersPath, dir.name);
            const foundPath = findFileInDir(folderPath, fileName);
            if (foundPath) {
              // console.log(`[getFilePath] Found in folders directory: ${foundPath}`);
              return foundPath;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[getFilePath] Folders scan failed:', e);
    }

    // 5. 还是找不到，返回 null（不再返回无效路径）
    // console.log(`[getFilePath] File not found for item ${itemId}, fileName: ${fileName}`);
    return null;
  });

  ipcMain.handle('fileStorage:deleteItemStorage', async (event, itemId) => {
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

  ipcMain.handle('fileStorage:saveItemMetadata', async (event, itemId, metadata) => {
    const paths = getFileStoragePaths();
    const metadataPath = path.join(paths.files, itemId, 'metadata.json');
    try {
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fileStorage:readItemMetadata', async (event, itemId) => {
    const paths = getFileStoragePaths();
    const metadataPath = path.join(paths.files, itemId, 'metadata.json');
    try {
      if (!fs.existsSync(metadataPath)) return null;
      const content = fs.readFileSync(metadataPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  });

  // ============================================
  // File Storage: Move File to Folder (for folder migration)
  // ============================================

  ipcMain.handle('fileStorage:moveFileToFolder', async (event, itemId, fileName, folderId) => {
    const paths = getFileStoragePaths();
    const foldersDir = path.join(paths.base, 'folders');
    const sourcePath = path.join(paths.files, itemId, fileName);
    const targetDir = path.join(foldersDir, folderId || 'uncategorized');
    const targetPath = path.join(targetDir, fileName);

    try {
      // Ensure target directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Check if source file exists
      if (!fs.existsSync(sourcePath)) {
        return { success: false, error: 'Source file not found' };
      }

      // Move the file
      fs.renameSync(sourcePath, targetPath);

      console.log(`[fileStorage] Moved file to folder: ${sourcePath} -> ${targetPath}`);
      return { success: true, path: targetPath };
    } catch (error) {
      console.error('[fileStorage] Failed to move file to folder:', error);
      return { success: false, error: error.message };
    }
  });

  // ============================================
  // MTime Tracking System (Eagle-style mtime.json)
  // ============================================

  function getMTimeFilePath() {
    const paths = getStoragePaths();
    return path.join(paths.data, 'mtime.json');
  }

  ipcMain.handle('mtime:readMTime', async () => {
    const mtimePath = getMTimeFilePath();
    try {
      if (!fs.existsSync(mtimePath)) {
        return { times: {}, count: 0, lastModified: new Date().toISOString() };
      }
      const content = fs.readFileSync(mtimePath, 'utf-8');
      const data = JSON.parse(content);
      const count = data.all || Object.keys(data).filter(k => k !== 'all').length;
      return { times: data, count, lastModified: new Date().toISOString() };
    } catch (error) {
      return { times: {}, count: 0, lastModified: new Date().toISOString() };
    }
  });

  ipcMain.handle('mtime:updateMTime', async (event, itemId) => {
    const mtimePath = getMTimeFilePath();
    ensureStorageDirectories();
    try {
      let data = {};
      if (fs.existsSync(mtimePath)) {
        try { data = JSON.parse(fs.readFileSync(mtimePath, 'utf-8')); } catch (e) { data = {}; }
      }
      data[itemId] = Date.now();
      data.all = Object.keys(data).filter(k => k !== 'all').length;
      fs.writeFileSync(mtimePath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('mtime:setMTime', async (event, itemId, timestamp) => {
    const mtimePath = getMTimeFilePath();
    ensureStorageDirectories();
    try {
      let data = {};
      if (fs.existsSync(mtimePath)) {
        try { data = JSON.parse(fs.readFileSync(mtimePath, 'utf-8')); } catch (e) { data = {}; }
      }
      data[itemId] = timestamp;
      data.all = Object.keys(data).filter(k => k !== 'all').length;
      fs.writeFileSync(mtimePath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('mtime:removeMTime', async (event, itemId) => {
    const mtimePath = getMTimeFilePath();
    try {
      if (!fs.existsSync(mtimePath)) return { success: true };
      let data = JSON.parse(fs.readFileSync(mtimePath, 'utf-8'));
      delete data[itemId];
      data.all = Object.keys(data).filter(k => k !== 'all').length;
      fs.writeFileSync(mtimePath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('mtime:getMTime', async (event, itemId) => {
    const mtimePath = getMTimeFilePath();
    try {
      if (!fs.existsSync(mtimePath)) return null;
      const content = fs.readFileSync(mtimePath, 'utf-8');
      const data = JSON.parse(content);
      return data[itemId] || null;
    } catch (error) {
      return null;
    }
  });

  ipcMain.handle('mtime:getAll', async () => {
    const mtimePath = getMTimeFilePath();
    try {
      if (!fs.existsSync(mtimePath)) return {};
      const content = fs.readFileSync(mtimePath, 'utf-8');
      const data = JSON.parse(content);
      const { all, ...times } = data;
      return times;
    } catch (error) {
      return {};
    }
  });

  ipcMain.handle('mtime:getCount', async () => {
    const mtimePath = getMTimeFilePath();
    try {
      if (!fs.existsSync(mtimePath)) return 0;
      const content = fs.readFileSync(mtimePath, 'utf-8');
      const data = JSON.parse(content);
      return data.all || Object.keys(data).filter(k => k !== 'all').length;
    } catch (error) {
      return 0;
    }
  });

  // ============================================
  // Backup System (Eagle-style)
  // ============================================

  function getBackupPaths() {
    const paths = getStoragePaths();
    return { backupDir: path.join(paths.base, 'backups') };
  }

  ipcMain.handle('backup:createBackup', async (event, data) => {
    const { backupDir } = getBackupPaths();
    try {
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const now = new Date();
      const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\./g, '-').replace('T', ' ').split(' ')[0] + ' ' + now.toTimeString().split(' ')[0].replace(/:/g, '.');
      const backupFile = path.join(backupDir, `backup-${timestamp}.${Date.now()}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true, path: backupFile };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('backup:listBackups', async () => {
    const { backupDir } = getBackupPaths();
    try {
      if (!fs.existsSync(backupDir)) return [];
      const files = fs.readdirSync(backupDir).filter(f => f.startsWith('backup-') && f.endsWith('.json')).sort().reverse();
      return files.map(fileName => {
        const filePath = path.join(backupDir, fileName);
        const stats = fs.statSync(filePath);
        let timestamp = new Date();
        const match = fileName.match(/backup-(.+)\.\d+\.json/);
        if (match && match[1]) { try { timestamp = new Date(match[1].replace(' ', 'T')); } catch (e) { } }
        let itemCount = 0;
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const d = JSON.parse(content);
          itemCount = d._backupInfo?.itemCount || d.items?.length || 0;
        } catch (e) { }
        return { path: filePath, fileName, timestamp, size: stats.size, itemCount };
      });
    } catch (error) {
      return [];
    }
  });

  ipcMain.handle('backup:restoreBackup', async (event, backupPath) => {
    try {
      if (!fs.existsSync(backupPath)) return { success: false, error: 'Backup file not found' };
      const content = fs.readFileSync(backupPath, 'utf-8');
      const data = JSON.parse(content);
      const { _backupInfo, ...restoreData } = data;
      return { success: true, data: restoreData };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('backup:deleteBackup', async (event, backupPath) => {
    try {
      if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('backup:cleanupOldBackups', async (event, keepCount = 30) => {
    const { backupDir } = getBackupPaths();
    try {
      if (!fs.existsSync(backupDir)) return { deleted: 0 };
      const files = fs.readdirSync(backupDir).filter(f => f.startsWith('backup-') && f.endsWith('.json')).sort().reverse();
      if (files.length <= keepCount) return { deleted: 0 };
      const toDelete = files.slice(keepCount);
      let deleted = 0;
      for (const fileName of toDelete) {
        const filePath = path.join(backupDir, fileName);
        try { fs.unlinkSync(filePath); deleted++; } catch (e) { console.error('Failed to delete backup:', filePath); }
      }
      return { deleted };
    } catch (error) {
      return { deleted: 0, error: error.message };
    }
  });

  ipcMain.handle('backup:getBackupPath', async () => {
    const { backupDir } = getBackupPaths();
    ensureStorageDirectories();
    return backupDir;
  });

  // ============================================
  // Folder Directory System (Eagle-style folders)
  // ============================================

  function getFolderPaths() {
    const paths = getStoragePaths();
    return {
      base: path.join(paths.base, 'folders'),
    };
  }

  ipcMain.handle('folder:getFoldersPath', () => {
    const paths = getFolderPaths();
    if (!fs.existsSync(paths.base)) {
      fs.mkdirSync(paths.base, { recursive: true });
    }
    return paths.base;
  });

  ipcMain.handle('folder:create', async (event, folderId) => {
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

  ipcMain.handle('folder:delete', async (event, folderId) => {
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

  ipcMain.handle('folder:exists', async (event, folderId) => {
    const paths = getFolderPaths();
    const folderPath = path.join(paths.base, folderId);
    return fs.existsSync(folderPath);
  });

  // ============================================
  // Item Metadata System (Eagle-style items/{id}/metadata.json)
  // ============================================

  function getItemsPaths() {
    const paths = getStoragePaths();
    return {
      base: path.join(paths.base, 'items'),
      indexFile: path.join(paths.base, 'items', 'index.json'),
    };
  }

  ipcMain.handle('item:getItemsPath', () => {
    const paths = getItemsPaths();
    if (!fs.existsSync(paths.base)) {
      fs.mkdirSync(paths.base, { recursive: true });
    }
    return paths.base;
  });

  ipcMain.handle('item:saveMetadata', async (event, itemId, metadata) => {
    const paths = getItemsPaths();
    const metadataPath = path.join(paths.base, itemId, 'metadata.json');
    try {
      if (!fs.existsSync(path.join(paths.base, itemId))) {
        fs.mkdirSync(path.join(paths.base, itemId), { recursive: true });
      }
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
      return { success: true, path: metadataPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('item:readMetadata', async (event, itemId) => {
    const paths = getItemsPaths();
    const metadataPath = path.join(paths.base, itemId, 'metadata.json');
    try {
      if (!fs.existsSync(metadataPath)) return null;
      const content = fs.readFileSync(metadataPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  });

  ipcMain.handle('item:deleteMetadata', async (event, itemId) => {
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

  ipcMain.handle('item:saveIndex', async (event, index) => {
    const paths = getItemsPaths();
    try {
      fs.writeFileSync(paths.indexFile, JSON.stringify(index, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('item:readIndex', async () => {
    const paths = getItemsPaths();
    try {
      if (!fs.existsSync(paths.indexFile)) return null;
      const content = fs.readFileSync(paths.indexFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  });

  // ============================================
  // File Move API (for moving files between folders)
  // ============================================

  ipcMain.handle('file:moveFile', async (event, sourcePath, targetPath) => {
    try {
      // Ensure target directory exists
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Check if source file exists
      if (!fs.existsSync(sourcePath)) {
        return { success: false, error: 'Source file does not exist' };
      }

      // If target file exists, remove it first
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }

      // Move/copy the file
      fs.copyFileSync(sourcePath, targetPath);

      // Remove the source file if it's in our storage directory
      const storagePaths = getStoragePaths();
      const storageFilesDir = path.join(storagePaths.base, 'files');
      if (sourcePath.startsWith(storageFilesDir)) {
        fs.unlinkSync(sourcePath);
      }

      return { success: true, path: targetPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ============================================
  // Thumbnail Storage API
  // ============================================

  function getThumbnailsPath() {
    const paths = getStoragePaths();
    return {
      base: path.join(paths.base, 'thumbnails'),
      thumbnailsDir: path.join(paths.base, 'thumbnails', 'images'),
    };
  }

  ipcMain.handle('fileStorage:saveThumbnail', async (event, itemId, dataUrl) => {
    const paths = getThumbnailsPath();
    try {
      if (!fs.existsSync(paths.thumbnailsDir)) {
        fs.mkdirSync(paths.thumbnailsDir, { recursive: true });
      }

      // Extract base64 data from data URL
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Save as PNG for quality
      const thumbnailPath = path.join(paths.thumbnailsDir, `${itemId}.png`);
      fs.writeFileSync(thumbnailPath, buffer);

      return { success: true, path: thumbnailPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('fileStorage:readThumbnail', async (event, itemId) => {
    const paths = getThumbnailsPath();
    try {
      const thumbnailPath = path.join(paths.thumbnailsDir, `${itemId}.png`);
      if (!fs.existsSync(thumbnailPath)) {
        return null;
      }
      const data = fs.readFileSync(thumbnailPath);
      const dataUrl = `data:image/png;base64,${data.toString('base64')}`;
      return { dataUrl, path: thumbnailPath };
    } catch (error) {
      return null;
    }
  });

  ipcMain.handle('fileStorage:deleteThumbnail', async (event, itemId) => {
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

  // Get data directory path
  ipcMain.handle('storage:getDataPath', () => {
    const paths = getStoragePaths();
    ensureStorageDirectories();
    return paths.data;
  });

  // Read library.json
  ipcMain.handle('storage:readLibrary', async () => {
    const paths = getStoragePaths();
    ensureStorageDirectories();

    try {
      if (!fs.existsSync(paths.libraryFile)) {
        console.log('[Storage] library.json not found, returning null');
        return null;
      }

      const content = fs.readFileSync(paths.libraryFile, 'utf-8');
      const data = JSON.parse(content);
      console.log('[Storage] Loaded library.json, items:', data.items?.length || 0);
      return data;
    } catch (error) {
      console.error('[Storage] Failed to read library.json:', error);
      return null;
    }
  });

  // Write library.json (with auto-backup)
  ipcMain.handle('storage:writeLibrary', async (event, data) => {
    const paths = getStoragePaths();
    ensureStorageDirectories();

    try {
      // Create backup before overwriting (if file exists)
      if (fs.existsSync(paths.libraryFile)) {
        createLibraryBackup();
      }

      // Update lastModified timestamp
      data.lastModified = new Date().toISOString();

      // Write atomically: write to temp file first, then rename
      const tempFile = paths.libraryFile + '.tmp';
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempFile, paths.libraryFile);

      console.log('[Storage] Saved library.json, items:', data.items?.length || 0);
      return { success: true };
    } catch (error) {
      console.error('[Storage] Failed to write library.json:', error);
      return { success: false, error: error.message };
    }
  });

  // Read settings.json
  ipcMain.handle('storage:readSettings', async () => {
    const paths = getStoragePaths();
    ensureStorageDirectories();

    try {
      if (!fs.existsSync(paths.settingsFile)) {
        console.log('[Storage] settings.json not found, returning null');
        return null;
      }

      const content = fs.readFileSync(paths.settingsFile, 'utf-8');
      const data = JSON.parse(content);
      console.log('[Storage] Loaded settings.json');
      return data;
    } catch (error) {
      console.error('[Storage] Failed to read settings.json:', error);
      return null;
    }
  });

  // Write settings.json
  ipcMain.handle('storage:writeSettings', async (event, data) => {
    const paths = getStoragePaths();
    ensureStorageDirectories();

    try {
      // Write atomically
      const tempFile = paths.settingsFile + '.tmp';
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempFile, paths.settingsFile);

      console.log('[Storage] Saved settings.json');
      return { success: true };
    } catch (error) {
      console.error('[Storage] Failed to write settings.json:', error);
      return { success: false, error: error.message };
    }
  });

  // Migrate data from localStorage to JSON files
  ipcMain.handle('storage:migrate', async (event, legacyData) => {
    const paths = getStoragePaths();
    ensureStorageDirectories();

    try {
      // Create library.json from legacy data
      const libraryData = {
        version: 1,
        lastModified: new Date().toISOString(),
        items: legacyData.items || [],
        tags: legacyData.tags || [],
        folders: legacyData.folders || [],
      };

      // Create settings.json from legacy data
      const settingsData = {
        version: 1,
        colorMode: legacyData.colorMode || 'dark',
        themeId: legacyData.themeId || 'blue',
        locale: legacyData.locale || 'en',
        customStoragePath: legacyData.storagePath || null,
        viewMode: legacyData.viewMode || 'list',
        filterState: legacyData.filterState || { search: '', tagId: null, folderId: 'all' },
        recentFiles: legacyData.recentFiles || [],
        favoriteFolders: legacyData.favoriteFolders || [],
      };

      // Write both files
      fs.writeFileSync(paths.libraryFile, JSON.stringify(libraryData, null, 2), 'utf-8');
      fs.writeFileSync(paths.settingsFile, JSON.stringify(settingsData, null, 2), 'utf-8');

      console.log('[Storage] Migration completed successfully');
      console.log('[Storage] - Items:', libraryData.items.length);
      console.log('[Storage] - Tags:', libraryData.tags.length);
      console.log('[Storage] - Folders:', libraryData.folders.length);

      return { success: true, libraryData, settingsData };
    } catch (error) {
      console.error('[Storage] Migration failed:', error);
      return { success: false, error: error.message };
    }
  });
}
console.log('🔍 准备注册协议...');
// Register custom protocol for local file access
// This allows the renderer to access local files via localfile:// URLs
try {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'localfile',
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
  console.error('❌ 严重错误：无法注册协议，跳过以启动窗口:', err);
}

console.log('⏳ 等待 app.whenReady...');

// App events
app.whenReady().then(async () => {
  console.log('[App] whenReady fired');

  // Initialize search index manager (BM25 FTS5)
  const userDataPath = app.getPath('userData');
  console.log('[App] userDataPath:', userDataPath);
  try {
    console.log('正在初始化搜索服务...');
    // Now with fixed require() instead of dynamic import
    // await searchIndexManager.initialize(userDataPath);
    console.log('搜索服务初始化完成');
  } catch (err) {
    console.error('❌ 严重错误：搜索服务初始化失败，跳过以启动窗口:', err);
  }

  // Register all IPC handlers (must be done after app is ready)
  registerIPCHandlers();

  // Register the localfile protocol handler using registerFileProtocol (simpler API)
  protocol.registerFileProtocol('localfile', (request, callback) => {
    try {
      // URL format: localfile:///absolute/path/to/file (3 slashes)
      const url = request.url;
      console.log('[localfile protocol] raw URL:', url);

      // 1. Remove protocol prefix - URL format is localfile:///Users/...
      // After removing localfile://, the result should start with /Users/...
      let filePath = url.replace('localfile://', '');

      // 2. Ensure path starts with / for macOS absolute paths
      if (!filePath.startsWith('/')) {
        filePath = '/' + filePath;
      }

      // 3. Fix case: users -> Users (macOS path is case-insensitive but our logic needs consistency)
      if (filePath.startsWith('/users/')) {
        filePath = '/Users' + filePath.slice(6);
      }

      // 4. Normalize path for cross-platform compatibility
      const finalPath = path.normalize(filePath);
      console.log('[localfile protocol] final path:', finalPath);

      callback({ path: finalPath });
    } catch (error) {
      console.error('[localfile protocol] error:', error);
      callback({ error: -6 }); // FILE_NOT_FOUND
    }
  });

  createWindow();
  createMenu();
  httpServer.startServer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Cleanup
  httpServer.stopServer();
});

// ============================================
// Vector Store API (Semantic Search)
// ============================================

ipcMain.handle('vector:initialize', async (event, { modelId } = {}) => {
  const userDataPath = app.getPath('userData');
  return await vectorService.initialize(userDataPath, modelId);
});

// Alias for switching model (re-initializes)
ipcMain.handle('vector:setModel', async (event, { modelId }) => {
  const userDataPath = app.getPath('userData');
  return await vectorService.initialize(userDataPath, modelId);
});

ipcMain.handle('vector:index', async (event, { id, text, metadata }) => {
  return await vectorService.indexDocument(id, text, metadata);
});

ipcMain.handle('vector:search', async (event, { query, limit }) => {
  return await vectorService.search(query, limit || 10);
});

ipcMain.handle('vector:delete', async (event, { id }) => {
  return await vectorService.deleteDocument(id);
});

ipcMain.handle('vector:getStats', async () => {
  return await vectorService.getStats();
});

ipcMain.handle('vector:checkMissing', async (event, { ids }) => {
  return await vectorService.checkMissing(ids);
});

// ============================================
// Search Index API (BM25 Full-Text Search)
// ============================================

ipcMain.handle('search:index', async (event, { id, text, metadata }) => {
  return await searchIndexManager.indexDocument(id, text, metadata);
});

ipcMain.handle('search:delete', async (event, { id }) => {
  return await searchIndexManager.deleteDocument(id);
});

ipcMain.handle('search:bm25', async (event, { query, limit }) => {
  return await searchIndexManager.search(query, limit || 10);
});

ipcMain.handle('search:getStats', async () => {
  return await searchIndexManager.getStats();
});