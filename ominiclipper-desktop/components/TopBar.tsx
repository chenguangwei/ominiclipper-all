import React from 'react';
import Icon from './Icon';
import { ViewMode } from '../types';

interface TopBarProps {
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddClick: () => void;
  onSyncClick: () => void;
  onImportExportClick: () => void;
  isSyncing?: boolean;
}

const TopBar: React.FC<TopBarProps> = ({
  viewMode,
  onChangeViewMode,
  searchQuery,
  onSearchChange,
  onAddClick,
  onSyncClick,
  onImportExportClick,
  isSyncing = false,
}) => {
  return (
    <header className="flex h-12 items-center justify-between border-b border-[rgb(var(--color-border)/var(--border-opacity))] bg-surface-tertiary/80 px-4 mac-blur sticky top-0 z-50 select-none">
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
    </header>
  );
};

export default TopBar;
