import { Folder, ColorMode } from '@/types';

export interface FolderContextMenuProps {
  folder: Folder;
  position: { x: number; y: number };
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  expandedIds: Set<string>;
  isSystemFolder: boolean;
  // Callbacks
  onCreateFolder: (currentFolderId: string) => void; // Creates sibling folder
  onCreateSubfolder: (parentId: string) => void;      // Creates child folder
  onRename: (folder: Folder) => void;
  onDelete: (folderId: string) => void;
  onClone: (folderId: string) => void;
  onMove: (folder: Folder) => void;
  onToggleExpand: (folderId: string) => void;
  onExpandSiblings: (folderId: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onChangeIcon: (folderId: string, icon: string, color?: string) => void;
  colorMode?: ColorMode;
}

export interface MenuItemProps {
  icon: string;
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  hasSubmenu?: boolean;
  children?: React.ReactNode;
  colorMode?: ColorMode;
}

export interface MenuDividerProps {
  colorMode?: ColorMode;
}

export interface IconColorPickerProps {
  currentIcon?: string;
  currentColor?: string;
  onSelect: (icon: string, color?: string) => void;
  colorMode?: ColorMode;
}

// Preset folder colors
export const FOLDER_COLORS = [
  { name: 'gray', hex: '#6b7280', label: '灰色' },
  { name: 'red', hex: '#ef4444', label: '红色' },
  { name: 'orange', hex: '#f97316', label: '橙色' },
  { name: 'yellow', hex: '#eab308', label: '黄色' },
  { name: 'green', hex: '#22c55e', label: '绿色' },
  { name: 'cyan', hex: '#06b6d4', label: '青色' },
  { name: 'blue', hex: '#3b82f6', label: '蓝色' },
  { name: 'purple', hex: '#a855f7', label: '紫色' },
  { name: 'pink', hex: '#ec4899', label: '粉色' },
] as const;

// Preset folder icons
export const FOLDER_ICONS = [
  { icon: 'folder', label: '文件夹' },
  { icon: 'folder_open', label: '打开文件夹' },
  { icon: 'work', label: '工作' },
  { icon: 'lightbulb', label: '想法' },
  { icon: 'palette', label: '设计' },
  { icon: 'code', label: '代码' },
  { icon: 'science', label: '研究' },
  { icon: 'bookmark', label: '书签' },
  { icon: 'star', label: '收藏' },
  { icon: 'favorite', label: '喜欢' },
  { icon: 'archive', label: '归档' },
  { icon: 'inventory_2', label: '存储' },
] as const;
