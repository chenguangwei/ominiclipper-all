/**
 * 本地存储服务
 * 提供资源、文件夹、标签的本地持久化存储
 */
import { ResourceItem, Tag, Folder, ResourceType } from '../types';
import { MOCK_ITEMS, MOCK_TAGS, MOCK_FOLDERS } from '../constants';

const STORAGE_KEYS = {
  ITEMS: 'omniclipper_items',
  TAGS: 'omniclipper_tags',
  FOLDERS: 'omniclipper_folders',
  FILTER_STATE: 'omniclipper_filter_state',
  VIEW_MODE: 'omniclipper_view_mode',
};

// ==================== 资源项目操作 ====================

/**
 * 获取所有资源项目
 */
export const getItems = (): ResourceItem[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ITEMS);
    if (stored) {
      return JSON.parse(stored);
    }
    // 首次加载返回空数组，不自动保存 MOCK 数据
    return [];
  } catch (e) {
    console.error('Failed to load items:', e);
    return [];
  }
};

/**
 * 保存所有资源项目
 */
export const saveItems = (items: ResourceItem[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save items:', e);
  }
};

/**
 * 添加资源项目
 */
export const addItem = (item: Omit<ResourceItem, 'id' | 'createdAt' | 'updatedAt'>): ResourceItem => {
  const newItem: ResourceItem = {
    ...item,
    id: generateId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const items = getItems();
  items.unshift(newItem); // 添加到开头
  saveItems(items);
  return newItem;
};

/**
 * 更新资源项目
 */
export const updateItem = (id: string, updates: Partial<ResourceItem>): ResourceItem | null => {
  const items = getItems();
  const index = items.findIndex(item => item.id === id);
  if (index === -1) return null;

  items[index] = {
    ...items[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveItems(items);
  return items[index];
};

/**
 * 删除资源项目
 */
export const deleteItem = (id: string): boolean => {
  const items = getItems();
  const index = items.findIndex(item => item.id === id);
  if (index === -1) return false;

  items.splice(index, 1);
  saveItems(items);
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
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TAGS);
    if (stored) {
      return JSON.parse(stored);
    }
    saveTags(MOCK_TAGS);
    return MOCK_TAGS;
  } catch (e) {
    console.error('Failed to load tags:', e);
    return MOCK_TAGS;
  }
};

/**
 * 保存所有标签
 */
export const saveTags = (tags: Tag[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(tags));
  } catch (e) {
    console.error('Failed to save tags:', e);
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
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.FOLDERS);
    if (stored) {
      return JSON.parse(stored);
    }
    saveFolders(MOCK_FOLDERS);
    return MOCK_FOLDERS;
  } catch (e) {
    console.error('Failed to load folders:', e);
    return MOCK_FOLDERS;
  }
};

/**
 * 保存所有文件夹
 */
export const saveFolders = (folders: Folder[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders));
  } catch (e) {
    console.error('Failed to save folders:', e);
  }
};

/**
 * 添加文件夹
 */
export const addFolder = (folder: Omit<Folder, 'id'>): Folder => {
  const newFolder: Folder = {
    ...folder,
    id: generateId(),
  };
  const folders = getFolders();
  folders.push(newFolder);
  saveFolders(folders);
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
export const deleteFolder = (id: string): boolean => {
  const folders = getFolders();
  const index = folders.findIndex(folder => folder.id === id);
  if (index === -1) return false;

  // 同时删除子文件夹
  const idsToDelete = [id, ...getDescendantFolderIds(id, folders)];
  const filteredFolders = folders.filter(folder => !idsToDelete.includes(folder.id));
  saveFolders(filteredFolders);

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

// ==================== 工具函数 ====================

/**
 * 生成唯一 ID
 */
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * 清除所有本地数据
 */
export const clearAllData = (): void => {
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
 * @param jsonData 浏览器扩展导出的 JSON 数据
 * @returns 导入的新项目数量
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
      // 标记从浏览器扩展导入的项目
      const markedItems = newItems.map(item => ({
        ...item,
        source: 'browser-extension',
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
