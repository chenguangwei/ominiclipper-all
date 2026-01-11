import { ResourceItem, AppSettings, SupabaseConfig, FeishuConfig, Tag, Folder, STORAGE_KEYS, SyncStatus } from '../types';

// Storage keys - aligned with desktop app
const STORAGE_KEY_ITEMS = STORAGE_KEYS.ITEMS;
const STORAGE_KEY_SETTINGS = STORAGE_KEYS.SETTINGS;
const STORAGE_KEY_TAGS = STORAGE_KEYS.TAGS;
const STORAGE_KEY_FOLDERS = STORAGE_KEYS.FOLDERS;

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

  saveItems: (items: ResourceItem[]): void => {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save items', e);
    }
  },

  saveItem: (item: ResourceItem): ResourceItem[] => {
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
    const newItems = [item, ...items];
    StorageService.saveItems(newItems);
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
    return newItems;
  },

  deleteItems: (ids: string[]): ResourceItem[] => {
    const items = StorageService.getItems();
    const idSet = new Set(ids);
    const newItems = items.filter(i => !idSet.has(i.id));
    StorageService.saveItems(newItems);
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
  },

  clearAllData: (): void => {
    localStorage.removeItem(STORAGE_KEY_ITEMS);
    localStorage.removeItem(STORAGE_KEY_SETTINGS);
    localStorage.removeItem(STORAGE_KEY_TAGS);
    localStorage.removeItem(STORAGE_KEY_FOLDERS);
  },

  // ========== Utilities ==========

  generateId
};
