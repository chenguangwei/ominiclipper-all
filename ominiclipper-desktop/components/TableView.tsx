import React from 'react';
import { ResourceItem, ResourceType, Tag } from '../types';
import Icon from './Icon';

interface TableViewProps {
  items: ResourceItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  getTagName: (id: string) => string;
}

const TableView: React.FC<TableViewProps> = ({ items, selectedId, onSelect, getTagName }) => {
  
  const getIconForType = (type: ResourceType) => {
    switch (type) {
      case ResourceType.WORD: return <Icon name="description" className="text-word-blue text-[20px]" />;
      case ResourceType.PDF: return <Icon name="picture_as_pdf" className="text-pdf-red text-[20px]" />;
      case ResourceType.EPUB: return <Icon name="auto_stories" className="text-epub-purple text-[20px]" />;
      case ResourceType.WEB: return <Icon name="language" className="text-tag-green text-[20px]" />;
      case ResourceType.IMAGE: return <Icon name="image" className="text-tag-yellow text-[20px]" />;
      default: return <Icon name="draft" className="text-slate-400 text-[20px]" />;
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
  }

  return (
    <div className="flex-1 overflow-auto no-scrollbar bg-[#1e1e1e]">
      <table className="w-full border-collapse table-fixed min-w-[800px]">
        <thead className="sticky top-0 z-10 bg-[#252525] border-b border-white/10">
          <tr>
            <th className="table-header-cell w-[35%] text-left">Name</th>
            <th className="table-header-cell w-[25%] text-left">Tags</th>
            <th className="table-header-cell w-[10%] text-center">Color</th>
            <th className="table-header-cell w-[12%] text-left">Kind</th>
            <th className="table-header-cell w-[18%] text-left">Date Modified</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {items.map(item => (
            <tr 
              key={item.id} 
              onClick={() => onSelect(item.id)}
              className={`table-row cursor-pointer ${selectedId === item.id ? 'bg-primary/20' : ''}`}
            >
              <td className="table-cell">
                <div className="flex items-center gap-2">
                  {getIconForType(item.type)}
                  <span className={`font-medium truncate ${selectedId === item.id ? 'text-white' : ''}`}>{item.title}</span>
                  {item.isCloud && <Icon name="cloud" className="text-[12px] text-slate-500" />}
                </div>
              </td>
              <td className="table-cell">
                <div className="flex flex-wrap gap-1">
                  {item.tags.map(tagId => (
                    <span key={tagId} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] text-slate-400">
                      {getTagName(tagId)}
                    </span>
                  ))}
                </div>
              </td>
              <td className="table-cell text-center">
                <div className={`inline-block w-2.5 h-2.5 rounded-full bg-${item.color}`}></div>
              </td>
              <td className="table-cell text-slate-400">{getReadableType(item.type)}</td>
              <td className="table-cell text-slate-500">
                {new Date(item.updatedAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableView;