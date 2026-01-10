import React, { useState, useMemo, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import ListDetailView from './components/ListDetailView';
import PreviewPane from './components/PreviewPane';
import TableView from './components/TableView';
import GridView from './components/GridView';
import AuthDialog from './components/AuthDialog';
import { MOCK_ITEMS, MOCK_TAGS, MOCK_FOLDERS, APP_THEMES } from './constants';
import { ViewMode, FilterState, ResourceItem } from './types';
import Icon from './components/Icon';
import { getClient } from './supabaseClient';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.LIST_DETAIL);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [items, setItems] = useState<ResourceItem[]>(MOCK_ITEMS);
  const [filterState, setFilterState] = useState<FilterState>({
    search: '',
    tagId: null,
    color: null,
    folderId: 'all'
  });
  
  // Auth State
  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Theme State
  const [currentThemeId, setCurrentThemeId] = useState<string>('blue');

  // Initialize Theme
  useEffect(() => {
    const savedThemeId = localStorage.getItem('app_theme_id') || 'blue';
    applyTheme(savedThemeId);
  }, []);

  const applyTheme = (themeId: string) => {
    const theme = APP_THEMES.find(t => t.id === themeId);
    if (theme) {
      document.documentElement.style.setProperty('--color-primary', theme.rgb);
      setCurrentThemeId(themeId);
      localStorage.setItem('app_theme_id', themeId);
    }
  };

  useEffect(() => {
     // Check for existing session
     const client = getClient();
     if (client) {
         client.auth.getUser().then(({ data }) => {
             if (data.user) {
                 setUser(data.user);
                 syncItems(); // Initial sync
             }
         });
     }
  }, []);

  const syncItems = async () => {
      const client = getClient();
      if (!client || !user) return;
      
      setIsSyncing(true);
      try {
          // In a real app, this would be a sophisticated merge or fetch
          // For this demo, we fetch and if empty, we might upsert mocks
          // We assume a table 'resources' exists
          const { data, error } = await client.from('resources').select('*');
          if (data && data.length > 0) {
              // Map DB structure to internal type if needed
              // For demo, we just console log and pretend to merge
              console.log("Synced items:", data);
              // setItems(prev => [...prev, ...data]); // Uncomment if table exists and matches schema
          }
      } catch (e) {
          console.error("Sync error", e);
      } finally {
          setIsSyncing(false);
      }
  };

  const getTagName = (id: string) => {
    return MOCK_TAGS.find(t => t.id === id)?.name || id;
  };

  // Helper to find all descendant folder IDs for a given folder
  const getDescendantFolderIds = (folderId: string): string[] => {
      const children = MOCK_FOLDERS.filter(f => f.parentId === folderId);
      let ids = children.map(c => c.id);
      children.forEach(c => {
          ids = [...ids, ...getDescendantFolderIds(c.id)];
      });
      return ids;
  };

  // Filter Logic
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Search
      if (filterState.search && !item.title.toLowerCase().includes(filterState.search.toLowerCase())) {
        return false;
      }
      
      // Tag
      if (filterState.tagId) {
        if (!item.tags.includes(filterState.tagId)) {
             const selectedTag = MOCK_TAGS.find(t => t.id === filterState.tagId);
             const childrenTags = MOCK_TAGS.filter(t => t.parentId === selectedTag?.id).map(t => t.id);
             const hasChildTag = item.tags.some(t => childrenTags.includes(t));
             if(!hasChildTag) return false;
        }
      }
      
      // Color
      if (filterState.color && item.color !== filterState.color) {
        return false;
      }
      
      // Folder Logic
      if (filterState.folderId === 'all') {
          return true;
      } else if (filterState.folderId === 'trash') {
          return false; 
      } else if (filterState.folderId === 'uncategorized') {
          return !item.folderId;
      } else if (filterState.folderId === 'untagged') {
          return item.tags.length === 0;
      } else if (filterState.folderId === 'recent') {
          return true; 
      } else {
          const relevantFolderIds = [filterState.folderId, ...getDescendantFolderIds(filterState.folderId)];
          return item.folderId && relevantFolderIds.includes(item.folderId);
      }
    });
  }, [filterState, items]);

  const selectedItem = useMemo(() => 
    items.find(i => i.id === selectedItemId) || null
  , [selectedItemId, items]);

  return (
    <div className="flex h-screen w-full flex-col bg-[#1e1e1e] overflow-hidden text-slate-200">
      
      <AuthDialog 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        onLoginSuccess={(u) => {
            setUser(u);
            syncItems();
        }}
        currentThemeId={currentThemeId}
        onThemeChange={applyTheme}
        user={user}
        onLogout={() => {
            setUser(null);
            const client = getClient();
            client?.auth.signOut();
            setIsAuthOpen(false);
        }}
      />

      <TopBar 
        viewMode={viewMode} 
        onChangeViewMode={setViewMode}
        searchQuery={filterState.search}
        onSearchChange={(q) => setFilterState(prev => ({ ...prev, search: q }))}
      />
      
      {/* Active Filters Bar */}
      {(filterState.tagId || filterState.color) && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar bg-[#252525]/40 border-b border-white/5 px-4 py-2 shrink-0">
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
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-[11px] font-medium whitespace-nowrap animate-in fade-in slide-in-from-left-2">
              <div className={`w-2 h-2 rounded-full bg-${filterState.color}`}></div>
              <span>Color Filter</span>
              <Icon 
                 name="close" 
                 className="text-[14px] opacity-50 cursor-pointer hover:opacity-100" 
                 onClick={() => setFilterState(prev => ({...prev, color: null}))}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          tags={MOCK_TAGS}
          folders={MOCK_FOLDERS}
          activeTagId={filterState.tagId}
          onSelectTag={(id) => setFilterState(prev => ({ ...prev, tagId: id }))}
          activeColor={filterState.color}
          onSelectColor={(c) => setFilterState(prev => ({ ...prev, color: c }))}
          activeFolderId={filterState.folderId}
          onSelectFolder={(f) => setFilterState(prev => ({ ...prev, folderId: f }))}
          user={user}
          onOpenAuth={() => setIsAuthOpen(true)}
        />

        {/* Content Area Switcher */}
        {viewMode === ViewMode.TABLE ? (
          <TableView 
            items={filteredItems}
            selectedId={selectedItemId}
            onSelect={setSelectedItemId}
            getTagName={getTagName}
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
                    <div className="w-[350px] border-l border-white/5 hidden xl:block">
                        <PreviewPane item={selectedItem} getTagName={getTagName} />
                    </div>
                )}
            </>
        ) : (
          // List Detail Mode (Split View)
          <>
            <ListDetailView 
              items={filteredItems} 
              selectedId={selectedItemId} 
              onSelect={setSelectedItemId} 
              getTagName={getTagName}
            />
            <div className="hidden md:flex flex-1">
                <PreviewPane item={selectedItem} getTagName={getTagName} />
            </div>
          </>
        )}
      </div>

       {/* Mobile Footer/Nav */}
       <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-[#252525]/90 border-t border-white/10 flex items-center justify-around px-4 mac-blur z-[60]">
            <div className="flex flex-col items-center text-primary">
                <Icon name="filter_list" />
                <span className="text-[10px] mt-0.5">Browse</span>
            </div>
            <div className="flex flex-col items-center text-slate-500">
                 <Icon name="search" />
                <span className="text-[10px] mt-0.5">Search</span>
            </div>
            <div className="flex flex-col items-center text-slate-500">
                 <Icon name="settings" />
                <span className="text-[10px] mt-0.5">Settings</span>
            </div>
        </nav>
        
        {/* Sync Indicator */}
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