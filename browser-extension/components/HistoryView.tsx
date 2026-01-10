import React, { useMemo, useState } from 'react';
import { SavedItem, TAG_OPTIONS } from '../types';
import { StorageService } from '../services/storageService';
import { ExternalLink, FileText, Trash2, Calendar, Cloud, CloudOff, Download } from 'lucide-react';

interface HistoryViewProps {
  items: SavedItem[];
  onDelete: () => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ items, onDelete }) => {
  const [filterTag, setFilterTag] = useState<string | null>(null);

  // Generate a list of all unique tags available in the items + default options
  const availableTags = useMemo(() => {
    const tags = new Set(TAG_OPTIONS);
    items.forEach(item => {
        item.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!filterTag) return items;
    return items.filter(item => item.tags.includes(filterTag));
  }, [items, filterTag]);

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this item locally?')) {
      StorageService.deleteItem(id);
      onDelete();
    }
  };

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
  };

  const handleExportCSV = () => {
    if (items.length === 0) return;

    const escapeCsv = (str: string) => {
      if (!str) return '';
      // Double quotes to escape them, and wrap field in quotes
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = ["ID", "Type", "Title", "Content", "URL", "Tags", "Created At", "Synced"];
    const rows = items.map(item => [
      item.id,
      item.type,
      escapeCsv(item.title),
      escapeCsv(item.content),
      escapeCsv(item.url || ''),
      escapeCsv(item.tags.join(', ')),
      escapeCsv(new Date(item.createdAt).toLocaleString()),
      item.synced ? 'Yes' : 'No'
    ]);

    const csvContent = [
        headers.join(","), 
        ...rows.map(r => r.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `omniclipper_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Filters & Actions */}
      <div className="bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center justify-between px-3 pt-3">
             <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
               {filterTag ? `Filtered: ${filteredItems.length}` : `All Items: ${items.length}`}
             </span>
             <button 
               onClick={handleExportCSV}
               disabled={items.length === 0}
               className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded transition-colors ${
                 items.length === 0 
                    ? 'text-gray-300 cursor-not-allowed' 
                    : 'text-gray-600 hover:text-brand-600 hover:bg-gray-100'
               }`}
               title="Export all data to CSV"
             >
               <Download className="w-3.5 h-3.5" />
               Export CSV
             </button>
        </div>

        <div className="p-3 overflow-x-auto whitespace-nowrap hide-scrollbar">
          <button
              onClick={() => setFilterTag(null)}
              className={`inline-flex items-center px-3 py-1 mr-2 rounded-full text-xs font-medium transition-colors ${
                  !filterTag ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
              All
          </button>
          {availableTags.map(tag => (
              <button
                  key={tag}
                  onClick={() => setFilterTag(tag)}
                  className={`inline-flex items-center px-3 py-1 mr-2 rounded-full text-xs font-medium transition-colors ${
                      filterTag === tag ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                  {tag}
              </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <div className="bg-gray-100 p-4 rounded-full mb-3">
                    <FileText className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-sm">No items found.</p>
            </div>
        ) : (
            filteredItems.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group relative">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                            <span className={`p-1.5 rounded-lg ${item.type === 'link' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                {item.type === 'link' ? <ExternalLink className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                            </span>
                            <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{item.title}</h3>
                        </div>
                        <div className="flex items-center gap-1">
                           {item.synced ? <Cloud className="w-3 h-3 text-green-500" /> : <CloudOff className="w-3 h-3 text-gray-300" />}
                        </div>
                    </div>
                    
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3 font-mono bg-gray-50 p-2 rounded">
                        {item.content || "No content"}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <div className="flex items-center gap-2">
                            <span className="flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                {formatDate(item.createdAt)}
                            </span>
                            <div className="flex gap-1">
                                {item.tags.slice(0, 2).map(t => (
                                    <span key={t} className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{t}</span>
                                ))}
                                {item.tags.length > 2 && <span>+{item.tags.length - 2}</span>}
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    
                    {item.type === 'link' && item.url && (
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="absolute inset-0 z-0"
                          title={item.title}
                          onClick={(e) => {
                              // Prevent click if clicking the delete button
                              if ((e.target as HTMLElement).closest('button')) e.preventDefault();
                          }}
                        />
                    )}
                </div>
            ))
        )}
      </div>
    </div>
  );
};

export default HistoryView;