import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder, ColorMode } from '@/types';
import Icon from './Icon';

interface RenameFolderDialogProps {
  isOpen: boolean;
  folder: Folder;
  onConfirm: (folderId: string, newName: string) => Promise<boolean>;
  onCancel: () => void;
  colorMode?: ColorMode;
}

const RenameFolderDialog: React.FC<RenameFolderDialogProps> = ({
  isOpen,
  folder,
  onConfirm,
  onCancel,
  colorMode = 'dark',
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(folder.name);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isLight = colorMode === 'light';

  // Reset state when folder changes
  useEffect(() => {
    setName(folder.name);
    setError(null);
  }, [folder]);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError(t('rename_dialog.error_empty', '文件夹名称不能为空'));
      return;
    }

    if (name.trim() === folder.name) {
      onCancel();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const success = await onConfirm(folder.id, name.trim());
      if (!success) {
        setError(t('rename_dialog.error_failed', '重命名失败'));
      }
    } catch (err) {
      setError(t('rename_dialog.error_failed', '重命名失败'));
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
          relative w-[400px] rounded-xl shadow-2xl p-6
          ${isLight ? 'bg-white' : 'bg-[#1a1a1a]'}
        `}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`
            w-10 h-10 rounded-lg flex items-center justify-center
            ${isLight ? 'bg-gray-100' : 'bg-white/10'}
          `}>
            <Icon name="edit" className={`text-xl ${isLight ? 'text-gray-600' : 'text-gray-300'}`} />
          </div>
          <div>
            <h2 className={`text-lg font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>
              {t('rename_dialog.title', '重命名文件夹')}
            </h2>
            <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
              {t('rename_dialog.subtitle', '输入新的文件夹名称')}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('rename_dialog.placeholder', '文件夹名称')}
              className={`
                w-full px-4 py-3 rounded-lg text-sm
                border transition-colors
                ${isLight
                  ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-primary focus:ring-1 focus:ring-primary'
                  : 'bg-white/5 border-white/10 text-white focus:border-primary focus:ring-1 focus:ring-primary'
                }
                outline-none
              `}
              disabled={isSubmitting}
            />
            {error && (
              <p className="mt-2 text-sm text-red-500">{error}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
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
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium
                bg-primary text-white
                transition-colors
                hover:bg-primary/90
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {isSubmitting ? t('common.saving', '保存中...') : t('common.save', '保存')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RenameFolderDialog;
