/**
 * File Manager Service
 * Handles file path management, recent files, and file statistics
 */

import { ResourceItem, ResourceType, RecentFile, FileStats } from '../types';
import * as storageService from './storageService';
import { importFile, deleteItemFiles } from './fileStorageService';

// MIME type mappings
const MIME_TYPE_MAP: Record<string, ResourceType> = {
  'application/pdf': ResourceType.PDF,
  'application/msword': ResourceType.WORD,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ResourceType.WORD,
  'application/epub+zip': ResourceType.EPUB,
  'image/jpeg': ResourceType.IMAGE,
  'image/png': ResourceType.IMAGE,
  'image/gif': ResourceType.IMAGE,
  'image/webp': ResourceType.IMAGE,
  'text/html': ResourceType.WEB,
};

/**
 * Get file extension from path
 */
export function getFileExtension(path: string): string {
  return path.split('.').pop()?.toLowerCase() || '';
}

/**
 * Get resource type from file path or MIME type
 */
export function getResourceTypeFromPath(path: string, mimeType?: string): ResourceType {
  // Check MIME type first
  if (mimeType && MIME_TYPE_MAP[mimeType]) {
    return MIME_TYPE_MAP[mimeType];
  }

  // Check file extension
  const ext = getFileExtension(path);
  switch (ext) {
    case 'pdf':
      return ResourceType.PDF;
    case 'doc':
    case 'docx':
      return ResourceType.WORD;
    case 'epub':
      return ResourceType.EPUB;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
      return ResourceType.IMAGE;
    case 'html':
    case 'htm':
      return ResourceType.WEB;
    case 'md':
    case 'markdown':
    case 'txt':
      return ResourceType.MARKDOWN;
    default:
      return ResourceType.UNKNOWN;
  }
}

/**
 * Format file size to human readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get file info (size, modified date, etc.)
 * Note: In browser context, this is limited
 */
export function getFileInfo(file: File): { size: number; mimeType: string; extension: string } {
  return {
    size: file.size,
    mimeType: file.type,
    extension: getFileExtension(file.name),
  };
}

/**
 * Add a file to recent files list
 */
export function addRecentFile(item: ResourceItem): void {
  const recentFiles = getRecentFiles();

  // Remove if already exists
  const filtered = recentFiles.filter(f => f.path !== item.path);

  // Add to beginning
  const newRecent: RecentFile = {
    id: item.id,
    path: item.path || '',
    title: item.title,
    type: item.type,
    lastOpened: Date.now(),
    count: 1,
  };

  const updated = [newRecent, ...filtered].slice(0, 50); // Keep last 50
  storageService.setRecentFiles(updated);
}

/**
 * Get recent files list
 */
export function getRecentFiles(): RecentFile[] {
  return storageService.getRecentFiles() as RecentFile[];
}

/**
 * Increment open count for a recent file
 */
export function incrementRecentFileCount(path: string): void {
  const recentFiles = getRecentFiles();
  const updated = recentFiles.map(f => {
    if (f.path === path) {
      return { ...f, count: f.count + 1, lastOpened: Date.now() };
    }
    return f;
  });
  storageService.setRecentFiles(updated);
}

/**
 * Clear recent files history
 */
export function clearRecentFiles(): void {
  storageService.setRecentFiles([]);
}

/**
 * Add a folder to favorites
 */
export function addFavoriteFolder(path: string): boolean {
  const favorites = getFavoriteFolders();
  if (favorites.includes(path)) {
    return false; // Already exists
  }

  const updated = [...favorites, path];
  storageService.setFavoriteFolders(updated);
  return true;
}

/**
 * Get favorite folders
 */
export function getFavoriteFolders(): string[] {
  return storageService.getFavoriteFolders();
}

/**
 * Remove a folder from favorites
 */
export function removeFavoriteFolder(path: string): void {
  const favorites = getFavoriteFolders().filter(p => p !== path);
  storageService.setFavoriteFolders(favorites);
}

/**
 * Calculate file statistics
 */
export function calculateFileStats(items: ResourceItem[]): FileStats {
  const stats: FileStats = {
    totalSize: 0,
    totalCount: items.length,
    byType: {
      [ResourceType.WORD]: 0,
      [ResourceType.PDF]: 0,
      [ResourceType.EPUB]: 0,
      [ResourceType.WEB]: 0,
      [ResourceType.IMAGE]: 0,
      [ResourceType.MARKDOWN]: 0,
      [ResourceType.UNKNOWN]: 0,
    },
  };

  let oldestDate = Infinity;
  let newestDate = 0;

  items.forEach(item => {
    if (item.fileSize) {
      stats.totalSize += item.fileSize;
    }

    if (stats.byType[item.type] !== undefined) {
      stats.byType[item.type]++;
    }

    const itemDate = new Date(item.createdAt).getTime();
    if (itemDate < oldestDate) {
      oldestDate = itemDate;
      stats.oldestFile = item.title;
    }
    if (itemDate > newestDate) {
      newestDate = itemDate;
      stats.newestFile = item.title;
    }
  });

  return stats;
}

/**
 * Search files by name in a list
 */
export function searchFiles(items: ResourceItem[], query: string): ResourceItem[] {
  const lowerQuery = query.toLowerCase();
  return items.filter(item =>
    item.title.toLowerCase().includes(lowerQuery) ||
    (item.path && item.path.toLowerCase().includes(lowerQuery)) ||
    (item.contentSnippet && item.contentSnippet.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get files by type
 */
export function getFilesByType(items: ResourceItem[], type: ResourceType): ResourceItem[] {
  return items.filter(item => item.type === type);
}

/**
 * Get starred/favorite items
 */
export function getStarredItems(items: ResourceItem[]): ResourceItem[] {
  return items.filter(item => item.isStarred);
}

/**
 * Toggle star status
 */
export function toggleStar(items: ResourceItem[], id: string): ResourceItem[] {
  return items.map(item => {
    if (item.id === id) {
      return { ...item, isStarred: !item.isStarred };
    }
    return item;
  });
}

/**
 * Update item with file info
 */
export function updateItemWithFileInfo(
  item: Partial<ResourceItem>,
  file?: File
): Partial<ResourceItem> {
  if (!file) return item;

  return {
    ...item,
    fileSize: file.size,
    mimeType: file.type,
    path: item.path || URL.createObjectURL(file),
    type: item.type || getResourceTypeFromPath(file.name, file.type),
  };
}

/**
 * Get common document folders
 */
export function getCommonFolders(): string[] {
  // Return placeholder paths - actual paths would be handled by Electron
  return [
    '~/Documents',
    '~/Downloads',
    '~/Desktop',
    '/Documents',
    '/Downloads',
  ];
}

/**
 * Validate file path
 */
export function isValidPath(path: string): boolean {
  if (!path || path.trim().length === 0) return false;
  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*]/;
  return !invalidChars.test(path);
}

/**
 * Extract file name from path
 */
export function getFileNameFromPath(path: string): string {
  return path.split('/').pop() || path;
}

/**
 * Get directory path from full path
 */
export function getDirectoryPath(path: string): string {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/') || '/';
}

/**
 * Check if path is a subdirectory of another path
 */
export function isSubdirectory(parent: string, child: string): boolean {
  const parentNormalized = parent.replace(/\\/g, '/').toLowerCase();
  const childNormalized = child.replace(/\\/g, '/').toLowerCase();
  return childNormalized.startsWith(parentNormalized);
}

/**
 * Batch update file paths
 */
export function batchUpdatePaths(
  items: ResourceItem[],
  oldBasePath: string,
  newBasePath: string
): ResourceItem[] {
  return items.map(item => {
    if (item.path && item.path.startsWith(oldBasePath)) {
      return {
        ...item,
        path: item.path.replace(oldBasePath, newBasePath),
      };
    }
    return item;
  });
}

/**
 * Export file paths as a list
 */
export function exportFilePaths(items: ResourceItem[], format: 'txt' | 'csv' | 'json'): string {
  const validItems = items.filter(item => item.path);

  switch (format) {
    case 'txt':
      return validItems.map(item => `${item.path}\t${item.title}`).join('\n');

    case 'csv':
      const headers = 'Title,Path,Type,Created At\n';
      const rows = validItems.map(item =>
        `"${item.title}","${item.path}","${item.type}","${item.createdAt}"`
      ).join('\n');
      return headers + rows;

    case 'json':
      return JSON.stringify(
        validItems.map(item => ({
          title: item.title,
          path: item.path,
          type: item.type,
          createdAt: item.createdAt,
        })),
        null,
        2
      );

    default:
      return '';
  }
}

/**
 * Convert File to Base64 data URL
 * Uses FileReader in browser, falls back to IPC in Electron
 */
export async function fileToBase64(file: File): Promise<string> {
  // Check file size - for files over 10MB, warn and limit
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  if (file.size > MAX_SIZE) {
    console.warn('[FileManager] File size exceeds limit, may cause memory issues');
  }

  // Try FileReader first (works in both browser and Electron renderer)
  try {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = (error) => {
        console.error('[FileManager] FileReader error:', error);
        reject(new Error('Failed to read file with FileReader'));
      };
      reader.onabort = () => {
        reject(new Error('File reading was aborted'));
      };
      reader.readAsDataURL(file);
    });
  } catch (fileReaderError) {
    // If FileReader fails in Electron, try IPC method
    if (typeof window !== 'undefined' && (window as any).electronAPI?.readFileAsDataUrl) {
      try {
        console.log('[FileManager] Falling back to IPC file read');
        const result = await (window as any).electronAPI.readFileAsDataUrl(file.path || file.name);
        if (result.success) {
          return result.dataUrl;
        }
        throw new Error(result.error || 'IPC file read failed');
      } catch (ipcError) {
        console.error('[FileManager] IPC fallback also failed:', ipcError);
        throw new Error('Failed to read file: ' + (ipcError instanceof Error ? ipcError.message : 'Unknown error'));
      }
    }
    throw fileReaderError;
  }
}

/**
 * Create a blob URL from Base64 data URL
 */
export function base64ToBlob(base64: string): string {
  try {
    // If it's already a data URL, return as-is (can be used directly)
    if (base64.startsWith('data:')) {
      return base64;
    }

    // Parse base64 with header
    const [header, data] = base64.split(',');
    const mimeMatch = header?.match(/data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

    const byteCharacters = atob(data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    return URL.createObjectURL(blob);
  } catch (e) {
    console.error('Failed to convert base64 to blob:', e);
    return base64; // Return original if conversion fails
  }
}

/**
 * Check if a blob URL is still valid
 */
export async function isBlobUrlValid(url: string): Promise<boolean> {
  if (!url.startsWith('blob:')) {
    return true; // Not a blob URL, assume valid
  }

  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if running in Electron environment
 */
export function isElectron(): boolean {
  return !!(window as any).electronAPI;
}

/**
 * Read a local file and return as data URL (Electron only)
 * Handles blob URLs, local file paths, and non-file URLs
 */
export async function readLocalFileAsDataUrl(filePath: string): Promise<string | null> {
  if (!isElectron()) {
    return null;
  }

  // Handle blob URLs (created during drag & drop)
  if (filePath.startsWith('blob:')) {
    try {
      console.log('Fetching blob URL:', filePath.substring(0, 50) + '...');
      const response = await fetch(filePath);
      if (response.ok) {
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
      console.error('Failed to fetch blob:', response.statusText);
      return null;
    } catch (e) {
      console.error('Error reading blob URL:', e);
      return null;
    }
  }

  // Skip non-file URLs (http, data, etc.)
  if (!filePath || filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('data:')) {
    console.log('Skipping non-file URL:', filePath?.substring(0, 50));
    return null;
  }

  try {
    const result = await (window as any).electronAPI.readFileAsDataUrl(filePath);
    if (result.success) {
      return result.dataUrl;
    }
    console.error('Failed to read file:', result.error);
    return null;
  } catch (e) {
    console.error('Error reading local file:', e);
    return null;
  }
}

/**
 * Check if a local file exists (Electron only)
 */
export async function localFileExists(filePath: string): Promise<boolean> {
  if (!isElectron()) {
    return false;
  }

  try {
    return await (window as any).electronAPI.fileExists(filePath);
  } catch {
    return false;
  }
}

/**
 * Get usable path from ResourceItem
 * Handles embedded data by returning the data URL directly
 */
export function getUsablePath(item: ResourceItem): string | undefined {
  // If item has embedded data, use it directly as data URL
  if (item.storageMode === 'embed' && item.embeddedData) {
    return item.embeddedData;
  }

  // For reference mode with localPath, we need to read the file through Electron API
  // The actual reading will be done asynchronously in the viewer component
  if (item.storageMode === 'reference' && item.localPath) {
    // Return a special marker that indicates we need to load from local path
    return `local-file://${item.localPath}`;
  }

  // Otherwise return the stored path (might be blob: URL which could be expired)
  return item.path;
}

// ============================================
// Eagle-Style File Storage Integration
// ============================================

/**
 * Import a file to Eagle-style storage
 * @param sourcePath Source file path
 * @param itemData Item metadata
 */
export async function importFileToStorage(
  sourcePath: string,
  itemData: Partial<ResourceItem>
): Promise<{ success: boolean; item?: ResourceItem; error?: string }> {
  return await importFile(sourcePath, itemData);
}

/**
 * Delete item files from Eagle-style storage
 * @param itemId Item ID to delete
 */
export async function deleteItemFromStorage(
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  return await deleteItemFiles(itemId);
}

/**
 * Get storage path for an item
 */
export async function getItemStoragePath(_itemId: string): Promise<string> {
  const { getStoragePath } = await import('./fileStorageService');
  const storagePath = await getStoragePath();
  return storagePath;
}
