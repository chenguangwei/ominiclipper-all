/**
 * MTime Service
 * Tracks modification times for all items (Eagle-style mtime.json)
 *
 * Structure:
 * {
 *   "itemId1": 1765762138530,
 *   "itemId2": 1767864276658,
 *   ...
 *   "all": 100  // Total count
 * }
 */

// Check if running in Electron
function isElectron(): boolean {
  return !!(window as any).electronAPI?.mtimeAPI;
}

// ============================================
// Types
// ============================================

export interface MTimeData {
  times: Record<string, number>;
  count: number;
  lastModified: string;
}

// ============================================
// API Functions
// ============================================

/**
 * Read all mtime data
 */
export async function readMTime(): Promise<MTimeData> {
  if (isElectron()) {
    return await (window as any).electronAPI.mtimeAPI.readMTime();
  }
  // Return empty data for web environment
  return { times: {}, count: 0, lastModified: new Date().toISOString() };
}

/**
 * Update mtime for an item (sets to current time)
 */
export async function updateMTime(itemId: string): Promise<boolean> {
  if (isElectron()) {
    const result = await (window as any).electronAPI.mtimeAPI.updateMTime(itemId);
    return result.success;
  }
  return false;
}

/**
 * Set mtime for an item to a specific timestamp
 */
export async function setMTime(itemId: string, timestamp: number): Promise<boolean> {
  if (isElectron()) {
    const result = await (window as any).electronAPI.mtimeAPI.setMTime(itemId, timestamp);
    return result.success;
  }
  return false;
}

/**
 * Remove mtime entry for an item
 */
export async function removeMTime(itemId: string): Promise<boolean> {
  if (isElectron()) {
    const result = await (window as any).electronAPI.mtimeAPI.removeMTime(itemId);
    return result.success;
  }
  return false;
}

/**
 * Get mtime for a specific item
 */
export async function getMTime(itemId: string): Promise<number | null> {
  if (isElectron()) {
    return await (window as any).electronAPI.mtimeAPI.getMTime(itemId);
  }
  return null;
}

/**
 * Get all mtime entries
 */
export async function getAllMTime(): Promise<Record<string, number>> {
  if (isElectron()) {
    return await (window as any).electronAPI.mtimeAPI.getAll();
  }
  return {};
}

/**
 * Get total count of items
 */
export async function getItemCount(): Promise<number> {
  if (isElectron()) {
    return await (window as any).electronAPI.mtimeAPI.getCount();
  }
  return 0;
}

/**
 * Batch update mtime for multiple items
 */
export async function batchUpdateMTime(itemIds: string[]): Promise<boolean> {
  const now = Date.now();
  let allSuccess = true;

  for (const itemId of itemIds) {
    const success = await setMTime(itemId, now);
    if (!success) allSuccess = false;
  }

  return allSuccess;
}

/**
 * Get items sorted by modification time (newest first)
 */
export async function getItemsByMTime(): Promise<string[]> {
  const times = await getAllMTime();

  // Sort by timestamp descending
  const sortedIds = Object.entries(times)
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => id);

  return sortedIds;
}

/**
 * Get items modified since a specific time
 */
export async function getItemsModifiedSince(timestamp: number): Promise<string[]> {
  const times = await getAllMTime();

  return Object.entries(times)
    .filter(([, time]) => time >= timestamp)
    .map(([id]) => id);
}
