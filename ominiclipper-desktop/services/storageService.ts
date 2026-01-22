/**
 * 本地存储服务
 * 提供资源、文件夹、标签的本地持久化存储
 *
 * 存储策略：
 * - Electron 环境：使用 JSON 文件存储（library.json, settings.json）
 * - Web 环境：降级使用 localStorage
 * - 内存缓存 + 防抖写入，确保性能
 * - Eagle 风格：mtime.json 自动追踪，backup/ 自动备份，items/{id}/metadata.json
 */
import { ResourceItem, Tag, Folder, FilterState, ViewMode } from '../types';
import { MOCK_TAGS, MOCK_FOLDERS } from '../constants';
import * as mtimeService from './mtimeService';
import * as backupService from './backupService';
import * as folderDirService from './folderDirectoryService';
import * as itemMetaService from './itemMetadataService';
import { vectorStoreService } from './vectorStoreService';

// Browser-compatible path utilities (avoid Node.js path module)
const pathUtils = {
  basename: (filePath: string): string => {
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || filePath;
  },
  join: (...parts: string[]): string => {
    return parts
      .filter(Boolean)
      .join('/')
      .replace(/\/+/g, '/');
  },
};

// ============================================
// 类型定义
// ============================================

interface LibraryData {
  version: number;
  lastModified: string;
  items: ResourceItem[];
  tags: Tag[];
  folders: Folder[];
}

interface SettingsData {
  version: number;
  colorMode: string;
  themeId: string;
  locale: string;
  customStoragePath: string | null;
  viewMode: string;
  filterState: FilterState;
  recentFiles: any[];
  favoriteFolders: string[];
}

// localStorage 键（用于迁移和 Web 降级）
const STORAGE_KEYS = {
  ITEMS: 'omniclipper_items',
  TAGS: 'omniclipper_tags',
  FOLDERS: 'omniclipper_folders',
  FILTER_STATE: 'omniclipper_filter_state',
  VIEW_MODE: 'omniclipper_view_mode',
  COLOR_MODE: 'app_color_mode',
  THEME_ID: 'app_theme_id',
  STORAGE_PATH: 'omniclipper_storage_path',
  RECENT_FILES: 'omniclipper_recent_files',
  FAVORITE_FOLDERS: 'omniclipper_favorite_folders',
  LOCALE: 'LOCALE_KEY',
};

// ============================================
// 内存缓存和状态
// ============================================

let libraryCache: LibraryData | null = null;
let settingsCache: SettingsData | null = null;
let isElectronEnvironment = false;
let isInitialized = false;
let libraryWriteTimer: ReturnType<typeof setTimeout> | null = null;
let settingsWriteTimer: ReturnType<typeof setTimeout> | null = null;

const WRITE_DEBOUNCE_MS = 500;

// ============================================
// Electron API 类型
// ============================================

// 扩展 Window 接口以包含 Electron API
// 注意：使用 [key: string]: any 来避免类型冲突，因为 preload.js 中定义了更多属性
declare global {
  interface Window {
    electronAPI?: {
      // 通用 API
      getUserDataPath: () => Promise<string>;
      // 文件 API
      fileAPI?: {
        moveFile: (sourcePath: string, targetPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      };
      // 存储 API
      storageAPI?: {
        getDataPath: () => Promise<string>;
        readLibrary: () => Promise<LibraryData | null>;
        writeLibrary: (data: LibraryData) => Promise<{ success: boolean; error?: string }>;
        readSettings: () => Promise<SettingsData | null>;
        writeSettings: (data: SettingsData) => Promise<{ success: boolean; error?: string }>;
        migrate: (legacyData: any) => Promise<{ success: boolean; libraryData?: LibraryData; settingsData?: SettingsData; error?: string }>;
      };
      // MTime API
      mtimeAPI?: {
        readMTime: () => Promise<MTimeData>;
        updateMTime: (itemId: string) => Promise<{ success: boolean }>;
        setMTime: (itemId: string, timestamp: number) => Promise<{ success: boolean }>;
        removeMTime: (itemId: string) => Promise<{ success: boolean }>;
        getMTime: (itemId: string) => Promise<number | null>;
        getAll: () => Promise<Record<string, number>>;
        getCount: () => Promise<number>;
      };
      // 备份 API
      backupAPI?: {
        createBackup: (data: any) => Promise<{ success: boolean; path?: string; error?: string }>;
        listBackups: () => Promise<BackupInfo[]>;
        restoreBackup: (backupPath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        deleteBackup: (backupPath: string) => Promise<{ success: boolean; error?: string }>;
        cleanupOldBackups: (keepCount: number) => Promise<{ deleted: number; error?: string }>;
        getBackupPath: () => Promise<string>;
      };
      // 文件夹 API
      folderAPI?: {
        getFoldersPath: () => Promise<string>;
        createFolder: (folderId: string) => Promise<{ success: boolean; path?: string; error?: string }>;
        deleteFolder: (folderId: string) => Promise<{ success: boolean; error?: string }>;
        folderExists: (folderId: string) => Promise<boolean>;
      };
      // 项目 API
      itemAPI?: {
        getItemsPath: () => Promise<string>;
        saveItemMetadata: (itemId: string, metadata: any) => Promise<{ success: boolean; path?: string; error?: string }>;
        readItemMetadata: (itemId: string) => Promise<any | null>;
        deleteItemMetadata: (itemId: string) => Promise<{ success: boolean; error?: string }>;
        saveItemsIndex: (index: any) => Promise<{ success: boolean; error?: string }>;
        readItemsIndex: () => Promise<any | null>;
      };
      // 向量搜索 API
      vectorAPI?: {
        initialize: () => Promise<{ success: boolean; error?: string }>;
        index: (id: string, text: string, metadata: any) => Promise<{ success: boolean; error?: string }>;
        search: (query: string, limit: number) => Promise<any[]>;
        delete: (id: string) => Promise<{ success: boolean; error?: string }>;
        getStats: () => Promise<any>;
      };
      // BM25 全文搜索 API
      searchAPI?: {
        index: (id: string, text: string, metadata: any) => Promise<{ success: boolean; error?: string }>;
        delete: (id: string) => Promise<{ success: boolean; error?: string }>;
        bm25Search: (query: string, limit: number) => Promise<any[]>;
        getStats: () => Promise<any>;
      };
      // 允许其他属性（来自 preload.js）
      [key: string]: any;
    };
  }
}

interface MTimeData {
  times: Record<string, number>;
  count: number;
  lastModified: string;
}

interface BackupInfo {
  path: string;
  fileName: string;
  timestamp: Date;
  size: number;
  itemCount: number;
}

// ============================================
// 初始化
// ============================================

/**
 * 初始化存储服务
 * 应在应用启动时调用一次
 */
export const initStorage = async (): Promise<void> => {
  if (isInitialized) {
    console.log('[Storage] Already initialized');
    return;
  }

  isElectronEnvironment = !!(window.electronAPI?.storageAPI);
  console.log('[Storage] Environment:', isElectronEnvironment ? 'Electron' : 'Web');

  if (isElectronEnvironment) {
    await initElectronStorage();
  } else {
    initLocalStorage();
  }

  isInitialized = true;
  console.log('[Storage] Initialization complete');
};

/**
 * Electron 环境初始化
 */
const initElectronStorage = async (): Promise<void> => {
  const storageAPI = window.electronAPI!.storageAPI!;

  // 尝试读取 library.json
  libraryCache = await storageAPI.readLibrary();

  if (!libraryCache) {
    // JSON 文件不存在，检查 localStorage 是否有数据需要迁移
    const legacyItems = localStorage.getItem(STORAGE_KEYS.ITEMS);

    if (legacyItems) {
      console.log('[Storage] Found legacy localStorage data, migrating...');
      await migrateFromLocalStorage();
    } else {
      // 全新安装，初始化空数据
      console.log('[Storage] Fresh install, initializing empty data');
      libraryCache = {
        version: 1,
        lastModified: new Date().toISOString(),
        items: [],
        tags: MOCK_TAGS,
        folders: MOCK_FOLDERS,
      };
      // 保存初始数据
      await storageAPI.writeLibrary(libraryCache);
    }
  }

  // 读取 settings.json
  settingsCache = await storageAPI.readSettings();
  if (!settingsCache) {
    settingsCache = getDefaultSettings();
    await storageAPI.writeSettings(settingsCache);
  }

  console.log('[Storage] Loaded from JSON files');
  console.log('[Storage] - Items:', libraryCache?.items?.length || 0);
  console.log('[Storage] - Tags:', libraryCache?.tags?.length || 0);
  console.log('[Storage] - Folders:', libraryCache?.folders?.length || 0);
};

/**
 * Web 环境初始化（降级使用 localStorage）
 */
const initLocalStorage = (): void => {
  // 从 localStorage 加载到内存缓存
  try {
    const items = localStorage.getItem(STORAGE_KEYS.ITEMS);
    const tags = localStorage.getItem(STORAGE_KEYS.TAGS);
    const folders = localStorage.getItem(STORAGE_KEYS.FOLDERS);

    libraryCache = {
      version: 1,
      lastModified: new Date().toISOString(),
      items: items ? JSON.parse(items) : [],
      tags: tags ? JSON.parse(tags) : MOCK_TAGS,
      folders: folders ? JSON.parse(folders) : MOCK_FOLDERS,
    };

    settingsCache = getDefaultSettings();
    // 从 localStorage 读取设置
    const colorMode = localStorage.getItem(STORAGE_KEYS.COLOR_MODE);
    const themeId = localStorage.getItem(STORAGE_KEYS.THEME_ID);
    const filterState = localStorage.getItem(STORAGE_KEYS.FILTER_STATE);
    const viewMode = localStorage.getItem(STORAGE_KEYS.VIEW_MODE);

    if (colorMode) settingsCache.colorMode = colorMode;
    if (themeId) settingsCache.themeId = themeId;
    if (filterState) settingsCache.filterState = JSON.parse(filterState);
    if (viewMode) settingsCache.viewMode = viewMode;

  } catch (e) {
    console.error('[Storage] Failed to load from localStorage:', e);
    libraryCache = {
      version: 1,
      lastModified: new Date().toISOString(),
      items: [],
      tags: MOCK_TAGS,
      folders: MOCK_FOLDERS,
    };
    settingsCache = getDefaultSettings();
  }

  console.log('[Storage] Loaded from localStorage (Web fallback)');
};

/**
 * 获取默认设置
 */
const getDefaultSettings = (): SettingsData => ({
  version: 1,
  colorMode: 'dark',
  themeId: 'blue',
  locale: 'en',
  customStoragePath: null,
  viewMode: 'list',
  filterState: { search: '', tagId: null, color: null, folderId: 'all' },
  recentFiles: [],
  favoriteFolders: [],
});

/**
 * 从 localStorage 迁移数据到 JSON 文件
 */
const migrateFromLocalStorage = async (): Promise<void> => {
  if (!isElectronEnvironment) return;

  const storageAPI = window.electronAPI!.storageAPI!;

  // 收集 localStorage 中的所有数据
  const legacyData: any = {};

  try {
    const items = localStorage.getItem(STORAGE_KEYS.ITEMS);
    const tags = localStorage.getItem(STORAGE_KEYS.TAGS);
    const folders = localStorage.getItem(STORAGE_KEYS.FOLDERS);
    const colorMode = localStorage.getItem(STORAGE_KEYS.COLOR_MODE);
    const themeId = localStorage.getItem(STORAGE_KEYS.THEME_ID);
    const storagePath = localStorage.getItem(STORAGE_KEYS.STORAGE_PATH);
    const filterState = localStorage.getItem(STORAGE_KEYS.FILTER_STATE);
    const viewMode = localStorage.getItem(STORAGE_KEYS.VIEW_MODE);
    const recentFiles = localStorage.getItem(STORAGE_KEYS.RECENT_FILES);
    const favoriteFolders = localStorage.getItem(STORAGE_KEYS.FAVORITE_FOLDERS);
    const locale = localStorage.getItem(STORAGE_KEYS.LOCALE);

    legacyData.items = items ? JSON.parse(items) : [];
    legacyData.tags = tags ? JSON.parse(tags) : MOCK_TAGS;
    legacyData.folders = folders ? JSON.parse(folders) : MOCK_FOLDERS;
    legacyData.colorMode = colorMode || 'dark';
    legacyData.themeId = themeId || 'blue';
    legacyData.storagePath = storagePath || null;
    legacyData.filterState = filterState ? JSON.parse(filterState) : null;
    legacyData.viewMode = viewMode || 'list';
    legacyData.recentFiles = recentFiles ? JSON.parse(recentFiles) : [];
    legacyData.favoriteFolders = favoriteFolders ? JSON.parse(favoriteFolders) : [];
    legacyData.locale = locale || 'en';

  } catch (e) {
    console.error('[Storage] Error reading localStorage for migration:', e);
  }

  // 调用 Electron 主进程进行迁移
  const result = await storageAPI.migrate(legacyData);

  if (result.success) {
    libraryCache = result.libraryData || null;
    settingsCache = result.settingsData || null;
    console.log('[Storage] Migration successful');

    // 可选：清理 localStorage（保留一个标记以防万一）
    // Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    // localStorage.setItem('omniclipper_migrated', 'true');
  } else {
    console.error('[Storage] Migration failed:', result.error);
    // 降级：使用 localStorage 数据初始化缓存
    libraryCache = {
      version: 1,
      lastModified: new Date().toISOString(),
      items: legacyData.items || [],
      tags: legacyData.tags || MOCK_TAGS,
      folders: legacyData.folders || MOCK_FOLDERS,
    };
  }
};

// ============================================
// 防抖写入
// ============================================

/**
 * 调度 library 写入（防抖）
 */
const scheduleLibraryWrite = (): void => {
  if (libraryWriteTimer) {
    clearTimeout(libraryWriteTimer);
  }

  libraryWriteTimer = setTimeout(async () => {
    if (isElectronEnvironment && libraryCache) {
      const result = await window.electronAPI!.storageAPI!.writeLibrary(libraryCache);
      if (!result.success) {
        console.error('[Storage] Failed to write library:', result.error);
      }
    } else if (libraryCache) {
      // Web 降级：写入 localStorage
      try {
        localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(libraryCache.items));
        localStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(libraryCache.tags));
        localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(libraryCache.folders));
      } catch (e) {
        console.error('[Storage] Failed to write to localStorage:', e);
      }
    }
    libraryWriteTimer = null;
  }, WRITE_DEBOUNCE_MS);
};

/**
 * 调度 settings 写入（防抖）
 */
const scheduleSettingsWrite = (): void => {
  if (settingsWriteTimer) {
    clearTimeout(settingsWriteTimer);
  }

  settingsWriteTimer = setTimeout(async () => {
    if (isElectronEnvironment && settingsCache) {
      const result = await window.electronAPI!.storageAPI!.writeSettings(settingsCache);
      if (!result.success) {
        console.error('[Storage] Failed to write settings:', result.error);
      }
    } else if (settingsCache) {
      // Web 降级：写入 localStorage
      try {
        localStorage.setItem(STORAGE_KEYS.COLOR_MODE, settingsCache.colorMode);
        localStorage.setItem(STORAGE_KEYS.THEME_ID, settingsCache.themeId);
        localStorage.setItem(STORAGE_KEYS.VIEW_MODE, settingsCache.viewMode);
        localStorage.setItem(STORAGE_KEYS.FILTER_STATE, JSON.stringify(settingsCache.filterState));
      } catch (e) {
        console.error('[Storage] Failed to write settings to localStorage:', e);
      }
    }
    settingsWriteTimer = null;
  }, WRITE_DEBOUNCE_MS);
};

/**
 * 立即写入所有挂起的更改（用于应用关闭前）
 */
export const flushPendingWrites = async (): Promise<void> => {
  if (libraryWriteTimer) {
    clearTimeout(libraryWriteTimer);
    libraryWriteTimer = null;
  }
  if (settingsWriteTimer) {
    clearTimeout(settingsWriteTimer);
    settingsWriteTimer = null;
  }

  if (isElectronEnvironment) {
    if (libraryCache) {
      await window.electronAPI!.storageAPI!.writeLibrary(libraryCache);
    }
    if (settingsCache) {
      await window.electronAPI!.storageAPI!.writeSettings(settingsCache);
    }
  }
};

// ==================== 资源项目操作 ====================

/**
 * 获取所有资源项目
 */
export const getItems = (): ResourceItem[] => {
  return libraryCache?.items || [];
};

/**
 * 保存所有资源项目
 */
export const saveItems = (items: ResourceItem[]): void => {
  if (libraryCache) {
    libraryCache.items = items;
    libraryCache.lastModified = new Date().toISOString();
    scheduleLibraryWrite();
  }
};

/**
 * 添加资源项目
 */
export const addItem = async (item: Omit<ResourceItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ResourceItem> => {
  const newItem: ResourceItem = {
    ...item,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const items = getItems();
  items.unshift(newItem);
  saveItems(items);

  // Save item metadata to Eagle-style structure
  if (isElectronEnvironment) {
    await itemMetaService.saveItemMetadata(newItem);

    // Index for semantic search (async, non-blocking)
    indexItemForSemanticSearch(newItem).catch(err =>
      console.error('[Storage] Vector indexing failed:', err)
    );
  }

  return newItem;
};

/**
 * 更新资源项目
 */
export const updateItem = async (id: string, updates: Partial<ResourceItem>): Promise<ResourceItem | null> => {
  const items = getItems();
  const index = items.findIndex(item => item.id === id);
  if (index === -1) return null;

  const oldItem = items[index];
  const newFolderId = updates.folderId;
  const oldFolderId = oldItem.folderId;

  items[index] = {
    ...items[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveItems(items);

  // 如果 folderId 改变，移动文件到新文件夹
  if (isElectronEnvironment && newFolderId !== oldFolderId) {
    try {
      // 获取文件名
      let fileName = '';
      let sourcePath = '';

      if (oldItem.localPath) {
        // reference 模式：使用 localPath
        fileName = pathUtils.basename(oldItem.localPath);
        sourcePath = oldItem.localPath;
      } else if (oldItem.originalPath) {
        // embed 模式或只有 originalPath：尝试从 storage 获取文件名
        fileName = pathUtils.basename(oldItem.originalPath);
        // 尝试从 fileStorage 获取实际文件路径
        if ((window as any).electronAPI?.fileStorageAPI) {
          const storageFilePath = await (window as any).electronAPI.fileStorageAPI.getFilePath(oldItem.id, fileName);
          if (storageFilePath) {
            sourcePath = storageFilePath;
          }
        }
      }

      if (!fileName) {
        // 尝试从 embeddedData 的 originalPath 恢复文件名
        fileName = oldItem.originalPath?.split('/').pop() || `${oldItem.id}.pdf`;
      }

      if (fileName) {
        const userDataPath = await window.electronAPI!.getUserDataPath();
        const storagePath = pathUtils.join(userDataPath, 'OmniCollector');
        const targetDir = pathUtils.join(storagePath, 'folders', newFolderId || 'uncategorized');

        let targetPath: string | null = null;

        if (sourcePath && oldItem.localPath) {
          // reference 模式：使用 fileAPI.moveFile
          const targetFilePath = pathUtils.join(targetDir, fileName);
          const result = await window.electronAPI!.fileAPI!.moveFile(sourcePath, targetFilePath);
          if (result.success) {
            targetPath = targetFilePath;
            items[index].localPath = targetPath;
            items[index].path = targetPath;
            console.log('[Storage] Moved reference file to folder:', targetPath);
          }
        } else if ((window as any).electronAPI?.fileStorageAPI?.moveFileToFolder) {
          // embed 模式：使用 fileStorageAPI.moveFileToFolder
          const result = await (window as any).electronAPI.fileStorageAPI.moveFileToFolder(oldItem.id, fileName, newFolderId || 'uncategorized');
          if (result.success) {
            targetPath = result.path;
            items[index].localPath = targetPath;
            items[index].path = targetPath;
            console.log('[Storage] Moved embed file to folder:', targetPath);
          }
        }

        if (targetPath) {
          saveItems(items);
        }
      }
    } catch (error) {
      console.error('[Storage] Failed to move file to new folder:', error);
    }
  }

  // Update item metadata in Eagle-style structure
  if (isElectronEnvironment) {
    await itemMetaService.saveItemMetadata(items[index]);

    // Re-index for semantic search if content changed
    if (updates.title || updates.contentSnippet || updates.description || updates.tags) {
      indexItemForSemanticSearch(items[index]).catch(err =>
        console.error('[Storage] Vector re-indexing failed:', err)
      );
    }
  }

  return items[index];
};

/**
 * 删除资源项目
 */
export const deleteItem = async (id: string): Promise<boolean> => {
  const items = getItems();
  const index = items.findIndex(item => item.id === id);
  if (index === -1) return false;

  items.splice(index, 1);
  saveItems(items);

  // Delete item metadata from Eagle-style structure
  if (isElectronEnvironment) {
    await itemMetaService.deleteItemMetadata(id);

    // Remove from semantic search index
    removeItemFromSemanticSearch(id).catch(err =>
      console.error('[Storage] Vector deletion failed:', err)
    );
  }

  return true;
};

/**
 * 根据 ID 获取资源项目
 */
export const getItemById = (id: string): ResourceItem | null => {
  const items = getItems();
  return items.find(item => item.id === id) || null;
};

// ==================== 标签操作 ====================

/**
 * 获取所有标签
 */
export const getTags = (): Tag[] => {
  return libraryCache?.tags || [];
};

/**
 * 保存所有标签
 */
export const saveTags = (tags: Tag[]): void => {
  if (libraryCache) {
    libraryCache.tags = tags;
    libraryCache.lastModified = new Date().toISOString();
    scheduleLibraryWrite();
  }
};

/**
 * 添加标签
 */
export const addTag = (tag: Omit<Tag, 'id'>): Tag => {
  const newTag: Tag = {
    ...tag,
    id: generateId(),
    count: 0,
  };
  const tags = getTags();
  tags.push(newTag);
  saveTags(tags);
  return newTag;
};

/**
 * 更新标签
 */
export const updateTag = (id: string, updates: Partial<Tag>): Tag | null => {
  const tags = getTags();
  const index = tags.findIndex(tag => tag.id === id);
  if (index === -1) return null;

  tags[index] = { ...tags[index], ...updates };
  saveTags(tags);
  return tags[index];
};

/**
 * 删除标签
 */
export const deleteTag = (id: string): boolean => {
  const tags = getTags();
  const index = tags.findIndex(tag => tag.id === id);
  if (index === -1) return false;

  // 同时删除子标签
  const idsToDelete = [id, ...getDescendantTagIds(id, tags)];
  const filteredTags = tags.filter(tag => !idsToDelete.includes(tag.id));
  saveTags(filteredTags);

  // 从资源项目中移除被删除的标签
  const items = getItems();
  const updatedItems = items.map(item => ({
    ...item,
    tags: item.tags.filter(tagId => !idsToDelete.includes(tagId)),
  }));
  saveItems(updatedItems);

  return true;
};

/**
 * 获取标签的所有子孙标签 ID
 */
const getDescendantTagIds = (parentId: string, tags: Tag[]): string[] => {
  const children = tags.filter(t => t.parentId === parentId);
  let ids = children.map(c => c.id);
  children.forEach(c => {
    ids = [...ids, ...getDescendantTagIds(c.id, tags)];
  });
  return ids;
};

/**
 * 更新标签计数
 */
export const updateTagCounts = (): void => {
  const items = getItems();
  const tags = getTags();

  const updatedTags = tags.map(tag => ({
    ...tag,
    count: items.filter(item => item.tags.includes(tag.id)).length,
  }));

  saveTags(updatedTags);
};

// ==================== 文件夹操作 ====================

/**
 * 获取所有文件夹
 */
export const getFolders = (): Folder[] => {
  return libraryCache?.folders || [];
};

/**
 * 保存所有文件夹
 */
export const saveFolders = (folders: Folder[]): void => {
  if (libraryCache) {
    libraryCache.folders = folders;
    libraryCache.lastModified = new Date().toISOString();
    scheduleLibraryWrite();
  }
};

/**
 * 添加文件夹
 */
export const addFolder = async (folder: Omit<Folder, 'id'>): Promise<Folder> => {
  const newFolder: Folder = {
    ...folder,
    id: generateId(),
  };
  const folders = getFolders();
  folders.push(newFolder);
  saveFolders(folders);

  // Create physical folder in Eagle-style structure
  if (isElectronEnvironment) {
    await folderDirService.createFolderPhysical(folders, newFolder.id);
  }

  return newFolder;
};

/**
 * 更新文件夹
 */
export const updateFolder = (id: string, updates: Partial<Folder>): Folder | null => {
  const folders = getFolders();
  const index = folders.findIndex(folder => folder.id === id);
  if (index === -1) return null;

  folders[index] = { ...folders[index], ...updates };
  saveFolders(folders);
  return folders[index];
};

/**
 * 删除文件夹
 */
export const deleteFolder = async (id: string): Promise<boolean> => {
  const folders = getFolders();
  const index = folders.findIndex(folder => folder.id === id);
  if (index === -1) return false;

  // 同时删除子文件夹
  const idsToDelete = [id, ...getDescendantFolderIds(id, folders)];
  const filteredFolders = folders.filter(folder => !idsToDelete.includes(folder.id));
  saveFolders(filteredFolders);

  // 删除物理文件夹
  if (isElectronEnvironment) {
    for (const folderId of idsToDelete) {
      await folderDirService.deleteFolderPhysical(folderId);
    }
  }

  // 将被删除文件夹中的资源项目设为未分类
  const items = getItems();
  const updatedItems = items.map(item => ({
    ...item,
    folderId: idsToDelete.includes(item.folderId || '') ? undefined : item.folderId,
  }));
  saveItems(updatedItems);

  return true;
};

/**
 * 获取文件夹的所有子孙文件夹 ID
 */
const getDescendantFolderIds = (parentId: string, folders: Folder[]): string[] => {
  const children = folders.filter(f => f.parentId === parentId);
  let ids = children.map(c => c.id);
  children.forEach(c => {
    ids = [...ids, ...getDescendantFolderIds(c.id, folders)];
  });
  return ids;
};

// ==================== 设置操作 ====================

/**
 * 获取设置
 */
export const getSettings = (): SettingsData => {
  return settingsCache || getDefaultSettings();
};

/**
 * 更新设置
 */
export const updateSettings = (updates: Partial<SettingsData>): void => {
  if (settingsCache) {
    Object.assign(settingsCache, updates);
    scheduleSettingsWrite();
  }
};

/**
 * 获取颜色模式
 */
export const getColorMode = (): string => {
  return settingsCache?.colorMode || 'dark';
};

/**
 * 设置颜色模式
 */
export const setColorMode = (mode: string): void => {
  if (settingsCache) {
    settingsCache.colorMode = mode;
    scheduleSettingsWrite();
  }
};

/**
 * 获取主题 ID
 */
export const getThemeId = (): string => {
  return settingsCache?.themeId || 'blue';
};

/**
 * 设置主题 ID
 */
export const setThemeId = (themeId: string): void => {
  if (settingsCache) {
    settingsCache.themeId = themeId;
    scheduleSettingsWrite();
  }
};

/**
 * 获取自定义存储路径
 */
export const getCustomStoragePath = (): string | null => {
  return settingsCache?.customStoragePath || null;
};

/**
 * 设置自定义存储路径
 */
export const setCustomStoragePath = (path: string | null): void => {
  if (settingsCache) {
    settingsCache.customStoragePath = path;
    scheduleSettingsWrite();
  }
};

/**
 * 获取最近文件列表
 */
export const getRecentFiles = (): any[] => {
  return settingsCache?.recentFiles || [];
};

/**
 * 设置最近文件列表
 */
export const setRecentFiles = (files: any[]): void => {
  if (settingsCache) {
    settingsCache.recentFiles = files;
    scheduleSettingsWrite();
  }
};

/**
 * 获取收藏文件夹列表
 */
export const getFavoriteFolders = (): string[] => {
  return settingsCache?.favoriteFolders || [];
};

/**
 * 设置收藏文件夹列表
 */
export const setFavoriteFolders = (folders: string[]): void => {
  if (settingsCache) {
    settingsCache.favoriteFolders = folders;
    scheduleSettingsWrite();
  }
};

// ==================== 工具函数 ====================

/**
 * 生成唯一 ID
 */
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * 检查是否已初始化
 */
export const isStorageInitialized = (): boolean => {
  return isInitialized;
};

/**
 * 检查是否为 Electron 环境
 */
export const isElectron = (): boolean => {
  return isElectronEnvironment;
};

/**
 * 清除所有本地数据
 */
export const clearAllData = (): void => {
  if (libraryCache) {
    libraryCache.items = [];
    libraryCache.tags = MOCK_TAGS;
    libraryCache.folders = MOCK_FOLDERS;
    scheduleLibraryWrite();
  }

  // 同时清理 localStorage
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
};

/**
 * 导出所有数据为 JSON
 */
export const exportData = (): string => {
  return JSON.stringify({
    items: getItems(),
    tags: getTags(),
    folders: getFolders(),
    exportedAt: new Date().toISOString(),
  }, null, 2);
};

/**
 * 从 JSON 导入数据
 */
export const importData = (jsonData: string): boolean => {
  try {
    const data = JSON.parse(jsonData);
    if (data.items) saveItems(data.items);
    if (data.tags) saveTags(data.tags);
    if (data.folders) saveFolders(data.folders);
    return true;
  } catch (e) {
    console.error('Failed to import data:', e);
    return false;
  }
};

/**
 * 从浏览器扩展导入数据（去重合并）
 */
export const importFromBrowserExtension = (jsonData: string): number => {
  try {
    const data = JSON.parse(jsonData);
    const existingItems = getItems();
    const existingIds = new Set(existingItems.map(i => i.id));

    // 合并标签
    if (data.tags && Array.isArray(data.tags)) {
      const existingTags = getTags();
      const existingTagIds = new Set(existingTags.map(t => t.id));
      const newTags = data.tags.filter((tag: Tag) => !existingTagIds.has(tag.id));
      saveTags([...newTags, ...existingTags]);
    }

    // 合并文件夹
    if (data.folders && Array.isArray(data.folders)) {
      const existingFolders = getFolders();
      const existingFolderIds = new Set(existingFolders.map(f => f.id));
      const newFolders = data.folders.filter((folder: Folder) => !existingFolderIds.has(folder.id));
      saveFolders([...newFolders, ...existingFolders]);
    }

    // 合并项目（去重）
    if (data.items && Array.isArray(data.items)) {
      const newItems = data.items.filter((item: ResourceItem) => !existingIds.has(item.id));
      const markedItems = newItems.map((item: ResourceItem) => ({
        ...item,
        source: 'browser-extension' as const,
        updatedAt: new Date().toISOString(),
      }));
      const allItems = [...markedItems, ...existingItems];
      saveItems(allItems);
      return newItems.length;
    }

    return 0;
  } catch (e) {
    console.error('Failed to import from browser extension:', e);
    return 0;
  }
};

/**
 * 获取导入统计信息
 */
export const getImportStats = (jsonData: string): { items: number; tags: number; folders: number } | null => {
  try {
    const data = JSON.parse(jsonData);
    return {
      items: data.items?.length || 0,
      tags: data.tags?.length || 0,
      folders: data.folders?.length || 0,
    };
  } catch {
    return null;
  }
};

// ============================================
// Eagle 风格 MTime 追踪集成
// ============================================

/**
 * 更新项目的 mtime（Eagle 风格）
 * 当项目被添加或修改时调用
 */
export const updateItemMTime = async (itemId: string): Promise<void> => {
  if (!isElectronEnvironment) return;
  try {
    await mtimeService.updateMTime(itemId);
  } catch (e) {
    console.error('[Storage] Failed to update mtime:', e);
  }
};

/**
 * 批量更新多个项目的 mtime
 */
export const batchUpdateItemMTime = async (itemIds: string[]): Promise<void> => {
  if (!isElectronEnvironment) return;
  try {
    await mtimeService.batchUpdateMTime(itemIds);
  } catch (e) {
    console.error('[Storage] Failed to batch update mtime:', e);
  }
};

/**
 * 删除项目的 mtime 记录
 */
export const removeItemMTime = async (itemId: string): Promise<void> => {
  if (!isElectronEnvironment) return;
  try {
    await mtimeService.removeMTime(itemId);
  } catch (e) {
    console.error('[Storage] Failed to remove mtime:', e);
  }
};

/**
 * 获取所有项目的 mtime
 */
export const getAllMTime = async (): Promise<Record<string, number>> => {
  if (!isElectronEnvironment) return {};
  try {
    return await mtimeService.getAllMTime();
  } catch {
    return {};
  }
};

// ============================================
// Eagle 风格自动备份集成
// ============================================

/**
 * 创建当前数据的备份（Eagle 风格）
 * 在执行可能影响数据的操作前调用
 */
export const createBackup = async (): Promise<{ success: boolean; path?: string }> => {
  if (!isElectronEnvironment) {
    return { success: false };
  }

  const backupData = {
    items: getItems(),
    tags: getTags(),
    folders: getFolders(),
    _backupInfo: {
      timestamp: new Date().toISOString(),
      version: 1,
      itemCount: getItems().length,
    },
  };

  try {
    const result = await backupService.createBackup(backupData);
    if (result.success) {
      console.log('[Storage] Backup created:', result.path);
    }
    return result;
  } catch (e) {
    console.error('[Storage] Failed to create backup:', e);
    return { success: false };
  }
};

/**
 * 列出所有备份
 */
export const listBackups = async (): Promise<BackupInfo[]> => {
  if (!isElectronEnvironment) return [];
  try {
    return await backupService.listBackups();
  } catch {
    return [];
  }
};

/**
 * 从备份恢复数据
 */
export const restoreFromBackup = async (backupPath: string): Promise<boolean> => {
  if (!isElectronEnvironment) return false;

  try {
    const result = await backupService.restoreBackup(backupPath);
    if (result.success && result.data) {
      // 恢复数据
      if (result.data.items) saveItems(result.data.items);
      if (result.data.tags) saveTags(result.data.tags);
      if (result.data.folders) saveFolders(result.data.folders);
      console.log('[Storage] Restored from backup:', backupPath);
      return true;
    }
    return false;
  } catch (e) {
    console.error('[Storage] Failed to restore backup:', e);
    return false;
  }
};

/**
 * 清理旧备份（保留最近的 N 个）
 */
export const cleanupOldBackups = async (keepCount?: number): Promise<number> => {
  if (!isElectronEnvironment) return 0;
  try {
    const result = await backupService.cleanupOldBackups(keepCount);
    if (result.deleted > 0) {
      console.log('[Storage] Cleaned up', result.deleted, 'old backups');
    }
    return result.deleted;
  } catch {
    return 0;
  }
};

/**
 * 获取备份目录路径
 */
export const getBackupPath = async (): Promise<string> => {
  if (!isElectronEnvironment) return '';
  try {
    return await backupService.getBackupPath();
  } catch {
    return '';
  }
};

// ============================================
// 向量索引集成 (Semantic Search) + BM25 全文索引
// ============================================

/**
 * 为单个项目创建语义搜索索引和 BM25 全文索引
 * 异步执行，不阻塞主流程
 */
const indexItemForSemanticSearch = async (item: ResourceItem): Promise<void> => {
  if (!isElectronEnvironment) return;

  // 构建索引文本：标题 + 内容片段 + 标签
  const text = [
    item.title,
    item.contentSnippet || '',
    item.description || '',
    item.tags.join(' '),
  ].filter(Boolean).join(' ');

  if (!text.trim()) return;

  const metadata = {
    title: item.title,
    type: item.type,
    tags: item.tags,
    createdAt: item.createdAt,
  };

  // 并行索引：向量搜索 + BM25 全文搜索
  await Promise.all([
    // 向量索引（语义搜索）
    vectorStoreService.indexDocument({
      id: item.id,
      text,
      metadata,
    }).catch(err => console.error('[Storage] Vector indexing failed:', err)),

    // BM25 全文索引
    (async () => {
      if (window.electronAPI?.searchAPI?.index) {
        try {
          await window.electronAPI.searchAPI.index(item.id, text, metadata);
        } catch (err) {
          console.error('[Storage] BM25 indexing failed:', err);
        }
      }
    })(),
  ]);
};

/**
 * 从语义搜索索引和 BM25 索引中删除项目
 */
const removeItemFromSemanticSearch = async (itemId: string): Promise<void> => {
  if (!isElectronEnvironment) return;

  await Promise.all([
    // 删除向量索引
    vectorStoreService.deleteDocument(itemId).catch(err =>
      console.error('[Storage] Vector delete failed:', err)
    ),
    // 删除 BM25 索引
    (async () => {
      if (window.electronAPI?.searchAPI?.delete) {
        try {
          await window.electronAPI.searchAPI.delete(itemId);
        } catch (err) {
          console.error('[Storage] BM25 delete failed:', err);
        }
      }
    })(),
  ]);
};

/**
 * 批量索引所有现有项目（用于迁移）
 */
export const indexAllItemsForSemanticSearch = async (
  onProgress?: (indexed: number, total: number) => void
): Promise<{ indexed: number; errors: number }> => {
  if (!isElectronEnvironment) {
    return { indexed: 0, errors: 0 };
  }

  const items = getItems();
  let indexed = 0;
  let errors = 0;

  for (let i = 0; i < items.length; i++) {
    try {
      await indexItemForSemanticSearch(items[i]);
      indexed++;
    } catch (e) {
      console.error('[Storage] Failed to index item:', items[i].id, e);
      errors++;
    }

    if (onProgress) {
      onProgress(i + 1, items.length);
    }
  }

  console.log(`[Storage] Semantic indexing complete: ${indexed} indexed, ${errors} errors`);
  return { indexed, errors };
};

/**
 * 初始化向量存储服务
 * 应在应用启动时调用
 */
export const initVectorStore = async (): Promise<boolean> => {
  if (!isElectronEnvironment) return false;

  const result = await vectorStoreService.initialize();
  if (result.success) {
    console.log('[Storage] Vector store initialized');
  } else {
    console.error('[Storage] Vector store initialization failed:', result.error);
  }
  return result.success;
};
