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
  // Image specific fields from browser extension
  imageData: string | null;  // Base64 encoded image data (data URL format)
  imageMimeType: string | null; // Image MIME type (e.g., 'image/png')
  imageSize: { width: number; height: number } | null; // Image dimensions
  sourceUrl: string | null;  // Original URL where image was captured
  // Article specific fields from browser extension
  markdown: string | null;   // Markdown content for ARTICLE type
  author: string | null;     // Article author
  readingTime: number | null; // Estimated reading time in minutes
  favicon: string | null;    // Website favicon URL
  siteName: string | null;   // Website name
  source: string | null;     // Source identifier (e.g., 'browser-extension')
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
  // 支持浏览器扩展的 imageData 字段
  const imageData = item.imageData || null;

  return {
    id: item.id,
    name: item.title,
    title: item.title,
    type: item.type,
    tags: item.tags,
    folderId: item.folderId || null,
    color: item.color,
    path: item.path || null,
    localPath: item.localPath || null,
    originalPath: item.originalPath || null,
    storageMode: item.storageMode || 'reference',
    fileSize: item.fileSize || 0,
    mimeType: item.mimeType || '',
    isCloud: item.isCloud || false,
    isStarred: item.isStarred || false,
    contentSnippet: item.contentSnippet || null,
    aiSummary: item.aiSummary || null,
    embeddedData: item.embeddedData || null,
    // Image specific fields from browser extension
    imageData: imageData,
    imageMimeType: item.imageMimeType || null,
    imageSize: item.imageSize || null,
    sourceUrl: item.sourceUrl || null,
    // Article specific fields from browser extension
    markdown: item.markdown || null,
    author: item.author || null,
    readingTime: item.readingTime || null,
    favicon: item.favicon || null,
    siteName: item.siteName || null,
    source: item.source || null,
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
  // 如果有 imageData，使用它作为 embeddedData（兼容桌面端）
  // imageData 来自浏览器扩展，embeddedData 是桌面端原生格式
  const embeddedData = meta.imageData || meta.embeddedData || undefined;
  console.log('[ItemMeta] metadataToResourceItem:', meta.id, 'meta.imageData:', !!meta.imageData, 'meta.embeddedData:', !!meta.embeddedData, 'result embeddedData:', !!embeddedData, 'markdown:', !!meta.markdown);

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
    embeddedData: embeddedData,
    // Image specific fields from browser extension
    imageData: meta.imageData || undefined,
    imageMimeType: meta.imageMimeType || undefined,
    imageSize: meta.imageSize || undefined,
    sourceUrl: meta.sourceUrl || undefined,
    // Article specific fields from browser extension
    markdown: meta.markdown || undefined,
    author: meta.author || undefined,
    readingTime: meta.readingTime || undefined,
    favicon: meta.favicon || undefined,
    siteName: meta.siteName || undefined,
    source: meta.source || undefined,
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
      const result = await (window as any).electronAPI.fileStorageAPI.readItemMetadata(itemId);
      if (result) {
        console.log('[ItemMeta] Read metadata for:', itemId, 'has imageData:', !!result.imageData, 'has embeddedData:', !!result.embeddedData);
      }
      return result;
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
