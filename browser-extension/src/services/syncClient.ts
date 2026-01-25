/**
 * Sync Client for Browser Extension
 * Syncs items to OmniClipper Desktop app via local HTTP API
 */

import { ResourceItem } from '../types';

// Default desktop app port
const DEFAULT_PORT = 3456;

/**
 * Get the desktop app port
 * Browser extension cannot read file:// URLs, so we use a fixed port
 */
async function getDesktopPort(): Promise<number> {
  // Browser extensions can't read file:// URLs, so use fixed port
  // The desktop app always runs on port 3456
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
 * Check if desktop app is running
 */
export async function pingDesktop(): Promise<boolean> {
  try {
    const url = await getDesktopUrl();
    const response = await fetch(`${url}/api/ping`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    return data.status === 'ok';
  } catch (error) {
    console.log('[SyncClient] Desktop app not available:', error);
    return false;
  }
}

/**
 * Sync a single item to desktop app
 */
export async function syncItemToDesktop(item: ResourceItem): Promise<{ success: boolean; action?: string }> {
  try {
    const url = await getDesktopUrl();
    const response = await fetch(`${url}/api/sync-one`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });

    const data = await response.json();
    console.log('[SyncClient] Sync result:', data);
    return { success: data.success, action: data.action };
  } catch (error) {
    console.error('[SyncClient] Failed to sync item:', error);
    return { success: false };
  }
}

/**
 * Sync multiple items to desktop app
 */
export async function syncItemsToDesktop(items: ResourceItem[]): Promise<{ synced: number; skipped: number }> {
  try {
    const url = await getDesktopUrl();
    const response = await fetch(`${url}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });

    const data = await response.json();
    console.log('[SyncClient] Batch sync result:', data);
    return { synced: data.synced, skipped: data.skipped };
  } catch (error) {
    console.error('[SyncClient] Failed to sync items:', error);
    return { synced: 0, skipped: 0 };
  }
}

/**
 * Get sync statistics from desktop app
 */
export async function getDesktopStats(): Promise<{ totalItems: number; browserExtensionItems: number } | null> {
  try {
    const url = await getDesktopUrl();
    const response = await fetch(`${url}/api/stats`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
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
 * Sync an item to desktop app (fire and forget, don't await)
 * This is the main function to call after saving an item
 */
export function syncToDesktopAsync(item: ResourceItem): void {
  // Fire and forget - don't await
  syncItemToDesktop(item).then(result => {
    if (result.success && result.action === 'added') {
      console.log('[SyncClient] Item synced to desktop:', item.title);
    } else if (result.success && result.action === 'skipped') {
      console.log('[SyncClient] Item already exists on desktop:', item.title);
    }
  }).catch(error => {
    // Silent fail - sync is best effort
    console.debug('[SyncClient] Sync failed (non-critical):', error.message);
  });
}

/**
 * Batch sync all items to desktop app
 * Useful for initial setup or manual sync
 */
export async function syncAllToDesktop(): Promise<{ synced: number; skipped: number }> {
  // Import dynamically to avoid circular dependencies
  const { StorageService } = await import('./storageService');
  const items = StorageService.getItems();
  return syncItemsToDesktop(items);
}

export const SyncClient = {
  pingDesktop,
  syncItemToDesktop,
  syncItemsToDesktop,
  getDesktopStats,
  syncToDesktopAsync,
  syncAllToDesktop,
  getDesktopPort
};
