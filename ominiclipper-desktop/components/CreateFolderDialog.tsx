import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { Folder, ColorMode } from '../types';

interface CreateFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (folder: Omit<Folder, 'id'>) => void;
  folders: Folder[];
  editFolder?: Folder | null;
  colorMode: ColorMode;
}

const ICON_OPTIONS = [
  { icon: 'folder', label: 'Folder' },
  { icon: 'folder_open', label: 'Open Folder' },
  { icon: 'work', label: 'Work' },
  { icon: 'lightbulb', label: 'Ideas' },
  { icon: 'palette', label: 'Design' },
  { icon: 'code', label: 'Code' },
  { icon: 'science', label: 'Research' },
  { icon: 'bookmark', label: 'Bookmark' },
  { icon: 'star', label: 'Star' },
  { icon: 'favorite', label: 'Favorite' },
  { icon: 'archive', label: 'Archive' },
  { icon: 'inventory_2', label: 'Storage' },
];

const CreateFolderDialog: React.FC<CreateFolderDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  folders,
  editFolder,
  colorMode,
}) => {
  const isLight = colorMode === 'light';
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [icon, setIcon] = useState('folder');

  useEffect(() => {
    if (editFolder) {
      setName(editFolder.name);
      setParentId(editFolder.parentId || '');
      setIcon(editFolder.icon || 'folder');
    } else {
      setName('');
      setParentId('');
      setIcon('folder');
    }
  }, [editFolder, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      parentId: parentId || undefined,
      icon,
    });

    onClose();
  };

  const renderFolderOptions = (parentFolderId?: string, level: number = 0): React.ReactNode => {
    const childFolders = folders.filter(f => f.parentId === parentFolderId);
    return childFolders.map(folder => {
      if (editFolder && (folder.id === editFolder.id)) {
        return null;
      }
      return (
        <React.Fragment key={folder.id}>
          <option value={folder.id}>
            {'  '.repeat(level)}{folder.name}
          </option>
          {renderFolderOptions(folder.id, level + 1)}
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

  const iconBtnClass = isLight
    ? (isSelected: boolean) => isSelected
      ? 'flex items-center justify-center p-2.5 rounded-lg border-2 border-[#007aff] bg-[#007aff]/5 text-[#007aff] transition-all'
      : 'flex items-center justify-center p-2.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 transition-all'
    : (isSelected: boolean) => isSelected
      ? 'flex items-center justify-center p-2.5 rounded-lg border border-primary bg-primary/20 text-primary'
      : 'flex items-center justify-center p-2.5 rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all';

  const footerClass = isLight
    ? 'flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50'
    : 'flex items-center justify-end gap-3 px-5 py-4 border-t border-white/10 bg-black/20';

  const cancelBtnClass = isLight
    ? 'px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors'
    : 'px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors';

  const submitBtnClass = isLight
    ? 'px-5 py-2 bg-[#007aff] hover:bg-[#0066d6] disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-all shadow-sm'
    : 'px-4 py-2 bg-primary hover:bg-primary/80 disabled:bg-white/10 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className={dialogClass}>
        <div className={headerClass}>
          <h2 className={titleClass}>
            {editFolder ? 'Edit Folder' : 'Create New Folder'}
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
              Folder Name <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter folder name..."
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label className={labelClass}>
              Parent Folder
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className={selectClass}
            >
              <option value="">Root (No parent)</option>
              {folders.filter(f => !f.parentId).map(folder => {
                if (editFolder && folder.id === editFolder.id) return null;
                return (
                  <React.Fragment key={folder.id}>
                    <option value={folder.id}>{folder.name}</option>
                    {renderFolderOptions(folder.id, 1)}
                  </React.Fragment>
                );
              })}
            </select>
          </div>

          <div>
            <label className={labelClass}>
              Icon
            </label>
            <div className="grid grid-cols-6 gap-2">
              {ICON_OPTIONS.map(option => (
                <button
                  key={option.icon}
                  type="button"
                  onClick={() => setIcon(option.icon)}
                  className={iconBtnClass(icon === option.icon)}
                  title={option.label}
                >
                  <Icon name={option.icon} className="text-lg" />
                </button>
              ))}
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
            {editFolder ? 'Save Changes' : 'Create Folder'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateFolderDialog;
