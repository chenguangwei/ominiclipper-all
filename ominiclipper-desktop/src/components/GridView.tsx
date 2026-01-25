import React, { useState } from 'react';
import { ResourceItem, ResourceType } from '../types';
import Icon from './Icon';
import ContextMenu from './ContextMenu';
import { getValidFilePath, recoverItemPath } from '../utils/fileHelpers';

interface GridViewProps {
  items: ResourceItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  getTagName: (id: string) => string;
  colorMode?: 'dark' | 'light' | 'system';
  onOpen?: (item: ResourceItem) => void;
  onDelete?: (id: string) => void;
  onEdit?: (item: ResourceItem) => void;
}

const GridView: React.FC<GridViewProps> = ({ items, selectedId, onSelect, getTagName, colorMode = 'dark', onOpen, onDelete, onEdit }) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuTarget, setContextMenuTarget] = useState<ResourceItem | null>(null);
  const handleDoubleClick = (item: ResourceItem) => {
    if (onOpen) {
      onOpen(item);
    }
  };
  const isLight = colorMode === 'light';

  const handleContextMenu = (e: React.MouseEvent, item: ResourceItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuTarget(item);
    setShowContextMenu(true);
  };

  const handleCloseContextMenu = () => {
    setShowContextMenu(false);
    setContextMenuTarget(null);
  };

  const handleRevealInFinder = async () => {
    if (!contextMenuTarget || !(window as any).electronAPI?.showItemInFolder) return;

    // Use getValidFilePath which checks localPath, path, and originalPath
    let filePath = getValidFilePath(contextMenuTarget);

    // If no valid path, try recovery
    if (!filePath) {
      console.log('[GridView] No valid path, attempting recovery...');
      filePath = await recoverItemPath(contextMenuTarget);
    }

    if (filePath) {
      console.log('[GridView] Revealing in Finder:', filePath);
      (window as any).electronAPI.showItemInFolder(filePath);
    } else {
      console.warn('[GridView] Cannot reveal in Finder: no valid path found');
    }
  };

  const handleDelete = () => {
    if (contextMenuTarget && onDelete) {
      onDelete(contextMenuTarget.id);
    }
  };

  const handleEdit = () => {
    if (contextMenuTarget && onEdit) {
      onEdit(contextMenuTarget);
    }
  };

  const handleOpen = () => {
    if (contextMenuTarget && onOpen) {
      onOpen(contextMenuTarget);
    }
  };

  const getIconForType = (type: ResourceType) => {
    switch (type) {
      case ResourceType.WORD: return <Icon name="description" className="text-word-blue text-[40px]" />;
      case ResourceType.PDF: return <Icon name="picture_as_pdf" className="text-pdf-red text-[40px]" />;
      case ResourceType.EPUB: return <Icon name="auto_stories" className="text-epub-purple text-[40px]" />;
      case ResourceType.WEB: return <Icon name="language" className="text-tag-green text-[40px]" />;
      case ResourceType.IMAGE: return <Icon name="image" className="text-tag-yellow text-[40px]" />;
      case ResourceType.MARKDOWN: return <Icon name="article" className="text-tag-blue text-[40px]" />;
      case ResourceType.PPT: return <Icon name="slideshow" className="text-tag-orange text-[40px]" />;
      case ResourceType.EXCEL: return <Icon name="table_chart" className="text-tag-green text-[40px]" />;
      default: return <Icon name="article" className={isLight ? 'text-gray-400 text-[40px]' : 'text-slate-400 text-[40px]'} />;
    }
  };

  // Helper to get thumbnail source - supports all file types with cached thumbnails
  const getThumbnailSrc = (item: ResourceItem): string | null => {
    // First priority: cached thumbnail (generated for all types)
    if (item.thumbnailUrl) {
      return item.thumbnailUrl;
    }
    // For images: use embedded data or file path directly
    if (item.type === ResourceType.IMAGE) {
      if (item.embeddedData) {
        // If already a data URL, use directly; otherwise convert base64 to data URL
        if (item.embeddedData.startsWith('data:')) {
          return item.embeddedData;
        }
        const mimeType = item.mimeType || 'image/png';
        return `data:${mimeType};base64,${item.embeddedData}`;
      }
      if (item.localPath) {
        // 使用正确的 file:// 协议，或者使用 data URL（如果可能）
        return item.localPath.startsWith('file://') ? item.localPath : `file://${item.localPath}`;
      }
      return item.path || null;
    }
    return null;
  };

  return (
    <div className={`flex-1 overflow-y-auto no-scrollbar p-6 ${isLight ? 'bg-gray-50' : 'bg-[#1e1e1e]'}`}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-6">
        {items.map(item => (
            <div
              key={item.id}
              onClick={() => onSelect(item.id)}
              onDoubleClick={() => handleDoubleClick(item)}
              onContextMenu={(e) => handleContextMenu(e, item)}
              className={`group flex flex-col rounded-xl p-4 transition-all duration-200 cursor-pointer border ${selectedId === item.id ? 'bg-primary/20 border-primary/50 ring-2 ring-primary/30' : isLight ? 'bg-white border-gray-200 hover:bg-gray-50 hover:scale-[1.02] hover:shadow-lg' : 'bg-[#252525]/40 border-white/5 hover:bg-[#252525] hover:scale-[1.02] hover:shadow-lg'}`}
            >
              <div className={`aspect-[4/3] w-full rounded-lg mb-3 flex items-center justify-center relative overflow-hidden ${isLight ? 'bg-gray-100' : 'bg-black/20'}`}>
                {(() => {
                  // Use thumbnail for all types if available
                  const thumbnailSrc = getThumbnailSrc(item);
                  return thumbnailSrc ? (
                    <img
                      src={thumbnailSrc}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fall back to icon on error
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : getIconForType(item.type);
                })()}
                {item.isCloud && (
                  <div className="absolute top-2 right-2 bg-black/40 backdrop-blur rounded-full p-1">
                     <Icon name="cloud" className="text-[12px] text-white/70" />
                  </div>
                )}
                <div className={`absolute bottom-0 inset-x-0 h-1 bg-${item.color}`}></div>
              </div>

              <h3 className={`text-sm font-medium line-clamp-2 leading-snug mb-2 ${isLight ? 'text-gray-800' : 'text-slate-200'}`}>{item.title}</h3>

              <div className="mt-auto flex items-center justify-between">
                <span className={`text-[10px] ${isLight ? 'text-gray-400' : 'text-slate-500'}`}>{new Date(item.updatedAt).toLocaleDateString()}</span>
                <div className="flex gap-1">
                   {item.tags.slice(0, 2).map(tagId => (
                      <div key={tagId} className="w-2 h-2 rounded-full bg-white/20" title={getTagName(tagId)}></div>
                   ))}
                </div>
              </div>
            </div>
        ))}
      </div>
      {showContextMenu && (
        <ContextMenu
          x={contextMenuPosition.x}
          y={contextMenuPosition.y}
          isVisible={showContextMenu}
          onClose={handleCloseContextMenu}
          onOpen={handleOpen}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRevealInFinder={handleRevealInFinder}
          colorMode={colorMode}
        />
      )}
    </div>
  );
};

export default GridView;