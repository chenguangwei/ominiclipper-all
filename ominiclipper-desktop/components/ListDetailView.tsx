import React from 'react';
import { ResourceItem, ResourceType } from '../types';
import Icon from './Icon';

interface ListDetailViewProps {
  items: ResourceItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  getTagName: (id: string) => string;
}

const ListDetailView: React.FC<ListDetailViewProps> = ({ items, selectedId, onSelect, getTagName }) => {

  const getIconForType = (type: ResourceType) => {
    switch (type) {
      case ResourceType.WORD: return <Icon name="description" className="text-word-blue text-[24px]" />;
      case ResourceType.PDF: return <Icon name="picture_as_pdf" className="text-pdf-red text-[24px]" />;
      case ResourceType.EPUB: return <Icon name="auto_stories" className="text-epub-purple text-[24px]" />;
      case ResourceType.WEB: return <Icon name="language" className="text-tag-green text-[24px]" />;
      case ResourceType.IMAGE: return <Icon name="image" className="text-tag-yellow text-[24px]" />;
      default: return <Icon name="draft" className="text-slate-400 text-[24px]" />;
    }
  };

  const getBgColorForType = (type: ResourceType) => {
     switch (type) {
      case ResourceType.WORD: return 'bg-word-blue/20 border-word-blue/30';
      case ResourceType.PDF: return 'bg-pdf-red/20 border-pdf-red/30';
      case ResourceType.EPUB: return 'bg-epub-purple/20 border-epub-purple/30';
      default: return 'bg-white/10 border-white/20';
    }
  }

  return (
    <div className="flex-1 flex flex-col border-r border-white/5 bg-[#1e1e1e] min-w-[300px] max-w-[420px] shrink-0">
      <div className="flex h-10 items-center justify-between border-b border-white/5 px-4 bg-[#252525]/20 shrink-0">
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{items.length} Items</span>
        <div className="flex items-center gap-3">
          <Icon name="filter_list" className="text-[18px] text-slate-500 hover:text-slate-300 cursor-pointer" />
          <Icon name="sort" className="text-[18px] text-slate-500 hover:text-slate-300 cursor-pointer" />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {items.map(item => (
          <div 
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`group relative flex flex-col gap-2 p-4 border-b border-white/5 cursor-pointer select-none transition-colors ${selectedId === item.id ? 'bg-primary/10 border-primary/20' : 'hover:bg-white/5'}`}
          >
            <div className={`absolute left-0 top-0 bottom-0 w-1 bg-${item.color}`}></div>
            <div className="flex gap-3">
              <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center border ${getBgColorForType(item.type)}`}>
                {getIconForType(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className={`text-sm font-semibold leading-tight line-clamp-1 ${selectedId === item.id ? 'text-white' : 'text-slate-200'}`}>{item.title}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                    {new Date(item.updatedAt).toLocaleDateString()}
                    {item.isCloud && <Icon name="cloud" className="text-[10px]" />}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
               {item.tags.map(tagId => (
                  <span key={tagId} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] text-slate-400">
                    {getTagName(tagId)}
                  </span>
               ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ListDetailView;