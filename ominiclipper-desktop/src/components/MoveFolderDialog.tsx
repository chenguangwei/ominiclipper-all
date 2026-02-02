import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder, ColorMode } from '@/types';
import Icon from './Icon';
import { flattenFolderTree, validateFolderMove } from '@/services/folderOperations';

interface MoveFolderDialogProps {
  isOpen: boolean;
  folder: Folder;
  folders: Folder[];
  onConfirm: (folderId: string, targetParentId: string | undefined) => Promise<boolean>;
  onCancel: () => void;
  colorMode?: ColorMode;
}

const MoveFolderDialog: React.FC<MoveFolderDialogProps> = ({
  isOpen,
  folder,
  folders,
  onConfirm,
  onCancel,
  colorMode = 'dark',
}) => {
  const { t } = useTranslation();
  const [selectedParentId, setSelectedParentId] = useState<string | undefined>(folder.parentId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLight = colorMode === 'light';

  // Get flattened folder tree excluding the moving folder and its descendants
  const availableFolders = useMemo(() => {
    return flattenFolderTree(folders, folder.id);
  }, [folders, folder.id]);

  const handleSubmit = async () => {
    // Validate move
    const validation = validateFolderMove(folder.id, selectedParentId, folders);
    if (!validation.valid) {
      setError(validation.error || t('move_dialog.error_invalid', '无效的移动操作'));
      return;
    }

    // Don't move if parent hasn't changed
    if (selectedParentId === folder.parentId) {
      onCancel();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const success = await onConfirm(folder.id, selectedParentId);
      if (!success) {
        setError(t('move_dialog.error_failed', '移动失败'));
      }
    } catch (err) {
      setError(t('move_dialog.error_failed', '移动失败'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className={`
          relative w-[450px] max-h-[80vh] rounded-xl shadow-2xl flex flex-col
          ${isLight ? 'bg-white' : 'bg-[#1a1a1a]'}
        `}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-6 pb-4">
          <div className={`
            w-10 h-10 rounded-lg flex items-center justify-center
            ${isLight ? 'bg-gray-100' : 'bg-white/10'}
          `}>
            <Icon name="drive_file_move" className={`text-xl ${isLight ? 'text-gray-600' : 'text-gray-300'}`} />
          </div>
          <div>
            <h2 className={`text-lg font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
              {t('move_dialog.title', '移动文件夹')}
            </h2>
            <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
              {t('move_dialog.subtitle', '选择目标位置')}：<span className="font-medium">{folder.name}</span>
            </p>
          </div>
        </div>

        {/* Folder List */}
        <div className={`
          flex-1 overflow-y-auto mx-6 mb-4 rounded-lg border
          ${isLight ? 'border-gray-200 bg-gray-50' : 'border-white/10 bg-white/5'}
        `}>
          {/* Root level option */}
          <button
            onClick={() => setSelectedParentId(undefined)}
            className={`
              w-full flex items-center gap-3 px-4 py-3 text-sm
              transition-colors border-b
              ${isLight ? 'border-gray-200' : 'border-white/10'}
              ${selectedParentId === undefined
                ? isLight
                  ? 'bg-primary/10 text-primary'
                  : 'bg-primary/20 text-primary'
                : isLight
                  ? 'text-gray-700 hover:bg-gray-100'
                  : 'text-gray-200 hover:bg-white/5'
              }
            `}
          >
            <Icon name="home" className="text-[18px]" />
            <span className="flex-1 text-left">{t('move_dialog.root_level', '根目录')}</span>
            {selectedParentId === undefined && (
              <Icon name="check" className="text-[18px] text-primary" />
            )}
          </button>

          {/* Folder tree */}
          {availableFolders.map(({ folder: f, depth }) => (
            <button
              key={f.id}
              onClick={() => setSelectedParentId(f.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 text-sm
                transition-colors border-b last:border-b-0
                ${isLight ? 'border-gray-200' : 'border-white/10'}
                ${selectedParentId === f.id
                  ? isLight
                    ? 'bg-primary/10 text-primary'
                    : 'bg-primary/20 text-primary'
                  : isLight
                    ? 'text-gray-700 hover:bg-gray-100'
                    : 'text-gray-200 hover:bg-white/5'
                }
              `}
              style={{ paddingLeft: `${16 + depth * 24}px` }}
            >
              <Icon
                name={f.icon || 'folder'}
                className="text-[18px]"
                style={f.color ? { color: f.color } : undefined}
              />
              <span className="flex-1 text-left truncate">{f.name}</span>
              {selectedParentId === f.id && (
                <Icon name="check" className="text-[18px] text-primary" />
              )}
            </button>
          ))}

          {availableFolders.length === 0 && (
            <div className={`
              px-4 py-8 text-center text-sm
              ${isLight ? 'text-gray-400' : 'text-gray-500'}
            `}>
              {t('move_dialog.no_folders', '没有可用的目标文件夹')}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-4 px-4 py-2 rounded-lg bg-red-500/10 text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 p-6 pt-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium
              transition-colors
              ${isLight
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-gray-300 hover:bg-white/10'
              }
            `}
          >
            {t('common.cancel', '取消')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedParentId === folder.parentId}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium
              bg-primary text-white
              transition-colors
              hover:bg-primary/90
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {isSubmitting ? t('common.moving', '移动中...') : t('common.move', '移动')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveFolderDialog;
