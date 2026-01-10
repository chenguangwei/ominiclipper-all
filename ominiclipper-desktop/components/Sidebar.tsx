import React, { useState } from 'react';
import { Tag, Folder } from '../types';
import Icon from './Icon';

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
}

const Sidebar: React.FC<SidebarProps> = ({
  tags,
  folders,
  activeTagId,
  onSelectTag,
  activeColor,
  onSelectColor,
  activeFolderId,
  onSelectFolder,
  user,
  onOpenAuth
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['root-folders', 'root-tags', 'f2']));

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
    isRoot: boolean = false
  ) => {
    const hasChildren = React.Children.count(children) > 0;
    const isExpanded = expandedIds.has(id);

    return (
      <div key={id} className="select-none">
        <div 
          onClick={onClick}
          className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors ${isActive ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
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

          <Icon name={icon} className={`text-[18px] ${isActive ? 'text-white' : (iconColor || 'text-slate-500')}`} />
          <span className="flex-1 truncate">{label}</span>
          {count !== undefined && <span className={`text-[10px] ${isActive ? 'text-white/80' : 'text-slate-600'}`}>{count}</span>}
        </div>
        
        {/* Children Container */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="ml-4 border-l border-white/5 pl-1 my-0.5">
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
        folder.name,
        folder.icon || 'folder',
        renderFolderTree(folder.id),
        activeFolderId === folder.id,
        () => {
            onSelectFolder(folder.id);
            onSelectTag(null); // Clear tag selection when picking folder
        },
        undefined,
        undefined
      )
    ));
  };

  const renderTagTree = (parentId?: string) => {
    const childTags = tags.filter(t => t.parentId === parentId);
    return childTags.map(tag => (
      renderTreeItem(
        tag.id,
        tag.name,
        'label',
        renderTagTree(tag.id),
        activeTagId === tag.id,
        () => {
             onSelectTag(tag.id);
             onSelectFolder('all'); 
        },
        tag.count,
        tag.color ? `text-${tag.color}` : 'text-primary'
      )
    ));
  };

  return (
    <aside className="w-64 border-r border-white/5 bg-[#181818] flex flex-col overflow-y-auto no-scrollbar shrink-0 select-none text-slate-300">
      
      {/* Workspace Header */}
      <div className="h-12 flex items-center px-4 border-b border-white/5 mb-2 hover:bg-white/5 cursor-pointer transition-colors">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center mr-2 shadow-sm">
             <Icon name="library_books" className="text-white text-[14px]" />
          </div>
          <span className="font-semibold text-sm text-slate-200">Inspiration Collection</span>
          <Icon name="unfold_more" className="ml-auto text-slate-500 text-[16px]" />
      </div>

      <div className="p-2 space-y-1 flex-1">
        {/* Library Section */}
        <div className="mb-4">
             <div 
                onClick={() => { onSelectFolder('all'); onSelectTag(null); }}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer ${activeFolderId === 'all' && !activeTagId ? 'bg-primary text-white' : 'hover:bg-white/5 hover:text-slate-200'}`}
             >
                <span className="w-4"></span>
                <Icon name="inbox" className={`text-[18px] ${activeFolderId === 'all' && !activeTagId ? 'text-white' : 'text-slate-500'}`} />
                <span className="flex-1">All Items</span>
                <span className="text-[10px] opacity-50">142</span>
             </div>
             {/* ... (Other static items omitted for brevity, keeping structure) ... */}
              <div 
                onClick={() => { onSelectFolder('trash'); onSelectTag(null); }}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer ${activeFolderId === 'trash' ? 'bg-primary text-white' : 'hover:bg-white/5 hover:text-slate-200'}`}
             >
                 <span className="w-4"></span>
                <Icon name="delete" className={`text-[18px] ${activeFolderId === 'trash' ? 'text-white' : 'text-slate-500'}`} />
                <span className="flex-1">Trash</span>
             </div>
        </div>

        {/* Folders */}
        <div className="mb-2">
            <div 
                className="flex items-center justify-between px-2 py-1 cursor-pointer hover:text-white text-slate-500 group"
                onClick={(e) => toggleExpand('root-folders', e)}
            >
                <div className="flex items-center gap-2">
                     <Icon name="chevron_right" className={`text-[14px] transition-transform ${expandedIds.has('root-folders') ? 'rotate-90' : ''}`} />
                    <h3 className="text-[11px] font-medium">Folders ({folders.length})</h3>
                </div>
                 <Icon name="create_new_folder" className="text-[14px] opacity-0 group-hover:opacity-100 cursor-pointer hover:text-white" />
            </div>
             <div className={`overflow-hidden transition-all duration-300 ${expandedIds.has('root-folders') ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                {renderFolderTree(undefined)}
             </div>
        </div>

        {/* Tags */}
        <div>
            <div 
                className="flex items-center justify-between px-2 py-1 cursor-pointer hover:text-white text-slate-500 group"
                 onClick={(e) => toggleExpand('root-tags', e)}
            >
                <div className="flex items-center gap-2">
                    <Icon name="chevron_right" className={`text-[14px] transition-transform ${expandedIds.has('root-tags') ? 'rotate-90' : ''}`} />
                    <h3 className="text-[11px] font-medium">Tags</h3>
                </div>
                <Icon name="add" className="text-[14px] opacity-0 group-hover:opacity-100 cursor-pointer hover:text-white" />
            </div>
             <div className={`overflow-hidden transition-all duration-300 ${expandedIds.has('root-tags') ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                {renderTagTree(undefined)}
             </div>
        </div>
      </div>

      {/* User / Cloud Section */}
      <div className="mt-auto p-3 border-t border-white/5 bg-white/5">
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
                <Icon name="settings" className="text-slate-500 hover:text-white cursor-pointer" onClick={onOpenAuth} />
            </div>
        ) : (
            <button 
                onClick={onOpenAuth}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group"
            >
                <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center group-hover:bg-primary transition-colors">
                    <Icon name="cloud_off" className="text-white/50 group-hover:text-white text-[16px]" />
                </div>
                <div className="flex-1 text-left">
                    <div className="text-xs font-medium text-slate-300 group-hover:text-white">Connect Cloud</div>
                    <div className="text-[10px] text-slate-500">Upgrade to Pro</div>
                </div>
            </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;