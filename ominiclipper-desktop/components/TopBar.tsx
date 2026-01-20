import React, { useState } from 'react';
import Icon from './Icon';
import { ViewMode, ResourceType, Tag } from '../types';

interface TopBarProps {
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddClick: () => void;
  onSyncClick: () => void;
  onImportExportClick: () => void;
  onSettingsClick: () => void;
  isSyncing?: boolean;
  // New filter props
  tags?: Tag[];
  selectedTypeFilter?: ResourceType | null;
  onTypeFilterChange?: (type: ResourceType | null) => void;
  selectedTagFilter?: string | null;
  onTagFilterChange?: (tagId: string | null) => void;
  selectedColorFilter?: string | null;
  onColorFilterChange?: (color: string | null) => void;
}

// Type filter options with icons
const TYPE_FILTERS: { type: ResourceType | null; label: string; icon: string }[] = [
  { type: null, label: 'All Types', icon: 'apps' },
  { type: ResourceType.PDF, label: 'PDF', icon: 'picture_as_pdf' },
  { type: ResourceType.WORD, label: 'Word', icon: 'description' },
  { type: ResourceType.EPUB, label: 'EPUB', icon: 'auto_stories' },
  { type: ResourceType.IMAGE, label: 'Images', icon: 'image' },
  { type: ResourceType.MARKDOWN, label: 'Markdown', icon: 'article' },
  { type: ResourceType.PPT, label: 'PPT', icon: 'slideshow' },
  { type: ResourceType.EXCEL, label: 'Excel', icon: 'table_chart' },
  { type: ResourceType.WEB, label: 'Web', icon: 'language' },
];

// Color filter options
const COLOR_FILTERS = [
  { color: null, label: 'All Colors' },
  { color: 'tag-blue', label: 'Blue' },
  { color: 'tag-green', label: 'Green' },
  { color: 'tag-orange', label: 'Orange' },
  { color: 'tag-red', label: 'Red' },
  { color: 'tag-yellow', label: 'Yellow' },
];

const TopBar: React.FC<TopBarProps> = ({
  viewMode,
  onChangeViewMode,
  searchQuery,
  onSearchChange,
  onAddClick,
  onSyncClick,
  onImportExportClick,
  onSettingsClick,
  isSyncing = false,
  tags = [],
  selectedTypeFilter = null,
  onTypeFilterChange,
  selectedTagFilter = null,
  onTagFilterChange,
  selectedColorFilter = null,
  onColorFilterChange,
}) => {
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  const hasActiveFilters = selectedTypeFilter !== null || selectedColorFilter !== null || selectedTagFilter !== null;

  return (
    <header className="flex flex-col border-b border-[rgb(var(--color-border)/var(--border-opacity))] bg-surface-tertiary/80 mac-blur sticky top-0 z-50 select-none">
      {/* Main toolbar row */}
      <div className="flex h-12 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          {/* Fake Traffic Lights */}
          <div className="flex gap-1.5 shrink-0 group">
            <div className="h-3 w-3 rounded-full bg-[#ff5f57] group-hover:flex items-center justify-center text-[8px] text-black/50"></div>
            <div className="h-3 w-3 rounded-full bg-[#febc2e]"></div>
            <div className="h-3 w-3 rounded-full bg-[#28c840]"></div>
          </div>

          {/* View Switcher */}
          <div className="hidden sm:flex bg-surface-secondary p-0.5 rounded-lg ml-2">
            <button
              onClick={() => onChangeViewMode(ViewMode.TABLE)}
              className={`flex items-center justify-center h-6 px-3 rounded-md transition-all ${viewMode === ViewMode.TABLE ? 'bg-surface-tertiary text-content shadow-sm' : 'text-content-secondary hover:text-content'}`}
              title="Table View (⌘1)"
            >
              <Icon name="format_list_bulleted" className="text-[18px]" />
            </button>
            <button
              onClick={() => onChangeViewMode(ViewMode.LIST_DETAIL)}
              className={`flex items-center justify-center h-6 px-3 rounded-md transition-all ${viewMode === ViewMode.LIST_DETAIL ? 'bg-surface-tertiary text-content shadow-sm' : 'text-content-secondary hover:text-content'}`}
              title="Split View (⌘2)"
            >
              <Icon name="view_column" className="text-[18px]" />
            </button>
            <button
              onClick={() => onChangeViewMode(ViewMode.GRID)}
              className={`flex items-center justify-center h-6 px-3 rounded-md transition-all ${viewMode === ViewMode.GRID ? 'bg-surface-tertiary text-content shadow-sm' : 'text-content-secondary hover:text-content'}`}
              title="Grid View (⌘3)"
            >
              <Icon name="grid_view" className="text-[18px]" />
            </button>
          </div>

          {/* Filter Buttons */}
          {onTypeFilterChange && (
            <div className="hidden md:flex items-center gap-1 ml-2">
              {/* Type Filter */}
              <div className="relative">
                <button
                  onClick={() => { setShowTypeDropdown(!showTypeDropdown); setShowColorDropdown(false); setShowTagDropdown(false); }}
                  className={`flex items-center gap-1 h-7 px-2 rounded-md text-xs transition-all ${selectedTypeFilter ? 'bg-primary/20 text-primary' : 'bg-surface-secondary text-content-secondary hover:text-content'}`}
                >
                  <Icon name={TYPE_FILTERS.find(f => f.type === selectedTypeFilter)?.icon || 'filter_list'} className="text-[16px]" />
                  <span className="hidden lg:inline">{TYPE_FILTERS.find(f => f.type === selectedTypeFilter)?.label || 'Type'}</span>
                  <Icon name="expand_more" className="text-[14px]" />
                </button>
                {showTypeDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-surface-secondary border border-[rgb(var(--color-border)/0.1)] rounded-lg shadow-lg py-1 min-w-[140px] z-50">
                    {TYPE_FILTERS.map(({ type, label, icon }) => (
                      <button
                        key={label}
                        onClick={() => { onTypeFilterChange(type); setShowTypeDropdown(false); }}
                        className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-surface-tertiary transition-colors ${selectedTypeFilter === type ? 'text-primary' : 'text-content'}`}
                      >
                        <Icon name={icon} className="text-[16px]" />
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Color Filter */}
              <div className="relative">
                <button
                  onClick={() => { setShowColorDropdown(!showColorDropdown); setShowTypeDropdown(false); setShowTagDropdown(false); }}
                  className={`flex items-center gap-1 h-7 px-2 rounded-md text-xs transition-all ${selectedColorFilter ? 'bg-primary/20 text-primary' : 'bg-surface-secondary text-content-secondary hover:text-content'}`}
                >
                  {selectedColorFilter ? (
                    <div className={`w-3 h-3 rounded-full bg-${selectedColorFilter}`} />
                  ) : (
                    <Icon name="palette" className="text-[16px]" />
                  )}
                  <span className="hidden lg:inline">{COLOR_FILTERS.find(f => f.color === selectedColorFilter)?.label || 'Color'}</span>
                  <Icon name="expand_more" className="text-[14px]" />
                </button>
                {showColorDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-surface-secondary border border-[rgb(var(--color-border)/0.1)] rounded-lg shadow-lg py-1 min-w-[120px] z-50">
                    {COLOR_FILTERS.map(({ color, label }) => (
                      <button
                        key={label}
                        onClick={() => { onColorFilterChange?.(color); setShowColorDropdown(false); }}
                        className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-surface-tertiary transition-colors ${selectedColorFilter === color ? 'text-primary' : 'text-content'}`}
                      >
                        {color ? <div className={`w-3 h-3 rounded-full bg-${color}`} /> : <Icon name="block" className="text-[16px]" />}
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tag Filter */}
              {tags.length > 0 && onTagFilterChange && (
                <div className="relative">
                  <button
                    onClick={() => { setShowTagDropdown(!showTagDropdown); setShowTypeDropdown(false); setShowColorDropdown(false); }}
                    className={`flex items-center gap-1 h-7 px-2 rounded-md text-xs transition-all ${selectedTagFilter ? 'bg-primary/20 text-primary' : 'bg-surface-secondary text-content-secondary hover:text-content'}`}
                  >
                    <Icon name="label" className="text-[16px]" />
                    <span className="hidden lg:inline">{tags.find(t => t.id === selectedTagFilter)?.name || 'Tag'}</span>
                    <Icon name="expand_more" className="text-[14px]" />
                  </button>
                  {showTagDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-surface-secondary border border-[rgb(var(--color-border)/0.1)] rounded-lg shadow-lg py-1 min-w-[140px] max-h-[200px] overflow-y-auto z-50">
                      <button
                        onClick={() => { onTagFilterChange(null); setShowTagDropdown(false); }}
                        className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-surface-tertiary transition-colors ${selectedTagFilter === null ? 'text-primary' : 'text-content'}`}
                      >
                        <Icon name="block" className="text-[16px]" />
                        All Tags
                      </button>
                      {tags.map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => { onTagFilterChange(tag.id); setShowTagDropdown(false); }}
                          className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-surface-tertiary transition-colors ${selectedTagFilter === tag.id ? 'text-primary' : 'text-content'}`}
                        >
                          <Icon name="label" className={`text-[16px] ${tag.color ? `text-${tag.color}` : 'text-primary'}`} />
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    onTypeFilterChange?.(null);
                    onColorFilterChange?.(null);
                    onTagFilterChange?.(null);
                  }}
                  className="flex items-center gap-1 h-7 px-2 rounded-md text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                  title="Clear all filters"
                >
                  <Icon name="filter_list_off" className="text-[16px]" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="flex-1 mx-4 max-w-xl">
          <div className="relative flex items-center">
            <Icon name="search" className="absolute left-2 text-[18px] text-content-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-7 w-full rounded-md border-none bg-surface-secondary pl-8 pr-2 text-sm text-content focus:ring-1 focus:ring-primary/50 placeholder:text-content-secondary outline-none transition-all"
              placeholder="Search resources... (⌘F)"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 text-content-secondary hover:text-content"
              >
                <Icon name="close" className="text-[16px]" />
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={onSettingsClick}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-secondary text-content-secondary transition-colors"
            title="Settings"
          >
            <Icon name="settings" />
          </button>
          <button
            onClick={onImportExportClick}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-secondary text-content-secondary transition-colors"
            title="Import/Export (⌘E)"
          >
            <Icon name="import_export" />
          </button>
          <button
            onClick={onSyncClick}
            disabled={isSyncing}
            className={`flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-secondary text-content-secondary transition-colors ${isSyncing ? 'animate-spin' : ''}`}
            title="Sync with Cloud"
          >
            <Icon name="cloud_sync" />
          </button>
          <button
            onClick={onAddClick}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/20 hover:bg-primary/30 text-primary transition-colors"
            title="Add New Resource (⌘N)"
          >
            <Icon name="add" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
