import React, { useState } from 'react';
import { ResourceItem, ResourceType, ColorMode } from '../types';
import Icon from './Icon';

type SortType = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';

interface ListDetailViewProps {
  items: ResourceItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  getTagName: (id: string) => string;
  sortType?: SortType;
  onSortChange?: (sort: SortType) => void;
  colorMode?: ColorMode;
  onOpen?: (item: ResourceItem) => void;
}

const ListDetailView: React.FC<ListDetailViewProps> = ({
  items,
  selectedId,
  onSelect,
  getTagName,
  sortType = 'date-desc',
  onSortChange,
  colorMode = 'dark',
  onOpen,
}) => {
  const [showSortMenu, setShowSortMenu] = useState(false);
  const isLight = colorMode === 'light';

  const handleDoubleClick = (item: ResourceItem) => {
    if (onOpen) {
      onOpen(item);
    }
  };

  const getIconForType = (type: ResourceType) => {
    switch (type) {
      case ResourceType.WORD: return <Icon name="description" className="text-word-blue text-[24px]" />;
      case ResourceType.PDF: return <Icon name="picture_as_pdf" className="text-pdf-red text-[24px]" />;
      case ResourceType.EPUB: return <Icon name="auto_stories" className="text-epub-purple text-[24px]" />;
      case ResourceType.WEB: return <Icon name="language" className="text-tag-green text-[24px]" />;
      case ResourceType.IMAGE: return <Icon name="image" className="text-tag-yellow text-[24px]" />;
      default: return <Icon name="draft" className={isLight ? 'text-gray-400 text-[24px]' : 'text-content-secondary text-[24px]'} />;
    }
  };

  const getBgColorForType = (type: ResourceType, selected: boolean) => {
    if (isLight) {
      switch (type) {
        case ResourceType.WORD: return selected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100';
        case ResourceType.PDF: return selected ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100';
        case ResourceType.EPUB: return selected ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-100';
        default: return selected ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-100';
      }
    } else {
      switch (type) {
        case ResourceType.WORD: return 'bg-word-blue/20 border-word-blue/30';
        case ResourceType.PDF: return 'bg-pdf-red/20 border-pdf-red/30';
        case ResourceType.EPUB: return 'bg-epub-purple/20 border-epub-purple/30';
        default: return selected ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10';
      }
    }
  };

  const getSortLabel = () => {
    switch (sortType) {
      case 'date-desc': return 'Newest First';
      case 'date-asc': return 'Oldest First';
      case 'name-asc': return 'Name A-Z';
      case 'name-desc': return 'Name Z-A';
    }
  };

  // Light mode classes
  const containerClass = isLight
    ? 'flex-1 flex flex-col border-r border-gray-200 bg-gray-50 min-w-[300px] max-w-[420px] shrink-0'
    : 'flex-1 flex flex-col border-r border-[rgb(var(--color-border)/var(--border-opacity))] bg-surface min-w-[300px] max-w-[420px] shrink-0';

  const headerClass = isLight
    ? 'flex h-10 items-center justify-between border-b border-gray-200 px-4 bg-gray-100 shrink-0'
    : 'flex h-10 items-center justify-between border-b border-[rgb(var(--color-border)/var(--border-opacity))] px-4 bg-surface-tertiary/20 shrink-0';

  const headerTextClass = isLight ? 'text-[11px] font-medium text-gray-500 uppercase tracking-wide' : 'text-[11px] font-medium text-content-secondary uppercase tracking-wide';

  const sortButtonClass = isLight
    ? 'flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 cursor-pointer'
    : 'flex items-center gap-1 text-[11px] text-content-secondary hover:text-content cursor-pointer';

  const itemClass = (selected: boolean) => isLight
    ? `group relative flex flex-col gap-2 p-4 border-b border-gray-200 cursor-pointer select-none transition-colors ${
        selected ? 'bg-white border-l-4 border-l-[#007aff]' : 'hover:bg-white'
      }`
    : `group relative flex flex-col gap-2 p-4 border-b border-[rgb(var(--color-border)/var(--border-opacity))] cursor-pointer select-none transition-colors ${
        selected ? 'bg-primary/10 border-primary/20' : 'hover:bg-surface-tertiary'
      }`;

  const itemTitleClass = (selected: boolean) => isLight
    ? `text-sm font-semibold leading-tight line-clamp-1 ${
        selected ? 'text-gray-900' : 'text-gray-700'
      }`
    : `text-sm font-semibold leading-tight line-clamp-1 ${
        selected ? 'text-white' : 'text-content'
      }`;

  const itemDateClass = isLight ? 'text-[11px] text-gray-400 mt-0.5 flex items-center gap-1' : 'text-[11px] text-content-secondary mt-0.5 flex items-center gap-1';

  const tagClass = isLight
    ? 'px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-[9px] text-gray-500'
    : 'px-1.5 py-0.5 rounded bg-surface-tertiary border border-[rgb(var(--color-border)/0.1)] text-[9px] text-content-secondary';

  const sortMenuClass = isLight
    ? 'absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]'
    : 'absolute right-0 top-full mt-1 z-20 bg-surface-tertiary border border-[rgb(var(--color-border)/0.1)] rounded-lg shadow-xl py-1 min-w-[140px]';

  const sortMenuItemClass = (isSelected: boolean) => isLight
    ? `w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
        isSelected
          ? 'text-[#007aff] bg-[#007aff]/10'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`
    : `w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
        isSelected
          ? 'text-primary bg-primary/10'
          : 'text-content-secondary hover:bg-surface-tertiary hover:text-content'
      }`;

  return (
    <div className={containerClass}>
      <div className={headerClass}>
        <span className={headerTextClass}>{items.length} Items</span>
        <div className="flex items-center gap-3 relative">
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={sortButtonClass}
            >
              <Icon name="sort" className="text-[16px]" />
              <span>{getSortLabel()}</span>
            </button>

            {/* Sort Menu */}
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                <div className={sortMenuClass}>
                  {[
                    { value: 'date-desc' as SortType, label: 'Newest First' },
                    { value: 'date-asc' as SortType, label: 'Oldest First' },
                    { value: 'name-asc' as SortType, label: 'Name A-Z' },
                    { value: 'name-desc' as SortType, label: 'Name Z-A' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onSortChange?.(option.value);
                        setShowSortMenu(false);
                      }}
                      className={sortMenuItemClass(sortType === option.value)}
                    >
                      {sortType === option.value && <Icon name="check" className="text-sm" />}
                      <span className={sortType === option.value ? '' : isLight ? 'ml-5 text-gray-500' : 'ml-5'}>{option.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {items.length === 0 ? (
          <div className={`flex flex-col items-center justify-center h-full ${isLight ? 'text-gray-400' : 'text-content-secondary'}`}>
            <Icon name="folder_open" className="text-[48px] opacity-30 mb-2" />
            <span className="text-sm">No items found</span>
          </div>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              onClick={() => onSelect(item.id)}
              onDoubleClick={() => handleDoubleClick(item)}
              className={itemClass(selectedId === item.id)}
            >
              {isLight && selectedId === item.id && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#007aff]"></div>
              )}
              {!isLight && (
                <div className={`absolute left-0 top-0 bottom-0 w-1 bg-${item.color}`}></div>
              )}
              <div className="flex gap-3">
                <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center border ${getBgColorForType(item.type, selectedId === item.id)}`}>
                  {getIconForType(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={itemTitleClass(selectedId === item.id)}>{item.title}</h4>
                  <p className={itemDateClass}>
                    {new Date(item.updatedAt).toLocaleDateString()}
                    {item.isCloud && <Icon name="cloud" className="text-[10px]" />}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {item.tags.map(tagId => (
                  <span key={tagId} className={tagClass}>
                    {getTagName(tagId)}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ListDetailView;
