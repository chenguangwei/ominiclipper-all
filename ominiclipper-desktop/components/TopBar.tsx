import React from 'react';
import Icon from './Icon';
import { ViewMode } from '../types';

interface TopBarProps {
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const TopBar: React.FC<TopBarProps> = ({ viewMode, onChangeViewMode, searchQuery, onSearchChange }) => {
  return (
    <header className="flex h-12 items-center justify-between border-b border-white/5 bg-[#252525]/80 px-4 mac-blur sticky top-0 z-50 select-none">
      <div className="flex items-center gap-3">
        {/* Fake Traffic Lights */}
        <div className="flex gap-1.5 shrink-0 group">
          <div className="h-3 w-3 rounded-full bg-[#ff5f57] group-hover:flex items-center justify-center text-[8px] text-black/50"></div>
          <div className="h-3 w-3 rounded-full bg-[#febc2e]"></div>
          <div className="h-3 w-3 rounded-full bg-[#28c840]"></div>
        </div>

        {/* View Switcher */}
        <div className="hidden sm:flex bg-black/20 p-0.5 rounded-lg ml-2">
          <button 
            onClick={() => onChangeViewMode(ViewMode.TABLE)}
            className={`flex items-center justify-center h-6 px-3 rounded-md transition-all ${viewMode === ViewMode.TABLE ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            title="Table View"
          >
            <Icon name="format_list_bulleted" className="text-[18px]" />
          </button>
          <button 
            onClick={() => onChangeViewMode(ViewMode.LIST_DETAIL)}
            className={`flex items-center justify-center h-6 px-3 rounded-md transition-all ${viewMode === ViewMode.LIST_DETAIL ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            title="Split View"
          >
             <Icon name="view_column" className="text-[18px]" />
          </button>
           <button 
            onClick={() => onChangeViewMode(ViewMode.GRID)}
            className={`flex items-center justify-center h-6 px-3 rounded-md transition-all ${viewMode === ViewMode.GRID ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
            title="Grid View"
          >
            <Icon name="grid_view" className="text-[18px]" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex-1 mx-4 max-w-xl">
        <div className="relative flex items-center">
          <Icon name="search" className="absolute left-2 text-[18px] text-slate-500" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-7 w-full rounded-md border-none bg-white/5 pl-8 pr-2 text-sm text-slate-200 focus:ring-1 focus:ring-primary/50 placeholder:text-slate-500 outline-none transition-all" 
            placeholder="Search resources..."
          />
        </div>
      </div>

      {/* Add Button */}
      <div className="flex items-center gap-1">
         <button className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/5 text-slate-400 transition-colors" title="Sync Status">
           <Icon name="cloud_sync" />
         </button>
        <button className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/5 text-slate-400 transition-colors">
          <Icon name="add" />
        </button>
      </div>
    </header>
  );
};

export default TopBar;