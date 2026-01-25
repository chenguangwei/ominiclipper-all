import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { Tag, ColorMode } from '../types';

interface CreateTagDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tag: Omit<Tag, 'id'>) => void;
  tags: Tag[];
  editTag?: Tag | null;
  colorMode: ColorMode;
}

const COLOR_OPTIONS = [
  { value: 'primary', label: 'Primary', class: 'bg-[#007aff]' },
  { value: 'tag-blue', label: 'Blue', class: 'bg-[#007aff]' },
  { value: 'tag-green', label: 'Green', class: 'bg-[#34c759]' },
  { value: 'tag-orange', label: 'Orange', class: 'bg-[#ff9500]' },
  { value: 'tag-red', label: 'Red', class: 'bg-[#ff3b30]' },
  { value: 'tag-yellow', label: 'Yellow', class: 'bg-[#ffcc00]' },
  { value: 'tag-purple', label: 'Purple', class: 'bg-[#9c27b0]' },
  { value: 'tag-pink', label: 'Pink', class: 'bg-[#ff2d55]' },
];

const CreateTagDialog: React.FC<CreateTagDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  tags,
  editTag,
  colorMode,
}) => {
  const isLight = colorMode === 'light';
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [color, setColor] = useState('primary');

  useEffect(() => {
    if (editTag) {
      setName(editTag.name);
      setParentId(editTag.parentId || '');
      setColor(editTag.color || 'primary');
    } else {
      setName('');
      setParentId('');
      setColor('primary');
    }
  }, [editTag, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      parentId: parentId || undefined,
      color,
      count: editTag?.count || 0,
    });

    onClose();
  };

  const renderTagOptions = (parentTagId?: string, level: number = 0): React.ReactNode => {
    const childTags = tags.filter(t => t.parentId === parentTagId);
    return childTags.map(tag => {
      if (editTag && tag.id === editTag.id) {
        return null;
      }
      return (
        <React.Fragment key={tag.id}>
          <option value={tag.id}>
            {'  '.repeat(level)}{tag.name}
          </option>
          {renderTagOptions(tag.id, level + 1)}
        </React.Fragment>
      );
    });
  };

  if (!isOpen) return null;

  const dialogClass = isLight
    ? 'relative w-full max-w-md bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-200/60 overflow-hidden animate-in fade-in zoom-in-95 duration-200'
    : 'relative w-full max-w-md bg-[#252525] rounded-xl shadow-2xl border border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200';

  const headerClass = isLight
    ? 'flex items-center justify-between px-5 py-4 border-b border-gray-100'
    : 'flex items-center justify-between px-5 py-4 border-b border-white/10';

  const titleClass = isLight ? 'text-xl font-semibold text-gray-900' : 'text-lg font-semibold text-white';

  const closeBtnClass = isLight
    ? 'p-2 -mr-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all'
    : 'p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors';

  const labelClass = isLight ? 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5' : 'block text-sm font-medium text-slate-300 mb-1.5';

  const inputClass = isLight
    ? 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff]'
    : 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50';

  const selectClass = isLight
    ? 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#007aff]/20 focus:border-[#007aff] cursor-pointer'
    : 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer';

  const colorBtnClass = isLight
    ? (isSelected: boolean) => isSelected
      ? 'w-9 h-9 rounded-lg ring-2 ring-[#007aff] ring-offset-2 ring-offset-white scale-110 transition-all cursor-pointer flex items-center justify-center'
      : 'w-9 h-9 rounded-lg opacity-60 hover:opacity-100 cursor-pointer transition-all'
    : (isSelected: boolean) => isSelected
      ? 'w-10 h-10 rounded-lg ring-2 ring-white ring-offset-2 ring-offset-[#252525] scale-110 transition-all cursor-pointer flex items-center justify-center'
      : 'w-10 h-10 rounded-lg opacity-60 hover:opacity-100 cursor-pointer transition-all';

  const previewClass = isLight
    ? 'flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg'
    : 'flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10';

  const previewTextClass = isLight ? 'text-gray-900' : 'text-white';

  const previewCountClass = isLight ? 'text-xs text-gray-400 ml-auto' : 'text-xs text-slate-500 ml-auto';

  const footerClass = isLight
    ? 'flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50'
    : 'flex items-center justify-end gap-3 px-5 py-4 border-t border-white/10 bg-black/20';

  const cancelBtnClass = isLight
    ? 'px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors'
    : 'px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors';

  const submitBtnClass = isLight
    ? 'px-5 py-2 bg-[#007aff] hover:bg-[#0066d6] disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-all shadow-sm'
    : 'px-4 py-2 bg-primary hover:bg-primary/80 disabled:bg-white/10 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors';

  const getColorValue = (colorOption: string) => {
    const option = COLOR_OPTIONS.find(c => c.value === colorOption);
    return option?.class.replace('bg-[', '').replace(']', '') || '#007aff';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className={dialogClass}>
        <div className={headerClass}>
          <h2 className={titleClass}>
            {editTag ? 'Edit Tag' : 'Create New Tag'}
          </h2>
          <button
            onClick={onClose}
            className={closeBtnClass}
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className={labelClass}>
              Tag Name <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter tag name..."
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label className={labelClass}>
              Parent Tag
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className={selectClass}
            >
              <option value="">No parent (root level)</option>
              {tags.filter(t => !t.parentId).map(tag => {
                if (editTag && tag.id === editTag.id) return null;
                return (
                  <React.Fragment key={tag.id}>
                    <option value={tag.id}>{tag.name}</option>
                    {renderTagOptions(tag.id, 1)}
                  </React.Fragment>
                );
              })}
            </select>
          </div>

          <div>
            <label className={labelClass}>
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setColor(option.value)}
                  className={`${option.class} ${colorBtnClass(color === option.value)}`}
                  title={option.label}
                >
                  {color === option.value && (
                    <Icon name="check" className="text-white text-sm" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Preview
            </label>
            <div className={previewClass}>
              <Icon
                name="label"
                className="text-lg"
                style={{ color: getColorValue(color) }}
              />
              <span className={previewTextClass}>{name || 'Tag Name'}</span>
              <span className={previewCountClass}>0 items</span>
            </div>
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
            disabled={!name.trim()}
            className={submitBtnClass}
          >
            {editTag ? 'Save Changes' : 'Create Tag'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateTagDialog;
