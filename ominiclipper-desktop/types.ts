export enum ResourceType {
  WORD = 'WORD',
  PDF = 'PDF',
  EPUB = 'EPUB',
  WEB = 'WEB',
  IMAGE = 'IMAGE',
  UNKNOWN = 'UNKNOWN'
}

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
  isCloud: boolean; // Synced to cloud (Pro feature)
  contentSnippet?: string; // Brief description or content
}

export interface FilterState {
  search: string;
  tagId: string | null;
  color: string | null;
  folderId: string; // 'all', 'trash', 'recent', 'uncategorized', etc. or UUID
}