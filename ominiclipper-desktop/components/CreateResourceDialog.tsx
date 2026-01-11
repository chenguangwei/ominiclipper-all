import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { ResourceType, Tag, Folder, ResourceItem, ColorMode } from '../types';

interface CreateResourceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Omit<ResourceItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  tags: Tag[];
  folders: Folder[];
  editItem?: ResourceItem | null;
  colorMode: ColorMode;
}

const RESOURCE_TYPE_OPTIONS = [
  { type: ResourceType.WEB, label: 'Web Link', icon: 'language' },
  { type: ResourceType.WORD, label: 'Word Document', icon: 'description' },
  { type: ResourceType.PDF, label: 'PDF Document', icon: 'picture_as_pdf' },
  { type: ResourceType.EPUB, label: 'EPUB Book', icon: 'menu_book' },
  { type: ResourceType.IMAGE, label: 'Image', icon: 'image' },
  { type: ResourceType.UNKNOWN, label: 'Other', icon: 'insert_drive_file' },
];

const COLOR_OPTIONS = [
  { value: 'tag-blue', label: 'Blue', class: 'bg-[#007aff]' },
  { value: 'tag-green', label: 'Green', class: 'bg-[#34c759]' },
  { value: 'tag-orange', label: 'Orange', class: 'bg-[#ff9500]' },
  { value: 'tag-red', label: 'Red', class: 'bg-[#ff3b30]' },
  { value: 'tag-yellow', label: 'Yellow', class: 'bg-[#ffcc00]' },
  { value: 'tag-purple', label: 'Purple', class: 'bg-[#9c27b0]' },
];

const CreateResourceDialog: React.FC<CreateResourceDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  tags,
  folders,
  editItem,
  colorMode,
}) => {
  const isLight = colorMode === 'light';

  const [title, setTitle] = useState('');
  const [type, setType] = useState<ResourceType>(ResourceType.WEB);
  const [path, setPath] = useState('');
  const [contentSnippet, setContentSnippet] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [folderId, setFolderId] = useState<string>('');
  const [color, setColor] = useState('tag-blue');
  const [isCloud, setIsCloud] = useState(false);

  useEffect(() => {
    if (editItem) {
      setTitle(editItem.title);
      setType(editItem.type);
      setPath(editItem.path || '');
      setContentSnippet(editItem.contentSnippet || '');
      setSelectedTags(editItem.tags);
      setFolderId(editItem.folderId || '');
      setColor(editItem.color);
      setIsCloud(editItem.isCloud);
    } else {
      setTitle('');
      setType(ResourceType.WEB);
      setPath('');
      setContentSnippet('');
      setSelectedTags([]);
      setFolderId('');
      setColor('tag-blue');
      setIsCloud(false);
    }
  }, [editItem, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      type,
      path: path.trim() || undefined,
      contentSnippet: contentSnippet.trim() || undefined,
      tags: selectedTags,
      folderId: folderId || undefined,
      color,
      isCloud,
      isStarred: false,
    });

    onClose();
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const renderFolderOptions = (parentId?: string, level: number = 0): React.ReactNode => {
    const childFolders = folders.filter(f => f.parentId === parentId);
    return childFolders.map(folder => (
      <React.Fragment key={folder.id}>
        <option value={folder.id}>
          {'  '.repeat(level)}{folder.name}
        </option>
        {renderFolderOptions(folder.id, level + 1)}
      </React.Fragment>
    ));
  };

  if (!isOpen) return null;

  // Apple-style light mode classes
  const dialogClass = isLight
    ? 'relative w-full max-w-lg bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-200/60 overflow-hidden animate-in fade-in zoom-in-95 duration-200'
    : 'relative w-full max-w-lg bg-surface-tertiary rounded-xl shadow-2xl border border-[rgb(var(--color-border)/0.1)] overflow-hidden animate-in fade-in zoom-in-95 duration-200';

  const headerClass = isLight
    ? 'flex items-center justify-between px-5 py-4 border-b border-gray-100'
    : 'flex items-center justify-between px-5 py-4 border-b border-[rgb(var(--color-border)/0.1)]';

  const titleClass = isLight ? 'text-xl font-semibold text-gray-900' : 'text-lg font-semibold text-white';

  const closeBtnClass = isLight
    ? 'p-2 -mr-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all'
    : 'p-1 rounded-lg hover:bg-surface-tertiary text-content-secondary hover:text-white transition-colors';

  const formClass = 'p-5 space-y-5 max-h-[70vh] overflow-y-auto';

  const labelClass = isLight ? 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5' : 'block text-sm font-medium text-content mb-1.5';

  const inputClass = isLight
    ? 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff]'
    : 'w-full px-3 py-2 bg-surface-secondary border border-[rgb(var(--color-border)/0.1)] rounded-lg text-white placeholder:text-content-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent';

  const typeBtnClass = isLight
    ? (isSelected: boolean) => isSelected
      ? 'flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-[#007aff] bg-[#007aff]/5 text-[#007aff] font-medium transition-all'
      : 'flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 transition-all'
    : (isSelected: boolean) => isSelected
      ? 'flex items-center gap-2 px-3 py-2 rounded-lg border border-primary bg-primary/20 text-primary'
      : 'flex items-center gap-2 px-3 py-2 rounded-lg border border-[rgb(var(--color-border)/0.1)] bg-surface-secondary text-content-secondary hover:bg-surface-tertiary hover:text-white transition-all';

  const selectClass = isLight
    ? 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] cursor-pointer'
    : 'w-full px-3 py-2 bg-surface-secondary border border-[rgb(var(--color-border)/0.1)] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer';

  const tagBtnClass = isLight
    ? (isSelected: boolean) => isSelected
      ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#007aff] text-white transition-all'
      : 'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all'
    : (isSelected: boolean) => isSelected
      ? 'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all bg-primary text-white'
      : 'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-all bg-surface-tertiary text-content-secondary hover:bg-surface-tertiary hover:text-white';

  const colorBtnClass = isLight
    ? (isSelected: boolean) => isSelected
      ? 'w-7 h-7 rounded-full ring-2 ring-[#007aff] ring-offset-2 ring-offset-white scale-110 transition-all cursor-pointer'
      : 'w-7 h-7 rounded-full opacity-60 hover:opacity-100 cursor-pointer transition-all'
    : (isSelected: boolean) => isSelected
      ? 'w-8 h-8 rounded-full ring-2 ring-white ring-offset-2 ring-offset-[#252525] scale-110 transition-all cursor-pointer'
      : 'w-8 h-8 rounded-full opacity-60 hover:opacity-100 cursor-pointer transition-all';

  const footerClass = isLight
    ? 'flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50'
    : 'flex items-center justify-end gap-3 px-5 py-4 border-t border-[rgb(var(--color-border)/0.1)] bg-black/20';

  const cancelBtnClass = isLight
    ? 'px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors'
    : 'px-4 py-2 text-sm text-content-secondary hover:text-white transition-colors';

  const submitBtnClass = isLight
    ? 'px-5 py-2 bg-[#007aff] hover:bg-[#0066d6] disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-all shadow-sm'
    : 'px-4 py-2 bg-primary hover:bg-primary/80 disabled:bg-surface-tertiary disabled:text-content-secondary text-white text-sm font-medium rounded-lg transition-colors';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className={dialogClass}>
        <div className={headerClass}>
          <h2 className={titleClass}>
            {editItem ? 'Edit Resource' : 'Add New Resource'}
          </h2>
          <button
            onClick={onClose}
            className={closeBtnClass}
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={formClass}>
          <div>
            <label className={labelClass}>
              Title <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter resource title..."
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label className={labelClass}>
              Resource Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {RESOURCE_TYPE_OPTIONS.map(option => (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => setType(option.type)}
                  className={typeBtnClass(type === option.type)}
                >
                  <Icon name={option.icon} className="text-base" />
                  <span className="text-xs">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {type === ResourceType.WEB && (
            <div>
              <label className={labelClass}>
                URL
              </label>
              <input
                type="url"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="https://example.com"
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className={labelClass}>
              Description / Notes
            </label>
            <textarea
              value={contentSnippet}
              onChange={(e) => setContentSnippet(e.target.value)}
              placeholder="Add a brief description or notes..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className={labelClass}>
              Folder
            </label>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className={selectClass}
            >
              <option value="">No folder</option>
              {folders.filter(f => !f.parentId).map(folder => (
                <React.Fragment key={folder.id}>
                  <option value={folder.id}>{folder.name}</option>
                  {renderFolderOptions(folder.id, 1)}
                </React.Fragment>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {tags.filter(t => !t.parentId).map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={tagBtnClass(selectedTags.includes(tag.id))}
                >
                  <Icon name="label" className="text-xs" />
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Color Label
            </label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setColor(option.value)}
                  className={`${option.class} ${colorBtnClass(color === option.value)}`}
                  title={option.label}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <label className={`text-sm font-medium ${isLight ? 'text-gray-700' : 'text-content'}`}>
                Cloud Sync
              </label>
              <p className={`text-xs ${isLight ? 'text-gray-400' : 'text-content-secondary'}`}>
                Sync to cloud storage
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCloud(!isCloud)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                isCloud ? 'bg-[#007aff]' : isLight ? 'bg-gray-200' : 'bg-surface'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-sm absolute top-0.5 transition-all ${
                  isCloud ? 'left-5.5 translate-x-0' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </form>

        <div className={footerClass}>
          <button
            type="button"
            onClick={onClose}
            className={cancelBtnClass}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className={submitBtnClass}
          >
            {editItem ? 'Save Changes' : 'Add Resource'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateResourceDialog;
