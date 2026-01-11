// 与桌面端统一的资源类型
export enum ResourceType {
  WEB = 'WEB',
  ARTICLE = 'ARTICLE',
  IMAGE = 'IMAGE',
  NOTE = 'NOTE'
}

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

export type FileStorageMode = 'embed' | 'reference';

// 与桌面端统一的资源项接口
export interface ResourceItem {
  id: string;
  title: string;
  type: ResourceType;
  tags: string[];
  folderId?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;

  // 通用字段
  url?: string;
  content?: string;
  isCloud: boolean;
  isStarred: boolean;

  // 网站特有
  favicon?: string;
  siteName?: string;
  description?: string;

  // 文章特有
  markdown?: string;
  author?: string;
  readingTime?: number;

  // 图片特有
  imageData?: string;
  imageMimeType?: string;
  imageSize?: { width: number; height: number };
  sourceUrl?: string;

  // 同步状态 (浏览器插件特有)
  syncStatus?: SyncStatus;

  // 桌面端兼容字段
  path?: string;
  localPath?: string;
  fileSize?: number;
  mimeType?: string;
  contentSnippet?: string;
  aiSummary?: string;
  storageMode?: FileStorageMode;
  embeddedData?: string;
  originalPath?: string;
}

// 标签
export interface Tag {
  id: string;
  name: string;
  color?: string;
  count?: number;
  parentId?: string;
}

// 文件夹
export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  icon?: string;
}

// 飞书配置
export interface FeishuConfig {
  appId: string;
  appSecret: string;
  appToken: string;
  tableId: string;
}

// Supabase配置
export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName: string;
}

// 用户会话
export interface UserSession {
  user: {
    id: string;
    email: string;
  };
  accessToken: string;
  expiresAt: number;
}

// 订阅
export interface Subscription {
  plan: 'free' | 'monthly' | 'yearly';
  isActive: boolean;
  expiryDate?: number;
}

// 应用设置
export interface AppSettings {
  storageMode: 'local' | 'feishu' | 'supabase';
  feishuConfig: FeishuConfig;
  supabaseConfig: SupabaseConfig;
  userSession?: UserSession;
  subscription: Subscription;
}

// 视图状态
export enum ViewState {
  CAPTURE = 'CAPTURE',
  HISTORY = 'HISTORY',
  SETTINGS = 'SETTINGS'
}

// 捕获类型Tab (Note tab removed - redundant with Article)
export type CaptureTab = 'website' | 'article' | 'image';

// 预设标签
export const TAG_OPTIONS = [
  'Work', 'Inspiration', 'Dev', 'Design', 'Reading', 'Tool', 'Other'
];

// 存储键 - 与桌面端保持一致
export const STORAGE_KEYS = {
  ITEMS: 'OMNICLIPPER_ITEMS',
  TAGS: 'OMNICLIPPER_TAGS',
  FOLDERS: 'OMNICLIPPER_FOLDERS',
  SETTINGS: 'OMNICLIPPER_SETTINGS',
  FILTER_STATE: 'OMNICLIPPER_FILTER_STATE'
};
