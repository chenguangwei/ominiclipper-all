/**
 * Folder Operations Service
 * Handles folder-related operations like clone, move validation, and tree utilities
 */

import { Folder } from '@/types';
import * as storageService from './storageService';

/**
 * Generate a unique ID for folders
 */
const generateId = () => Math.random().toString(36).substr(2, 9);

/**
 * Get all descendant folder IDs (children, grandchildren, etc.)
 */
export const getFolderDescendants = (
  folderId: string,
  folders: Folder[]
): string[] => {
  const descendants: string[] = [];
  const queue = [folderId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = folders.filter(f => f.parentId === currentId);

    for (const child of children) {
      descendants.push(child.id);
      queue.push(child.id);
    }
  }

  return descendants;
};

/**
 * Get sibling folders (folders with the same parent)
 */
export const getSiblingFolders = (
  folderId: string,
  folders: Folder[]
): Folder[] => {
  const folder = folders.find(f => f.id === folderId);
  if (!folder) return [];

  return folders.filter(f => f.parentId === folder.parentId && f.id !== folderId);
};

/**
 * Get parent chain for a folder (from root to folder)
 */
export const getFolderAncestors = (
  folderId: string,
  folders: Folder[]
): string[] => {
  const ancestors: string[] = [];
  let currentFolder = folders.find(f => f.id === folderId);

  while (currentFolder?.parentId) {
    ancestors.unshift(currentFolder.parentId);
    currentFolder = folders.find(f => f.id === currentFolder!.parentId);
  }

  return ancestors;
};

/**
 * Validate if a folder move operation is valid
 * Prevents circular references (moving a folder into its own descendant)
 */
export const validateFolderMove = (
  folderId: string,
  targetParentId: string | undefined,
  folders: Folder[]
): { valid: boolean; error?: string } => {
  // Moving to root is always valid
  if (!targetParentId) {
    return { valid: true };
  }

  // Can't move to itself
  if (folderId === targetParentId) {
    return { valid: false, error: '不能将文件夹移动到自身' };
  }

  // Can't move to a descendant
  const descendants = getFolderDescendants(folderId, folders);
  if (descendants.includes(targetParentId)) {
    return { valid: false, error: '不能将文件夹移动到其子文件夹中' };
  }

  // Check if target exists
  const targetFolder = folders.find(f => f.id === targetParentId);
  if (!targetFolder) {
    return { valid: false, error: '目标文件夹不存在' };
  }

  return { valid: true };
};

/**
 * Clone a folder with a new name
 * Does NOT clone child folders or items (shallow clone)
 */
export const cloneFolder = async (
  folderId: string,
  folders: Folder[]
): Promise<Folder | null> => {
  const sourceFolder = folders.find(f => f.id === folderId);
  if (!sourceFolder) {
    console.error('[FolderOperations] Clone failed: source folder not found');
    return null;
  }

  // Generate new name with "(Copy)" suffix
  let baseName = sourceFolder.name;
  // Remove existing (Copy) or (Copy N) suffix
  const copyMatch = baseName.match(/^(.+?)\s*\(Copy(?:\s+\d+)?\)$/);
  if (copyMatch) {
    baseName = copyMatch[1].trim();
  }

  // Find unique name
  let newName = `${baseName} (Copy)`;
  let copyNumber = 2;
  while (folders.some(f => f.name === newName && f.parentId === sourceFolder.parentId)) {
    newName = `${baseName} (Copy ${copyNumber})`;
    copyNumber++;
  }

  // Create cloned folder
  const clonedFolder: Omit<Folder, 'id'> = {
    name: newName,
    parentId: sourceFolder.parentId,
    icon: sourceFolder.icon,
    color: sourceFolder.color,
    isQuickAccess: false, // Don't clone quick access status
    sortOrder: sourceFolder.sortOrder,
  };

  try {
    const newFolder = await storageService.addFolder(clonedFolder);
    console.log('[FolderOperations] Folder cloned:', newFolder);
    return newFolder;
  } catch (err) {
    console.error('[FolderOperations] Clone failed:', err);
    return null;
  }
};

/**
 * Clone a folder with all its descendants (deep clone)
 */
export const cloneFolderDeep = async (
  folderId: string,
  folders: Folder[]
): Promise<Folder | null> => {
  const sourceFolder = folders.find(f => f.id === folderId);
  if (!sourceFolder) return null;

  // Clone the root folder first
  const clonedRoot = await cloneFolder(folderId, folders);
  if (!clonedRoot) return null;

  // Map old IDs to new IDs
  const idMap = new Map<string, string>();
  idMap.set(folderId, clonedRoot.id);

  // Clone descendants in breadth-first order
  const queue = folders.filter(f => f.parentId === folderId);

  while (queue.length > 0) {
    const folder = queue.shift()!;

    // Get the new parent ID
    const newParentId = idMap.get(folder.parentId!);
    if (!newParentId) continue;

    // Clone this folder
    const cloned: Omit<Folder, 'id'> = {
      name: folder.name,
      parentId: newParentId,
      icon: folder.icon,
      color: folder.color,
      sortOrder: folder.sortOrder,
    };

    try {
      const newFolder = await storageService.addFolder(cloned);
      idMap.set(folder.id, newFolder.id);

      // Add children to queue
      const children = folders.filter(f => f.parentId === folder.id);
      queue.push(...children);
    } catch (err) {
      console.error('[FolderOperations] Deep clone failed for:', folder.name, err);
    }
  }

  return clonedRoot;
};

/**
 * Move a folder to a new parent
 */
export const moveFolder = async (
  folderId: string,
  newParentId: string | undefined,
  folders: Folder[]
): Promise<boolean> => {
  // Validate move
  const validation = validateFolderMove(folderId, newParentId, folders);
  if (!validation.valid) {
    console.error('[FolderOperations] Move validation failed:', validation.error);
    return false;
  }

  try {
    const result = storageService.updateFolder(folderId, { parentId: newParentId });
    if (result) {
      console.log('[FolderOperations] Folder moved successfully');
      return true;
    }
    return false;
  } catch (err) {
    console.error('[FolderOperations] Move failed:', err);
    return false;
  }
};

/**
 * Get folder tree structure for rendering
 */
export interface FolderTreeNode {
  folder: Folder;
  children: FolderTreeNode[];
  depth: number;
}

export const buildFolderTree = (
  folders: Folder[],
  parentId?: string,
  depth: number = 0
): FolderTreeNode[] => {
  return folders
    .filter(f => f.parentId === parentId)
    .map(folder => ({
      folder,
      depth,
      children: buildFolderTree(folders, folder.id, depth + 1),
    }));
};

/**
 * Flatten folder tree for display in select/dropdown
 */
export const flattenFolderTree = (
  folders: Folder[],
  excludeFolderId?: string
): { folder: Folder; depth: number }[] => {
  const result: { folder: Folder; depth: number }[] = [];

  // Get descendants of excluded folder (to also exclude them)
  const excludedIds = new Set<string>();
  if (excludeFolderId) {
    excludedIds.add(excludeFolderId);
    getFolderDescendants(excludeFolderId, folders).forEach(id => excludedIds.add(id));
  }

  const traverse = (parentId: string | undefined, depth: number) => {
    const children = folders.filter(f => f.parentId === parentId);
    for (const folder of children) {
      if (!excludedIds.has(folder.id)) {
        result.push({ folder, depth });
        traverse(folder.id, depth + 1);
      }
    }
  };

  traverse(undefined, 0);
  return result;
};
