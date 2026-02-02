import { ResourceItem, AppSettings, SupabaseConfig, FeishuConfig, Tag, Folder, STORAGE_KEYS, SyncStatus } from '../types';

// Storage keys - aligned with desktop app
const STORAGE_KEY_ITEMS = STORAGE_KEYS.ITEMS;
const STORAGE_KEY_SETTINGS = STORAGE_KEYS.SETTINGS;
const STORAGE_KEY_TAGS = STORAGE_KEYS.TAGS;
const STORAGE_KEY_FOLDERS = STORAGE_KEYS.FOLDERS;

// IndexedDB for large data (images)
const DB_NAME = 'omniclipper-storage';
const DB_VERSION = 1;
const STORE_LARGE_DATA = 'largeData';

let dbPromise: Promise<IDBDatabase> | null = null;

const initDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_LARGE_DATA)) {
        db.createObjectStore(STORE_LARGE_DATA, { keyPath: 'id' });
      }
    };
  });

  return dbPromise;
};

// Large data storage (images) using IndexedDB
const saveLargeData = async (id: string, data: { imageData?: string; markdown?: string }): Promise<void> => {
  try {
    const db = await initDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_LARGE_DATA, 'readwrite');
      const store = transaction.objectStore(STORE_LARGE_DATA);
      const request = store.put({ id, ...data, updatedAt: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to save large data to IndexedDB:', e);
  }
};

const getLargeData = async <T = { imageData?: string; markdown?: string }>(id: string): Promise<T | null> => {
  try {
    const db = await initDB();
    return await new Promise<T | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_LARGE_DATA, 'readonly');
      const store = transaction.objectStore(STORE_LARGE_DATA);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to get large data from IndexedDB:', e);
    return null;
  }
};

const deleteLargeData = async (id: string): Promise<void> => {
  try {
    const db = await initDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_LARGE_DATA, 'readwrite');
      const store = transaction.objectStore(STORE_LARGE_DATA);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Failed to delete large data from IndexedDB:', e);
  }
};

// Helper to check if data exceeds localStorage limit (roughly 2MB to be safe)
const isLargeData = (data: string): boolean => {
  return data.length > 1_500_000; // ~1.5MB limit for localStorage items
};

const DEFAULT_SETTINGS: AppSettings = {
  storageMode: 'local',
  feishuConfig: {
    appId: '',
    appSecret: '',
    appToken: '',
    tableId: ''
  },
  supabaseConfig: {
    url: '',
    anonKey: '',
    tableName: 'omniclipper_items'
  },
  userSession: undefined,
  subscription: {
    plan: 'free',
    isActive: false
  }
};

// Generate unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

export const StorageService = {
  // ========== Settings ==========

  getSettings: (): AppSettings => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          feishuConfig: { ...DEFAULT_SETTINGS.feishuConfig, ...parsed.feishuConfig },
          supabaseConfig: { ...DEFAULT_SETTINGS.supabaseConfig, ...parsed.supabaseConfig },
          subscription: { ...DEFAULT_SETTINGS.subscription, ...parsed.subscription }
        };
      }
      return DEFAULT_SETTINGS;
    } catch (e) {
      console.error('Failed to load settings', e);
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings: (settings: AppSettings): void => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  },

  updateFeishuConfig: (config: Partial<FeishuConfig>): AppSettings => {
    const settings = StorageService.getSettings();
    settings.feishuConfig = { ...settings.feishuConfig, ...config };
    StorageService.saveSettings(settings);
    return settings;
  },

  updateSupabaseConfig: (config: Partial<SupabaseConfig>): AppSettings => {
    const settings = StorageService.getSettings();
    settings.supabaseConfig = { ...settings.supabaseConfig, ...config };
    StorageService.saveSettings(settings);
    return settings;
  },

  setStorageMode: (mode: 'local' | 'supabase' | 'feishu'): AppSettings => {
    const settings = StorageService.getSettings();
    settings.storageMode = mode;
    StorageService.saveSettings(settings);
    return settings;
  },

  // ========== Items (ResourceItem) ==========

  getItems: (): ResourceItem[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ITEMS);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load items', e);
      return [];
    }
  },

  // Get item with large data (images) loaded from IndexedDB
  getItemWithLargeData: async (id: string): Promise<ResourceItem | undefined> => {
    const items = StorageService.getItems();
    const item = items.find(i => i.id === id);
    if (!item) return undefined;

    // Load large data from IndexedDB if present
    const largeData = await getLargeData(id);
    if (largeData) {
      if (largeData.imageData) item.imageData = largeData.imageData;
      if (largeData.markdown) item.markdown = largeData.markdown;
    }
    return item;
  },

  // Get all items with large data loaded from IndexedDB
  getAllItemsWithLargeData: async (): Promise<ResourceItem[]> => {
    const items = StorageService.getItems();

    // Load large data for items that have it stored in IndexedDB
    const itemsWithData: ResourceItem[] = [];
    for (const item of items) {
      const largeData = await getLargeData(item.id);
      if (largeData) {
        const itemWithData = { ...item };
        if (largeData.imageData) itemWithData.imageData = largeData.imageData;
        if (largeData.markdown) itemWithData.markdown = largeData.markdown;
        itemsWithData.push(itemWithData);
      } else {
        itemsWithData.push(item);
      }
    }
    return itemsWithData;
  },

  saveItems: (items: ResourceItem[]): void => {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save items', e);
    }
  },

  saveItem: (item: ResourceItem, syncToDesktop = true): ResourceItem[] => {
    const items = StorageService.getItems();
    if (!item.id) {
      item.id = generateId();
    }
    if (!item.createdAt) {
      item.createdAt = new Date().toISOString();
    }
    if (!item.updatedAt) {
      item.updatedAt = new Date().toISOString();
    }

    // Handle large data (images) - store in IndexedDB if too large
    const itemToSave = { ...item };
    const largeDataToSave: { imageData?: string; markdown?: string } = {};

    if (item.imageData && isLargeData(item.imageData)) {
      largeDataToSave.imageData = item.imageData;
      delete itemToSave.imageData;
    }

    if (item.markdown && isLargeData(item.markdown)) {
      largeDataToSave.markdown = item.markdown;
      delete itemToSave.markdown;
    }

    // Save large data to IndexedDB if needed
    if (Object.keys(largeDataToSave).length > 0) {
      saveLargeData(item.id, largeDataToSave);
    }

    const newItems = [itemToSave, ...items];
    StorageService.saveItems(newItems);

    // Sync to desktop app asynchronously
    if (syncToDesktop) {
      import('./syncClient').then(({ syncToDesktopAsync }) => {
        syncToDesktopAsync(item);
      }).catch(() => {
        // Silent fail - sync is best effort
      });
    }

    return newItems;
  },

  getItemById: (id: string): ResourceItem | undefined => {
    const items = StorageService.getItems();
    return items.find(item => item.id === id);
  },

  updateItem: (id: string, updates: Partial<ResourceItem>): ResourceItem[] => {
    const items = StorageService.getItems();
    const newItems = items.map(item =>
      item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
    );
    StorageService.saveItems(newItems);
    return newItems;
  },

  deleteItem: (id: string): ResourceItem[] => {
    const items = StorageService.getItems();
    const newItems = items.filter(i => i.id !== id);
    StorageService.saveItems(newItems);
    // Also delete from IndexedDB
    deleteLargeData(id);
    return newItems;
  },

  deleteItems: (ids: string[]): ResourceItem[] => {
    const items = StorageService.getItems();
    const idSet = new Set(ids);
    const newItems = items.filter(i => !idSet.has(i.id));
    StorageService.saveItems(newItems);
    // Also delete from IndexedDB
    ids.forEach(id => deleteLargeData(id));
    return newItems;
  },

  updateItemSyncStatus: (id: string, status: SyncStatus): ResourceItem[] => {
    const items = StorageService.getItems();
    const newItems = items.map(i =>
      i.id === id ? { ...i, syncStatus: status, updatedAt: new Date().toISOString() } : i
    );
    StorageService.saveItems(newItems);
    return newItems;
  },

  // ========== Tags ==========

  getTags: (): Tag[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_TAGS);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load tags', e);
      return [];
    }
  },

  saveTags: (tags: Tag[]): void => {
    try {
      localStorage.setItem(STORAGE_KEY_TAGS, JSON.stringify(tags));
    } catch (e) {
      console.error('Failed to save tags', e);
    }
  },

  // ========== Folders ==========

  getFolders: (): Folder[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_FOLDERS);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load folders', e);
      return [];
    }
  },

  saveFolders: (folders: Folder[]): void => {
    try {
      localStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));
    } catch (e) {
      console.error('Failed to save folders', e);
    }
  },

  addFolder: (folder: Omit<Folder, 'id'>): Folder => {
    const folders = StorageService.getFolders();
    // Check for duplicate name at same level
    const existing = folders.find(f => f.name === folder.name && f.parentId === folder.parentId);
    if (existing) {
      return existing;
    }
    const newFolder: Folder = { ...folder, id: generateId() };
    folders.push(newFolder);
    StorageService.saveFolders(folders);
    return newFolder;
  },

  updateFolder: (id: string, updates: Partial<Folder>): Folder | null => {
    const folders = StorageService.getFolders();
    const index = folders.findIndex(f => f.id === id);
    if (index === -1) return null;
    folders[index] = { ...folders[index], ...updates };
    StorageService.saveFolders(folders);
    return folders[index];
  },

  deleteFolder: (id: string): boolean => {
    const folders = StorageService.getFolders();
    if (!folders.find(f => f.id === id)) return false;

    // Identify all folders to delete (recursive)
    const idsToDelete = new Set<string>([id]);
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

    // Remove folders
    const filtered = folders.filter(f => !idsToDelete.has(f.id));
    StorageService.saveFolders(filtered);

    // Update items (orphan them)
    const items = StorageService.getItems();
    let itemsChanged = false;
    items.forEach(i => {
      if (i.folderId && idsToDelete.has(i.folderId)) {
        i.folderId = undefined;
        itemsChanged = true;
      }
    });
    if (itemsChanged) {
      StorageService.saveItems(items);
    }

    return true;
  },

  getFolderById: (id: string): Folder | undefined => {
    const folders = StorageService.getFolders();
    return folders.find(f => f.id === id);
  },

  getChildFolders: (parentId?: string): Folder[] => {
    const folders = StorageService.getFolders();
    return folders.filter(f => f.parentId === parentId);
  },

  getItemsByFolder: (folderId: string): ResourceItem[] => {
    const items = StorageService.getItems();
    if (folderId === 'all') {
      return items;
    }
    if (folderId === 'uncategorized') {
      return items.filter(i => !i.folderId);
    }
    return items.filter(i => i.folderId === folderId);
  },

  moveItemToFolder: (itemId: string, folderId: string | undefined): boolean => {
    const items = StorageService.getItems();
    const index = items.findIndex(i => i.id === itemId);
    if (index === -1) return false;

    // Handle special folder IDs
    const actualFolderId = folderId === 'all' || folderId === 'uncategorized' ? undefined : folderId;
    items[index] = { ...items[index], folderId: actualFolderId, updatedAt: new Date().toISOString() };
    StorageService.saveItems(items);
    return true;
  },

  // ========== Search and Filter ==========

  searchItems: (query: string): ResourceItem[] => {
    if (!query.trim()) return StorageService.getItems();

    const lowerQuery = query.toLowerCase();
    return StorageService.getItems().filter(item =>
      item.title.toLowerCase().includes(lowerQuery) ||
      (item.content?.toLowerCase().includes(lowerQuery)) ||
      (item.markdown?.toLowerCase().includes(lowerQuery)) ||
      (item.description?.toLowerCase().includes(lowerQuery)) ||
      item.url?.toLowerCase().includes(lowerQuery) ||
      item.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  },

  filterByType: (type: string): ResourceItem[] => {
    if (type === 'all') return StorageService.getItems();
    return StorageService.getItems().filter(item => item.type === type);
  },

  filterByTag: (tag: string): ResourceItem[] => {
    return StorageService.getItems().filter(item =>
      item.tags.includes(tag)
    );
  },

  filterBySyncStatus: (status: SyncStatus): ResourceItem[] => {
    return StorageService.getItems().filter(item => item.syncStatus === status);
  },

  // ========== Tags (from items) ==========

  getAllTags: (): string[] => {
    const items = StorageService.getItems();
    const tagSet = new Set<string>();
    items.forEach(item => {
      item.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  },

  getTagCounts: (): Record<string, number> => {
    const items = StorageService.getItems();
    const counts: Record<string, number> = {};
    items.forEach(item => {
      item.tags.forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return counts;
  },

  // ========== Stats ==========

  getStats: (): { total: number; synced: number; pending: number; byType: Record<string, number> } => {
    const items = StorageService.getItems();
    const byType: Record<string, number> = {};
    let synced = 0;
    let pending = 0;

    items.forEach(item => {
      byType[item.type] = (byType[item.type] || 0) + 1;
      if (item.syncStatus === 'synced') {
        synced++;
      } else if (item.syncStatus === 'pending') {
        pending++;
      }
    });

    return {
      total: items.length,
      synced,
      pending,
      byType
    };
  },

  // ========== Import/Export ==========

  exportData: (): string => {
    const data = {
      items: StorageService.getItems(),
      tags: StorageService.getTags(),
      folders: StorageService.getFolders(),
      settings: StorageService.getSettings(),
      exportedAt: new Date().toISOString(),
      version: '2.0.0'
    };
    return JSON.stringify(data, null, 2);
  },

  importData: (jsonString: string): { success: boolean; message: string; itemsCount?: number } => {
    try {
      const data = JSON.parse(jsonString);

      if (!data.items || !Array.isArray(data.items)) {
        return { success: false, message: 'Invalid data format: missing items array' };
      }

      // Merge items (deduplicate)
      const existingItems = StorageService.getItems();
      const existingIds = new Set(existingItems.map(i => i.id));
      const newItems = data.items.filter((item: ResourceItem) => !existingIds.has(item.id));

      const mergedItems = [...newItems, ...existingItems];
      StorageService.saveItems(mergedItems);

      // Import tags if present
      if (data.tags && Array.isArray(data.tags)) {
        const existingTags = StorageService.getTags();
        const existingTagIds = new Set(existingTags.map(t => t.id));
        const newTags = data.tags.filter((tag: Tag) => !existingTagIds.has(tag.id));
        StorageService.saveTags([...newTags, ...existingTags]);
      }

      // Import folders if present
      if (data.folders && Array.isArray(data.folders)) {
        const existingFolders = StorageService.getFolders();
        const existingFolderIds = new Set(existingFolders.map(f => f.id));
        const newFolders = data.folders.filter((folder: Folder) => !existingFolderIds.has(folder.id));
        StorageService.saveFolders([...newFolders, ...existingFolders]);
      }

      return {
        success: true,
        message: `Successfully imported ${newItems.length} new items`,
        itemsCount: newItems.length
      };
    } catch (e) {
      console.error('Import failed', e);
      return { success: false, message: 'Failed to parse import data' };
    }
  },

  // ========== Clear Data ==========

  clearAllItems: (): void => {
    localStorage.removeItem(STORAGE_KEY_ITEMS);
    // Also clear IndexedDB
    initDB().then(db => {
      db.transaction(STORE_LARGE_DATA, 'readwrite').objectStore(STORE_LARGE_DATA).clear();
    }).catch(() => {});
  },

  clearAllData: (): void => {
    localStorage.removeItem(STORAGE_KEY_ITEMS);
    localStorage.removeItem(STORAGE_KEY_SETTINGS);
    localStorage.removeItem(STORAGE_KEY_TAGS);
    localStorage.removeItem(STORAGE_KEY_FOLDERS);
    // Also clear IndexedDB
    initDB().then(db => {
      db.transaction(STORE_LARGE_DATA, 'readwrite').objectStore(STORE_LARGE_DATA).clear();
    }).catch(() => {});
  },

  // Clear large data cache for specific item
  clearLargeDataCache: async (id: string): Promise<void> => {
    deleteLargeData(id);
  },

  // ========== Utilities ==========

  generateId
};
