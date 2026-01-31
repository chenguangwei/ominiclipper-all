import { ResourceItem, FileStorageMode, ResourceType } from '../../types';
import { storageState } from './state';
import { scheduleLibraryWrite } from './persistence';
import { ItemIndexEntry } from './types';
import * as itemFileService from '../itemFileMetadataService';
import { vectorStoreService } from '../vectorStoreService';

// Utilities
const generateId = () => Math.random().toString(36).substr(2, 9);

// ============================================
// Item Update Listeners (for UI refresh)
// ============================================
type ItemUpdateListener = (itemId: string, updates: Partial<ResourceItem>) => void;
const itemUpdateListeners: Set<ItemUpdateListener> = new Set();

/**
 * Subscribe to item updates (e.g., for thumbnail generation completion)
 */
export const onItemUpdate = (listener: ItemUpdateListener): (() => void) => {
    itemUpdateListeners.add(listener);
    return () => itemUpdateListeners.delete(listener);
};

/**
 * Notify all listeners of an item update
 */
const notifyItemUpdate = (itemId: string, updates: Partial<ResourceItem>) => {
    itemUpdateListeners.forEach(listener => {
        try {
            listener(itemId, updates);
        } catch (e) {
            console.error('[Storage] Error in item update listener:', e);
        }
    });
};

// ============================================
// Index Operations (library.json)
// ============================================

export const getItems = (): ItemIndexEntry[] => {
    return storageState.libraryCache?.items || [];
};

/**
 * Get items as ResourceItem array for backward compatibility
 * Note: Returns partial data with undefined for fields not in the lightweight index
 * For full data, use getItemById() which reads from files/{id}/metadata.json
 */
export const getItemsAsResourceItems = (): ResourceItem[] => {
    return storageState.libraryCache?.items?.map(entry => ({
        id: entry.id,
        title: entry.title,
        type: entry.type,
        tags: entry.tags,
        folderId: entry.folderId,
        color: entry.color,
        isStarred: entry.isStarred,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        deletedAt: entry.deletedAt,
        isCloud: false,
        path: entry.path,
        localPath: entry.localPath,
        fileSize: undefined,
        mimeType: undefined,
        contentSnippet: undefined,
        aiSummary: undefined,
        embeddedData: undefined,
        originalPath: undefined,
        thumbnailUrl: entry.thumbnailUrl,
        description: undefined,
        fileHash: undefined,
        storageMode: (entry.storageMode as FileStorageMode) || 'reference',
    })) || [];
};

export const saveItems = (items: ItemIndexEntry[]): void => {
    console.log('[Storage] saveItems called, items count:', items.length);

    if (storageState.libraryCache) {
        storageState.libraryCache.items = items;
        storageState.libraryCache.lastModified = new Date().toISOString();

        // Debug: Log items with deletedAt
        const deletedItems = items.filter(i => i.deletedAt);
        console.log('[Storage] saveItems - items with deletedAt:', deletedItems.length);

        scheduleLibraryWrite();
        console.log('[Storage] saveItems - scheduleLibraryWrite called');
    } else {
        console.warn('[Storage] saveItems - no libraryCache available!');
    }
};

// ============================================
// Full Item Operations (files/{id}/metadata.json)
// ============================================

/**
 * Get full item data by reading from files/{id}/metadata.json
 */
export const getItemById = async (id: string): Promise<ResourceItem | null> => {
    // First check if item exists in index
    const indexEntry = getItems().find(i => i.id === id);
    if (!indexEntry) return null;

    // If in Electron environment, read full metadata from files/{id}/metadata.json
    if (storageState.isElectronEnvironment) {
        const fullMetadata = await itemFileService.readItemMetadata(id);
        if (fullMetadata) {
            return itemFileService.metadataToResourceItem(fullMetadata);
        }
    }

    // Fallback: return from index (partial data)
    return {
        id: indexEntry.id,
        title: indexEntry.title,
        type: indexEntry.type,
        tags: indexEntry.tags,
        folderId: indexEntry.folderId,
        color: indexEntry.color,
        isStarred: indexEntry.isStarred,
        createdAt: indexEntry.createdAt,
        updatedAt: indexEntry.updatedAt,
        deletedAt: indexEntry.deletedAt,
        isCloud: false,
        path: indexEntry.path,
        localPath: indexEntry.localPath,
        fileSize: undefined,
        mimeType: undefined,
        contentSnippet: undefined,
        aiSummary: undefined,
        embeddedData: undefined,
        originalPath: undefined,
        thumbnailUrl: indexEntry.thumbnailUrl,
        description: undefined,
        fileHash: undefined,
        storageMode: (indexEntry.storageMode as FileStorageMode) || 'reference',
    };
};

/**
 * Add a new item - writes to both index and full metadata file
 */
export const addItem = async (item: Omit<ResourceItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<ResourceItem> => {
    const newItem: ResourceItem = {
        ...item,
        id: item.id || generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    // 1. Save full metadata to files/{id}/metadata.json
    if (storageState.isElectronEnvironment) {
        await itemFileService.saveItemMetadata(newItem);
    }

    // 2. Create index entry and add to library.json
    const indexEntry: ItemIndexEntry = {
        id: newItem.id,
        title: newItem.title,
        type: newItem.type,
        tags: newItem.tags,
        folderId: newItem.folderId,
        color: newItem.color,
        isStarred: newItem.isStarred || false,
        createdAt: newItem.createdAt,
        updatedAt: newItem.updatedAt,
        deletedAt: newItem.deletedAt,
        path: newItem.path,
        localPath: newItem.localPath,
        storageMode: newItem.storageMode,
        thumbnailUrl: newItem.thumbnailUrl,
    };

    const items = getItems();
    items.unshift(indexEntry);
    saveItems(items);

    // 3. Trigger full content indexing (background)
    if (storageState.isElectronEnvironment) {
        import('../indexingService').then(({ indexResourceItem }) => {
            indexResourceItem(newItem).catch(err =>
                console.error('[Storage] Auto-indexing failed:', err)
            );
        });
    }

    return newItem;
};

/**
 * Update an item - updates both index and full metadata file
 */
export const updateItem = async (id: string, updates: Partial<ResourceItem>): Promise<ResourceItem | null> => {
    const items = getItems();
    const index = items.findIndex(i => i.id === id);
    if (index === -1) return null;

    const now = new Date().toISOString();

    // 1. Update full metadata file
    if (storageState.isElectronEnvironment) {
        const fullItem = await getItemById(id);
        if (fullItem) {
            const updatedFullItem = { ...fullItem, ...updates, updatedAt: now };
            await itemFileService.saveItemMetadata(updatedFullItem);
        }
    }

    // 2. Update index entry
    items[index] = {
        ...items[index],
        title: updates.title ?? items[index].title,
        type: updates.type ?? items[index].type,
        tags: updates.tags ?? items[index].tags,
        folderId: updates.folderId ?? items[index].folderId,
        color: updates.color ?? items[index].color,
        isStarred: updates.isStarred ?? items[index].isStarred,
        updatedAt: now,
        path: updates.path ?? items[index].path,
        localPath: updates.localPath ?? items[index].localPath,
        storageMode: updates.storageMode ?? items[index].storageMode,
        thumbnailUrl: updates.thumbnailUrl ?? items[index].thumbnailUrl,
    };
    saveItems(items);

    // 3. Trigger re-indexing if content-related fields changed
    if (storageState.isElectronEnvironment && (updates.title || updates.contentSnippet || updates.tags || updates.path)) {
        import('../indexingService').then(({ indexResourceItem }) => {
            indexResourceItem({ ...items[index], ...updates } as ResourceItem).catch(err =>
                console.error('[Storage] Re-indexing failed:', err)
            );
        });
    }

    // 4. Notify listeners of the update (for UI refresh)
    notifyItemUpdate(id, updates);

    // Return full item
    return getItemById(id);
};

// ============================================
// Delete/Restore Operations
// ============================================

// Soft delete
export const deleteItem = async (id: string): Promise<boolean> => {
    console.log('[Storage] deleteItem called for:', id);

    const items = getItems();
    const index = items.findIndex(i => i.id === id);
    if (index === -1) {
        console.log('[Storage] deleteItem - item not found:', id);
        return false;
    }

    const deletedAt = new Date().toISOString();

    // 1. Update index entry with deletedAt
    items[index] = { ...items[index], deletedAt, updatedAt: deletedAt };
    saveItems(items);

    // 2. Update full metadata file
    if (storageState.isElectronEnvironment) {
        const fullItem = await getItemById(id);
        if (fullItem) {
            await itemFileService.saveItemMetadata({ ...fullItem, deletedAt, updatedAt: deletedAt });
        }
    }

    return true;
};

export const restoreItem = async (id: string): Promise<boolean> => {
    const items = getItems();
    const index = items.findIndex(i => i.id === id);
    if (index === -1) return false;

    if (!items[index].deletedAt) return true; // Already active

    const now = new Date().toISOString();

    // 1. Update index entry
    items[index] = {
        ...items[index],
        deletedAt: undefined,
        updatedAt: now,
    };
    saveItems(items);

    // 2. Update full metadata file
    if (storageState.isElectronEnvironment) {
        const fullItem = await getItemById(id);
        if (fullItem) {
            await itemFileService.saveItemMetadata({ ...fullItem, deletedAt: undefined, updatedAt: now });
        }
    }

    return true;
};

export const permanentlyDeleteItem = async (id: string): Promise<boolean> => {
    console.log(`[Storage] permanentlyDeleteItem called for: ${id}`);

    const items = getItems();
    const index = items.findIndex(i => i.id === id);
    if (index === -1) {
        console.log(`[Storage] permanentlyDeleteItem - item not found: ${id}`);
        return false;
    }

    const item = items[index];
    const itemTitle = item.title;
    console.log(`[Storage] permanentlyDeleteItem - deleting: ${itemTitle}, mode: ${item.storageMode}`);

    // SAFEGUARD: For reference mode, we strictly DO NOT delete the external file.
    // The `deleteItemStorage` IPC only deletes the internal ID folder (metadata), which is correct.
    if (item.storageMode === 'reference') {
        console.log(`[Storage] Reference mode detected. External source file at "${item.localPath}" will be PRESERVED.`);
        console.log(`[Storage] Only removing application metadata and internal index.`);
    }

    // 1. Remove from index
    items.splice(index, 1);
    saveItems(items);

    if (storageState.isElectronEnvironment) {
        const api = (window as any).electronAPI;

        // 2. Delete /files/{id}/ storage folder (includes physical file and metadata.json)
        if (api?.fileStorageAPI?.deleteItemStorage) {
            console.log(`[Storage] Deleting file storage folder...`);
            await api.fileStorageAPI.deleteItemStorage(id).catch((e: Error) =>
                console.error('[Storage] Failed to delete item storage folder:', e)
            );
        }

        // 3. Delete from vector store (semantic search index)
        console.log(`[Storage] Deleting from vector store...`);
        await vectorStoreService.deleteDocument(id).catch((e: Error) =>
            console.error('[Storage] Failed to delete from vector store:', e)
        );

        // 4. Delete from BM25 full-text search index
        if (api?.searchAPI?.delete) {
            console.log(`[Storage] Deleting from BM25 search index...`);
            await api.searchAPI.delete(id).catch((e: Error) =>
                console.error('[Storage] Failed to delete from BM25 index:', e)
            );
        }

        // 5. Clear thumbnail cache
        if (api?.fileStorageAPI?.deleteThumbnail) {
            console.log(`[Storage] Deleting thumbnail...`);
            await api.fileStorageAPI.deleteThumbnail(id).catch((e: Error) =>
                console.error('[Storage] Failed to delete thumbnail:', e)
            );
        }

        // 6. Clear AI classification cache from localStorage
        try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('OMNICLIPPER_AI_CACHE_') && key.includes(id)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                console.log(`[Storage] Removed AI cache: ${key}`);
            });
        } catch (e) {
            console.error('[Storage] Failed to clear AI cache:', e);
        }

        console.log(`[Storage] Permanently deleted item ${id} and all related caches`);
    }
    return true;
};

export const cleanupOldTrash = async (daysToKeep = 3): Promise<number> => {
    const items = getItems();
    const now = new Date().getTime();
    const msPerDay = 24 * 60 * 60 * 1000;

    const itemsToDelete = items.filter(i => {
        if (!i.deletedAt) return false;
        const deletedTime = new Date(i.deletedAt).getTime();
        return (now - deletedTime) > (daysToKeep * msPerDay);
    });

    let count = 0;
    for (const item of itemsToDelete) {
        await permanentlyDeleteItem(item.id);
        count++;
    }

    if (count > 0) {
        console.log(`[Trash] Auto-cleaned ${count} items older than ${daysToKeep} days.`);
    }
    return count;
};

export const getItemByHash = async (hash: string, includeTrash = false): Promise<ResourceItem | null> => {
    if (!hash) return null;

    // Need to search through full metadata files for hash
    // For now, this is a placeholder - in production we'd need an index
    const items = getItems();
    for (const item of items) {
        if (includeTrash || !item.deletedAt) {
            const fullItem = await getItemById(item.id);
            if (fullItem?.fileHash === hash) {
                return fullItem;
            }
        }
    }
    return null;
};

// ============================================
// Import/Export Operations
// ============================================

export const exportData = async (): Promise<string> => {
    // For export, we need to include full item data
    const indexItems = getItems();
    const fullItems: ResourceItem[] = [];

    if (storageState.isElectronEnvironment) {
        // Read full metadata for each item
        for (const indexEntry of indexItems) {
            const fullItem = await getItemById(indexEntry.id);
            if (fullItem) {
                fullItems.push(fullItem);
            }
        }
    } else {
        // Web fallback: use index entries
        for (const indexEntry of indexItems) {
            fullItems.push({
                id: indexEntry.id,
                title: indexEntry.title,
                type: indexEntry.type,
                tags: indexEntry.tags,
                folderId: indexEntry.folderId,
                color: indexEntry.color,
                isStarred: indexEntry.isStarred,
                createdAt: indexEntry.createdAt,
                updatedAt: indexEntry.updatedAt,
                deletedAt: indexEntry.deletedAt,
                isCloud: false,
                path: undefined,
                localPath: undefined,
                fileSize: undefined,
                mimeType: undefined,
                contentSnippet: undefined,
                aiSummary: undefined,
                embeddedData: undefined,
                originalPath: undefined,
                thumbnailUrl: undefined,
                description: undefined,
                fileHash: undefined,
                storageMode: 'reference',
            });
        }
    }

    const data = {
        version: 2,  // New version with full item data
        exportedAt: new Date().toISOString(),
        items: fullItems,
        tags: storageState.libraryCache?.tags || [],
        folders: storageState.libraryCache?.folders || [],
    };
    return JSON.stringify(data, null, 2);
};

export const getImportStats = (jsonString: string) => {
    try {
        const data = JSON.parse(jsonString);
        return {
            itemCount: Array.isArray(data.items) ? data.items.length : 0,
            tagCount: Array.isArray(data.tags) ? data.tags.length : 0,
            folderCount: Array.isArray(data.folders) ? data.folders.length : 0,
            valid: true
        };
    } catch (e) {
        return { valid: false, error: 'Invalid JSON' };
    }
};

export const importData = async (jsonString: string, options: { merge: boolean } = { merge: true }) => {
    try {
        const data = JSON.parse(jsonString);
        if (!data.items) throw new Error('Invalid data format');

        const currentIndexItems = getItems();
        const itemsToImport = data.items || [];

        for (const importItem of itemsToImport) {
            // Skip if item already exists and not merging
            const exists = currentIndexItems.find(i => i.id === importItem.id);
            if (!exists || options.merge) {
                // Save full metadata to files/{id}/metadata.json
                if (storageState.isElectronEnvironment) {
                    await itemFileService.saveItemMetadata(importItem);
                }

                // Create index entry
                const indexEntry: ItemIndexEntry = {
                    id: importItem.id,
                    title: importItem.title,
                    type: importItem.type as ResourceType,
                    tags: importItem.tags || [],
                    folderId: importItem.folderId,
                    color: importItem.color || 'tag-gray',
                    isStarred: importItem.isStarred || false,
                    createdAt: importItem.createdAt,
                    updatedAt: importItem.updatedAt,
                    deletedAt: importItem.deletedAt,
                };

                // Add to index
                const newItems = getItems();
                if (!exists) {
                    newItems.unshift(indexEntry);
                }
                saveItems(newItems);
            }
        }

        // Auto-index imported items
        if (storageState.isElectronEnvironment) {
            console.log('[Import] Starting background indexing...');
            const itemsToIndex = options.merge
                ? itemsToImport.filter((i: ResourceItem) => !currentIndexItems.find(c => c.id === i.id))
                : itemsToImport;

            (async () => {
                let successCount = 0;
                for (const item of itemsToIndex) {
                    try {
                        await vectorStoreService.indexDocument({
                            id: item.id,
                            text: item.contentSnippet || item.embeddedData || item.description || '',
                            metadata: {
                                title: item.title,
                                type: item.type,
                                tags: item.tags,
                                createdAt: item.createdAt
                            }
                        });
                        successCount++;
                    } catch (err) {
                        console.error(`[Import] Failed to index item ${item.id}:`, err);
                    }
                }
                console.log(`[Import] Background indexing completed. Indexed ${successCount}/${itemsToIndex.length} items.`);
            })();
        }

        return { success: true, count: itemsToImport.length };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

export const reindexAllItems = async (onProgress?: (current: number, total: number) => void) => {
    if (!storageState.isElectronEnvironment) {
        console.warn('Reindexing skipped: Not in Electron environment');
        return;
    }

    const items = getItems();
    console.log(`[Reindex] Starting reindex for ${items.length} items...`);

    let processed = 0;

    for (const indexEntry of items) {
        try {
            const fullItem = await getItemById(indexEntry.id);
            if (fullItem) {
                await vectorStoreService.indexDocument({
                    id: fullItem.id,
                    text: fullItem.contentSnippet || fullItem.embeddedData || fullItem.description || '',
                    metadata: {
                        title: fullItem.title,
                        type: fullItem.type,
                        tags: fullItem.tags,
                        createdAt: fullItem.createdAt
                    }
                });
            }
        } catch (err) {
            console.error(`[Reindex] Failed to index item ${indexEntry.id}:`, err);
        }
        processed++;
        if (onProgress) onProgress(processed, items.length);
    }

    console.log('[Reindex] Completed.');
};

export const importFromBrowserExtension = async (data: any) => {
    // Placeholder for extension import logic
    return addItem(data);
};
