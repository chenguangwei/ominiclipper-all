/**
 * Item File Metadata Service
 * Manages individual item metadata files stored in files/{itemId}/metadata.json
 *
 * Structure:
 * files/
 *   ├── {itemId}/
 *   │   ├── {filename}        # Original file
 *   │   └── metadata.json     # Full item metadata
 */

import { ResourceItem } from '../types';

// Check if running in Electron
function isElectron(): boolean {
  return !!(window as any).electronAPI?.fileStorageAPI;
}

// ============================================
// Types
// ============================================

/**
 * Full item metadata (stored in files/{itemId}/metadata.json)
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
  deletedAt?: string;
  btime?: number;
  mtime?: number;
  lastModified?: number;
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
    deletedAt: item.deletedAt,
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
    deletedAt: meta.deletedAt,
  };
};

// ============================================
// API Functions
// ============================================

/**
 * Get the files base path
 */
export const getFilesPath = async (): Promise<string> => {
  if (isElectron()) {
    return await (window as any).electronAPI.fileStorageAPI.getFilesPath();
  }
  return 'files';
};

/**
 * Save item metadata to file in files/{itemId}/metadata.json
 */
export const saveItemMetadata = async (
  item: ResourceItem
): Promise<{ success: boolean; path?: string; error?: string }> => {
  const metadata = resourceItemToMetadata(item);

  if (isElectron()) {
    try {
      const result = await (window as any).electronAPI.fileStorageAPI.saveItemMetadata(item.id, metadata);
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
  return { success: true, path: `files/${item.id}/metadata.json` };
};

/**
 * Read item metadata from file in files/{itemId}/metadata.json
 */
export const readItemMetadata = async (
  itemId: string
): Promise<ItemMetadata | null> => {
  if (isElectron()) {
    try {
      return await (window as any).electronAPI.fileStorageAPI.readItemMetadata(itemId);
    } catch (e) {
      console.error('[ItemMeta] Failed to read metadata for:', itemId, e);
      return null;
    }
  }
  return null;
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
