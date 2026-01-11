/**
 * OmniClipper Background Service Worker
 * Handles background sync, notifications, offline queue, and cross-context communication
 */

const SYNC_ALARM_NAME = 'omniclipper-sync';
const SYNC_INTERVAL_MINUTES = 15;
const MAX_RETRY_ATTEMPTS = 3;
const BACKOFF_BASE_DELAY = 60000; // 1 minute base delay

// Storage keys - unified with desktop app
const STORAGE_KEY_ITEMS = 'OMNICLIPPER_ITEMS';
const STORAGE_KEY_SETTINGS = 'OMNICLIPPER_SETTINGS';
const STORAGE_KEY_TAGS = 'OMNICLIPPER_TAGS';
const STORAGE_KEY_FOLDERS = 'OMNICLIPPER_FOLDERS';
const STORAGE_KEY_SYNC_QUEUE = 'OMNICLIPPER_SYNC_QUEUE';

// Resource types
const ResourceType = {
  WEB: 'WEB',
  ARTICLE: 'ARTICLE',
  IMAGE: 'IMAGE',
  NOTE: 'NOTE'
};

/**
 * Initialize background service worker
 */
function init() {
  // Create context menu
  createContextMenu();

  // Set up alarm for periodic sync
  setupSyncAlarm();

  // Set up message listeners
  setupMessageListeners();

  // Set up alarm listener
  chrome.alarms.onAlarm.addListener(handleAlarm);

  // Set up online/offline listeners
  setupNetworkListeners();

  console.log('OmniClipper Background Service Worker initialized');
}

/**
 * Set up network status listeners
 */
function setupNetworkListeners() {
  // When coming back online, trigger sync
  chrome.runtime.onStartup.addListener(async () => {
    console.log('Extension started, checking for pending items...');
    await syncPendingItems();
  });

  // Listen for network status changes
  if (typeof navigator !== 'undefined') {
    self.addEventListener('online', async () => {
      console.log('Network online, syncing pending items...');
      await syncPendingItems();
    });

    self.addEventListener('offline', () => {
      console.log('Network offline, queueing will be enabled');
    });
  }
}

/**
 * Create context menu items
 */
function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    // Main menu
    chrome.contextMenus.create({
      id: 'omniclipper-root',
      title: 'OmniClipper',
      contexts: ['page', 'selection', 'link', 'image']
    });

    // Capture as Website
    chrome.contextMenus.create({
      id: 'capture-website',
      parentId: 'omniclipper-root',
      title: 'Save as Website',
      contexts: ['page']
    });

    // Capture as Article
    chrome.contextMenus.create({
      id: 'capture-article',
      parentId: 'omniclipper-root',
      title: 'Extract Article',
      contexts: ['page']
    });

    // Capture selection as Note
    chrome.contextMenus.create({
      id: 'capture-selection',
      parentId: 'omniclipper-root',
      title: 'Save Selection as Note',
      contexts: ['selection']
    });

    // Capture link
    chrome.contextMenus.create({
      id: 'capture-link',
      parentId: 'omniclipper-root',
      title: 'Save Link',
      contexts: ['link']
    });

    // Capture image
    chrome.contextMenus.create({
      id: 'capture-image',
      parentId: 'omniclipper-root',
      title: 'Save Image',
      contexts: ['image']
    });

    // Screenshot submenu
    chrome.contextMenus.create({
      id: 'capture-screenshot',
      parentId: 'omniclipper-root',
      title: 'Screenshot',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: 'capture-visible',
      parentId: 'capture-screenshot',
      title: 'Visible Area',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: 'capture-fullpage',
      parentId: 'capture-screenshot',
      title: 'Full Page',
      contexts: ['page']
    });

    chrome.contextMenus.create({
      id: 'capture-area',
      parentId: 'capture-screenshot',
      title: 'Select Area',
      contexts: ['page']
    });
  });
}

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  switch (info.menuItemId) {
    case 'capture-website':
      chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_PAGE' });
      break;

    case 'capture-article':
      chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_ARTICLE' });
      break;

    case 'capture-selection':
      if (info.selectionText) {
        await openPopupWithData({
          type: ResourceType.NOTE,
          title: info.selectionText.substring(0, 50) + (info.selectionText.length > 50 ? '...' : ''),
          content: info.selectionText,
          url: tab.url,
          sourceUrl: tab.url
        });
      }
      break;

    case 'capture-link':
      if (info.linkUrl) {
        await openPopupWithData({
          type: ResourceType.WEB,
          url: info.linkUrl,
          title: info.linkText || 'Untitled Link',
          description: ''
        });
      }
      break;

    case 'capture-image':
      if (info.srcUrl) {
        // Fetch image and convert to base64
        try {
          const response = await fetch(info.srcUrl);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = async () => {
            await openPopupWithData({
              type: ResourceType.IMAGE,
              title: 'Captured Image',
              imageData: reader.result,
              imageMimeType: blob.type,
              sourceUrl: info.srcUrl,
              url: tab.url
            });
          };
          reader.readAsDataURL(blob);
        } catch (error) {
          console.error('Failed to capture image:', error);
          await openPopupWithData({
            type: ResourceType.IMAGE,
            title: 'Image',
            sourceUrl: info.srcUrl,
            url: tab.url
          });
        }
      }
      break;

    case 'capture-visible':
      chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_VISIBLE' });
      break;

    case 'capture-fullpage':
      chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_FULL_PAGE' });
      break;

    case 'capture-area':
      chrome.tabs.sendMessage(tab.id, { type: 'START_AREA_SELECTION' });
      break;
  }
});

/**
 * Set up periodic sync alarm
 */
function setupSyncAlarm() {
  chrome.alarms.get(SYNC_ALARM_NAME, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(SYNC_ALARM_NAME, {
        periodInMinutes: SYNC_INTERVAL_MINUTES
      });
    }
  });
}

/**
 * Handle alarm triggers
 */
function handleAlarm(alarm) {
  if (alarm.name === SYNC_ALARM_NAME) {
    syncPendingItems();
  }
}

/**
 * Set up message listeners
 */
function setupMessageListeners() {
  // Handle messages from content script and popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  });
}

/**
 * Handle incoming messages
 */
async function handleMessage(message, sender) {
  switch (message.type) {
    case 'OPEN_POPUP_WITH_DATA':
      await openPopupWithData(message.data);
      return { success: true };

    case 'SAVE_ITEM':
      return await saveItem(message.item);

    case 'SYNC_ITEM':
      return await syncItem(message.item);

    case 'SYNC_ALL_PENDING':
      return await syncPendingItems();

    case 'GET_PENDING_COUNT':
      const pending = await getPendingItems();
      return { success: true, count: pending.length };

    case 'GET_SYNC_STATUS':
      return await getSyncStatus();

    case 'CAPTURE_FROM_BACKGROUND':
      return await captureFromBackground(message.options);

    case 'UPDATE_BADGE':
      await updateBadge(message.count);
      return { success: true };

    case 'CLEAR_SYNC_QUEUE':
      await clearSyncQueue();
      return { success: true };

    case 'RETRY_FAILED_ITEMS':
      return await retryFailedItems();

    case 'SCREENSHOT_CAPTURED':
      await openPopupWithData({
        type: ResourceType.IMAGE,
        title: 'Screenshot - ' + new Date().toLocaleString(),
        imageData: message.imageData,
        imageMimeType: 'image/png',
        url: sender.tab?.url,
        sourceUrl: sender.tab?.url
      });
      return { success: true };

    case 'CAPTURE_VISIBLE_TAB_REQUEST':
      // Capture visible tab screenshot
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        return { success: true, dataUrl };
      } catch (error) {
        console.error('Failed to capture visible tab:', error);
        return { success: false, error: error.message };
      }

    case 'CAPTURE_VISIBLE_TAB':
      // Legacy handler for content script
      try {
        const capturedDataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        return { success: true, dataUrl: capturedDataUrl };
      } catch (error) {
        console.error('Failed to capture visible tab:', error);
        return { success: false, error: error.message };
      }

    case 'CAPTURE_FULL_PAGE':
      // For now, just capture visible area (full page scrolling requires more complex logic)
      try {
        const fullPageDataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        return { success: true, dataUrl: fullPageDataUrl };
      } catch (error) {
        console.error('Failed to capture full page:', error);
        return { success: false, error: error.message };
      }

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

/**
 * Open popup with captured data
 */
async function openPopupWithData(data) {
  // Store data in localStorage for popup to read
  await chrome.storage.local.set({
    omniclipper_capture_data: JSON.stringify({
      ...data,
      timestamp: Date.now()
    })
  });

  // Open the extension popup
  if (chrome.action && chrome.action.openPopup) {
    try {
      await chrome.action.openPopup();
    } catch (error) {
      console.log('Could not open popup automatically:', error);
    }
  }
}

/**
 * Capture page from background context
 */
async function captureFromBackground(options) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error('No active tab found');
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'CAPTURE_PAGE',
      options
    });

    if (response.success) {
      await openPopupWithData(response.data);
      return { success: true, data: response.data };
    } else {
      throw new Error('Capture failed');
    }
  } catch (error) {
    // Fallback: get basic metadata only
    const metadata = await getTabMetadata(tab.id);
    await openPopupWithData({
      ...metadata,
      type: ResourceType.WEB,
      capturedAt: Date.now()
    });
    return { success: true, data: metadata };
  }
}

/**
 * Get tab metadata
 */
async function getTabMetadata(tabId) {
  const tab = await chrome.tabs.get(tabId);
  return {
    title: tab.title || '',
    url: tab.url || '',
    hostname: tab.url ? new URL(tab.url).hostname : '',
    favicon: tab.favIconUrl || ''
  };
}

// ==================== OFFLINE SYNC QUEUE ====================

/**
 * Get sync queue from storage
 */
async function getSyncQueue() {
  const result = await chrome.storage.local.get(STORAGE_KEY_SYNC_QUEUE);
  return result[STORAGE_KEY_SYNC_QUEUE] || [];
}

/**
 * Save sync queue to storage
 */
async function saveSyncQueue(queue) {
  await chrome.storage.local.set({ [STORAGE_KEY_SYNC_QUEUE]: queue });
}

/**
 * Add item to sync queue
 */
async function addToSyncQueue(item) {
  const queue = await getSyncQueue();

  // Check if item already exists in queue
  const existingIndex = queue.findIndex(q => q.id === item.id);

  const queueItem = {
    ...item,
    queuedAt: Date.now(),
    retryCount: 0,
    lastError: null,
    status: 'pending'
  };

  if (existingIndex >= 0) {
    // Update existing item
    queue[existingIndex] = queueItem;
  } else {
    // Add new item
    queue.push(queueItem);
  }

  await saveSyncQueue(queue);
  console.log(`Item ${item.id} added to sync queue`);
}

/**
 * Remove item from sync queue
 */
async function removeFromSyncQueue(itemId) {
  const queue = await getSyncQueue();
  const filtered = queue.filter(item => item.id !== itemId);
  await saveSyncQueue(filtered);
}

/**
 * Update item in sync queue
 */
async function updateSyncQueueItem(itemId, updates) {
  const queue = await getSyncQueue();
  const updated = queue.map(item =>
    item.id === itemId ? { ...item, ...updates } : item
  );
  await saveSyncQueue(updated);
}

/**
 * Clear sync queue
 */
async function clearSyncQueue() {
  await chrome.storage.local.remove(STORAGE_KEY_SYNC_QUEUE);
  console.log('Sync queue cleared');
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(retryCount) {
  return BACKOFF_BASE_DELAY * Math.pow(2, retryCount);
}

/**
 * Sync a single item with queue support
 */
async function syncItem(item) {
  try {
    // Check network status
    if (!navigator.onLine) {
      await addToSyncQueue(item);
      return { success: true, queued: true, message: 'Queued for offline sync' };
    }

    // Update sync status to syncing
    await updateItemSyncStatus(item.id, 'syncing');

    const settings = await getSettings();
    let success = false;

    if (settings.storageMode === 'feishu') {
      success = await syncToFeishu(settings.feishuConfig, item);
    } else if (settings.storageMode === 'supabase') {
      success = await syncToSupabase(settings.supabaseConfig, item, settings.userSession);
    } else {
      // Local mode - already synced
      success = true;
    }

    if (success) {
      await updateItemSyncStatus(item.id, 'synced');
      return { success: true };
    } else {
      await updateItemSyncStatus(item.id, 'error');
      // Add to queue for retry
      await addToSyncQueue(item);
      return { success: false, error: 'Sync failed', queued: true };
    }
  } catch (error) {
    await updateItemSyncStatus(item.id, 'error');
    // Add to queue for retry
    await addToSyncQueue({ ...item, lastError: error.message });
    return { success: false, error: error.message, queued: true };
  }
}

/**
 * Sync all pending items with queue management
 */
async function syncPendingItems() {
  const queue = await getSyncQueue();
  if (queue.length === 0) {
    // Also check items that need sync
    const pending = await getPendingItems();
    if (pending.length === 0) {
      await updateBadge(0);
      return { success: true, synced: 0, queued: 0 };
    }
  }

  // If offline, show notification
  if (!navigator.onLine) {
    console.log('Offline mode, sync queue active');
    await updateBadge(queue.length);
    return { success: true, synced: 0, queued: queue.length, offline: true };
  }

  let synced = 0;
  let failed = 0;
  const errors = [];

  for (const queueItem of queue) {
    try {
      // Check if should retry based on backoff
      if (queueItem.retryCount > 0) {
        const backoffDelay = getBackoffDelay(queueItem.retryCount);
        const timeSinceQueued = Date.now() - queueItem.queuedAt;
        if (timeSinceQueued < backoffDelay) {
          continue; // Skip this item, still in backoff period
        }
      }

      const result = await syncItem(queueItem);

      if (result.success) {
        synced++;
        await removeFromSyncQueue(queueItem.id);
      } else {
        failed++;
        errors.push({ id: queueItem.id, error: result.error });

        // Update retry count
        const newRetryCount = (queueItem.retryCount || 0) + 1;
        await updateSyncQueueItem(queueItem.id, {
          retryCount: newRetryCount,
          lastError: result.error,
          status: newRetryCount >= MAX_RETRY_ATTEMPTS ? 'failed' : 'pending'
        });
      }
    } catch (error) {
      failed++;
      errors.push({ id: queueItem.id, error: error.message });
    }
  }

  // Update badge with remaining queue count
  const remainingQueue = await getSyncQueue();
  await updateBadge(remainingQueue.length);

  return {
    success: failed === 0,
    synced,
    failed,
    errors,
    remaining: remainingQueue.length
  };
}

/**
 * Retry all failed items
 */
async function retryFailedItems() {
  const queue = await getSyncQueue();
  const failedItems = queue.filter(item =>
    item.status === 'failed' || item.retryCount >= MAX_RETRY_ATTEMPTS
  );

  // Reset retry count for failed items
  for (const item of failedItems) {
    await updateSyncQueueItem(item.id, {
      retryCount: 0,
      status: 'pending',
      lastError: null
    });
  }

  return await syncPendingItems();
}

/**
 * Get overall sync status
 */
async function getSyncStatus() {
  const queue = await getSyncQueue();
  const pending = await getPendingItems();

  const failedItems = queue.filter(item => item.status === 'failed');
  const pendingItems = queue.filter(item => item.status === 'pending');

  return {
    success: true,
    status: {
      totalQueued: queue.length,
      pendingSync: pendingItems.length,
      failed: failedItems.length,
      maxRetries: MAX_RETRY_ATTEMPTS,
      isOnline: navigator.onLine,
      lastSync: await getLastSyncTime()
    }
  };
}

/**
 * Get last sync time
 */
async function getLastSyncTime() {
  const result = await chrome.storage.local.get('omniclipper_last_sync');
  return result.omniclipper_last_sync || null;
}

/**
 * Set last sync time
 */
async function setLastSyncTime(time) {
  await chrome.storage.local.set({ omniclipper_last_sync: time });
}

/**
 * Sync item to Feishu
 */
async function syncToFeishu(config, item) {
  if (!config.appId || !config.appSecret || !config.appToken || !config.tableId) {
    console.log('Feishu config incomplete, skipping sync');
    return false;
  }

  try {
    // Get tenant access token
    const tokenResponse = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        app_id: config.appId,
        app_secret: config.appSecret
      })
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.code !== 0) {
      throw new Error(tokenData.msg);
    }

    const tenantAccessToken = tokenData.tenant_access_token;

    // Create record with new ResourceItem fields
    const fields = {
      'Title': item.title,
      'Type': item.type,
      'URL': item.url || undefined,
      'Content': item.content || item.markdown || item.description || '',
      'Tags': item.tags || [],
      'CreatedAt': item.createdAt,
      'IsStarred': item.isStarred || false
    };

    // Add type-specific fields
    if (item.type === ResourceType.ARTICLE) {
      fields['Author'] = item.author || '';
      fields['ReadingTime'] = item.readingTime || 0;
    } else if (item.type === ResourceType.WEB) {
      fields['Favicon'] = item.favicon || '';
      fields['SiteName'] = item.siteName || '';
    }

    const recordResponse = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tenantAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
      }
    );

    const recordData = await recordResponse.json();
    return recordData.code === 0;
  } catch (error) {
    console.error('Feishu sync error:', error);
    return false;
  }
}

/**
 * Sync item to Supabase
 */
async function syncToSupabase(config, item, session) {
  if (!config.url || !config.anonKey || !config.tableName) {
    console.log('Supabase config incomplete, skipping sync');
    return false;
  }

  try {
    const baseUrl = config.url.replace(/\/$/, '');
    const endpoint = `${baseUrl}/rest/v1/${config.tableName}`;

    // Build payload matching ResourceItem structure
    const payload = {
      id: item.id,
      title: item.title,
      type: item.type,
      url: item.url || null,
      tags: item.tags || [],
      folder_id: item.folderId || null,
      color: item.color || null,
      created_at: item.createdAt,
      updated_at: item.updatedAt || new Date().toISOString(),
      is_cloud: true,
      is_starred: item.isStarred || false,
      user_id: session?.user?.id || null
    };

    // Add type-specific fields
    if (item.type === ResourceType.WEB) {
      payload.favicon = item.favicon || null;
      payload.site_name = item.siteName || null;
      payload.description = item.description || null;
    } else if (item.type === ResourceType.ARTICLE) {
      payload.markdown = item.markdown || null;
      payload.author = item.author || null;
      payload.reading_time = item.readingTime || null;
    } else if (item.type === ResourceType.IMAGE) {
      payload.image_data = item.imageData || null;
      payload.image_mime_type = item.imageMimeType || null;
      payload.image_size = item.imageSize || null;
      payload.source_url = item.sourceUrl || null;
    } else if (item.type === ResourceType.NOTE) {
      payload.content = item.content || null;
    }

    const authHeader = session?.accessToken
      ? `Bearer ${session.accessToken}`
      : `Bearer ${config.anonKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': config.anonKey,
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase sync error response:', errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Supabase sync error:', error);
    return false;
  }
}

/**
 * Update badge count
 */
async function updateBadge(count) {
  const text = count > 0 ? count.toString() : '';
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
}

/**
 * Get pending items
 */
async function getPendingItems() {
  const items = await getItems();
  return items.filter(item => item.syncStatus === 'pending' || item.syncStatus === 'error');
}

/**
 * Get all items
 */
async function getItems() {
  const result = await chrome.storage.local.get(STORAGE_KEY_ITEMS);
  return result[STORAGE_KEY_ITEMS] || [];
}

/**
 * Update item sync status
 */
async function updateItemSyncStatus(id, status) {
  const items = await getItems();
  const updatedItems = items.map(item =>
    item.id === id ? { ...item, syncStatus: status, updatedAt: new Date().toISOString() } : item
  );
  await chrome.storage.local.set({ [STORAGE_KEY_ITEMS]: updatedItems });
}

/**
 * Get settings
 */
async function getSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
  return result[STORAGE_KEY_SETTINGS] || getDefaultSettings();
}

/**
 * Get default settings
 */
function getDefaultSettings() {
  return {
    storageMode: 'local',
    feishuConfig: {
      appId: '',
      appSecret: '',
      appToken: '',
      tableId: ''
    },
    supabaseConfig: {
      url: '',
      anonKey: '',
      tableName: 'omniclipper_items'
    },
    userSession: undefined,
    subscription: {
      plan: 'free',
      isActive: false
    }
  };
}

/**
 * Save item
 */
async function saveItem(item) {
  const items = await getItems();

  // Generate ID if not present
  if (!item.id) {
    item.id = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  // Set timestamps
  const now = new Date().toISOString();
  if (!item.createdAt) {
    item.createdAt = now;
  }
  item.updatedAt = now;

  // Set defaults
  item.syncStatus = 'pending';
  item.isCloud = item.isCloud || false;
  item.isStarred = item.isStarred || false;
  item.tags = item.tags || [];

  const newItems = [item, ...items];
  await chrome.storage.local.set({ [STORAGE_KEY_ITEMS]: newItems });

  // Update badge
  const pendingCount = newItems.filter(i => i.syncStatus === 'pending').length;
  await updateBadge(pendingCount);

  // Update sync time
  await setLastSyncTime(Date.now());

  // Try to sync immediately if cloud sync enabled
  if (item.isCloud) {
    syncItem(item);
  }

  return { success: true, item: newItems[0] };
}

// Handle installation
chrome.runtime.onInstalled.addListener(async () => {
  console.log('OmniClipper installed');
  init();

  // Show notification on first install
  chrome.storage.local.get('installed', (result) => {
    if (!result.installed) {
      chrome.notifications.create('omniclipper-installed', {
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: chrome.i18n.getMessage('extensionName') || 'OmniClipper Installed',
        message: chrome.i18n.getMessage('notifications_installed') || 'Click the extension icon to start capturing web content!'
      });
      chrome.storage.local.set({ installed: true });
    }
  });
});

// Export for use in other contexts
if (typeof self !== 'undefined') {
  self.omniclipperBackground = {
    syncItem,
    syncPendingItems,
    saveItem,
    getItems,
    getSettings,
    updateBadge,
    getSyncQueue,
    addToSyncQueue,
    getSyncStatus,
    retryFailedItems,
    ResourceType
  };
}
