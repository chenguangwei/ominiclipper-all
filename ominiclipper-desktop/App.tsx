import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import ListDetailView from './components/ListDetailView';
import PreviewPane from './components/PreviewPane';
import TableView from './components/TableView';
import GridView from './components/GridView';
import AuthDialog from './components/AuthDialog';
import CreateResourceDialog from './components/CreateResourceDialog';
import CreateFolderDialog from './components/CreateFolderDialog';
import CreateTagDialog from './components/CreateTagDialog';
import ConfirmDialog from './components/ConfirmDialog';
import ImportExportDialog from './components/ImportExportDialog';
import DocumentViewer from './components/DocumentViewer';
import FileDropDialog from './components/FileDropDialog';
import FolderDropDialog from './components/FolderDropDialog';
import SettingsDialog from './components/SettingsDialog';
import { APP_THEMES } from './constants';
import { ViewMode, FilterState, ResourceItem, Tag, Folder, ResourceType, FileStorageMode, ColorMode } from './types';
import Icon from './components/Icon';
import { getClient } from './supabaseClient';
import * as storageService from './services/storageService';
import * as fileManager from './services/fileManager';
import { t, getLocale, setLocale, getAvailableLocales } from './services/i18n';
import * as thumbnailService from './services/thumbnailService';
import * as contentExtractionService from './services/contentExtractionService';
import { vectorStoreService } from './services/vectorStoreService';

// Sorting types
type SortType = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';

const App: React.FC = () => {
  // Storage initialization state
  const [isStorageReady, setIsStorageReady] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.LIST_DETAIL);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [filterState, setFilterState] = useState<FilterState>({
    search: '',
    tagId: null,
    color: null,
    folderId: 'all'
  });
  const [sortType, setSortType] = useState<SortType>('date-desc');

  // Auth state
  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Theme state
  const [currentThemeId, setCurrentThemeId] = useState<string>('blue');

  // Dialog states
  const [isCreateResourceOpen, setIsCreateResourceOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [defaultParentFolderId, setDefaultParentFolderId] = useState<string | undefined>(undefined);
  const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ResourceItem | null>(null);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Document viewer state
  const [documentViewerItem, setDocumentViewerItem] = useState<ResourceItem | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [pendingDropFile, setPendingDropFile] = useState<File | null>(null);
  const [isFileDropDialogOpen, setIsFileDropDialogOpen] = useState(false);
  const [pendingDropFolder, setPendingDropFolder] = useState<string | null>(null);
  const [isFolderDropDialogOpen, setIsFolderDropDialogOpen] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null); // Track which folder is being dragged over

  // Color mode state
  const [colorMode, setColorModeState] = useState<ColorMode>('dark');

  // Settings dialog state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customStoragePath, setCustomStoragePath] = useState<string | null>(null);

  // Semantic search state
  const [isSemanticSearchEnabled, setIsSemanticSearchEnabled] = useState(true);
  const [semanticSearchResults, setSemanticSearchResults] = useState<string[]>([]);
  const [isSemanticSearching, setIsSemanticSearching] = useState(false);
  const semanticSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize storage service (async)
  useEffect(() => {
    const initApp = async () => {
      console.log('[App] Initializing storage...');
      await storageService.initStorage();

      // Load data from storage after initialization
      setItems(storageService.getItems());
      setTags(storageService.getTags());
      setFolders(storageService.getFolders());

      // Load settings
      const settings = storageService.getSettings();
      setColorModeState(settings.colorMode as ColorMode);
      setCurrentThemeId(settings.themeId);
      setCustomStoragePath(settings.customStoragePath);

      // Apply theme and color mode (internal versions, don't save back)
      applyThemeInternal(settings.themeId);
      applyColorModeInternal(settings.colorMode as ColorMode);

      setIsStorageReady(true);
      console.log('[App] Storage initialized successfully');

      // Initialize vector store for semantic search (async, non-blocking)
      storageService.initVectorStore().then(success => {
        if (success) {
          console.log('[App] Vector store ready for semantic search');
        }
      });
    };

    initApp();

    // Cleanup: flush pending writes on unmount
    return () => {
      storageService.flushPendingWrites();
    };
  }, []);

  // Listen for system preference changes (color mode)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (colorMode === 'system') {
        applyColorModeInternal('system');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [colorMode]);

  // Initialize i18n
  useEffect(() => {
    const locale = getLocale();
    console.log('Current locale:', locale);
  }, []);

  // Semantic search effect - triggered when search query changes
  useEffect(() => {
    // Clear previous timeout
    if (semanticSearchTimeoutRef.current) {
      clearTimeout(semanticSearchTimeoutRef.current);
    }

    // If search is empty or semantic search is disabled, clear results
    if (!filterState.search || !isSemanticSearchEnabled) {
      setSemanticSearchResults([]);
      setIsSemanticSearching(false);
      return;
    }

    // Debounce semantic search (300ms)
    setIsSemanticSearching(true);
    semanticSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await vectorStoreService.search(filterState.search, 20);
        setSemanticSearchResults(results.map(r => r.id));
      } catch (err) {
        console.error('[App] Semantic search error:', err);
        setSemanticSearchResults([]);
      } finally {
        setIsSemanticSearching(false);
      }
    }, 300);

    return () => {
      if (semanticSearchTimeoutRef.current) {
        clearTimeout(semanticSearchTimeoutRef.current);
      }
    };
  }, [filterState.search, isSemanticSearchEnabled]);

  // Handle browser extension sync
  useEffect(() => {
    // Expose sync handler to window for Electron IPC callbacks
    (window as any).handleBrowserExtensionSync = async (item: ResourceItem) => {
      console.log('[App] Received sync from browser extension:', item.title);

      // Check if item already exists
      const existingIds = new Set(items.map(i => i.id));
      if (existingIds.has(item.id)) {
        console.log('[App] Item already exists, skipping:', item.id);
        return;
      }

      // Add item to state and storage
      const newItems = [item, ...items];
      storageService.saveItems(newItems);
      await storageService.flushPendingWrites();
      setItems([...storageService.getItems()]);
      console.log('[App] Synced item from browser extension:', item.title);
    };

    return () => {
      delete (window as any).handleBrowserExtensionSync;
    };
  }, [items]);

  // Internal function to apply theme CSS without saving
  const applyThemeInternal = (themeId: string) => {
    const theme = APP_THEMES.find(t => t.id === themeId);
    if (theme) {
      document.documentElement.style.setProperty('--color-primary', theme.rgb);
    }
  };

  // Apply theme and save to storage
  const applyTheme = (themeId: string) => {
    applyThemeInternal(themeId);
    setCurrentThemeId(themeId);
    storageService.setThemeId(themeId);
  };

  // Internal function to apply color mode CSS without saving
  const applyColorModeInternal = (mode: ColorMode) => {
    const html = document.documentElement;
    let effectiveMode = mode;

    if (mode === 'system') {
      effectiveMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    if (effectiveMode === 'dark') {
      html.classList.add('dark');
      html.classList.remove('light');
    } else {
      html.classList.remove('dark');
      html.classList.add('light');
    }
  };

  // Apply color mode and save to storage
  const applyColorMode = (mode: ColorMode) => {
    applyColorModeInternal(mode);
    setColorModeState(mode);
    storageService.setColorMode(mode);
  };

  // Keyboard shortcuts (general)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Cmd/Ctrl + N: New resource
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setIsCreateResourceOpen(true);
      }

      // Cmd/Ctrl + F: Focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        searchInput?.focus();
      }

      // Cmd/Ctrl + E: Export
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        setIsImportExportOpen(true);
      }

      // Delete: Delete selected item
      if (e.key === 'Delete' && selectedItemId) {
        e.preventDefault();
        handleDeleteResource(selectedItemId);
      }

      // Escape: Close dialogs
      if (e.key === 'Escape') {
        setIsCreateResourceOpen(false);
        setIsCreateFolderOpen(false);
        setIsCreateTagOpen(false);
        setIsImportExportOpen(false);
        setIsAuthOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemId]);

  // Check existing session
  useEffect(() => {
    const client = getClient();
    if (client) {
      client.auth.getUser().then(({ data }) => {
        if (data.user) {
          setUser(data.user);
          syncItems();
        }
      });
    }
  }, []);

  // Sync items with Supabase
  const syncItems = async () => {
    const client = getClient();
    if (!client) return;

    setIsSyncing(true);
    try {
      const { data, error } = await client.from('resources').select('*');
      if (error) {
        console.error('Sync error:', error);
      } else if (data && data.length > 0) {
        const cloudItems: ResourceItem[] = data.map((item: any) => ({
          id: item.id,
          title: item.title,
          type: item.type as ResourceType,
          tags: item.tags || [],
          folderId: item.folder_id,
          color: item.color || 'tag-blue',
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          path: item.path,
          isCloud: true,
          contentSnippet: item.content_snippet,
        }));

        const localItems = storageService.getItems();
        const mergedItems = [...cloudItems];

        localItems.forEach(localItem => {
          if (!mergedItems.find(i => i.id === localItem.id)) {
            mergedItems.push(localItem);
          }
        });

        setItems(mergedItems);
        storageService.saveItems(mergedItems);
        console.log('Synced items:', cloudItems.length);
      }
    } catch (e) {
      console.error('Sync error:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Get tag name
  const getTagName = useCallback((id: string) => {
    return tags.find(t => t.id === id)?.name || id;
  }, [tags]);

  // Get descendant folder IDs
  const getDescendantFolderIds = useCallback((folderId: string): string[] => {
    const children = folders.filter(f => f.parentId === folderId);
    let ids = children.map(c => c.id);
    children.forEach(c => {
      ids = [...ids, ...getDescendantFolderIds(c.id)];
    });
    return ids;
  }, [folders]);

  // Filter logic with semantic search support
  const filteredItems = useMemo(() => {
    // Build semantic search set for fast lookup
    const semanticSet = new Set(semanticSearchResults);
    const hasSemanticResults = isSemanticSearchEnabled && semanticSearchResults.length > 0;

    let result = items.filter(item => {
      // Search filter - use hybrid approach (semantic + keyword)
      if (filterState.search) {
        const keywordMatch = item.title.toLowerCase().includes(filterState.search.toLowerCase()) ||
          item.tags.some(tagId => {
            const tag = tags.find(t => t.id === tagId);
            return tag?.name.toLowerCase().includes(filterState.search.toLowerCase());
          }) ||
          (item.contentSnippet?.toLowerCase().includes(filterState.search.toLowerCase()));

        const semanticMatch = hasSemanticResults && semanticSet.has(item.id);

        // Include if either keyword or semantic matches
        if (!keywordMatch && !semanticMatch) {
          return false;
        }
      }

      // Type filter
      if (filterState.typeFilter && item.type !== filterState.typeFilter) {
        return false;
      }

      // Tag filter
      if (filterState.tagId) {
        if (!item.tags.includes(filterState.tagId)) {
          const selectedTag = tags.find(t => t.id === filterState.tagId);
          const childrenTags = tags.filter(t => t.parentId === selectedTag?.id).map(t => t.id);
          const hasChildTag = item.tags.some(t => childrenTags.includes(t));
          if (!hasChildTag) return false;
        }
      }

      // Color filter
      if (filterState.color && item.color !== filterState.color) {
        return false;
      }

      // Folder logic
      if (filterState.folderId === 'all') {
        return true;
      } else if (filterState.folderId === 'trash') {
        return false;
      } else if (filterState.folderId === 'uncategorized') {
        return !item.folderId;
      } else if (filterState.folderId === 'untagged') {
        return item.tags.length === 0;
      } else if (filterState.folderId === 'recent') {
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return new Date(item.updatedAt).getTime() > oneWeekAgo;
      } else if (filterState.folderId === 'starred') {
        return item.isStarred;
      } else {
        const relevantFolderIds = [filterState.folderId, ...getDescendantFolderIds(filterState.folderId)];
        return item.folderId && relevantFolderIds.includes(item.folderId);
      }
    });

    // Sort - prioritize semantic matches when searching
    result = [...result].sort((a, b) => {
      // When searching with semantic results, prioritize semantic matches
      if (filterState.search && hasSemanticResults) {
        const aIsSemantic = semanticSet.has(a.id);
        const bIsSemantic = semanticSet.has(b.id);

        if (aIsSemantic && !bIsSemantic) return -1;
        if (!aIsSemantic && bIsSemantic) return 1;

        // If both are semantic matches, sort by their order in results (relevance)
        if (aIsSemantic && bIsSemantic) {
          const aIndex = semanticSearchResults.indexOf(a.id);
          const bIndex = semanticSearchResults.indexOf(b.id);
          return aIndex - bIndex;
        }
      }

      // Default sorting
      switch (sortType) {
        case 'date-desc':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'date-asc':
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case 'name-asc':
          return a.title.localeCompare(b.title);
        case 'name-desc':
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });

    return result;
  }, [filterState, items, tags, sortType, getDescendantFolderIds, semanticSearchResults, isSemanticSearchEnabled]);

  // Arrow keys: Navigate items (must be after filteredItems definition)
  useEffect(() => {
    const handleArrowKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && filteredItems.length > 0) {
        const currentIndex = filteredItems.findIndex(item => item.id === selectedItemId);
        let newIndex = currentIndex;

        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          newIndex = currentIndex < filteredItems.length - 1 ? currentIndex + 1 : 0;
        } else {
          newIndex = currentIndex > 0 ? currentIndex - 1 : filteredItems.length - 1;
        }

        setSelectedItemId(filteredItems[newIndex].id);
      }
    };

    window.addEventListener('keydown', handleArrowKey);
    return () => window.removeEventListener('keydown', handleArrowKey);
  }, [selectedItemId, filteredItems]);

  const selectedItem = useMemo(() =>
    items.find(i => i.id === selectedItemId) || null
  , [selectedItemId, items]);

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const files = e.dataTransfer.files;

    if (files.length > 0) {
      const file = files[0];
      const filePath = (file as any).path;

      // Check if it's a directory in Electron
      if (filePath && (window as any).electronAPI?.isDirectory) {
        try {
          const isDir = await (window as any).electronAPI.isDirectory(filePath);
          if (isDir) {
            // It's a directory
            setPendingDropFolder(filePath);
            setIsFolderDropDialogOpen(true);
            return;
          }
        } catch (err) {
          console.error('Failed to check if directory:', err);
        }
      }

      // It's a file
      setPendingDropFile(file);
      setIsFileDropDialogOpen(true);
    }
  };

  // Handle files dropped directly on a folder in the sidebar
  const handleDropOnFolder = async (folderId: string, files: FileList) => {
    const file = files[0];
    if (!file) return;

    const electronFilePath = (file as any).path;
    const type = getResourceTypeFromFile(file);

    let path: string;
    let localPath: string | undefined;
    const originalPath = electronFilePath || file.name;

    // Use embed mode by default for folder drops
    if (electronFilePath && (window as any).electronAPI?.copyFileToStorage) {
      try {
        const result = await (window as any).electronAPI.copyFileToStorage(electronFilePath, file.name, customStoragePath);
        if (result.success) {
          localPath = result.targetPath;
          path = result.targetPath;
        } else {
          throw new Error(result.error || 'Failed to copy file');
        }
      } catch (error) {
        console.error('[App] Failed to copy file to storage:', error);
        localPath = electronFilePath;
        path = electronFilePath;
      }
    } else {
      localPath = electronFilePath;
      path = electronFilePath || URL.createObjectURL(file);
    }

    // Add item directly to the target folder
    const newItem = await storageService.addItem({
      title: file.name.replace(/\.[^/.]+$/, ''),
      type,
      tags: [],
      folderId: folderId,
      color: 'tag-blue',
      path,
      localPath,
      embeddedData: undefined,
      originalPath,
      storageMode: 'embed' as FileStorageMode,
      fileSize: file.size,
      mimeType: file.type,
      isCloud: false,
      isStarred: false,
      contentSnippet: `Added to folder`,
    });

    await storageService.flushPendingWrites();
    setItems([...storageService.getItems()]);

    // Generate thumbnail and description in background
    if (newItem) {
      generateItemMetadata(newItem.id, type, localPath || path);
    }
  };

  const handleFileDropConfirm = async (mode: FileStorageMode) => {
    if (!pendingDropFile) return;

    const file = pendingDropFile;
    const type = getResourceTypeFromFile(file);

    let path: string;
    let localPath: string | undefined;
    // In Electron, file.path contains the actual file system path
    const electronFilePath = (file as any).path;
    // Always set originalPath to the file name for display
    const originalPath = electronFilePath || file.name;

    if (mode === 'embed') {
      // Copy file to app's storage directory (use custom path if set)
      if (electronFilePath && (window as any).electronAPI?.copyFileToStorage) {
        try {
          const result = await (window as any).electronAPI.copyFileToStorage(electronFilePath, file.name, customStoragePath);
          if (result.success) {
            localPath = result.targetPath;
            path = result.targetPath;
            console.log('[App] File copied to storage:', result.targetPath);
          } else {
            throw new Error(result.error || 'Failed to copy file');
          }
        } catch (error) {
          console.error('[App] Failed to copy file to storage, falling back to reference mode:', error);
          // Fall back to reference mode
          localPath = electronFilePath;
          path = electronFilePath;
        }
      } else {
        // No Electron API or no file path, use reference mode
        localPath = electronFilePath;
        path = electronFilePath || URL.createObjectURL(file);
      }
    } else {
      // Reference mode - store original path only
      if (electronFilePath) {
        localPath = electronFilePath;
        path = electronFilePath;
      } else {
        // Fallback for web environment - use blob URL (won't persist)
        path = URL.createObjectURL(file);
      }
    }

    // Create new resource from dropped file
    // Auto-assign to current folder if one is selected (and not a special folder)
    const specialFolders = ['all', 'recent', 'starred', 'uncategorized', 'untagged', 'trash'];
    const targetFolderId = (!specialFolders.includes(filterState.folderId) && filterState.folderId !== 'all')
      ? filterState.folderId
      : undefined;

    const newItem = await storageService.addItem({
      title: file.name.replace(/\.[^/.]+$/, ''),
      type,
      tags: [],
      folderId: targetFolderId,
      color: 'tag-blue',
      path,
      localPath,
      embeddedData: undefined, // No longer using Base64 for embed mode
      originalPath,
      storageMode: mode,
      fileSize: file.size,
      mimeType: file.type,
      isCloud: false,
      isStarred: false,
      contentSnippet: `Imported from ${file.name}`
    });

    // Force flush pending writes and refresh state immediately
    // Create a new array reference to ensure React detects the change
    await storageService.flushPendingWrites();
    setItems([...storageService.getItems()]);
    setPendingDropFile(null);
    setIsFileDropDialogOpen(false);

    // Generate thumbnail and description in background
    if (newItem) {
      generateItemMetadata(newItem.id, type, localPath || path);
    }
  };

  const handleFileDropClose = () => {
    setPendingDropFile(null);
    setIsFileDropDialogOpen(false);
  };

  // Handle folder drop confirmation
  interface ScannedFile {
    name: string;
    path: string;
    extension: string;
    size: number;
    mimeType: string;
    modifiedAt: string;
  }

  interface FileClassification {
    file: ScannedFile;
    category?: string;
    subfolder?: string;
    suggestedTags?: string[];
    confidence?: number;
    reasoning?: string;
    error?: string;
  }

  const handleFolderDropConfirm = async (files: ScannedFile[], mode: FileStorageMode, classifications?: FileClassification[]) => {
    // Create a map for quick classification lookup
    const classificationMap = new Map<string, FileClassification>();
    if (classifications) {
      classifications.forEach(c => classificationMap.set(c.file.path, c));
    }

    for (const file of files) {
      const type = getResourceTypeFromExtension(file.extension);
      const classification = classificationMap.get(file.path);

      let path: string;
      let localPath: string | undefined;

      if (mode === 'embed') {
        // Copy file to app storage (use custom path if set)
        try {
          if ((window as any).electronAPI?.copyFileToStorage) {
            const result = await (window as any).electronAPI.copyFileToStorage(file.path, file.name, customStoragePath);
            if (result.success) {
              localPath = result.targetPath;
              path = result.targetPath;
            } else {
              // Fallback to reference mode
              localPath = file.path;
              path = file.path;
            }
          } else {
            // No Electron API, use reference mode
            localPath = file.path;
            path = file.path;
          }
        } catch (error) {
          console.error('[App] Failed to copy file:', file.name, error);
          localPath = file.path;
          path = file.path;
        }
      } else {
        // Reference mode - just store the path
        localPath = file.path;
        path = file.path;
      }

      // Find or create folder based on classification
      // Auto-assign to current folder if one is selected (and not a special folder)
      const specialFolders = ['all', 'recent', 'starred', 'uncategorized', 'untagged', 'trash'];
      let folderId: string | undefined;

      // If a real folder is selected, use it (unless classification overrides)
      if (!specialFolders.includes(filterState.folderId) && filterState.folderId !== 'all') {
        folderId = filterState.folderId;
      }

      // Classification can override the auto-assigned folder
      if (classification?.subfolder) {
        // Check if folder exists, if not create it
        const existingFolder = folders.find(f => f.name === classification.subfolder || f.name === classification.category);
        if (existingFolder) {
          folderId = existingFolder.id;
        } else if (classification.category) {
          // Create new folder based on category
          const newFolder: Folder = {
            id: `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: classification.category,
            parentId: undefined
          };
          storageService.addFolder(newFolder);
          setFolders(storageService.getFolders());
          folderId = newFolder.id;
        }
      }

      // Find or create tags based on classification
      const itemTags: string[] = [];
      if (classification?.suggestedTags && classification.suggestedTags.length > 0) {
        for (const tagName of classification.suggestedTags) {
          let existingTag = tags.find(t => t.name === tagName);
          if (!existingTag) {
            // Create new tag
            existingTag = {
              id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: tagName,
              color: 'tag-purple'
            };
            storageService.addTag(existingTag);
            setTags(storageService.getTags());
          }
          itemTags.push(existingTag.id);
        }
      }

      // Create new resource with classification info
      storageService.addItem({
        title: file.name.replace(/\.[^/.]+$/, ''),
        type,
        tags: itemTags,
        folderId,
        color: 'tag-blue',
        path,
        localPath,
        embeddedData: undefined,
        originalPath: file.path,
        storageMode: mode,
        fileSize: file.size,
        mimeType: file.mimeType,
        isCloud: false,
        isStarred: false,
        contentSnippet: classification?.reasoning || `Imported from folder`
      });
    }

    // Force flush pending writes and refresh state immediately
    // Create a new array reference to ensure React detects the change
    await storageService.flushPendingWrites();
    setItems([...storageService.getItems()]);
    setPendingDropFolder(null);
    setIsFolderDropDialogOpen(false);
  };

  const handleFolderDropClose = () => {
    setPendingDropFolder(null);
    setIsFolderDropDialogOpen(false);
  };

  const getResourceTypeFromExtension = (ext: string): ResourceType => {
    switch (ext.toLowerCase()) {
      case '.pdf': return ResourceType.PDF;
      case '.doc': case '.docx': return ResourceType.WORD;
      case '.epub': return ResourceType.EPUB;
      case '.jpg': case '.jpeg': case '.png': case '.gif': case '.webp': return ResourceType.IMAGE;
      default: return ResourceType.UNKNOWN;
    }
  };

  const getResourceTypeFromFile = (file: File): ResourceType => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return ResourceType.PDF;
      case 'doc': case 'docx': return ResourceType.WORD;
      case 'epub': return ResourceType.EPUB;
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': case 'svg': case 'bmp': return ResourceType.IMAGE;
      case 'md': case 'markdown': return ResourceType.MARKDOWN;
      case 'ppt': case 'pptx': return ResourceType.PPT;
      case 'xls': case 'xlsx': case 'csv': return ResourceType.EXCEL;
      default: return ResourceType.UNKNOWN;
    }
  };

  // Generate thumbnail and description for a newly added item
  const generateItemMetadata = async (itemId: string, type: ResourceType, filePath: string | undefined) => {
    if (!filePath) return;

    try {
      // Generate thumbnail in background
      const thumbnailDataUrl = await thumbnailService.generateAndSaveThumbnail(itemId, type, filePath);

      // Generate description from content
      const description = await contentExtractionService.generateAutoDescription(type, filePath, '');

      // Update the item with generated metadata
      if (thumbnailDataUrl || description) {
        const updates: Partial<ResourceItem> = {};
        if (thumbnailDataUrl) updates.thumbnailUrl = thumbnailDataUrl;
        if (description) updates.description = description;

        await storageService.updateItem(itemId, updates);
        await storageService.flushPendingWrites();
        setItems([...storageService.getItems()]);
      }
    } catch (error) {
      console.error('[App] Failed to generate item metadata:', error);
    }
  };

  // Resource operations
  const handleAddResource = async (newItem: Omit<ResourceItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingItem) {
      const updated = await storageService.updateItem(editingItem.id, newItem);
      if (updated) {
        await storageService.flushPendingWrites();
        setItems([...storageService.getItems()]);
      }
      setEditingItem(null);
    } else {
      await storageService.addItem(newItem);
      await storageService.flushPendingWrites();
      setItems([...storageService.getItems()]);
    }
    storageService.updateTagCounts();
    setTags(storageService.getTags());
  };

  const handleDeleteResource = async (id: string) => {
    const item = items.find(i => i.id === id);
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Resource',
      message: `Are you sure you want to delete "${item?.title}"? This action cannot be undone.`,
      onConfirm: async () => {
        await storageService.deleteItem(id);
        await storageService.flushPendingWrites();
        setItems([...storageService.getItems()]);
        if (selectedItemId === id) {
          setSelectedItemId(null);
        }
        storageService.updateTagCounts();
        setTags(storageService.getTags());
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleEditResource = (item: ResourceItem) => {
    setEditingItem(item);
    setIsCreateResourceOpen(true);
  };

  // Toggle star status
  const handleToggleStar = async (id: string) => {
    const updatedItems = fileManager.toggleStar(items, id);
    storageService.saveItems(updatedItems);
    await storageService.flushPendingWrites();
    setItems([...storageService.getItems()]);
  };

  // Inline tag editing handlers
  const handleRemoveTag = async (itemId: string, tagId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const updatedItem = {
      ...item,
      tags: item.tags.filter(t => t !== tagId),
      updatedAt: new Date().toISOString()
    };
    storageService.updateItem(updatedItem);
    await storageService.flushPendingWrites();
    setItems([...storageService.getItems()]);
    storageService.updateTagCounts();
    setTags(storageService.getTags());
  };

  const handleAddTagToItem = async (itemId: string, tagId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item || item.tags.includes(tagId)) return;

    const updatedItem = {
      ...item,
      tags: [...item.tags, tagId],
      updatedAt: new Date().toISOString()
    };
    storageService.updateItem(updatedItem);
    await storageService.flushPendingWrites();
    setItems([...storageService.getItems()]);
    storageService.updateTagCounts();
    setTags(storageService.getTags());
  };

  const handleCreateTagInline = async (name: string): Promise<string | null> => {
    // Check if tag already exists
    const existing = tags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;

    // Create new tag
    const newTag: Tag = {
      id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      color: 'tag-purple'
    };
    storageService.addTag(newTag);
    setTags(storageService.getTags());
    return newTag.id;
  };

  // Inline type editing handler
  const handleChangeType = async (itemId: string, newType: ResourceType) => {
    const item = items.find(i => i.id === itemId);
    if (!item || item.type === newType) return;

    const updatedItem = {
      ...item,
      type: newType,
      updatedAt: new Date().toISOString()
    };
    storageService.updateItem(updatedItem);
    await storageService.flushPendingWrites();
    setItems([...storageService.getItems()]);
  };

  // Track recent file when item is selected
  useEffect(() => {
    if (selectedItem) {
      fileManager.addRecentFile(selectedItem);
      fileManager.incrementRecentFileCount(selectedItem.path || '');
    }
  }, [selectedItemId]);

  // AI Summary generation state
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Generate AI summary
  const handleGenerateSummary = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    setIsGeneratingSummary(true);
    try {
      // Simulate AI summary generation (replace with actual API call)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const summary = `[AI Generated Summary for "${item.title}"]

This document appears to be a ${item.type} file. Based on the content analysis:

• Key Topics: The document covers important concepts related to the subject matter.
• Main Points: Several key insights and findings are presented throughout the text.
• Structure: Well-organized with clear sections and logical flow.

The content includes substantial information that would be valuable for reference and further study.`;

      const updatedItems = items.map(i => {
        if (i.id === id) {
          return { ...i, aiSummary: summary };
        }
        return i;
      });

      storageService.saveItems(updatedItems);
      await storageService.flushPendingWrites();
      setItems([...storageService.getItems()]);
    } catch (error) {
      console.error('Failed to generate summary:', error);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Open document in viewer
  const handleOpenDocument = (item: ResourceItem) => {
    setDocumentViewerItem(item);
  };

  // Open item based on type (document viewer, image viewer, or web link)
  const handleOpenItem = async (item: ResourceItem) => {
    // For web pages, open URL in browser
    if (item.type === ResourceType.WEB && item.path) {
      if ((window as any).electronAPI?.openExternal) {
        (window as any).electronAPI.openExternal(item.path);
      } else {
        window.open(item.path, '_blank');
      }
      return;
    }

    // For images, try to open with system app first (same as View button)
    if (item.type === ResourceType.IMAGE) {
      const filePath = item.localPath || item.originalPath || item.path;
      if (filePath && (window as any).electronAPI?.openPath) {
        try {
          await (window as any).electronAPI.openPath(filePath);
          return; // Success, don't open viewer
        } catch (error) {
          console.error('Failed to open image with system app:', error);
        }
      }
      // Fallback to document viewer
      handleOpenDocument(item);
      return;
    }

    // For documents (PDF/EPUB/WORD), open in document viewer
    if (
      item.type === ResourceType.PDF ||
      item.type === ResourceType.EPUB ||
      item.type === ResourceType.WORD
    ) {
      handleOpenDocument(item);
      return;
    }

    // Fallback: try to open path directly
    if (item.path) {
      if ((window as any).electronAPI?.openExternal) {
        (window as any).electronAPI.openExternal(item.path);
      } else {
        window.open(item.path, '_blank');
      }
    }
  };

  // Close document viewer
  const handleCloseDocumentViewer = () => {
    setDocumentViewerItem(null);
  };

  // Folder operations
  const handleAddFolder = async (newFolder: Omit<Folder, 'id'>) => {
    if (editingFolder) {
      await storageService.updateFolder(editingFolder.id, newFolder);
      setEditingFolder(null);
    } else {
      await storageService.addFolder(newFolder);
    }
    await storageService.flushPendingWrites();
    setFolders(storageService.getFolders());
  };

  const handleDeleteFolder = async (id: string) => {
    const folder = folders.find(f => f.id === id);
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Folder',
      message: `Are you sure you want to delete "${folder?.name}"? All subfolders will also be deleted. Resources will be moved to Uncategorized.`,
      onConfirm: async () => {
        await storageService.deleteFolder(id);
        await storageService.flushPendingWrites();
        setFolders(storageService.getFolders());
        setItems([...storageService.getItems()]);
        if (filterState.folderId === id) {
          setFilterState(prev => ({ ...prev, folderId: 'all' }));
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Tag operations
  const handleAddTag = async (newTag: Omit<Tag, 'id'>) => {
    if (editingTag) {
      storageService.updateTag(editingTag.id, newTag);
      setEditingTag(null);
    } else {
      storageService.addTag(newTag);
    }
    await storageService.flushPendingWrites();
    setTags(storageService.getTags());
  };

  // Quick add tag (returns the new tag for inline creation)
  const handleQuickAddTag = (newTag: Omit<Tag, 'id'>): Tag => {
    const created = storageService.addTag(newTag);
    setTags(storageService.getTags());
    return created;
  };

  const handleDeleteTag = async (id: string) => {
    const tag = tags.find(t => t.id === id);
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Tag',
      message: `Are you sure you want to delete "${tag?.name}"? All nested tags will also be deleted.`,
      onConfirm: async () => {
        storageService.deleteTag(id);
        await storageService.flushPendingWrites();
        setTags(storageService.getTags());
        setItems([...storageService.getItems()]);
        if (filterState.tagId === id) {
          setFilterState(prev => ({ ...prev, tagId: null }));
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Show loading screen while storage is initializing
  if (!isStorageReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-content-secondary text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen w-full flex-col bg-surface overflow-hidden text-content"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-primary/90 flex items-center justify-center mac-blur">
          <div className="text-center">
            <Icon name="cloud_upload" className="text-[64px] text-white mx-auto mb-4" />
            <p className="text-2xl font-bold text-white">Drop files to import</p>
            <p className="text-white/70 mt-2">Supports PDF, Word, EPUB, Images</p>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AuthDialog
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={(u) => {
          setUser(u);
          syncItems();
        }}
        currentThemeId={currentThemeId}
        onThemeChange={applyTheme}
        colorMode={colorMode}
        onColorModeChange={applyColorMode}
        user={user}
        onLogout={() => {
          setUser(null);
          const client = getClient();
          client?.auth.signOut();
          setIsAuthOpen(false);
        }}
      />

      <CreateResourceDialog
        isOpen={isCreateResourceOpen}
        onClose={() => {
          setIsCreateResourceOpen(false);
          setEditingItem(null);
        }}
        onSave={handleAddResource}
        tags={tags}
        folders={folders}
        editItem={editingItem}
        colorMode={colorMode}
        onCreateTag={handleQuickAddTag}
      />

      <CreateFolderDialog
        isOpen={isCreateFolderOpen}
        onClose={() => {
          setIsCreateFolderOpen(false);
          setEditingFolder(null);
          setDefaultParentFolderId(undefined);
        }}
        onSave={handleAddFolder}
        folders={folders}
        editFolder={editingFolder}
        colorMode={colorMode}
        defaultParentId={defaultParentFolderId}
      />

      <CreateTagDialog
        isOpen={isCreateTagOpen}
        onClose={() => {
          setIsCreateTagOpen(false);
          setEditingTag(null);
        }}
        onSave={handleAddTag}
        tags={tags}
        editTag={editingTag}
        colorMode={colorMode}
      />

      <ImportExportDialog
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        currentThemeId={currentThemeId}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        confirmText="Delete"
        confirmVariant="danger"
      />

      <FileDropDialog
        isOpen={isFileDropDialogOpen}
        file={pendingDropFile}
        onClose={handleFileDropClose}
        onConfirm={handleFileDropConfirm}
      />

      <FolderDropDialog
        isOpen={isFolderDropDialogOpen}
        folderPath={pendingDropFolder}
        onClose={handleFolderDropClose}
        onConfirm={handleFolderDropConfirm}
      />

      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        colorMode={colorMode}
        onColorModeChange={applyColorMode}
        storagePath={customStoragePath}
        onStoragePathChange={(path) => {
          setCustomStoragePath(path);
          storageService.setCustomStoragePath(path);
        }}
      />

      <TopBar
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        searchQuery={filterState.search}
        onSearchChange={(q) => setFilterState(prev => ({ ...prev, search: q }))}
        onAddClick={() => setIsCreateResourceOpen(true)}
        onSyncClick={syncItems}
        isSyncing={isSyncing}
        onImportExportClick={() => setIsImportExportOpen(true)}
        onSettingsClick={() => setIsSettingsOpen(true)}
        tags={tags}
        selectedTypeFilter={filterState.typeFilter || null}
        onTypeFilterChange={(type) => setFilterState(prev => ({ ...prev, typeFilter: type }))}
        selectedTagFilter={filterState.tagId}
        onTagFilterChange={(tagId) => setFilterState(prev => ({ ...prev, tagId }))}
        selectedColorFilter={filterState.color}
        onColorFilterChange={(color) => setFilterState(prev => ({ ...prev, color }))}
      />

      {/* Active Filters Bar */}
      {(filterState.tagId || filterState.color || filterState.typeFilter) && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar bg-surface-tertiary/40 border-b border-[rgb(var(--color-border)/var(--border-opacity))] px-4 py-2 shrink-0">
          {filterState.typeFilter && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/20 border border-primary/40 text-[11px] font-medium text-primary whitespace-nowrap animate-in fade-in slide-in-from-left-2">
              <span>{filterState.typeFilter}</span>
              <Icon
                name="close"
                className="text-[14px] cursor-pointer"
                onClick={() => setFilterState(prev => ({ ...prev, typeFilter: null }))}
              />
            </div>
          )}
          {filterState.tagId && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/20 border border-primary/40 text-[11px] font-medium text-primary whitespace-nowrap animate-in fade-in slide-in-from-left-2">
              <span>{getTagName(filterState.tagId)}</span>
              <Icon
                name="close"
                className="text-[14px] cursor-pointer"
                onClick={() => setFilterState(prev => ({ ...prev, tagId: null }))}
              />
            </div>
          )}
          {filterState.color && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-tertiary border border-[rgb(var(--color-border)/var(--border-opacity))] text-[11px] font-medium whitespace-nowrap animate-in fade-in slide-in-from-left-2">
              <div className={`w-2 h-2 rounded-full bg-${filterState.color}`}></div>
              <span>Color Filter</span>
              <Icon
                name="close"
                className="text-[14px] opacity-50 cursor-pointer hover:opacity-100"
                onClick={() => setFilterState(prev => ({ ...prev, color: null }))}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          tags={tags}
          folders={folders}
          activeTagId={filterState.tagId}
          onSelectTag={(id) => setFilterState(prev => ({ ...prev, tagId: id }))}
          activeColor={filterState.color}
          onSelectColor={(c) => setFilterState(prev => ({ ...prev, color: c }))}
          activeFolderId={filterState.folderId}
          onSelectFolder={(f) => setFilterState(prev => ({ ...prev, folderId: f }))}
          user={user}
          onOpenAuth={() => setIsAuthOpen(true)}
          onCreateFolder={() => {
            // 如果当前选中的是用户文件夹（不是特殊文件夹），自动设为父文件夹
            const specialFolders = ['all', 'recent', 'starred', 'uncategorized', 'trash'];
            if (!specialFolders.includes(filterState.folderId)) {
              setDefaultParentFolderId(filterState.folderId);
            } else {
              setDefaultParentFolderId(undefined);
            }
            setIsCreateFolderOpen(true);
          }}
          onCreateSubfolder={(parentId) => {
            setDefaultParentFolderId(parentId);
            setIsCreateFolderOpen(true);
          }}
          onCreateTag={() => setIsCreateTagOpen(true)}
          onDropOnFolder={handleDropOnFolder}
          colorMode={colorMode}
          onDeleteFolder={handleDeleteFolder}
          onDeleteTag={handleDeleteTag}
        />

        {/* Content Area Switcher */}
        {viewMode === ViewMode.TABLE ? (
          <TableView
            items={filteredItems}
            selectedId={selectedItemId}
            onSelect={setSelectedItemId}
            getTagName={getTagName}
            onDelete={handleDeleteResource}
            onEdit={handleEditResource}
            sortType={sortType}
            onSortChange={setSortType}
            onOpen={handleOpenItem}
          />
        ) : viewMode === ViewMode.GRID ? (
          <>
            <GridView
              items={filteredItems}
              selectedId={selectedItemId}
              onSelect={setSelectedItemId}
              getTagName={getTagName}
              colorMode={colorMode}
              onOpen={handleOpenItem}
              onDelete={handleDeleteResource}
              onEdit={handleEditResource}
            />
            {selectedItemId && (
              <div className={`w-[350px] border-l hidden xl:block ${colorMode === 'light' ? 'border-gray-200' : 'border-[rgb(var(--color-border)/var(--border-opacity))]'}`}>
                <PreviewPane
                  item={selectedItem}
                  getTagName={getTagName}
                  onDelete={() => selectedItemId && handleDeleteResource(selectedItemId)}
                  onEdit={() => selectedItem && handleEditResource(selectedItem)}
                  onToggleStar={handleToggleStar}
                  onGenerateSummary={handleGenerateSummary}
                  isGeneratingSummary={isGeneratingSummary}
                  onOpenDocument={handleOpenDocument}
                  colorMode={colorMode}
                  availableTags={tags}
                  onRemoveTag={handleRemoveTag}
                  onAddTag={handleAddTagToItem}
                  onCreateTag={handleCreateTagInline}
                  onChangeType={handleChangeType}
                />
              </div>
            )}
          </>
        ) : (
          // List Detail Mode
          <>
            <ListDetailView
              items={filteredItems}
              selectedId={selectedItemId}
              onSelect={setSelectedItemId}
              getTagName={getTagName}
              sortType={sortType}
              onSortChange={setSortType}
              colorMode={colorMode}
              onOpen={handleOpenItem}
              onDelete={handleDeleteResource}
              onEdit={handleEditResource}
            />
            <div className="hidden md:flex flex-1">
              <PreviewPane
                item={selectedItem}
                getTagName={getTagName}
                onDelete={() => selectedItemId && handleDeleteResource(selectedItemId)}
                onEdit={() => selectedItem && handleEditResource(selectedItem)}
                onToggleStar={handleToggleStar}
                onGenerateSummary={handleGenerateSummary}
                isGeneratingSummary={isGeneratingSummary}
                onOpenDocument={handleOpenDocument}
                colorMode={colorMode}
                availableTags={tags}
                onRemoveTag={handleRemoveTag}
                onAddTag={handleAddTagToItem}
                onCreateTag={handleCreateTagInline}
                onChangeType={handleChangeType}
              />
            </div>
          </>
        )}
      </div>

      {/* Document Viewer Modal */}
      {documentViewerItem && (
        <div className="fixed inset-0 z-50 bg-black">
          <DocumentViewer
            item={documentViewerItem}
            onClose={handleCloseDocumentViewer}
          />
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="fixed bottom-4 right-4 text-[10px] text-content-secondary flex items-center gap-3 bg-surface-tertiary/80 px-3 py-1.5 rounded-full mac-blur">
        <span><kbd className="bg-surface-secondary px-1.5 py-0.5 rounded">⌘N</kbd> New</span>
        <span><kbd className="bg-surface-secondary px-1.5 py-0.5 rounded">⌘F</kbd> Search</span>
        <span><kbd className="bg-surface-secondary px-1.5 py-0.5 rounded">⌘E</kbd> Export</span>
      </div>

      {/* Sync indicator */}
      {isSyncing && (
        <div className="absolute top-14 right-4 bg-primary/90 text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1 shadow-lg z-50 animate-pulse">
          <Icon name="sync" className="animate-spin text-[12px]" />
          Syncing...
        </div>
      )}
    </div>
  );
};

export default App;
