import { ResourceItem, ResourceType, Tag, Folder } from '@/types';

export const COLORS = {
  primary: "#2b8cee",
  wordBlue: "#2b579a",
  pdfRed: "#f40f02",
  epubPurple: "#9c27b0",
  tagBlue: "#007aff",
  tagGreen: "#34c759",
  tagOrange: "#ff9500",
  tagRed: "#ff3b30",
  tagYellow: "#ffcc00",
};

export const APP_THEMES = [
  { id: 'blue', name: 'Default Blue', rgb: '43 140 238', hex: '#2b8cee' },
  { id: 'emerald', name: 'Emerald', rgb: '16 185 129', hex: '#10b981' },
  { id: 'violet', name: 'Violet', rgb: '139 92 246', hex: '#8b5cf6' },
  { id: 'amber', name: 'Amber', rgb: '245 158 11', hex: '#f59e0b' },
  { id: 'rose', name: 'Rose', rgb: '244 63 94', hex: '#f43f5e' },
  { id: 'cyan', name: 'Cyan', rgb: '6 182 212', hex: '#06b6d4' },
];

export const INITIAL_FOLDERS: Folder[] = [
  { id: 'f1', name: 'Work', icon: 'work' },
  { id: 'f2', name: 'Study', icon: 'school' },
  { id: 'f3', name: 'Life', icon: 'coffee' },
  { id: 'f4', name: 'Creation', icon: 'brush' },
  { id: 'f5', name: 'Tech', icon: 'code' },
  { id: 'f6', name: 'Personal', icon: 'favorite' },
];

export const INITIAL_TAGS: Tag[] = [
  { id: 't1', name: 'Important', color: 'tag-red', count: 0 },
  { id: 't2', name: 'To Do', color: 'tag-orange', count: 0 },
  { id: 't3', name: 'Done', color: 'tag-green', count: 0 },
  { id: 't4', name: 'Reading', color: 'tag-blue', count: 0 },
  { id: 't5', name: 'Idea', color: 'tag-yellow', count: 0 },
];

export const INITIAL_ITEMS: ResourceItem[] = [
  {
    id: 'welcome-1',
    title: 'Welcome to OmniClipper',
    type: ResourceType.MARKDOWN,
    tags: ['t1'],
    folderId: 'f1',
    color: 'tag-blue',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCloud: false,
    contentSnippet: 'Welcome to OmniClipper! Drag and drop files here to get started.'
  }
];