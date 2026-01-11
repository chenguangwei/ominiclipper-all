import React, { useState } from 'react';
import Icon from './Icon';
import { FileStorageMode } from '../types';
import { formatFileSize } from '../services/fileManager';

interface FileDropDialogProps {
  isOpen: boolean;
  file: File | null;
  onClose: () => void;
  onConfirm: (mode: FileStorageMode) => void;
}

const FileDropDialog: React.FC<FileDropDialogProps> = ({
  isOpen,
  file,
  onClose,
  onConfirm,
}) => {
  const [selectedMode, setSelectedMode] = useState<FileStorageMode>('embed');

  if (!isOpen || !file) return null;

  const fileSize = formatFileSize(file.size);
  const isLargeFile = file.size > 5 * 1024 * 1024; // 5MB threshold

  // Get file type icon
  const getFileIcon = () => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return 'picture_as_pdf';
      case 'doc':
      case 'docx':
        return 'description';
      case 'epub':
        return 'auto_stories';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return 'image';
      default:
        return 'article';
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedMode);
    setSelectedMode('embed'); // Reset for next time
  };

  const handleClose = () => {
    setSelectedMode('embed'); // Reset for next time
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md bg-[#252525] rounded-xl shadow-2xl border border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/20">
              <Icon name="upload_file" className="text-xl text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-white">Import File</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        {/* File Info */}
        <div className="p-5">
          <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg mb-5">
            <Icon name={getFileIcon()} className="text-[32px] text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{file.name}</p>
              <p className="text-xs text-slate-400">{fileSize}</p>
            </div>
          </div>

          {/* Storage Mode Selection */}
          <h3 className="text-sm font-medium text-white mb-3">Storage Mode</h3>

          <div className="space-y-2">
            {/* Embed Mode */}
            <button
              onClick={() => setSelectedMode('embed')}
              className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                selectedMode === 'embed'
                  ? 'border-primary bg-primary/10'
                  : 'border-white/10 bg-black/20 hover:bg-black/30'
              }`}
            >
              <Icon name="file_copy" className="text-[24px] text-primary mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">Embed File Content</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Store file data in library. Works offline, but uses more storage.
                </p>
              </div>
              {selectedMode === 'embed' && (
                <Icon name="check_circle" className="text-primary" />
              )}
            </button>

            {/* Reference Mode */}
            <button
              onClick={() => setSelectedMode('reference')}
              className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                selectedMode === 'reference'
                  ? 'border-primary bg-primary/10'
                  : 'border-white/10 bg-black/20 hover:bg-black/30'
              }`}
            >
              <Icon name="link" className="text-[24px] text-primary mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">Store Path Only</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Keep reference to original file. Saves storage, but requires file access.
                </p>
              </div>
              {selectedMode === 'reference' && (
                <Icon name="check_circle" className="text-primary" />
              )}
            </button>
          </div>

          {/* Large file warning */}
          {isLargeFile && selectedMode === 'embed' && (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-400 flex items-center gap-1.5">
                <Icon name="warning" className="text-[16px]" />
                Large file may slow down the app. Consider using "Store Path Only".
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/10 bg-black/20">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-white text-sm font-medium rounded-lg bg-primary hover:bg-primary/80 transition-colors"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileDropDialog;
