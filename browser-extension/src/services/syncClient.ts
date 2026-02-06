/**
 * Sync Client for Browser Extension
 * Syncs items to OmniClipper Desktop app via local HTTP API
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Connection status tracking
 * - Offline queue integration
 */

import { ResourceItem } from '../types';

// Default desktop app port
const DEFAULT_PORT = 3456;

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds
const CONNECTION_CHECK_INTERVAL = 30000; // 30 seconds

// Connection status
let isDesktopConnected = false;
let lastConnectionCheck = 0;
let connectionCheckTimer: ReturnType<typeof setInterval> | null = null;

// Auth token for desktop API
let cachedToken: string | null = null;

/**
 * Get the desktop sync token from storage
 */
export async function getDesktopToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    const result = await chrome.storage.local.get('OMNICLIPPER_DESKTOP_TOKEN');
    cachedToken = result.OMNICLIPPER_DESKTOP_TOKEN || null;
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

/**
 * Save the desktop sync token to storage
 */
export async function setDesktopToken(token: string): Promise<void> {
  cachedToken = token;
  await chrome.storage.local.set({ OMNICLIPPER_DESKTOP_TOKEN: token });
}

/**
 * Clear the cached token (e.g. on disconnect)
 */
export function clearTokenCache(): void {
  cachedToken = null;
}

/**
 * Get headers with authorization token for authenticated endpoints
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getDesktopToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Event listeners for connection status changes
type ConnectionListener = (connected: boolean) => void;
const connectionListeners: ConnectionListener[] = [];

/**
 * Subscribe to connection status changes
 */
export function onConnectionChange(listener: ConnectionListener): () => void {
  connectionListeners.push(listener);
  // Immediately notify current status
  listener(isDesktopConnected);
  // Return unsubscribe function
  return () => {
    const index = connectionListeners.indexOf(listener);
    if (index > -1) connectionListeners.splice(index, 1);
  };
}

/**
 * Notify all listeners of connection status change
 */
function notifyConnectionChange(connected: boolean) {
  if (isDesktopConnected !== connected) {
    isDesktopConnected = connected;
    connectionListeners.forEach(listener => listener(connected));
  }
}

/**
 * Get the desktop app port
 * Browser extension cannot read file:// URLs, so we use a fixed port
 */
async function getDesktopPort(): Promise<number> {
  return DEFAULT_PORT;
}

/**
 * Get the desktop app URL
 */
async function getDesktopUrl(): Promise<string> {
  const port = await getDesktopPort();
  return `http://127.0.0.1:${port}`;
}

/**
 * Calculate retry delay with exponential backoff
 */
function getRetryDelay(attempt: number): number {
  const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
  return Math.min(delay, MAX_RETRY_DELAY);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Attempt to auto-pair with desktop app to obtain auth token
 * Calls /api/pair which is CORS-restricted to chrome-extension:// origins
 */
export async function attemptPairing(): Promise<boolean> {
  try {
    const url = await getDesktopUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${url}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log('[SyncClient] Pairing failed:', response.status);
      return false;
    }

    const data = await response.json();
    if (data.token) {
      clearTokenCache();
      await setDesktopToken(data.token);
      console.log('[SyncClient] Auto-paired with desktop');
      return true;
    }
    return false;
  } catch (error) {
    console.log('[SyncClient] Pairing error:', error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Check if desktop app is running
 */
export async function pingDesktop(): Promise<boolean> {
  try {
    const url = await getDesktopUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(`${url}/api/ping`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const data = await response.json();
    const connected = data.status === 'ok';

    // Auto-pair if connected but no token stored
    if (connected) {
      const existingToken = await getDesktopToken();
      if (!existingToken) {
        await attemptPairing();
      }
    }

    notifyConnectionChange(connected);
    lastConnectionCheck = Date.now();

    return connected;
  } catch (error) {
    console.log('[SyncClient] Desktop app not available:', error instanceof Error ? error.message : error);
    notifyConnectionChange(false);
    lastConnectionCheck = Date.now();
    return false;
  }
}

/**
 * Check connection status (with caching)
 */
export async function checkConnection(): Promise<boolean> {
  // Use cached status if checked recently
  if (Date.now() - lastConnectionCheck < 5000) {
    return isDesktopConnected;
  }
  return pingDesktop();
}

/**
 * Get current connection status (synchronous, uses cached value)
 */
export function isConnected(): boolean {
  return isDesktopConnected;
}

/**
 * Start periodic connection checking
 */
export function startConnectionMonitor(): void {
  if (connectionCheckTimer) return;

  // Initial check
  pingDesktop();

  // Periodic checks
  connectionCheckTimer = setInterval(() => {
    pingDesktop();
  }, CONNECTION_CHECK_INTERVAL);

  console.log('[SyncClient] Connection monitor started');
}

/**
 * Stop periodic connection checking
 */
export function stopConnectionMonitor(): void {
  if (connectionCheckTimer) {
    clearInterval(connectionCheckTimer);
    connectionCheckTimer = null;
    console.log('[SyncClient] Connection monitor stopped');
  }
}

/**
 * Sync a single item to desktop app with retry logic
 */
export async function syncItemToDesktop(
  item: ResourceItem,
  options: { maxRetries?: number; silent?: boolean } = {}
): Promise<{ success: boolean; action?: string; error?: string }> {
  const { maxRetries = MAX_RETRIES, silent = false } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const url = await getDesktopUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const headers = await getAuthHeaders();
      const response = await fetch(`${url}/api/sync-one`, {
        method: 'POST',
        headers,
        body: JSON.stringify(item),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!silent) {
        console.log('[SyncClient] Sync result:', data);
      }

      notifyConnectionChange(true);
      return { success: data.success, action: data.action };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isLastAttempt = attempt === maxRetries;

      if (!silent) {
        console.warn(`[SyncClient] Sync attempt ${attempt + 1}/${maxRetries + 1} failed:`, errorMessage);
      }

      // On 401: token expired or desktop restarted. Try re-pairing.
      if (errorMessage.includes('401')) {
        clearTokenCache();
        const paired = await attemptPairing();
        if (paired && !isLastAttempt) {
          if (!silent) console.log('[SyncClient] Re-paired, retrying...');
          continue; // Retry immediately with new token
        }
      }

      // Check if it's a connection error
      if (errorMessage.includes('abort') || errorMessage.includes('network') || errorMessage.includes('fetch')) {
        notifyConnectionChange(false);
      }

      if (isLastAttempt) {
        return { success: false, error: errorMessage };
      }

      // Wait before retry
      const delay = getRetryDelay(attempt);
      if (!silent) {
        console.log(`[SyncClient] Retrying in ${delay}ms...`);
      }
      await sleep(delay);
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

/**
 * Sync multiple items to desktop app with retry logic
 */
export async function syncItemsToDesktop(
  items: ResourceItem[],
  options: { maxRetries?: number; onProgress?: (synced: number, total: number) => void } = {}
): Promise<{ synced: number; skipped: number; failed: number; errors: string[] }> {
  const { maxRetries = MAX_RETRIES, onProgress } = options;

  // First, check if desktop is available
  const connected = await checkConnection();
  if (!connected) {
    return { synced: 0, skipped: 0, failed: items.length, errors: ['Desktop app not available'] };
  }

  // Try batch sync first
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const url = await getDesktopUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for batch

      const headers = await getAuthHeaders();
      const response = await fetch(`${url}/api/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ items }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[SyncClient] Batch sync result:', data);

      notifyConnectionChange(true);
      return {
        synced: data.synced || 0,
        skipped: data.skipped || 0,
        failed: 0,
        errors: []
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isLastAttempt = attempt === maxRetries;

      console.warn(`[SyncClient] Batch sync attempt ${attempt + 1}/${maxRetries + 1} failed:`, errorMessage);

      // On 401: token expired or desktop restarted. Try re-pairing.
      if (errorMessage.includes('401')) {
        clearTokenCache();
        const paired = await attemptPairing();
        if (paired && !isLastAttempt) {
          console.log('[SyncClient] Re-paired, retrying batch...');
          continue;
        }
      }

      if (isLastAttempt) {
        // Fallback: try syncing items one by one
        console.log('[SyncClient] Falling back to individual sync...');
        return syncItemsIndividually(items, { onProgress });
      }

      const delay = getRetryDelay(attempt);
      console.log(`[SyncClient] Retrying batch in ${delay}ms...`);
      await sleep(delay);
    }
  }

  return { synced: 0, skipped: 0, failed: items.length, errors: ['Max retries exceeded'] };
}

/**
 * Sync items individually (fallback when batch fails)
 */
async function syncItemsIndividually(
  items: ResourceItem[],
  options: { onProgress?: (synced: number, total: number) => void } = {}
): Promise<{ synced: number; skipped: number; failed: number; errors: string[] }> {
  const { onProgress } = options;
  let synced = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const result = await syncItemToDesktop(item, { maxRetries: 1, silent: true });

    if (result.success) {
      if (result.action === 'added') {
        synced++;
      } else {
        skipped++;
      }
    } else {
      failed++;
      if (result.error) {
        errors.push(`${item.title}: ${result.error}`);
      }
    }

    onProgress?.(i + 1, items.length);
  }

  return { synced, skipped, failed, errors };
}

/**
 * Get sync statistics from desktop app
 */
export async function getDesktopStats(): Promise<{ totalItems: number; browserExtensionItems: number } | null> {
  try {
    const url = await getDesktopUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const headers = await getAuthHeaders();
    const response = await fetch(`${url}/api/stats`, {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    notifyConnectionChange(true);

    return {
      totalItems: data.totalItems,
      browserExtensionItems: data.browserExtensionItems
    };
  } catch (error) {
    console.error('[SyncClient] Failed to get stats:', error);
    return null;
  }
}

/**
 * Sync an item to desktop app (fire and forget with queue fallback)
 * This is the main function to call after saving an item
 */
export async function syncToDesktopAsync(item: ResourceItem): Promise<void> {
  const result = await syncItemToDesktop(item, { maxRetries: 2, silent: false });

  if (result.success) {
    if (result.action === 'added') {
      console.log('[SyncClient] Item synced to desktop:', item.title);
    } else if (result.action === 'skipped') {
      console.log('[SyncClient] Item already exists on desktop:', item.title);
    }
  } else {
    // Add to offline queue for later retry
    console.log('[SyncClient] Sync failed, queueing for later:', item.title);
    try {
      const { addToSyncQueue } = await import('../background/services/syncQueue');
      await addToSyncQueue(item);
    } catch (err) {
      console.error('[SyncClient] Failed to add to sync queue:', err);
    }
  }
}

/**
 * Batch sync all items to desktop app
 * Useful for initial setup or manual sync
 */
export async function syncAllToDesktop(
  onProgress?: (synced: number, total: number) => void
): Promise<{ synced: number; skipped: number; failed: number }> {
  // Import dynamically to avoid circular dependencies
  const { StorageService } = await import('./storageService');
  // Load items with large data (images) from IndexedDB
  const items = await StorageService.getAllItemsWithLargeData();

  if (items.length === 0) {
    return { synced: 0, skipped: 0, failed: 0 };
  }

  const result = await syncItemsToDesktop(items, { onProgress });
  return { synced: result.synced, skipped: result.skipped, failed: result.failed };
}

/**
 * Process the offline sync queue
 */
export async function processSyncQueue(): Promise<{ processed: number; failed: number }> {
  try {
    const { getSyncQueue, saveSyncQueue } = await import('../background/services/syncQueue');
    const queue = await getSyncQueue();

    if (queue.length === 0) {
      return { processed: 0, failed: 0 };
    }

    console.log(`[SyncClient] Processing ${queue.length} queued items...`);

    let processed = 0;
    let failed = 0;
    const updatedQueue: typeof queue = [];

    for (const queueItem of queue) {
      const result = await syncItemToDesktop(queueItem, { maxRetries: 1, silent: true });

      if (result.success) {
        processed++;
        // Remove from queue on success
        console.log(`[SyncClient] Queue item synced: ${queueItem.title}`);
      } else {
        // Increment retry count
        queueItem.retryCount = (queueItem.retryCount || 0) + 1;
        queueItem.lastError = result.error;

        if (queueItem.retryCount < MAX_RETRIES) {
          // Keep in queue for later retry
          updatedQueue.push(queueItem);
        } else {
          // Max retries exceeded, remove from queue
          failed++;
          console.warn(`[SyncClient] Queue item failed permanently: ${queueItem.title}`);
        }
      }
    }

    // Save updated queue
    await saveSyncQueue(updatedQueue);

    return { processed, failed };
  } catch (error) {
    console.error('[SyncClient] Failed to process sync queue:', error);
    return { processed: 0, failed: 0 };
  }
}

export const SyncClient = {
  // Connection
  pingDesktop,
  checkConnection,
  isConnected,
  onConnectionChange,
  startConnectionMonitor,
  stopConnectionMonitor,

  // Auth & Pairing
  getDesktopToken,
  setDesktopToken,
  clearTokenCache,
  attemptPairing,

  // Sync operations
  syncItemToDesktop,
  syncItemsToDesktop,
  syncToDesktopAsync,
  syncAllToDesktop,
  processSyncQueue,

  // Stats
  getDesktopStats,
  getDesktopPort
};
