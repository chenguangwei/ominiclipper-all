/**
 * OmniClipper Desktop - Electron Main Process
 */

const electron = require('electron');
const { app, BrowserWindow, Menu, shell, ipcMain, dialog, protocol, net } = electron;
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const httpServer = require('./httpServer.cjs');

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

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'OmniClipper',
    icon: path.join(__dirname, '../../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    },
    backgroundColor: '#1e1e1e',
    titleBarStyle: 'hiddenInset',
    show: false
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
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
        { label: 'About OmniClipper', role: 'about' },
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
        { label: 'Hide OmniClipper', accelerator: 'Command+H', role: 'hide' },
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

// IPC Handlers for file operations
ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    const mimeType = getMimeType(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // For text-based files, also return the text content
    const textExtensions = ['.md', '.markdown', '.txt', '.json', '.xml', '.html', '.css', '.js', '.ts'];
    const isTextFile = textExtensions.includes(ext);

    return {
      success: true,
      buffer: data.toString('base64'),  // Always return base64 for binary compatibility
      content: isTextFile ? data.toString('utf-8') : null,  // Return text content for text files
      mimeType
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:readFileAsDataUrl', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    const mimeType = getMimeType(filePath);
    const base64 = data.toString('base64');
    return { success: true, dataUrl: `data:${mimeType};base64,${base64}` };
  } catch (error) {
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
    const baseStoragePath = customStoragePath || app.getPath('userData');
    const storagePath = path.join(baseStoragePath, 'OmniClipper', 'documents');

    // Ensure storage directory exists
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }

    // Generate unique filename if needed
    let finalFileName = targetFileName || path.basename(sourcePath);
    let targetPath = path.join(storagePath, finalFileName);

    // If file exists, add timestamp to filename
    if (fs.existsSync(targetPath)) {
      const ext = path.extname(finalFileName);
      const baseName = path.basename(finalFileName, ext);
      finalFileName = `${baseName}_${Date.now()}${ext}`;
      targetPath = path.join(storagePath, finalFileName);
    }

    // Copy file
    fs.copyFileSync(sourcePath, targetPath);

    return { success: true, targetPath, fileName: finalFileName };
  } catch (error) {
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

// Register custom protocol for local file access
// This allows the renderer to access local files via localfile:// URLs
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'localfile',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
]);

// App events
app.whenReady().then(() => {
  // Register the localfile protocol handler
  protocol.handle('localfile', (request) => {
    // URL format: localfile:///absolute/path/to/file
    const url = request.url;
    let filePath = url.replace('localfile:///', '');

    // Decode URI components (handles spaces and special characters)
    filePath = decodeURIComponent(filePath);

    // On Windows, convert /C:/... to C:\...
    if (process.platform === 'win32' && filePath.startsWith('/')) {
      filePath = filePath.slice(1);
    }

    console.log('localfile protocol request:', filePath);

    // Use net.fetch to return the file
    return net.fetch(pathToFileURL(filePath).href);
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
