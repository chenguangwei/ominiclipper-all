/**
 * Folder Directory Service
 * Manages physical folder creation and deletion for Eagle-style structure
 *
 * Structure:
 * folders/
 *   ├── {folderId}/
 *   │   ├── {nestedFolderId}/
 *   │   └── ...
 *   └── ...
 */

import { Folder } from '../types';

// Check if running in Electron
function isElectron(): boolean {
  return !!(window as any).electronAPI?.folderAPI;
}

// ============================================
// Helper Functions (Web Fallback)
// ============================================

/**
 * Build folder path from folder hierarchy
 */
const buildFolderPath = (folders: Folder[], folderId: string): string => {
  // Build hierarchy from current folder up to root
  const hierarchy: string[] = [];
  let current: Folder | undefined = folders.find(f => f.id === folderId);

  while (current) {
    hierarchy.unshift(current.name);
    current = folders.find(f => f.id === current!.parentId);
  }

  return hierarchy.join('/');
};

/**
 * Get parent folder path
 */
const getParentPath = (folders: Folder[], folderId: string): string => {
  const folder = folders.find(f => f.id === folderId);
  if (!folder || !folder.parentId) {
    return '';
  }
  return buildFolderPath(folders, folder.parentId);
};

// ============================================
// API Functions
// ============================================

/**
 * Get the base folders path
 */
export const getFoldersPath = async (): Promise<string> => {
  if (isElectron()) {
    return await (window as any).electronAPI.folderAPI.getFoldersPath();
  }
  // Web fallback: use a virtual path
  return 'folders';
};

/**
 * Create a physical folder for a folder item
 */
export const createFolderPhysical = async (
  folders: Folder[],
  folderId: string
): Promise<{ success: boolean; path?: string; error?: string }> => {
  const folder = folders.find(f => f.id === folderId);
  if (!folder) {
    return { success: false, error: 'Folder not found' };
  }

  if (isElectron()) {
    try {
      const result = await (window as any).electronAPI.folderAPI.createFolder(folderId);
      if (result.success) {
        console.log('[FolderDir] Created physical folder:', folderId);
      }
      return result;
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // Web fallback: just log
  console.log('[FolderDir] Web mode - would create folder:', folder.name);
  return { success: true, path: folderId };
};

/**
 * Delete a physical folder
 */
export const deleteFolderPhysical = async (
  folderId: string
): Promise<{ success: boolean; error?: string }> => {
  if (isElectron()) {
    try {
      const result = await (window as any).electronAPI.folderAPI.deleteFolder(folderId);
      if (result.success) {
        console.log('[FolderDir] Deleted physical folder:', folderId);
      }
      return result;
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  // Web fallback
  console.log('[FolderDir] Web mode - would delete folder:', folderId);
  return { success: true };
};

/**
 * Create physical folders for all folders (sync operation)
 */
export const syncFoldersPhysical = async (
  folders: Folder[]
): Promise<{ created: number; failed: number; errors: string[] }> => {
  const result = { created: 0, failed: 0, errors: [] as string[] };

  if (!isElectron()) {
    console.log('[FolderDir] Web mode - skipping physical folder sync');
    return result;
  }

  for (const folder of folders) {
    const createResult = await createFolderPhysical(folders, folder.id);
    if (createResult.success) {
      result.created++;
    } else {
      result.failed++;
      result.errors.push(`${folder.name}: ${createResult.error}`);
    }
  }

  if (result.errors.length > 0) {
    console.warn('[FolderDir] Some folders failed to create:', result.errors);
  }

  console.log('[FolderDir] Sync complete:', result);
  return result;
};

/**
 * Create nested folder path for a folder item
 */
export const createNestedFolderPath = async (
  folders: Folder[],
  folderId: string
): Promise<{ success: boolean; path?: string; error?: string }> => {
  const folder = folders.find(f => f.id === folderId);
  if (!folder) {
    return { success: false, error: 'Folder not found' };
  }

  // Build the full nested path
  const folderPath = buildFolderPath(folders, folderId);

  if (isElectron()) {
    try {
      // Use folderId as the folder name (the IPC will handle the base path)
      const result = await (window as any).electronAPI.folderAPI.createFolder(folderId);
      return result;
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  return { success: true, path: folderPath };
};

/**
 * Check if a physical folder exists
 */
export const folderExists = async (
  folderId: string
): Promise<boolean> => {
  if (isElectron()) {
    return await (window as any).electronAPI.folderAPI.folderExists(folderId);
  }
  return false;
};

/**
 * Get the physical path for a folder
 */
export const getFolderPhysicalPath = async (
  folders: Folder[],
  folderId: string
): Promise<string> => {
  const basePath = await getFoldersPath();
  const folderPath = buildFolderPath(folders, folderId);
  return `${basePath}/${folderPath}`;
};
