import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// Components
import Icon from '@/components/Icon';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import AIAssistant from '@/components/AIAssistant';
import ListDetailView from '@/components/ListDetailView';
import PreviewPane from '@/components/PreviewPane';
import TableView from '@/components/TableView';
import GridView from '@/components/GridView';
import AuthDialog from '@/components/AuthDialog';
import CreateResourceDialog from '@/components/CreateResourceDialog';
import CreateFolderDialog from '@/components/CreateFolderDialog';
import CreateTagDialog from '@/components/CreateTagDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import ImportExportDialog from '@/components/ImportExportDialog';
import DocumentViewer from '@/components/DocumentViewer';
import FileDropDialog from '@/components/FileDropDialog';
import FolderDropDialog from '@/components/FolderDropDialog';
import SettingsDialog from '@/components/SettingsDialog';

// Services & Utils
import * as storageService from '@/services/storageService';
import { ViewMode, FilterState, ResourceItem, Tag, Folder } from '@/types';

// Custom Hooks
import { useAppInit } from '@/hooks/useAppInit';
import { useSemanticSearch } from '@/hooks/useSemanticSearch';
import { useDataIntegrity } from '@/hooks/useDataIntegrity';
import { useSync } from '@/hooks/useSync';
import { useFiltering } from '@/hooks/useFiltering';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useDragDrop } from '@/hooks/useDragDrop';

// Types
type SortType = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';

const App: React.FC = () => {
  // Core Data State
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.LIST_DETAIL);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<FilterState>({
    search: '', tagId: null, color: null, folderId: 'all'
  });
  const [sortType, setSortType] = useState<SortType>('date-desc');

  // Dialog States
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCreateResourceOpen, setIsCreateResourceOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [defaultParentFolderId, setDefaultParentFolderId] = useState<string | undefined>(undefined);

  // Editing State
  const [editingItem, setEditingItem] = useState<ResourceItem | null>(null);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  // Other UI
  const [documentViewerItem, setDocumentViewerItem] = useState<ResourceItem | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

  // --- Hooks Integration ---

  // 1. Initialization (Storage, Theme, i18n)
  const { isStorageReady, currentThemeId, colorMode, customStoragePath, setStoragePath, applyTheme, applyColorMode } = useAppInit(setItems, setTags, setFolders);

  // 2. Semantic Search
  const { isSemanticSearchEnabled, setIsSemanticSearchEnabled, isHybridSearchEnabled, setIsHybridSearchEnabled, semanticSearchResults, isSemanticSearching } =
    useSemanticSearch(filterState.search);


  const [isChatOpen, setIsChatOpen] = useState(false);

  // 3. Sync
  const { isSyncing, syncItems, user } = useSync(items, setItems);

  // 4. Filtering & Sorting
  const filteredItems = useFiltering(
    items, tags, folders, filterState, sortType, semanticSearchResults, isSemanticSearchEnabled
  );

  // 5. Drag & Drop
  const dnd = useDragDrop(setItems, filterState, customStoragePath);

  // 6. Data Integrity (Startup Scan)
  // Only run when storage is ready and we have items
  useDataIntegrity(items, isStorageReady);

  // --- Derived State ---
  const selectedItem = useMemo(() => items.find(i => i.id === selectedItemId) || null, [selectedItemId, items]);

  // --- Handlers (that require App context) ---

  const handleDeleteResource = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Resource',
      message: 'Are you sure you want to delete this resource?',
      onConfirm: async () => {
        await storageService.deleteItem(id);
        const newItems = storageService.getItems();
        setItems([...newItems]);
        if (selectedItemId === id) setSelectedItemId(null);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // 7. Navigation & Highlighting
  const [highlightText, setHighlightText] = useState<string | null>(null);

  const handleNavigateToItem = (itemId: string, text?: string) => {
    console.log('[App] handleNavigateToItem:', itemId, 'highlight:', text ? text.substring(0, 20) + '...' : 'none');

    // Check if item exists
    const itemExists = items.find(i => i.id === itemId);
    console.log('[App] Item exists:', !!itemExists);

    // 1. Select the item
    setSelectedItemId(itemId);

    // 2. Set highlight text if provided
    if (text) {
      setHighlightText(text);
      // Optional: clear highlight after some time? Keeping it persistent for now until new selection
    } else {
      setHighlightText(null);
    }

    // 3. Ensure we are in a view that shows the preview pane (List Detail)
    if (viewMode !== ViewMode.LIST_DETAIL) {
      setViewMode(ViewMode.LIST_DETAIL);
    }

    // 4. Close chat if needed, or keep open? 
    // Keeping it open is better for context, but might cover the preview on small screens.
    // Let's keep it open.
  };

  // --- Render ---

  // Add translation hook
  const { t } = useTranslation();

  if (!isStorageReady) {
    return <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-500">{t('common.loading')}</div>;
  }

  // Helper to handle confirm close
  const closeConfirm = () => setConfirmDialog(prev => ({ ...prev, isOpen: false }));

  return (
    <div
      className={`app-container flex h-screen bg-bg-primary text-text-primary ${colorMode} theme-${currentThemeId}`}
      onDragEnter={dnd.handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={dnd.handleDragLeave}
      onDrop={dnd.handleDrop}
    >
      <Sidebar
        tags={tags}
        folders={folders}
        activeTagId={filterState.tagId}
        onSelectTag={(id) => setFilterState(prev => ({ ...prev, tagId: id, folderId: 'all' }))}
        activeColor={filterState.color}
        onSelectColor={(color) => setFilterState(prev => ({ ...prev, color }))}
        activeFolderId={filterState.folderId}
        onSelectFolder={(id) => setFilterState(prev => ({ ...prev, folderId: id, tagId: null }))}
        onCreateFolder={() => { setDefaultParentFolderId(undefined); setIsCreateFolderOpen(true); }}
        onCreateSubfolder={(parentId) => { setDefaultParentFolderId(parentId); setIsCreateFolderOpen(true); }}
        onCreateTag={() => { setEditingTag(null); setIsCreateTagOpen(true); }}
        onDeleteFolder={async (id) => {
          await storageService.deleteFolder(id);
          setFolders([...storageService.getFolders()]);
        }}
        onDeleteTag={async (id) => {
          await storageService.deleteTag(id);
          setTags([...storageService.getTags()]);
          setItems([...storageService.getItems()]);
        }}
        colorMode={colorMode}
      />

      {/* ... rest of App ... */}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-bg-secondary relative">
        <TopBar
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          searchQuery={filterState.search}
          onSearchChange={(search) => setFilterState(prev => ({ ...prev, search }))}
          onAddClick={() => setIsCreateResourceOpen(true)}
          onSyncClick={syncItems}
          onImportExportClick={() => setIsImportExportOpen(true)}
          onSettingsClick={() => setIsSettingsOpen(true)}
          isSyncing={isSyncing}
          tags={tags}
          selectedTypeFilter={filterState.typeFilter || null}
          onTypeFilterChange={(type) => setFilterState(prev => ({ ...prev, typeFilter: type || undefined }))}
          selectedTagFilter={filterState.tagId}
          onTagFilterChange={(tagId) => setFilterState(prev => ({ ...prev, tagId }))}
          selectedColorFilter={filterState.color}
          onColorFilterChange={(color) => setFilterState(prev => ({ ...prev, color }))}
          isSemanticSearching={isSemanticSearching}
          isHybridSearchEnabled={isHybridSearchEnabled}
          onToggleHybridSearch={() => setIsHybridSearchEnabled(!isHybridSearchEnabled)}
          onToggleChat={() => setIsChatOpen(!isChatOpen)}
        />

        <main className="flex-1 overflow-hidden relative">
          {viewMode === ViewMode.LIST_DETAIL ? (
            <div className="flex h-full">
              <ListDetailView
                items={filteredItems}
                selectedId={selectedItemId}
                onSelect={(id) => {
                  setSelectedItemId(id);
                  // Clear highlight on manual selection change
                  setHighlightText(null);
                }}
                getTagName={(id) => tags.find(t => t.id === id)?.name || ''}
                sortType={sortType}
                onSortChange={setSortType}
                colorMode={colorMode}
                onOpen={setDocumentViewerItem}
                onDelete={handleDeleteResource}
                onEdit={(item) => { setEditingItem(item); setIsCreateResourceOpen(true); }}
              />
              {selectedItem ? (
                <div className="flex-1 flex flex-col min-w-0 bg-bg-secondary h-full border-l border-border">
                  <PreviewPane
                    item={selectedItem}
                    onEdit={() => { setEditingItem(selectedItem); setIsCreateResourceOpen(true); }}
                    onDelete={() => handleDeleteResource(selectedItem.id)}
                    getTagName={(id) => tags.find(t => t.id === id)?.name || ''}
                    onOpenDocument={setDocumentViewerItem}
                    // Pass highlight text
                    highlightText={highlightText}
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-text-secondary">
                  {t('common.select_item')}
                </div>
              )}
            </div>
          ) : viewMode === ViewMode.TABLE ? (
            <TableView
              items={filteredItems}
              selectedId={selectedItemId}
              onSelect={setSelectedItemId}
              getTagName={(id) => tags.find(t => t.id === id)?.name || ''}
              onViewItem={setDocumentViewerItem}
              onEditItem={(item) => { setEditingItem(item); setIsCreateResourceOpen(true); }}
              onDeleteItem={handleDeleteResource}
            />
          ) : (
            <GridView
              items={filteredItems}
              selectedId={selectedItemId}
              onSelect={setSelectedItemId}
              getTagName={(id) => tags.find(t => t.id === id)?.name || ''}
              onViewItem={setDocumentViewerItem}
              onEditItem={(item) => { setEditingItem(item); setIsCreateResourceOpen(true); }}
              onDeleteItem={handleDeleteResource}
            />
          )}

          {/* DND Overlay */}
          {dnd.isDragOver && (
            <div className="absolute inset-0 bg-primary-500/10 backdrop-blur-sm border-4 border-primary-500/50 z-50 flex items-center justify-center rounded-lg m-4">
              <div className="text-2xl font-bold text-primary-600 bg-white/90 px-8 py-4 rounded-xl shadow-lg">
                {t('common.drop_files')}
              </div>
            </div>
          )}
        </main>
      </div>


      {/* 4. Chat Interface */}
      <AIAssistant
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onNavigateToItem={handleNavigateToItem}
        items={items}
        colorMode={colorMode}
        onViewItem={setDocumentViewerItem}
      />

      {/* 5. Dialogs */}
      {isAuthOpen && (
        <AuthDialog
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          user={user}
          onLoginSuccess={() => setIsAuthOpen(false)}
          currentThemeId={currentThemeId}
          onThemeChange={applyTheme}
          colorMode={colorMode}
          onColorModeChange={applyColorMode}
          onLogout={async () => {
            await (window as any).supabase?.auth?.signOut();
            setIsAuthOpen(false);
          }}
        />
      )}

      {(isCreateResourceOpen || editingItem) && (
        <CreateResourceDialog
          isOpen={isCreateResourceOpen}
          onClose={() => { setIsCreateResourceOpen(false); setEditingItem(null); }}
          onSave={async (itemData) => {
            if (editingItem) {
              await storageService.updateItem(editingItem.id, itemData);
            } else {
              await storageService.addItem(itemData);
            }
            setItems([...storageService.getItems()]);
            setEditingItem(null);
            setIsCreateResourceOpen(false);
          }}
          editItem={editingItem || undefined}
          folders={folders}
          tags={tags}
          colorMode={colorMode}
          onCreateTag={(tagData) => {
            const newTag = storageService.addTag(tagData);
            setTags([...storageService.getTags()]);
            return newTag;
          }}
        />
      )}

      {(isCreateFolderOpen || editingFolder) && (
        <CreateFolderDialog
          isOpen={isCreateFolderOpen}
          onClose={() => { setIsCreateFolderOpen(false); setEditingFolder(null); setDefaultParentFolderId(undefined); }}
          onSave={async (folderData) => {
            if (editingFolder) {
              storageService.updateFolder(editingFolder.id, folderData);
            } else {
              await storageService.addFolder({ ...folderData, parentId: defaultParentFolderId || folderData.parentId });
            }
            setFolders([...storageService.getFolders()]);
            setEditingFolder(null);
            setIsCreateFolderOpen(false);
          }}
          initialData={editingFolder || undefined}
          folders={folders}
        />
      )}

      {(isCreateTagOpen || editingTag) && (
        <CreateTagDialog
          isOpen={isCreateTagOpen}
          onClose={() => { setIsCreateTagOpen(false); setEditingTag(null); }}
          onSave={(tagData) => {
            if (editingTag) {
              storageService.updateTag(editingTag.id, tagData);
            } else {
              storageService.addTag(tagData);
            }
            setTags([...storageService.getTags()]);
            setEditingTag(null);
            setIsCreateTagOpen(false);
          }}
          initialData={editingTag || undefined}
          tags={tags}
        />
      )}

      {isSettingsOpen && (
        <SettingsDialog
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          colorMode={colorMode}
          onColorModeChange={applyColorMode}
          storagePath={customStoragePath}
          onStoragePathChange={setStoragePath}
        />
      )}

      {isImportExportOpen && (
        <ImportExportDialog
          isOpen={isImportExportOpen}
          onClose={() => setIsImportExportOpen(false)}
          currentThemeId={currentThemeId}
        />
      )}

      {documentViewerItem && (
        <div className="fixed inset-0 z-[200] bg-black">
          <DocumentViewer item={documentViewerItem} onClose={() => setDocumentViewerItem(null)} />
        </div>
      )}

      {dnd.isFileDropDialogOpen && dnd.pendingDropFile && (
        <FileDropDialog
          isOpen={dnd.isFileDropDialogOpen}
          onClose={dnd.handleFileDropClose}
          onConfirm={dnd.handleFileDropConfirm}
          file={dnd.pendingDropFile}
        />
      )}

      {dnd.isFolderDropDialogOpen && (
        <FolderDropDialog
          isOpen={dnd.isFolderDropDialogOpen}
          onClose={() => dnd.setIsFolderDropDialogOpen(false)}
          onConfirm={dnd.handleFolderDropConfirm}
          folderPath={dnd.pendingDropFolder || ''}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirm}
      />

      {/* Browser Mode Warning Toast */}
      {dnd.browserModeWarning && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[300]">
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/90 text-white rounded-lg shadow-lg backdrop-blur-sm max-w-md animate-fade-in">
            <Icon name="info" className="text-[18px] shrink-0" />
            <span className="text-sm">{dnd.browserModeWarning}</span>
            <button
              onClick={() => dnd.setBrowserModeWarning(null)}
              className="ml-2 p-1 hover:bg-white/20 rounded transition-colors shrink-0"
            >
              <Icon name="close" className="text-[14px]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
