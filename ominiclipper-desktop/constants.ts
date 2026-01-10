import { ResourceItem, ResourceType, Tag, Folder } from './types';

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

export const MOCK_FOLDERS: Folder[] = [
    { id: 'f1', name: 'Architecture Diagrams', icon: 'folder' },
    { id: 'f2', name: 'Website Collection', icon: 'folder' },
    { id: 'f3', name: 'Tech Websites', parentId: 'f2', icon: 'folder_open' },
    { id: 'f4', name: 'Inspiration', icon: 'lightbulb' },
    { id: 'f5', name: 'AI Art', icon: 'palette' },
];

export const MOCK_TAGS: Tag[] = [
  { id: 't1', name: 'Project Alpha', color: 'primary', count: 12 },
  { id: 't2', name: 'Drafts', parentId: 't1', count: 4 },
  { id: 't3', name: 'Final', parentId: 't1', count: 8 },
  { id: 't4', name: 'Personal', color: 'tag-green', count: 24 },
  { id: 't5', name: 'Work', color: 'tag-orange', count: 18 },
  { id: 't6', name: 'Research', color: 'tag-blue', count: 5 },
  { id: 't7', name: 'Reading', color: 'tag-yellow', count: 2 },
];

export const MOCK_ITEMS: ResourceItem[] = [
  {
    id: '1',
    title: 'Product Specification v2.docx',
    type: ResourceType.WORD,
    tags: ['t5', 't2'],
    folderId: 'f1',
    color: 'tag-blue',
    createdAt: '2023-10-25T10:00:00Z',
    updatedAt: '2023-10-25T14:30:00Z',
    isCloud: true,
    contentSnippet: 'Technical documentation for the upcoming interface overhaul. This draft focuses on the transition from folders to a tag-centric architecture.',
  },
  {
    id: '2',
    title: 'Sustainable Architecture Research.pdf',
    type: ResourceType.PDF,
    tags: ['t6'],
    folderId: 'f1',
    color: 'tag-red',
    createdAt: '2023-10-24T14:20:00Z',
    updatedAt: '2023-10-24T14:20:00Z',
    isCloud: false,
    contentSnippet: 'A comprehensive study on modern sustainable building materials and energy-efficient design patterns.',
  },
  {
    id: '3',
    title: 'Design Ecosystems.epub',
    type: ResourceType.EPUB,
    tags: ['t7'],
    folderId: 'f4',
    color: 'tag-blue',
    createdAt: '2023-10-12T09:00:00Z',
    updatedAt: '2023-10-12T09:00:00Z',
    isCloud: true,
    contentSnippet: 'Understanding the interconnectivity of design systems in large-scale organizations.',
  },
  {
    id: '4',
    title: 'React 18 New Features - Blog Post',
    type: ResourceType.WEB,
    tags: ['t6'],
    folderId: 'f3',
    color: 'tag-green',
    createdAt: '2023-09-28T11:00:00Z',
    updatedAt: '2023-09-28T11:00:00Z',
    path: 'https://react.dev/blog',
    isCloud: true,
    contentSnippet: 'Concurrent rendering and automatic batching are the highlights of this release...',
  },
  {
    id: '5',
    title: 'Q4 Financial Projections.xlsx',
    type: ResourceType.UNKNOWN,
    tags: ['t5', 't3'],
    folderId: 'f1',
    color: 'tag-orange',
    createdAt: '2023-10-26T08:15:00Z',
    updatedAt: '2023-10-26T09:45:00Z',
    isCloud: false,
    contentSnippet: 'Spreadsheet containing the anticipated revenue streams for the upcoming quarter.',
  },
  {
      id: '6',
      title: 'Midjourney Prompt Guide',
      type: ResourceType.WEB,
      tags: ['t6'],
      folderId: 'f5',
      color: 'tag-purple',
      createdAt: '2023-10-27T10:00:00Z',
      updatedAt: '2023-10-27T10:00:00Z',
      isCloud: true,
      contentSnippet: 'A guide to getting the best results from AI image generation tools.'
  }
];