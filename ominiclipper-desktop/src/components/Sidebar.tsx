import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, Folder, ColorMode } from '../types';
import Icon from './Icon';
import AIAssistant from './AIAssistant';
import { INITIAL_FOLDERS, INITIAL_TAGS } from '../constants';

interface SidebarProps {
  tags: Tag[];
  folders: Folder[];
  activeTagId: string | null;
  onSelectTag: (id: string | null) => void;
  activeColor: string | null;
  onSelectColor: (color: string | null) => void;
  activeFolderId: string;
  onSelectFolder: (folderId: string) => void;
  user: any;
  onOpenAuth: () => void;
  onCreateFolder: () => void;
  onCreateSubfolder: (parentId: string) => void;
  onCreateTag: () => void;
  onDeleteFolder: (id: string) => void;
  onDeleteTag: (id: string) => void;
  onDropOnFolder?: (folderId: string, files: FileList) => void; // Callback when files dropped on folder
  onMoveItemToFolder?: (itemId: string, targetFolderId: string) => Promise<void>; // Callback when item dragged to folder
  colorMode?: ColorMode;
}

const Sidebar: React.FC<SidebarProps> = ({
  tags,
  folders,
  activeTagId,
  onSelectTag,
  activeColor: _activeColor,
  onSelectColor: _onSelectColor,
  activeFolderId,
  onSelectFolder,
  user,
  onOpenAuth,
  onCreateFolder,
  onCreateSubfolder,
  onCreateTag,
  onDeleteFolder,
  onDeleteTag,
  onDropOnFolder,
  onMoveItemToFolder,
  colorMode = 'dark',
}) => {
  const { t } = useTranslation();
  void _activeColor;
  void _onSelectColor;
  const isLight = colorMode === 'light';
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['root-folders', 'root-tags', 'f2']));
  const [contextMenu, setContextMenu] = useState<{ type: 'folder' | 'tag'; id: string; x: number; y: number } | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  const getFolderName = (folder: Folder) => {
    // Attempt to translate using folder ID
    // If translation is missing, it falls back to defaultValue which is the folder's original name
    return t(`initial_folders.${folder.id}`, { defaultValue: folder.name });
  };

  const getTagName = (tag: Tag) => {
    return t(`initial_tags.${tag.id}`, { defaultValue: tag.name });
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleContextMenu = (type: 'folder' | 'tag', id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ type, id, x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // 计算资源总数
  const totalItems = tags.reduce((sum, t) => sum + (t.count || 0), 0) || 142; // 默认显示 142

  // Helper to render tree items
  const renderTreeItem = (
    id: string,
    label: string,
    icon: string,
    children: React.ReactNode,
    isActive: boolean,
    onClick: () => void,
    count?: number,
    iconColor?: string,
    onContextMenu?: (e: React.MouseEvent) => void,
    isDropTarget?: boolean
  ) => {
    const hasChildren = React.Children.count(children) > 0;
    const isExpanded = expandedIds.has(id);

    return (
      <div key={id} className="select-none">
        <div
          onClick={onClick}
          onContextMenu={onContextMenu}
          onDragOver={(e) => {
            e.preventDefault();
            if (isDropTarget) {
              e.dataTransfer.dropEffect = 'copy';
              setDragOverFolderId(id);
            }
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (dragOverFolderId === id) {
              setDragOverFolderId(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOverFolderId(null);

            // Check for internal item drag first
            const itemData = e.dataTransfer.getData('application/x-omnicollector-item');
            if (itemData && isDropTarget) {
              try {
                const { itemId, itemTitle } = JSON.parse(itemData);
                console.log(`[Sidebar] Moving item "${itemTitle}" to folder ${id}`);
                onMoveItemToFolder?.(itemId, id);
              } catch (err) {
                console.error('[Sidebar] Failed to parse item drag data:', err);
              }
              return;
            }

            // Fall back to OS file drop
            if (isDropTarget && onDropOnFolder && e.dataTransfer.files.length > 0) {
              onDropOnFolder(id, e.dataTransfer.files);
            }
          }}
          className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors ${isActive ? 'bg-primary text-white' : 'text-content-secondary hover:bg-surface-tertiary hover:text-content'} ${isDropTarget && dragOverFolderId === id ? 'ring-2 ring-primary ring-inset bg-primary/10' : ''}`}
        >
          {/* Arrow */}
          <div
            className={`w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 ${hasChildren ? 'visible' : 'invisible'}`}
            onClick={(e) => hasChildren && toggleExpand(id, e)}
          >
            <Icon
              name="chevron_right"
              className={`text-[16px] transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            />
          </div>

          <Icon name={icon} className={`text-[18px] ${isActive ? 'text-white' : (iconColor || 'text-content-secondary')}`} />
          <span className="flex-1 truncate">{label}</span>
          {count !== undefined && <span className={`text-[10px] ${isActive ? 'text-white/80' : 'text-content-secondary'}`}>{count}</span>}
        </div>

        {/* Children Container */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="ml-4 border-l border-[rgb(var(--color-border)/var(--border-opacity))] pl-1 my-0.5">
            {children}
          </div>
        </div>
      </div>
    );
  };

  const renderFolderTree = (parentId?: string) => {
    const childFolders = folders.filter(f => f.parentId === parentId);
    return childFolders.map(folder => (
      renderTreeItem(
        folder.id,
        getFolderName(folder),
        folder.icon || 'folder',
        renderFolderTree(folder.id),
        activeFolderId === folder.id,
        () => {
          onSelectFolder(folder.id);
        },
        folder.count,
        undefined,
        (e) => handleContextMenu('folder', folder.id, e),
        true // Enable drop target
      )
    ));
  };

  const renderTagTree = (parentId?: string) => {
    const childTags = tags.filter(t => t.parentId === parentId);
    return childTags.map(tag => (
      renderTreeItem(
        tag.id,
        getTagName(tag),
        'label',
        renderTagTree(tag.id),
        activeTagId === tag.id,
        () => {
          onSelectTag(tag.id);
        },
        tag.count,
        tag.color ? `text-${tag.color}` : 'text-primary',
        (e) => handleContextMenu('tag', tag.id, e)
      )
    ));
  };

  return (
    <>
      <aside className="w-64 border-r border-[rgb(var(--color-border)/var(--border-opacity))] bg-surface-secondary flex flex-col overflow-y-auto no-scrollbar shrink-0 select-none text-content-secondary">

        {/* Workspace Header */}
        <div className="h-12 flex items-center px-4 border-b border-[rgb(var(--color-border)/var(--border-opacity))] mb-2 hover:bg-surface-tertiary cursor-pointer transition-colors">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center mr-2 shadow-sm">
            <Icon name="library_books" className="text-white text-[14px]" />
          </div>
          <span className="font-semibold text-sm text-content">OmniCollector</span>
          <Icon name="unfold_more" className="ml-auto text-content-secondary text-[16px]" />
        </div>

        <div className="p-2 space-y-1 flex-1">
          {/* Library Section */}
          <div className="mb-4">
            <div
              onClick={() => { onSelectFolder('all'); onSelectTag(null); }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverFolderId('all');
              }}
              onDragLeave={() => setDragOverFolderId(null)}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverFolderId(null);
                const itemData = e.dataTransfer.getData('application/x-omnicollector-item');
                if (itemData) {
                  try {
                    const { itemId, itemTitle } = JSON.parse(itemData);
                    console.log(`[Sidebar] Moving item "${itemTitle}" to All (removing folder)`);
                    onMoveItemToFolder?.(itemId, 'all');
                  } catch (err) {
                    console.error('[Sidebar] Failed to parse item drag data:', err);
                  }
                }
              }}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer ${activeFolderId === 'all' && !activeTagId ? 'bg-primary text-white' : 'hover:bg-surface-tertiary hover:text-content'} ${dragOverFolderId === 'all' ? 'ring-2 ring-primary ring-inset bg-primary/10' : ''}`}
            >
              <span className="w-4"></span>
              <Icon name="inbox" className={`text-[18px] ${activeFolderId === 'all' && !activeTagId ? 'text-white' : 'text-content-secondary'}`} />
              <span className="flex-1">{t('sidebar.all')}</span>
              <span className="text-[10px] opacity-50">{totalItems}</span>
            </div>

            <div
              onClick={() => { onSelectFolder('uncategorized'); onSelectTag(null); }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverFolderId('uncategorized');
              }}
              onDragLeave={() => setDragOverFolderId(null)}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverFolderId(null);
                const itemData = e.dataTransfer.getData('application/x-omnicollector-item');
                if (itemData) {
                  try {
                    const { itemId, itemTitle } = JSON.parse(itemData);
                    console.log(`[Sidebar] Moving item "${itemTitle}" to Uncategorized (removing folder)`);
                    onMoveItemToFolder?.(itemId, 'uncategorized');
                  } catch (err) {
                    console.error('[Sidebar] Failed to parse item drag data:', err);
                  }
                }
              }}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer ${activeFolderId === 'uncategorized' ? 'bg-primary text-white' : 'hover:bg-surface-tertiary hover:text-content'} ${dragOverFolderId === 'uncategorized' ? 'ring-2 ring-primary ring-inset bg-primary/10' : ''}`}
            >
              <span className="w-4"></span>
              <Icon name="folder_off" className={`text-[18px] ${activeFolderId === 'uncategorized' ? 'text-white' : 'text-content-secondary'}`} />
              <span className="flex-1">{t('sidebar.uncategorized')}</span>
            </div>

            <div
              onClick={() => { onSelectFolder('starred'); onSelectTag(null); }}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer ${activeFolderId === 'starred' ? 'bg-primary text-white' : 'hover:bg-surface-tertiary hover:text-content'}`}
            >
              <span className="w-4"></span>
              <Icon name="star" className={`text-[18px] ${activeFolderId === 'starred' ? 'text-white' : 'text-content-secondary'}`} />
              <span className="flex-1">{t('sidebar.favorites')}</span>
            </div>

            <div
              onClick={() => { onSelectFolder('trash'); onSelectTag(null); }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverFolderId('trash');
              }}
              onDragLeave={() => setDragOverFolderId(null)}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverFolderId(null);
                const itemData = e.dataTransfer.getData('application/x-omnicollector-item');
                if (itemData) {
                  try {
                    const { itemId, itemTitle } = JSON.parse(itemData);
                    console.log(`[Sidebar] Moving item "${itemTitle}" to Trash`);
                    onMoveItemToFolder?.(itemId, 'trash');
                  } catch (err) {
                    console.error('[Sidebar] Failed to parse item drag data:', err);
                  }
                }
              }}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer ${activeFolderId === 'trash' ? 'bg-primary text-white' : 'hover:bg-surface-tertiary hover:text-content'} ${dragOverFolderId === 'trash' ? 'ring-2 ring-red-500 ring-inset bg-red-500/10' : ''}`}
            >
              <span className="w-4"></span>
              <Icon name="delete" className={`text-[18px] ${activeFolderId === 'trash' ? 'text-white' : 'text-content-secondary'}`} />
              <span className="flex-1">{t('sidebar.trash')}</span>
            </div>
          </div>

          {/* Folders */}
          <div className="mb-2">
            <div
              className={`flex items-center justify-between px-2 py-1 cursor-pointer transition-colors ${isLight ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' : 'text-content-secondary hover:text-white hover:bg-surface-tertiary'} group`}
              onClick={(e) => toggleExpand('root-folders', e)}
            >
              <div className="flex items-center gap-2">
                <Icon name="chevron_right" className={`text-[14px] transition-transform ${expandedIds.has('root-folders') ? 'rotate-90' : ''} ${isLight ? '' : 'text-content-secondary'}`} />
                <h3 className={`text-[11px] font-medium ${isLight ? 'text-gray-700' : ''}`}>{t('sidebar.folders')} ({folders.length})</h3>
              </div>
              <Icon
                name="create_new_folder"
                className={`text-[14px] opacity-0 group-hover:opacity-100 cursor-pointer transition-colors ${isLight ? 'text-gray-500 hover:text-gray-800' : 'text-content-secondary hover:text-white'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateFolder();
                }}
              />
            </div>
            <div className={`overflow-hidden transition-all duration-300 ${expandedIds.has('root-folders') ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
              {renderFolderTree(undefined)}
            </div>
          </div>

          {/* Tags */}
          <div>
            <div
              className={`flex items-center justify-between px-2 py-1 cursor-pointer transition-colors ${isLight ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' : 'text-content-secondary hover:text-white hover:bg-surface-tertiary'} group`}
              onClick={(e) => toggleExpand('root-tags', e)}
            >
              <div className="flex items-center gap-2">
                <Icon name="chevron_right" className={`text-[14px] transition-transform ${expandedIds.has('root-tags') ? 'rotate-90' : ''} ${isLight ? '' : 'text-content-secondary'}`} />
                <h3 className={`text-[11px] font-medium ${isLight ? 'text-gray-700' : ''}`}>{t('sidebar.tags')} ({tags.length})</h3>
              </div>
              <Icon
                name="add"
                className={`text-[14px] opacity-0 group-hover:opacity-100 cursor-pointer transition-colors ${isLight ? 'text-gray-500 hover:text-gray-800' : 'text-content-secondary hover:text-white'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateTag();
                }}
              />
            </div>
            <div className={`overflow-hidden transition-all duration-300 ${expandedIds.has('root-tags') ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
              {renderTagTree(undefined)}
            </div>
          </div>
        </div>

        {/* User / Cloud Section */}
        <div className="mt-auto p-3 border-t border-[rgb(var(--color-border)/var(--border-opacity))] bg-surface-tertiary space-y-1">
          {/* AI Assistant Button */}
          <button
            onClick={() => setShowAIAssistant(true)}
            className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${isLight
              ? 'hover:bg-gray-100 text-gray-700'
              : 'hover:bg-white/5 text-slate-300 hover:text-white'
              }`}
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
              <Icon name="psychology" className="text-[18px] text-primary" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-xs font-medium">AI 助手</div>
              <div className="text-[10px] opacity-60">与数据对话</div>
            </div>
          </button>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white truncate">{user.email}</div>
                <div className="text-[10px] text-primary flex items-center gap-1">
                  <Icon name="verified" className="text-[10px]" />
                  Pro Member
                </div>
              </div>
              <Icon name="settings" className="text-content-secondary hover:text-white cursor-pointer" onClick={onOpenAuth} />
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface-tertiary transition-colors group"
            >
              <div className="h-8 w-8 rounded-full bg-surface-tertiary flex items-center justify-center group-hover:bg-primary transition-colors">
                <Icon name="cloud_off" className="text-white/50 group-hover:text-white text-[16px]" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-xs font-medium text-content group-hover:text-white">Connect Cloud</div>
                <div className="text-[10px] text-content-secondary">Upgrade to Pro</div>
              </div>
            </button>
          )}
        </div>
      </aside>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[200]" onClick={closeContextMenu} />
          <div
            className="fixed z-[201] bg-surface-tertiary border border-[rgb(var(--color-border)/0.1)] rounded-lg shadow-xl py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.type === 'folder' && (
              <button
                onClick={() => {
                  onCreateSubfolder(contextMenu.id);
                  closeContextMenu();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-content hover:bg-surface-tertiary transition-colors"
              >
                <Icon name="create_new_folder" className="text-lg" />
                Create Subfolder
              </button>
            )}

            {/* Delete Option - Protected for system items */}
            {!(INITIAL_FOLDERS.some(f => f.id === contextMenu.id) || INITIAL_TAGS.some(t => t.id === contextMenu.id)) && (
              <button
                onClick={() => {
                  if (contextMenu.type === 'folder') {
                    onDeleteFolder(contextMenu.id);
                  } else {
                    onDeleteTag(contextMenu.id);
                  }
                  closeContextMenu();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-surface-tertiary transition-colors"
              >
                <Icon name="delete" className="text-lg" />
                Delete {contextMenu.type === 'folder' ? 'Folder' : 'Tag'}
              </button>
            )}
          </div>
        </>
      )}

      {/* AI Assistant Panel */}
      <AIAssistant isOpen={showAIAssistant} onClose={() => setShowAIAssistant(false)} />
    </>
  );
};

export default Sidebar;
