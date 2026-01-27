import { ResourceItem, FileStorageMode } from '../../types';
import { storageState } from './state';
import { scheduleLibraryWrite } from './persistence';
import * as itemMetaService from '../itemMetadataService';
import { vectorStoreService } from '../vectorStoreService';

// Utilities
const generateId = () => Math.random().toString(36).substr(2, 9);
const pathUtils = {
    basename: (filePath: string) => filePath.split(/[/\\]/).pop() || filePath,
    join: (...parts: string[]) => parts.filter(Boolean).join('/').replace(/\/+/g, '/'),
};

export const getItems = (): ResourceItem[] => {
    return storageState.libraryCache?.items || [];
};

export const saveItems = (items: ResourceItem[]): void => {
    if (storageState.libraryCache) {
        storageState.libraryCache.items = items;
        storageState.libraryCache.lastModified = new Date().toISOString();
        scheduleLibraryWrite();
    }
};

export const addItem = async (item: Omit<ResourceItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<ResourceItem> => {
    const newItem: ResourceItem = {
        ...item,
        id: item.id || generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    const items = getItems();
    items.unshift(newItem);
    saveItems(items);

    if (storageState.isElectronEnvironment) {
        await itemMetaService.saveItemMetadata(newItem);
        // Trigger full content indexing (background)
        import('../indexingService').then(({ indexResourceItem }) => {
            indexResourceItem(newItem).catch(err =>
                console.error('[Storage] Auto-indexing failed:', err)
            );
        });
    }

    return newItem;
};

export const updateItem = async (id: string, updates: Partial<ResourceItem>): Promise<ResourceItem | null> => {
    const items = getItems();
    const index = items.findIndex(i => i.id === id);
    if (index === -1) return null;

    items[index] = { ...items[index], ...updates, updatedAt: new Date().toISOString() };
    saveItems(items);

    if (storageState.isElectronEnvironment) {
        await itemMetaService.saveItemMetadata(items[index]);
        if (updates.title || updates.contentSnippet || updates.tags || updates.path) {
            // Trigger re-indexing if content-related fields changed
            import('../indexingService').then(({ indexResourceItem }) => {
                indexResourceItem(items[index]).catch(err =>
                    console.error('[Storage] Re-indexing failed:', err)
                );
            });
        }
    }
    return items[index];
};

export const deleteItem = async (id: string): Promise<boolean> => {
    const items = getItems();
    const index = items.findIndex(i => i.id === id);
    if (index === -1) return false;

    items.splice(index, 1);
    saveItems(items);

    if (storageState.isElectronEnvironment) {
        await itemMetaService.deleteItemMetadata(id);
        vectorStoreService.deleteDocument(id).catch(console.error);
    }
    return true;
};

export const getItemById = (id: string): ResourceItem | null => {
    return getItems().find(i => i.id === id) || null;
};

// Import/Export logic
export const exportData = (): string => {
    const data = {
        version: 1,
        exportedAt: new Date().toISOString(),
        items: getItems(),
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

        const currentItems = getItems();
        // Very basic import logic for refactor placeholder
        const newItems = options.merge
            ? [...currentItems, ...data.items.filter((i: any) => !currentItems.find(c => c.id === i.id))]
            : data.items;

        saveItems(newItems);

        // Auto-index imported items
        if (storageState.isElectronEnvironment) {
            console.log('[Import] Starting background indexing...');
            const itemsToIndex = options.merge
                ? data.items.filter((i: any) => !currentItems.find(c => c.id === i.id))
                : data.items;

            // Index in background
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

        return { success: true, count: newItems.length };
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

    for (const item of items) {
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
        } catch (err) {
            console.error(`[Reindex] Failed to index item ${item.id}:`, err);
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
