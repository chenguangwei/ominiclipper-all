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
import { APP_THEMES } from './constants';
import { ViewMode, FilterState, ResourceItem, Tag, Folder, ResourceType, FileStorageMode, ColorMode } from './types';
import Icon from './components/Icon';
import { getClient } from './supabaseClient';
import * as storageService from './services/storageService';
import * as fileManager from './services/fileManager';
import { t, getLocale, setLocale, getAvailableLocales } from './services/i18n';

// Sorting types
type SortType = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';

const App: React.FC = () => {
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.LIST_DETAIL);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [items, setItems] = useState<ResourceItem[]>(() => storageService.getItems());
  const [tags, setTags] = useState<Tag[]>(() => storageService.getTags());
  const [folders, setFolders] = useState<Folder[]>(() => storageService.getFolders());
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

  // Color mode state
  const [colorMode, setColorMode] = useState<ColorMode>(() => {
    return (localStorage.getItem('app_color_mode') as ColorMode) || 'dark';
  });

  // Initialize theme
  useEffect(() => {
    const savedThemeId = localStorage.getItem('app_theme_id') || 'blue';
    applyTheme(savedThemeId);
  }, []);

  // Initialize color mode
  useEffect(() => {
    applyColorMode(colorMode);

    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (colorMode === 'system') {
        applyColorMode('system');
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

  const applyTheme = (themeId: string) => {
    const theme = APP_THEMES.find(t => t.id === themeId);
    if (theme) {
      document.documentElement.style.setProperty('--color-primary', theme.rgb);
      setCurrentThemeId(themeId);
      localStorage.setItem('app_theme_id', themeId);
    }
  };

  const applyColorMode = (mode: ColorMode) => {
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

    setColorMode(mode);
    localStorage.setItem('app_color_mode', mode);
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

  // Filter logic
  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      // Search filter
      if (filterState.search && !item.title.toLowerCase().includes(filterState.search.toLowerCase())) {
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

    // Sort
    result = [...result].sort((a, b) => {
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
  }, [filterState, items, tags, sortType, getDescendantFolderIds]);

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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      setPendingDropFile(file);
      setIsFileDropDialogOpen(true);
    }
  };

  const handleFileDropConfirm = async (mode: FileStorageMode) => {
    if (!pendingDropFile) return;

    const file = pendingDropFile;
    const type = getResourceTypeFromFile(file);

    let path: string;
    let embeddedData: string | undefined;
    // Always set originalPath to the file name for display
    const originalPath = (file as any).path || file.name;

    if (mode === 'embed') {
      // Embed file content as Base64
      embeddedData = await fileManager.fileToBase64(file);
      path = embeddedData; // Use data URL directly for viewing
    } else {
      // Reference mode - use blob URL for current session
      path = URL.createObjectURL(file);
    }

    // Create new resource from dropped file
    storageService.addItem({
      title: file.name.replace(/\.[^/.]+$/, ''),
      type,
      tags: [],
      folderId: undefined,
      color: 'tag-blue',
      path,
      embeddedData,
      originalPath,
      storageMode: mode,
      fileSize: file.size,
      mimeType: file.type,
      isCloud: false,
      isStarred: false,
      contentSnippet: `Imported from ${file.name}`
    });

    setItems(storageService.getItems());
    setPendingDropFile(null);
    setIsFileDropDialogOpen(false);
  };

  const handleFileDropClose = () => {
    setPendingDropFile(null);
    setIsFileDropDialogOpen(false);
  };

  const getResourceTypeFromFile = (file: File): ResourceType => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return ResourceType.PDF;
      case 'doc': case 'docx': return ResourceType.WORD;
      case 'epub': return ResourceType.EPUB;
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': return ResourceType.IMAGE;
      default: return ResourceType.UNKNOWN;
    }
  };

  // Resource operations
  const handleAddResource = (newItem: Omit<ResourceItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingItem) {
      const updated = storageService.updateItem(editingItem.id, newItem);
      if (updated) {
        setItems(storageService.getItems());
      }
      setEditingItem(null);
    } else {
      storageService.addItem(newItem);
      setItems(storageService.getItems());
    }
    storageService.updateTagCounts();
    setTags(storageService.getTags());
  };

  const handleDeleteResource = (id: string) => {
    const item = items.find(i => i.id === id);
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Resource',
      message: `Are you sure you want to delete "${item?.title}"? This action cannot be undone.`,
      onConfirm: () => {
        storageService.deleteItem(id);
        setItems(storageService.getItems());
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
  const handleToggleStar = (id: string) => {
    const updatedItems = fileManager.toggleStar(items, id);
    setItems(updatedItems);
    storageService.saveItems(updatedItems);
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

      setItems(updatedItems);
      storageService.saveItems(updatedItems);
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

  // Close document viewer
  const handleCloseDocumentViewer = () => {
    setDocumentViewerItem(null);
  };

  // Folder operations
  const handleAddFolder = (newFolder: Omit<Folder, 'id'>) => {
    if (editingFolder) {
      storageService.updateFolder(editingFolder.id, newFolder);
      setEditingFolder(null);
    } else {
      storageService.addFolder(newFolder);
    }
    setFolders(storageService.getFolders());
  };

  const handleDeleteFolder = (id: string) => {
    const folder = folders.find(f => f.id === id);
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Folder',
      message: `Are you sure you want to delete "${folder?.name}"? All subfolders will also be deleted. Resources will be moved to Uncategorized.`,
      onConfirm: () => {
        storageService.deleteFolder(id);
        setFolders(storageService.getFolders());
        setItems(storageService.getItems());
        if (filterState.folderId === id) {
          setFilterState(prev => ({ ...prev, folderId: 'all' }));
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Tag operations
  const handleAddTag = (newTag: Omit<Tag, 'id'>) => {
    if (editingTag) {
      storageService.updateTag(editingTag.id, newTag);
      setEditingTag(null);
    } else {
      storageService.addTag(newTag);
    }
    setTags(storageService.getTags());
  };

  const handleDeleteTag = (id: string) => {
    const tag = tags.find(t => t.id === id);
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Tag',
      message: `Are you sure you want to delete "${tag?.name}"? All nested tags will also be deleted.`,
      onConfirm: () => {
        storageService.deleteTag(id);
        setTags(storageService.getTags());
        setItems(storageService.getItems());
        if (filterState.tagId === id) {
          setFilterState(prev => ({ ...prev, tagId: null }));
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

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
      />

      <CreateFolderDialog
        isOpen={isCreateFolderOpen}
        onClose={() => {
          setIsCreateFolderOpen(false);
          setEditingFolder(null);
        }}
        onSave={handleAddFolder}
        folders={folders}
        editFolder={editingFolder}
        colorMode={colorMode}
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

      <TopBar
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        searchQuery={filterState.search}
        onSearchChange={(q) => setFilterState(prev => ({ ...prev, search: q }))}
        onAddClick={() => setIsCreateResourceOpen(true)}
        onSyncClick={syncItems}
        isSyncing={isSyncing}
        onImportExportClick={() => setIsImportExportOpen(true)}
      />

      {/* Active Filters Bar */}
      {(filterState.tagId || filterState.color) && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar bg-surface-tertiary/40 border-b border-[rgb(var(--color-border)/var(--border-opacity))] px-4 py-2 shrink-0">
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
          onCreateFolder={() => setIsCreateFolderOpen(true)}
          onCreateTag={() => setIsCreateTagOpen(true)}
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
          />
        ) : viewMode === ViewMode.GRID ? (
          <>
            <GridView
              items={filteredItems}
              selectedId={selectedItemId}
              onSelect={setSelectedItemId}
              getTagName={getTagName}
            />
            {selectedItemId && (
              <div className={`w-[350px] border-l hidden xl:block ${isLight ? 'border-gray-200' : 'border-[rgb(var(--color-border)/var(--border-opacity))]'}`}>
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
