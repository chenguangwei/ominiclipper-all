import React, { useState } from 'react';
import { ResourceItem, ResourceType } from '../types';
import Icon from './Icon';

type SortType = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';

interface TableViewProps {
  items: ResourceItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  getTagName: (id: string) => string;
  onDelete?: (id: string) => void;
  onEdit?: (item: ResourceItem) => void;
  sortType?: SortType;
  onSortChange?: (sort: SortType) => void;
  onOpen?: (item: ResourceItem) => void;
}

const TableView: React.FC<TableViewProps> = ({
  items,
  selectedId,
  onSelect,
  getTagName,
  onDelete,
  onEdit,
  sortType = 'date-desc',
  onSortChange,
  onOpen,
}) => {
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const handleDoubleClick = (item: ResourceItem) => {
    if (onOpen) {
      onOpen(item);
    }
  };

  const getIconForType = (type: ResourceType) => {
    switch (type) {
      case ResourceType.WORD: return <Icon name="description" className="text-word-blue text-[20px]" />;
      case ResourceType.PDF: return <Icon name="picture_as_pdf" className="text-pdf-red text-[20px]" />;
      case ResourceType.EPUB: return <Icon name="auto_stories" className="text-epub-purple text-[20px]" />;
      case ResourceType.WEB: return <Icon name="language" className="text-tag-green text-[20px]" />;
      case ResourceType.IMAGE: return <Icon name="image" className="text-tag-yellow text-[20px]" />;
      default: return <Icon name="draft" className="text-content-secondary text-[20px]" />;
    }
  };

  const getReadableType = (type: ResourceType) => {
    switch (type) {
      case ResourceType.WORD: return 'Microsoft Word';
      case ResourceType.PDF: return 'PDF Document';
      case ResourceType.EPUB: return 'EPUB eBook';
      case ResourceType.WEB: return 'Web Snippet';
      case ResourceType.IMAGE: return 'Image';
      default: return 'File';
    }
  };

  const handleContextMenu = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleSort = (column: 'name' | 'date') => {
    if (!onSortChange) return;
    if (column === 'name') {
      onSortChange(sortType === 'name-asc' ? 'name-desc' : 'name-asc');
    } else {
      onSortChange(sortType === 'date-desc' ? 'date-asc' : 'date-desc');
    }
  };

  return (
    <>
      <div className="flex-1 overflow-auto no-scrollbar bg-surface">
        <table className="w-full border-collapse table-fixed min-w-[800px]">
          <thead className="sticky top-0 z-10 bg-surface-tertiary border-b border-[rgb(var(--color-border)/0.1)]">
            <tr>
              <th
                className="table-header-cell w-[35%] text-left cursor-pointer hover:bg-surface-tertiary"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  Name
                  {(sortType === 'name-asc' || sortType === 'name-desc') && (
                    <Icon name={sortType === 'name-asc' ? 'arrow_upward' : 'arrow_downward'} className="text-[14px] text-primary" />
                  )}
                </div>
              </th>
              <th className="table-header-cell w-[25%] text-left">Tags</th>
              <th className="table-header-cell w-[10%] text-center">Color</th>
              <th className="table-header-cell w-[12%] text-left">Kind</th>
              <th
                className="table-header-cell w-[18%] text-left cursor-pointer hover:bg-surface-tertiary"
                onClick={() => handleSort('date')}
              >
                <div className="flex items-center gap-1">
                  Date Modified
                  {(sortType === 'date-asc' || sortType === 'date-desc') && (
                    <Icon name={sortType === 'date-desc' ? 'arrow_downward' : 'arrow_upward'} className="text-[14px] text-primary" />
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-content-secondary">
                  <Icon name="folder_open" className="text-[48px] opacity-30 mb-2" />
                  <p className="text-sm">No items found</p>
                </td>
              </tr>
            ) : (
              items.map(item => (
                <tr
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  onDoubleClick={() => handleDoubleClick(item)}
                  onContextMenu={(e) => handleContextMenu(item.id, e)}
                  className={`table-row cursor-pointer ${selectedId === item.id ? 'bg-primary/20' : ''}`}
                >
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      {getIconForType(item.type)}
                      <span className={`font-medium truncate ${selectedId === item.id ? 'text-white' : ''}`}>{item.title}</span>
                      {item.isCloud && <Icon name="cloud" className="text-[12px] text-content-secondary" />}
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map(tagId => (
                        <span key={tagId} className="px-1.5 py-0.5 rounded bg-surface-tertiary border border-[rgb(var(--color-border)/0.1)] text-[9px] text-content-secondary">
                          {getTagName(tagId)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="table-cell text-center">
                    <div className={`inline-block w-2.5 h-2.5 rounded-full bg-${item.color}`}></div>
                  </td>
                  <td className="table-cell text-content-secondary">{getReadableType(item.type)}</td>
                  <td className="table-cell text-content-secondary">
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[200]" onClick={closeContextMenu} />
          <div
            className="fixed z-[201] bg-surface-tertiary border border-[rgb(var(--color-border)/0.1)] rounded-lg shadow-xl py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                const item = items.find(i => i.id === contextMenu.id);
                if (item && onEdit) {
                  onEdit(item);
                }
                closeContextMenu();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-content hover:bg-surface-tertiary transition-colors"
            >
              <Icon name="edit" className="text-lg" />
              Edit
            </button>
            <button
              onClick={() => {
                if (onDelete) {
                  onDelete(contextMenu.id);
                }
                closeContextMenu();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-surface-tertiary transition-colors"
            >
              <Icon name="delete" className="text-lg" />
              Delete
            </button>
          </div>
        </>
      )}
    </>
  );
};

export default TableView;
