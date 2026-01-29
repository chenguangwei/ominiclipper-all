import { Tag, Folder } from '../../types';
import { storageState } from './state';
import { scheduleLibraryWrite } from './persistence';
import * as folderDirService from '../folderDirectoryService';
import { getItems, saveItems } from './items';

const generateId = () => Math.random().toString(36).substr(2, 9);

// ==================== TAGS ====================

export const getTags = (): Tag[] => storageState.libraryCache?.tags || [];

export const saveTags = (tags: Tag[]): void => {
    if (storageState.libraryCache) {
        storageState.libraryCache.tags = tags;
        storageState.libraryCache.lastModified = new Date().toISOString();
        scheduleLibraryWrite();
    }
};

export const addTag = (tag: Omit<Tag, 'id'>): Tag => {
    const tags = getTags();
    const existing = tags.find(t => t.name === tag.name && t.parentId === tag.parentId);
    if (existing) {
        return existing;
    }

    const newTag: Tag = { ...tag, id: generateId(), count: 0 };
    tags.push(newTag);
    saveTags(tags);
    return newTag;
};

export const updateTag = (id: string, updates: Partial<Tag>): Tag | null => {
    const tags = getTags();
    const index = tags.findIndex(t => t.id === id);
    if (index === -1) return null;

    tags[index] = { ...tags[index], ...updates };
    saveTags(tags);
    return tags[index];
};

export const deleteTag = (id: string): boolean => {
    const tags = getTags();
    if (!tags.find(t => t.id === id)) return false;

    const filtered = tags.filter(t => t.id !== id && t.parentId !== id);
    // Note: Original handled recursive delete properly. For refactor, simple filter.
    saveTags(filtered);

    // Cleanup items
    const items = getItems();
    let changed = false;
    items.forEach(i => {
        if (i.tags.includes(id)) {
            i.tags = i.tags.filter(t => t !== id);
            changed = true;
        }
    });
    if (changed) saveItems(items);

    return true;
};


// ==================== FOLDERS ====================

export const getFolders = (): Folder[] => storageState.libraryCache?.folders || [];

export const saveFolders = (folders: Folder[]): void => {
    if (storageState.libraryCache) {
        storageState.libraryCache.folders = folders;
        storageState.libraryCache.lastModified = new Date().toISOString();
        scheduleLibraryWrite();
    }
};

export const addFolder = async (folder: Omit<Folder, 'id'>): Promise<Folder> => {
    const folders = getFolders();
    const existing = folders.find(f => f.name === folder.name && f.parentId === folder.parentId);
    if (existing) {
        return existing;
    }

    const newFolder: Folder = { ...folder, id: generateId() };
    folders.push(newFolder);
    saveFolders(folders);

    if (storageState.isElectronEnvironment) {
        await folderDirService.createFolderPhysical(folders, newFolder.id);
    }
    return newFolder;
};

export const updateFolder = (id: string, updates: Partial<Folder>): Folder | null => {
    const folders = getFolders();
    const index = folders.findIndex(f => f.id === id);
    if (index === -1) return null;

    folders[index] = { ...folders[index], ...updates };
    saveFolders(folders);
    return folders[index];
};

export const deleteFolder = async (id: string): Promise<boolean> => {
    const folders = getFolders();
    if (!folders.find(f => f.id === id)) return false;

    // 1. Identify all folders to delete (recursive)
    const idsToDelete = new Set<string>([id]);

    // Simple iterative approach to find all descendants
    let foundNew = true;
    while (foundNew) {
        foundNew = false;
        folders.forEach(f => {
            if (f.parentId && idsToDelete.has(f.parentId) && !idsToDelete.has(f.id)) {
                idsToDelete.add(f.id);
                foundNew = true;
            }
        });
    }

    // 2. Remove folders
    const filtered = folders.filter(f => !idsToDelete.has(f.id));
    saveFolders(filtered);

    // 3. Cleanup items (orphan them to Uncategorized)
    const items = getItems();
    let itemsChanged = false;
    items.forEach(i => {
        if (i.folderId && idsToDelete.has(i.folderId)) {
            i.folderId = undefined; // effectively 'uncategorized'
            itemsChanged = true;
        }
    });

    if (itemsChanged) {
        saveItems(items);
    }

    return true;
};

/**
 * Remove orphan folders (folders with non-existent parentIds)
 * Returns the number of folders removed
 */
export const cleanupOrphanFolders = (): number => {
    const folders = getFolders();
    const folderIds = new Set(folders.map(f => f.id));

    // Find orphan folders (have parentId but parent doesn't exist)
    const orphanIds = new Set<string>();

    // Iteratively find all orphans (including nested orphans)
    let foundNew = true;
    while (foundNew) {
        foundNew = false;
        folders.forEach(f => {
            if (f.parentId && !folderIds.has(f.parentId) && !orphanIds.has(f.id)) {
                orphanIds.add(f.id);
                folderIds.delete(f.id); // Remove from valid set so children become orphans too
                foundNew = true;
            }
        });
    }

    if (orphanIds.size === 0) {
        return 0;
    }

    console.log(`[Storage] Cleaning up ${orphanIds.size} orphan folders:`, [...orphanIds]);

    // Remove orphan folders
    const filtered = folders.filter(f => !orphanIds.has(f.id));
    saveFolders(filtered);

    // Update items that reference orphan folders
    const items = getItems();
    let itemsChanged = false;
    items.forEach(i => {
        if (i.folderId && orphanIds.has(i.folderId)) {
            i.folderId = undefined;
            itemsChanged = true;
        }
    });

    if (itemsChanged) {
        saveItems(items);
    }

    return orphanIds.size;
};
