export enum ResourceType {
  WORD = 'WORD',
  PDF = 'PDF',
  EPUB = 'EPUB',
  WEB = 'WEB',
  IMAGE = 'IMAGE',
  MARKDOWN = 'MARKDOWN',
  PPT = 'PPT',
  EXCEL = 'EXCEL',
  UNKNOWN = 'UNKNOWN'
}

export type FileStorageMode = 'embed' | 'reference';

export type ColorMode = 'dark' | 'light' | 'system';

export enum ViewMode {
  LIST_DETAIL = 'LIST_DETAIL', // Sidebar -> List -> Detail
  TABLE = 'TABLE',             // Sidebar -> Full Table
  GRID = 'GRID'                // Sidebar -> Grid
}

export interface Tag {
  id: string;
  name: string;
  color?: string; // Hex code or tailwind class reference
  count?: number;
  parentId?: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
  icon?: string;
  count?: number; // Calculated dynamically
}

export interface ResourceItem {
  id: string;
  title: string;
  type: ResourceType;
  tags: string[]; // Tag IDs
  folderId?: string; // Folder ID this item belongs to
  color: string; // Color category (e.g., 'tag-blue')
  createdAt: string;
  updatedAt: string;
  path?: string; // File path or URL
  localPath?: string; // Local file path for Electron
  fileSize?: number; // File size in bytes
  mimeType?: string; // MIME type
  isCloud: boolean; // Synced to cloud (Pro feature)
  isStarred: boolean; // Starred/Favorite
  contentSnippet?: string; // Brief description or content
  aiSummary?: string; // AI-generated summary
  storageMode?: FileStorageMode; // 'embed' = Base64 embedded, 'reference' = path only
  embeddedData?: string; // Base64 encoded file content (for embed mode)
  originalPath?: string; // Original file path/name for reference
  thumbnailUrl?: string; // Cached thumbnail data URL for grid view
  description?: string; // Auto-generated or manual description from content
  fileHash?: string; // SHA-256 hash for deduplication
  deletedAt?: string; // ISO date string if in trash
}

// File system entry for file browser
export interface FileSystemEntry {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedAt?: string;
  children?: FileSystemEntry[];
}

// Recently used file
export interface RecentFile {
  id: string;
  path: string;
  title: string;
  type: ResourceType;
  lastOpened: number;
  count: number;
}

// File statistics
export interface FileStats {
  totalSize: number;
  totalCount: number;
  byType: Record<ResourceType, number>;
  oldestFile?: string;
  newestFile?: string;
}

export interface FilterState {
  search: string;
  tagId: string | null;
  color: string | null;
  folderId: string; // 'all', 'trash', 'recent', 'uncategorized', 'starred', etc. or UUID
  isStarred?: boolean; // Filter for starred items
  typeFilter?: ResourceType | null; // Filter by resource type
}