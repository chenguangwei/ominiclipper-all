import React from 'react';
import { ResourceItem, ResourceType } from '../types';
import Icon from './Icon';

interface GridViewProps {
  items: ResourceItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  getTagName: (id: string) => string;
}

const GridView: React.FC<GridViewProps> = ({ items, selectedId, onSelect, getTagName }) => {
  const getIconForType = (type: ResourceType) => {
    switch (type) {
      case ResourceType.WORD: return <Icon name="description" className="text-word-blue text-[40px]" />;
      case ResourceType.PDF: return <Icon name="picture_as_pdf" className="text-pdf-red text-[40px]" />;
      case ResourceType.EPUB: return <Icon name="auto_stories" className="text-epub-purple text-[40px]" />;
      case ResourceType.WEB: return <Icon name="language" className="text-tag-green text-[40px]" />;
      default: return <Icon name="article" className="text-slate-400 text-[40px]" />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-[#1e1e1e] p-6">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-6">
        {items.map(item => (
            <div 
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`group flex flex-col rounded-xl p-4 transition-all duration-200 cursor-pointer border ${selectedId === item.id ? 'bg-primary/20 border-primary/50 ring-2 ring-primary/30' : 'bg-[#252525]/40 border-white/5 hover:bg-[#252525] hover:scale-[1.02] hover:shadow-lg'}`}
            >
              <div className="aspect-[4/3] w-full rounded-lg bg-black/20 mb-3 flex items-center justify-center relative overflow-hidden">
                {getIconForType(item.type)}
                {item.isCloud && (
                  <div className="absolute top-2 right-2 bg-black/40 backdrop-blur rounded-full p-1">
                     <Icon name="cloud" className="text-[12px] text-white/70" />
                  </div>
                )}
                <div className={`absolute bottom-0 inset-x-0 h-1 bg-${item.color}`}></div>
              </div>
              
              <h3 className="text-sm font-medium text-slate-200 line-clamp-2 leading-snug mb-2">{item.title}</h3>
              
              <div className="mt-auto flex items-center justify-between">
                <span className="text-[10px] text-slate-500">{new Date(item.updatedAt).toLocaleDateString()}</span>
                <div className="flex gap-1">
                   {item.tags.slice(0, 2).map(tagId => (
                      <div key={tagId} className="w-2 h-2 rounded-full bg-white/20" title={getTagName(tagId)}></div>
                   ))}
                </div>
              </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default GridView;