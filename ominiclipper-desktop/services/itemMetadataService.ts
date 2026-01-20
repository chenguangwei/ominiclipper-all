/**
 * Item Metadata Service
 * Manages individual item metadata files (Eagle-style)
 *
 * Structure:
 * items/
 *   ├── index.json           # Lightweight index of all items
 *   ├── {itemId}/
 *   │   └── metadata.json    # Full item metadata
 *   └── {itemId}/
 *       └── metadata.json
 */

import { ResourceItem } from '../types';

// Check if running in Electron
function isElectron(): boolean {
  return !!(window as any).electronAPI?.itemAPI;
}

// ============================================
// Types
// ============================================

/**
 * Full item metadata (stored in items/{itemId}/metadata.json)
 */
export interface ItemMetadata {
  id: string;
  name: string;
  title: string;
  type: string;
  tags: string[];
  folderId: string | null;
  color: string;
  path: string | null;
  localPath: string | null;
  originalPath: string | null;
  storageMode: string;
  fileSize: number;
  mimeType: string;
  isCloud: boolean;
  isStarred: boolean;
  contentSnippet: string | null;
  aiSummary: string | null;
  embeddedData: string | null;
  createdAt: string;
  updatedAt: string;
  btime?: number;
  mtime?: number;
  lastModified?: number;
}

/**
 * Items index (stored in items/index.json)
 * Lightweight index for quick loading
 */
export interface ItemsIndex {
  version: number;
  lastModified: string;
  items: ItemIndexEntry[];
}

export interface ItemIndexEntry {
  id: string;
  title: string;
  type: string;
  folderId: string | null;
  tags: string[];
  color: string;
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;
  lastModified: number;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Convert full ResourceItem to ItemMetadata
 */
export const resourceItemToMetadata = (item: ResourceItem): ItemMetadata => {
  return {
    id: item.id,
    name: item.title,
    title: item.title,
    type: item.type,
    tags: item.tags,
    folderId: item.folderId || null,
    color: item.color,
    path: item.path,
    localPath: item.localPath,
    originalPath: item.originalPath,
    storageMode: item.storageMode || 'reference',
    fileSize: item.fileSize || 0,
    mimeType: item.mimeType || '',
    isCloud: item.isCloud || false,
    isStarred: item.isStarred || false,
    contentSnippet: item.contentSnippet || null,
    aiSummary: (item as any).aiSummary || null,
    embeddedData: item.embeddedData || null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    btime: item.createdAt ? new Date(item.createdAt).getTime() : undefined,
    mtime: item.updatedAt ? new Date(item.updatedAt).getTime() : undefined,
    lastModified: item.updatedAt ? new Date(item.updatedAt).getTime() : undefined,
  };
};

/**
 * Convert ItemMetadata to ResourceItem
 */
export const metadataToResourceItem = (meta: ItemMetadata): ResourceItem => {
  return {
    id: meta.id,
    title: meta.title,
    type: meta.type as any,
    tags: meta.tags,
    folderId: meta.folderId || undefined,
    color: meta.color,
    path: meta.path || undefined,
    localPath: meta.localPath || undefined,
    originalPath: meta.originalPath || undefined,
    storageMode: meta.storageMode as any,
    fileSize: meta.fileSize,
    mimeType: meta.mimeType,
    isCloud: meta.isCloud,
    isStarred: meta.isStarred,
    contentSnippet: meta.contentSnippet || undefined,
    embeddedData: meta.embeddedData || undefined,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  };
};

/**
 * Create index entry from item
 */
export const createIndexEntry = (item: ResourceItem): ItemIndexEntry => {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    folderId: item.folderId || null,
    tags: item.tags,
    color: item.color,
    isStarred: item.isStarred || false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    lastModified: item.updatedAt ? new Date(item.updatedAt).getTime() : Date.now(),
  };
};

// ============================================
// API Functions
// ============================================

/**
 * Get the items base path
 */
export const getItemsPath = async (): Promise<string> => {
  if (isElectron()) {
    return await (window as any).electronAPI.itemAPI.getItemsPath();
  }
  return 'items';
};

/**
 * Save item metadata to file
 */
export const saveItemMetadata = async (
  item: ResourceItem
): Promise<{ success: boolean; path?: string; error?: string }> => {
  const metadata = resourceItemToMetadata(item);

  if (isElectron()) {
    try {
      const result = await (window as any).electronAPI.itemAPI.saveItemMetadata(item.id, metadata);
      if (result.success) {
        console.log('[ItemMeta] Saved metadata for item:', item.id);
      }
      return result;
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // Web fallback
  console.log('[ItemMeta] Web mode - would save metadata for:', item.id);
  return { success: true, path: `items/${item.id}/metadata.json` };
};

/**
 * Read item metadata from file
 */
export const readItemMetadata = async (
  itemId: string
): Promise<ItemMetadata | null> => {
  if (isElectron()) {
    try {
      return await (window as any).electronAPI.itemAPI.readItemMetadata(itemId);
    } catch (e) {
      console.error('[ItemMeta] Failed to read metadata for:', itemId, e);
      return null;
    }
  }
  return null;
};

/**
 * Delete item metadata file
 */
export const deleteItemMetadata = async (
  itemId: string
): Promise<{ success: boolean; error?: string }> => {
  if (isElectron()) {
    try {
      const result = await (window as any).electronAPI.itemAPI.deleteItemMetadata(itemId);
      if (result.success) {
        console.log('[ItemMeta] Deleted metadata for item:', itemId);
      }
      return result;
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // Web fallback
  console.log('[ItemMeta] Web mode - would delete metadata for:', itemId);
  return { success: true };
};

/**
 * Read items index
 */
export const readItemsIndex = async (): Promise<ItemsIndex | null> => {
  if (isElectron()) {
    try {
      return await (window as any).electronAPI.itemAPI.readItemsIndex();
    } catch (e) {
      console.error('[ItemMeta] Failed to read items index:', e);
      return null;
    }
  }
  return null;
};

/**
 * Save items index
 */
export const saveItemsIndex = async (
  items: ResourceItem[]
): Promise<{ success: boolean; error?: string }> => {
  const index: ItemsIndex = {
    version: 1,
    lastModified: new Date().toISOString(),
    items: items.map(createIndexEntry),
  };

  if (isElectron()) {
    try {
      const result = await (window as any).electronAPI.itemAPI.saveItemsIndex(index);
      if (result.success) {
        console.log('[ItemMeta] Saved items index:', items.length, 'items');
      }
      return result;
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // Web fallback
  console.log('[ItemMeta] Web mode - would save index for:', items.length, 'items');
  return { success: true };
};

/**
 * Batch save metadata for multiple items
 */
export const batchSaveItemMetadata = async (
  items: ResourceItem[]
): Promise<{ saved: number; failed: number; errors: string[] }> => {
  const result = { saved: 0, failed: 0, errors: [] as string[] };

  for (const item of items) {
    const saveResult = await saveItemMetadata(item);
    if (saveResult.success) {
      result.saved++;
    } else {
      result.failed++;
      result.errors.push(`${item.id}: ${saveResult.error}`);
    }
  }

  console.log('[ItemMeta] Batch save complete:', result);
  return result;
};

/**
 * Build full item from index entry and metadata
 */
export const buildItemFromParts = async (
  indexEntry: ItemIndexEntry
): Promise<ResourceItem | null> => {
  const metadata = await readItemMetadata(indexEntry.id);
  if (metadata) {
    return metadataToResourceItem(metadata);
  }

  // Fallback: build from index entry only
  return {
    id: indexEntry.id,
    title: indexEntry.title,
    type: indexEntry.type as any,
    tags: indexEntry.tags,
    folderId: indexEntry.folderId || undefined,
    color: indexEntry.color,
    isStarred: indexEntry.isStarred,
    createdAt: indexEntry.createdAt,
    updatedAt: indexEntry.updatedAt,
    path: undefined,
    localPath: undefined,
    originalPath: undefined,
    storageMode: 'reference' as any,
    fileSize: 0,
    mimeType: '',
    isCloud: false,
    contentSnippet: undefined,
    embeddedData: undefined,
  };
};
