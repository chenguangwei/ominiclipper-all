import React from 'react';
import Icon from './Icon';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-sm bg-[#252525] rounded-xl shadow-2xl border border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${confirmVariant === 'danger' ? 'bg-red-500/20' : 'bg-primary/20'}`}>
              <Icon
                name={confirmVariant === 'danger' ? 'warning' : 'help'}
                className={`text-xl ${confirmVariant === 'danger' ? 'text-red-500' : 'text-primary'}`}
              />
            </div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <p className="text-slate-300 text-sm">{message}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/10 bg-black/20">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
              confirmVariant === 'danger'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-primary hover:bg-primary/80'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
