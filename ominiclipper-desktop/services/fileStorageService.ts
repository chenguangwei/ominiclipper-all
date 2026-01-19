/**
 * File Storage Service
 * Handles file storage in the Eagle-style structure:
 * - files/{itemId}/metadata.json
 * - files/{itemId}/{filename}
 */

import { ResourceItem, ResourceType } from '../types';
import { getResourceTypeFromPath, formatFileSize } from './fileManager';

// Check if running in Electron
function isElectron(): boolean {
  return !!(window as any).electronAPI?.fileStorageAPI;
}

/**
 * Get the storage base path
 */
export async function getStoragePath(): Promise<string> {
  if (isElectron()) {
    return await (window as any).electronAPI.fileStorageAPI.getStoragePath();
  }
  return '';
}

/**
 * Create a storage directory for an item
 */
export async function createItemStorage(itemId: string): Promise<{ success: boolean; path?: string; error?: string }> {
  if (isElectron()) {
    return await (window as any).electronAPI.fileStorageAPI.createItemStorage(itemId);
  }
  return { success: false, error: 'Not in Electron environment' };
}

/**
 * Save a file to item storage
 */
export async function saveFileToStorage(
  itemId: string,
  fileName: string,
  base64Data: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  if (isElectron()) {
    return await (window as any).electronAPI.fileStorageAPI.saveFileToStorage(itemId, fileName, base64Data);
  }
  return { success: false, error: 'Not in Electron environment' };
}

/**
 * Read a file from item storage
 */
export async function readFileFromStorage(
  itemId: string,
  fileName: string
): Promise<{ success: boolean; dataUrl?: string; error?: string }> {
  if (isElectron()) {
    return await (window as any).electronAPI.fileStorageAPI.readFileFromStorage(itemId, fileName);
  }
  return { success: false, error: 'Not in Electron environment' };
}

/**
 * Get the file path in storage
 */
export async function getFilePath(itemId: string, fileName: string): Promise<string> {
  if (isElectron()) {
    return await (window as any).electronAPI.fileStorageAPI.getFilePath(itemId, fileName);
  }
  return '';
}

/**
 * Delete item storage directory
 */
export async function deleteItemStorage(itemId: string): Promise<{ success: boolean; error?: string }> {
  if (isElectron()) {
    return await (window as any).electronAPI.fileStorageAPI.deleteItemStorage(itemId);
  }
  return { success: false, error: 'Not in Electron environment' };
}

/**
 * Save metadata for an item
 */
export async function saveItemMetadata(
  itemId: string,
  metadata: ItemMetadata
): Promise<{ success: boolean; error?: string }> {
  if (isElectron()) {
    return await (window as any).electronAPI.fileStorageAPI.saveItemMetadata(itemId, metadata);
  }
  return { success: false, error: 'Not in Electron environment' };
}

/**
 * Read metadata for an item
 */
export async function readItemMetadata(
  itemId: string
): Promise<ItemMetadata | null> {
  if (isElectron()) {
    return await (window as any).electronAPI.fileStorageAPI.readItemMetadata(itemId);
  }
  return null;
}

/**
 * Import a file and create item storage
 */
export async function importFile(
  sourcePath: string,
  itemData: Partial<ResourceItem>
): Promise<{ success: boolean; item?: ResourceItem; error?: string }> {
  try {
    // Generate item ID
    const itemId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get file info
    const fileName = sourcePath.split('/').pop() || 'unknown';
    const type = getResourceTypeFromPath(sourcePath);
    const fileSize = 0; // Will be updated after copying

    // Create item storage directory
    const createResult = await createItemStorage(itemId);
    if (!createResult.success) {
      return { success: false, error: createResult.error };
    }

    // Read file as base64 and save to storage
    if (isElectron()) {
      const readResult = await (window as any).electronAPI.readFileAsDataUrl(sourcePath);
      if (!readResult.success) {
        return { success: false, error: readResult.error };
      }

      const saveResult = await saveFileToStorage(itemId, fileName, readResult.dataUrl.split(',')[1]);
      if (!saveResult.success) {
        return { success: false, error: saveResult.error };
      }
    }

    // Create metadata
    const now = Date.now();
    const metadata: ItemMetadata = {
      id: itemId,
      name: itemData.title || fileName,
      type: type,
      size: 0, // Will be updated
      btime: now,
      mtime: now,
      ext: fileName.split('.').pop() || '',
      tags: itemData.tags || [],
      folders: itemData.folderId ? [itemData.folderId] : [],
      color: itemData.color,
      starred: itemData.isStarred || false,
      url: itemData.url,
      description: itemData.description,
      modificationTime: now,
    };

    // Save metadata
    await saveItemMetadata(itemId, metadata);

    // Return the item
    const newItem: ResourceItem = {
      id: itemId,
      title: metadata.name,
      type: type,
      path: saveResult.path || '',
      fileSize: metadata.size,
      mimeType: getMimeType(fileName),
      tags: metadata.tags,
      folderId: metadata.folders[0],
      color: metadata.color,
      isStarred: metadata.starred,
      url: metadata.url,
      description: metadata.description,
      createdAt: new Date(metadata.btime).toISOString(),
      updatedAt: new Date(metadata.mtime).toISOString(),
    };

    return { success: true, item: newItem };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Delete an item and its storage
 */
export async function deleteItemFiles(itemId: string): Promise<{ success: boolean; error?: string }> {
  return await deleteItemStorage(itemId);
}

// ============================================
// Types
// ============================================

export interface ItemMetadata {
  id: string;
  name: string;
  type: ResourceType;
  size: number;
  btime: number;
  mtime: number;
  ext: string;
  tags: string[];
  folders: string[];
  color?: string;
  starred: boolean;
  url?: string;
  description?: string;
  modificationTime: number;
  isDeleted?: boolean;
  deletedTime?: number;
}

// ============================================
// Helper Functions
// ============================================

function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'epub': 'application/epub+zip',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'md': 'text/markdown',
    'html': 'text/html',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
