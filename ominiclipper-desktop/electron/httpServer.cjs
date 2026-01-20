/**
 * OmniCollector Desktop - Local HTTP Server
 * Provides API for browser extension to sync items via IPC to renderer
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const PORT_FILE = '.omnicollector_port';

let server = null;

// Track main window for IPC
let mainWindowRef = null;

function setMainWindow(win) {
  mainWindowRef = win;
}

/**
 * Get user data directory
 */
function getUserDataPath() {
  return process.env.HOME || process.env.USERPROFILE;
}

/**
 * Get port file path
 */
function getPortFilePath() {
  return path.join(getUserDataPath(), PORT_FILE);
}

/**
 * Write port to file for browser extension discovery
 */
function writePortFile() {
  try {
    const portFilePath = getPortFilePath();
    fs.writeFileSync(portFilePath, String(PORT), 'utf8');
    console.log('[HTTP Server] Port written to:', portFilePath);
  } catch (error) {
    console.error('[HTTP Server] Failed to write port file:', error);
  }
}

/**
 * Delete port file
 */
function deletePortFile() {
  try {
    const portFilePath = getPortFilePath();
    if (fs.existsSync(portFilePath)) {
      fs.unlinkSync(portFilePath);
      console.log('[HTTP Server] Port file deleted');
    }
  } catch (error) {
    console.error('[HTTP Server] Failed to delete port file:', error);
  }
}

/**
 * Map browser extension ResourceType to desktop ResourceType
 */
function mapResourceType(browserType) {
  const typeMap = {
    'WEB': 'WEB',
    'ARTICLE': 'WEB',
    'IMAGE': 'IMAGE',
    'NOTE': 'WEB'
  };
  return typeMap[browserType] || 'WEB';
}

/**
 * Transform browser extension item to desktop format
 */
function transformItem(itemData) {
  return {
    id: itemData.id,
    title: itemData.title,
    type: mapResourceType(itemData.type),
    tags: itemData.tags || [],
    folderId: itemData.folderId,
    color: itemData.color || 'tag-gray',
    createdAt: itemData.createdAt,
    updatedAt: itemData.updatedAt || new Date().toISOString(),
    path: itemData.url || itemData.path,
    localPath: itemData.localPath,
    fileSize: itemData.fileSize,
    mimeType: itemData.mimeType,
    isCloud: false,
    isStarred: itemData.isStarred || false,
    contentSnippet: itemData.contentSnippet || itemData.description,
    aiSummary: itemData.aiSummary,
    storageMode: itemData.storageMode,
    embeddedData: itemData.embeddedData,
    originalPath: itemData.originalPath,
    source: 'browser-extension'
  };
}

/**
 * Send sync command to renderer process
 */
function sendToRenderer(desktopItem) {
  if (!mainWindowRef) {
    console.log('[HTTP Server] No main window available');
    return { success: false, error: 'No window' };
  }

  try {
    mainWindowRef.webContents.executeJavaScript(`
      (function() {
        if (typeof window.handleBrowserExtensionSync === 'function') {
          window.handleBrowserExtensionSync(${JSON.stringify(desktopItem)});
          return { success: true };
        }
        return { success: false, error: 'Handler not found' };
      })();
    `).then((result) => {
      console.log('[HTTP Server] Sync result:', result);
    }).catch((err) => {
      console.error('[HTTP Server] Failed to execute in renderer:', err);
    });

    return { success: true, sent: true };
  } catch (error) {
    console.error('[HTTP Server] Failed to send to renderer:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Parse request body
 */
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : null);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

/**
 * Handle incoming requests
 */
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  console.log(`[HTTP Server] ${req.method} ${pathname}`);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  try {
    // GET /api/ping - Health check
    if (pathname === '/api/ping' && req.method === 'GET') {
      sendJson(res, 200, { status: 'ok', server: 'omnicollector-desktop' });
      return;
    }

    // POST /api/sync - Sync items from browser extension
    if (pathname === '/api/sync' && req.method === 'POST') {
      const body = await parseRequestBody(req);

      if (!body || !body.items) {
        sendJson(res, 400, { error: 'Missing items array' });
        return;
      }

      let synced = 0;
      let skipped = 0;

      for (const itemData of body.items) {
        const desktopItem = transformItem(itemData);
        const result = sendToRenderer(desktopItem);
        if (result.success) {
          synced++;
        } else {
          skipped++;
        }
      }

      sendJson(res, 200, {
        success: true,
        synced: synced,
        skipped: skipped,
        total: body.items.length
      });
      return;
    }

    // POST /api/sync-one - Sync single item
    if (pathname === '/api/sync-one' && req.method === 'POST') {
      const body = await parseRequestBody(req);

      if (!body || !body.id) {
        sendJson(res, 400, { error: 'Missing item data' });
        return;
      }

      const desktopItem = transformItem(body);
      const result = sendToRenderer(desktopItem);

      if (result.success) {
        sendJson(res, 200, { success: true, action: 'synced' });
      } else {
        sendJson(res, 500, { success: false, error: result.error });
      }
      return;
    }

    // 404 for other routes
    sendJson(res, 404, { error: 'Not found' });

  } catch (error) {
    console.error('[HTTP Server] Request error:', error);
    sendJson(res, 500, { error: error.message });
  }
}

/**
 * Start the HTTP server
 */
function startServer() {
  if (server) {
    console.log('[HTTP Server] Server already running');
    return;
  }

  server = http.createServer(handleRequest);

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.log('[HTTP Server] Port in use, trying another...');
    }
    console.error('[HTTP Server] Server error:', error);
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[HTTP Server] Started on http://127.0.0.1:${PORT}`);
    writePortFile();
  });
}

/**
 * Stop the HTTP server
 */
function stopServer() {
  if (server) {
    server.close(() => {
      console.log('[HTTP Server] Server stopped');
      server = null;
      deletePortFile();
    });
  } else {
    deletePortFile();
  }
}

/**
 * Check if server is running
 */
function isRunning() {
  return server !== null;
}

module.exports = {
  startServer,
  stopServer,
  isRunning,
  setMainWindow,
  PORT
};
