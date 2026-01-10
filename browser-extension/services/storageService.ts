import { SavedItem, AppSettings } from '../types';

const STORAGE_KEY_ITEMS = 'omniclipper_items';
const STORAGE_KEY_SETTINGS = 'omniclipper_settings';

const DEFAULT_SETTINGS: AppSettings = {
  storageMode: 'local',
  feishuConfig: {
    appId: '',
    appSecret: '',
    appToken: '',
    tableId: ''
  },
  supabaseConfig: {
    url: 'https://eglbolqkcvggheixlafg.supabase.co',
    anonKey: 'sb_publishable_q3Ksl2GntTxW_cqrgJeXGw_AjgPmIXX',
    tableName: 'omniclipper_items'
  },
  userSession: undefined,
  subscription: {
    plan: 'free',
    isActive: false
  }
};

export const StorageService = {
  getSettings: (): AppSettings => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with default to ensure new fields (like supabaseConfig, userSession) exist if loading old settings
        return { 
          ...DEFAULT_SETTINGS, 
          ...parsed,
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
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  },

  getItems: (): SavedItem[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ITEMS);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load items', e);
      return [];
    }
  },

  saveItem: (item: SavedItem): SavedItem[] => {
    const items = StorageService.getItems();
    const newItems = [item, ...items];
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(newItems));
    return newItems;
  },

  deleteItem: (id: string): SavedItem[] => {
    const items = StorageService.getItems();
    const newItems = items.filter(i => i.id !== id);
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(newItems));
    return newItems;
  },
  
  updateItemSyncStatus: (id: string, status: boolean): void => {
     const items = StorageService.getItems();
     const newItems = items.map(i => i.id === id ? { ...i, synced: status } : i);
     localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(newItems));
  }
};