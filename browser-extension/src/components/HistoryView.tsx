import React, { useMemo, useState } from 'react';
import { ResourceItem, ResourceType, SyncStatus } from '../types';
import { StorageService } from '../services/storageService';
import {
  FileText,
  Trash2,
  Calendar,
  Cloud,
  CloudOff,
  Download,
  Search,
  X,
  RefreshCw,
  AlertCircle,
  Loader2,
  Edit2,
  Copy,
  Check,
  Image,
  Globe,
  Clock,
  Star,
  StarOff,
  Eye
} from 'lucide-react';

interface HistoryViewProps {
  items: ResourceItem[];
  onDelete: () => void;
  onRefresh?: () => void;
}

// Type filter options
type TypeFilter = 'all' | ResourceType;

const HistoryView: React.FC<HistoryViewProps> = ({ items, onDelete, onRefresh }) => {
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ResourceItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [previewItem, setPreviewItem] = useState<ResourceItem | null>(null);

  // Get type icon and color
  const getTypeInfo = (type: ResourceType) => {
    switch (type) {
      case ResourceType.WEB:
        return { icon: Globe, color: 'bg-blue-50 text-blue-600', label: 'Website' };
      case ResourceType.ARTICLE:
        return { icon: FileText, color: 'bg-green-50 text-green-600', label: 'Article' };
      case ResourceType.IMAGE:
        return { icon: Image, color: 'bg-purple-50 text-purple-600', label: 'Image' };
      case ResourceType.NOTE:
        return { icon: FileText, color: 'bg-amber-50 text-amber-600', label: 'Note' };
      default:
        return { icon: FileText, color: 'bg-gray-50 text-gray-600', label: 'Item' };
    }
  };

  // Get all available tags
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    items.forEach(item => {
      item.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [items]);

  // Filter and search
  const filteredItems = useMemo(() => {
    let result = items;

    // Type filter
    if (filterType !== 'all') {
      result = result.filter(item => item.type === filterType);
    }

    // Tag filter
    if (filterTag) {
      result = result.filter(item => item.tags.includes(filterTag));
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.content?.toLowerCase().includes(query) ||
        item.markdown?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.url?.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return result;
  }, [items, filterType, filterTag, searchQuery]);

  // Get sync status icon
  const getSyncStatusIcon = (status: SyncStatus | undefined) => {
    switch (status) {
      case 'synced':
        return <Cloud className="w-3 h-3 text-green-500" title="Synced" />;
      case 'syncing':
        return <Loader2 className="w-3 h-3 text-blue-500 animate-spin" title="Syncing" />;
      case 'error':
        return <AlertCircle className="w-3 h-3 text-red-500" title="Sync failed" />;
      case 'pending':
      default:
        return <CloudOff className="w-3 h-3 text-gray-300" title="Not synced" />;
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      StorageService.deleteItem(id);
      onDelete();
    }
  };

  const handleToggleStar = (item: ResourceItem) => {
    StorageService.updateItem(item.id, { isStarred: !item.isStarred });
    onDelete(); // Refresh
  };

  const handleCopy = async (item: ResourceItem) => {
    let text = item.title;
    if (item.url) text += `\n${item.url}`;
    if (item.markdown) text += `\n\n${item.markdown}`;
    else if (item.content) text += `\n\n${item.content}`;
    if (item.description) text += `\n\n${item.description}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleEdit = (item: ResourceItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditContent(item.markdown || item.content || item.description || '');
  };

  const handleSaveEdit = () => {
    if (editingItem && editTitle.trim()) {
      const updates: Partial<ResourceItem> = { title: editTitle.trim() };

      // Update appropriate content field based on type
      if (editingItem.type === ResourceType.ARTICLE) {
        updates.markdown = editContent.trim();
      } else if (editingItem.type === ResourceType.NOTE) {
        updates.content = editContent.trim();
      } else {
        updates.description = editContent.trim();
      }

      StorageService.updateItem(editingItem.id, updates);
      setEditingItem(null);
      onDelete(); // Refresh
    }
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditTitle('');
    setEditContent('');
  };

  const formatDate = (dateStr: string | number) => {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Export as JSON
  const handleExportJSON = () => {
    if (items.length === 0) return;

    const data = StorageService.exportData();
    const blob = new Blob([data], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `omniclipper_export_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export as CSV
  const handleExportCSV = () => {
    if (items.length === 0) return;

    const escapeCsv = (str: string) => {
      if (!str) return '';
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = ['ID', 'Type', 'Title', 'Description', 'URL', 'Tags', 'Created At', 'Sync Status', 'Starred'];
    const rows = items.map(item => [
      item.id,
      item.type,
      escapeCsv(item.title),
      escapeCsv(item.description || item.content || ''),
      escapeCsv(item.url || ''),
      escapeCsv(item.tags.join(', ')),
      escapeCsv(formatDate(item.createdAt)),
      item.syncStatus || 'pending',
      item.isStarred ? 'Yes' : 'No'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `omniclipper_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render item preview/thumbnail
  const renderItemPreview = (item: ResourceItem) => {
    if (item.type === ResourceType.IMAGE && item.imageData) {
      return (
        <div className="mb-3 rounded-lg overflow-hidden bg-gray-100">
          <img
            src={item.imageData}
            alt={item.title}
            className="w-full h-24 object-cover"
          />
        </div>
      );
    }

    if (item.type === ResourceType.WEB && item.favicon) {
      return (
        <div className="flex items-center gap-2 mb-2">
          <img
            src={item.favicon}
            alt=""
            className="w-4 h-4"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          {item.siteName && (
            <span className="text-xs text-gray-500">{item.siteName}</span>
          )}
        </div>
      );
    }

    return null;
  };

  // Render item metadata
  const renderItemMeta = (item: ResourceItem) => {
    const metas: React.ReactNode[] = [];

    if (item.type === ResourceType.ARTICLE && item.readingTime) {
      metas.push(
        <span key="reading" className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {item.readingTime} min read
        </span>
      );
    }

    if (item.author) {
      metas.push(
        <span key="author" className="text-gray-500">
          by {item.author}
        </span>
      );
    }

    if (item.type === ResourceType.IMAGE && item.imageSize) {
      metas.push(
        <span key="size" className="text-gray-400">
          {item.imageSize.width}×{item.imageSize.height}
        </span>
      );
    }

    return metas.length > 0 ? (
      <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-2">
        {metas}
      </div>
    ) : null;
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Search bar */}
      <div className="bg-white border-b border-gray-200 px-3 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Type filter */}
      <div className="bg-white border-b border-gray-200 px-3 py-2">
        <div className="flex items-center gap-1">
          {(['all', ResourceType.WEB, ResourceType.ARTICLE, ResourceType.IMAGE, ResourceType.NOTE] as const).map((type) => {
            const isAll = type === 'all';
            const typeInfo = isAll ? null : getTypeInfo(type as ResourceType);
            const Icon = isAll ? Globe : typeInfo!.icon;
            const label = isAll ? 'All' : typeInfo!.label;
            const isActive = filterType === type;

            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters and actions */}
      <div className="bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center justify-between px-3 pt-3">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            {filterTag || searchQuery || filterType !== 'all'
              ? `Found: ${filteredItems.length}`
              : `All Items: ${items.length}`}
          </span>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded text-gray-600 hover:text-brand-600 hover:bg-gray-100 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handleExportJSON}
              disabled={items.length === 0}
              className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded transition-colors ${
                items.length === 0
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:text-brand-600 hover:bg-gray-100'
              }`}
              title="Export as JSON"
            >
              <Download className="w-3.5 h-3.5" />
              JSON
            </button>
            <button
              onClick={handleExportCSV}
              disabled={items.length === 0}
              className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded transition-colors ${
                items.length === 0
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:text-brand-600 hover:bg-gray-100'
              }`}
              title="Export as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>

        {availableTags.length > 0 && (
          <div className="p-3 overflow-x-auto whitespace-nowrap hide-scrollbar">
            <button
              onClick={() => setFilterTag(null)}
              className={`inline-flex items-center px-3 py-1 mr-2 rounded-full text-xs font-medium transition-colors ${
                !filterTag ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Tags
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
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <div className="bg-gray-100 p-4 rounded-full mb-3">
              <FileText className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-sm">
              {searchQuery || filterTag || filterType !== 'all'
                ? 'No matching items found.'
                : 'No items found.'}
            </p>
          </div>
        ) : (
          filteredItems.map(item => {
            const typeInfo = getTypeInfo(item.type);
            const TypeIcon = typeInfo.icon;

            return (
              <div
                key={item.id}
                className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group relative"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <span className={`p-1.5 rounded-lg shrink-0 ${typeInfo.color}`}>
                      <TypeIcon className="w-4 h-4" />
                    </span>
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{item.title}</h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      onClick={() => handleToggleStar(item)}
                      className={`p-1 rounded transition-colors ${
                        item.isStarred ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'
                      }`}
                      title={item.isStarred ? 'Unstar' : 'Star'}
                    >
                      {item.isStarred ? <Star className="w-3.5 h-3.5 fill-current" /> : <StarOff className="w-3.5 h-3.5" />}
                    </button>
                    {getSyncStatusIcon(item.syncStatus)}
                  </div>
                </div>

                {renderItemPreview(item)}
                {renderItemMeta(item)}

                <p className="text-xs text-gray-500 line-clamp-2 mb-3 font-mono bg-gray-50 p-2 rounded">
                  {item.description || item.content || item.markdown?.substring(0, 200) || 'No content'}
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

                  <div className="flex items-center gap-1">
                    {(item.type === ResourceType.ARTICLE || item.type === ResourceType.NOTE) && (
                      <button
                        onClick={() => setPreviewItem(item)}
                        className="p-1.5 hover:bg-gray-100 text-gray-300 hover:text-gray-600 rounded transition-colors relative z-10"
                        title="Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(item)}
                      className="p-1.5 hover:bg-gray-100 text-gray-300 hover:text-gray-600 rounded transition-colors relative z-10"
                      title="Copy"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-1.5 hover:bg-gray-100 text-gray-300 hover:text-gray-600 rounded transition-colors relative z-10"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded transition-colors relative z-10"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute inset-0 z-0"
                    title={item.title}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button')) e.preventDefault();
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Edit modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Edit Item</h3>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase">Content</label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={6}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm resize-none font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!editTitle.trim()}
                className="px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal for articles/notes */}
      {previewItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">{previewItem.title}</h3>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {previewItem.author && (
                <p className="text-sm text-gray-500 mb-2">By {previewItem.author}</p>
              )}
              {previewItem.readingTime && (
                <p className="text-xs text-gray-400 mb-4 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {previewItem.readingTime} min read
                </p>
              )}
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700 bg-gray-50 p-4 rounded-lg">
                  {previewItem.markdown || previewItem.content || 'No content'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryView;
