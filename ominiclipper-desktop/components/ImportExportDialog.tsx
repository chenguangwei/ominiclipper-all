/**
 * Import/Export Dialog
 * UI for importing and exporting data
 */

import React, { useState, useRef } from 'react';
import Icon from './Icon';
import * as storageService from '../services/storageService';

interface ImportExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentThemeId: string;
}

type DialogMode = 'import' | 'export';

const ImportExportDialog: React.FC<ImportExportDialogProps> = ({
  isOpen,
  onClose,
  currentThemeId
}) => {
  const [mode, setMode] = useState<DialogMode>('export');
  const [isDragOver, setIsDragOver] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExport = () => {
    try {
      let data: string;
      let filename: string;
      let mimeType: string;

      if (exportFormat === 'json') {
        data = storageService.exportData();
        filename = `omnicollector-export-${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      } else {
        // CSV export
        const items = storageService.getItems();
        const headers = ['ID', 'Title', 'Type', 'Tags', 'Folder', 'Color', 'Created At', 'Updated At', 'Path'];
        const rows = items.map(item => [
          item.id,
          `"${item.title.replace(/"/g, '""')}"`,
          item.type,
          `"${item.tags.join(', ')}"`,
          item.folderId || '',
          item.color,
          item.createdAt,
          item.updatedAt,
          item.path || ''
        ]);
        data = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        filename = `omnicollector-export-${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      }

      // Download file
      const blob = new Blob([data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: t('msg.exportSuccess') });
    } catch (e) {
      setMessage({ type: 'error', text: t('error.unknown') });
    }
  };

  const handleImport = () => {
    if (!importFile) {
      setMessage({ type: 'error', text: t('error.required') });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const success = storageService.importData(content);
        if (success) {
          setMessage({ type: 'success', text: t('msg.importSuccess') });
          // Refresh page after short delay
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          setMessage({ type: 'error', text: t('error.invalidFile') });
        }
      } catch (err) {
        setMessage({ type: 'error', text: t('error.invalidFile') });
      }
    };
    reader.readAsText(importFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.json') || file.name.endsWith('.csv')) {
        setImportFile(file);
        setMessage(null);
      } else {
        setMessage({ type: 'error', text: t('error.invalidFile') });
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setImportFile(files[0]);
      setMessage(null);
    }
  };

  const handleBrowserExtensionImport = () => {
    // Trigger file selection for browser extension export
    document.getElementById('browser-extension-input')?.click();
  };

  const handleBrowserExtensionFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const stats = storageService.getImportStats(content);
          if (stats) {
            const importedCount = storageService.importFromBrowserExtension(content);
            if (importedCount > 0) {
              setMessage({
                type: 'success',
                text: `Successfully synced ${importedCount} new items from browser extension!`
              });
              setTimeout(() => {
                window.location.reload();
              }, 1500);
            } else {
              setMessage({
                type: 'success',
                text: 'All items are already synced. No new items to import.'
              });
            }
          } else {
            setMessage({ type: 'error', text: t('error.invalidFile') });
          }
        } catch (err) {
          setMessage({ type: 'error', text: t('error.invalidFile') });
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-[#1e1e1e] rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-white/10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Icon name={mode === 'export' ? 'download' : 'upload'} className="text-primary" />
            <span className="font-medium text-white">
              {mode === 'export' ? t('dialog.exportData') : t('dialog.importData')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          <button
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              mode === 'export'
                ? 'text-primary border-b-2 border-primary'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => { setMode('export'); setMessage(null); setImportFile(null); }}
          >
            {t('action.export')}
          </button>
          <button
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              mode === 'import'
                ? 'text-primary border-b-2 border-primary'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => { setMode('import'); setMessage(null); }}
          >
            {t('action.import')}
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {mode === 'export' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Export your data to a file for backup or transfer.
              </p>

              <div>
                <label className="block text-xs text-slate-500 mb-2">Format</label>
                <div className="flex gap-2">
                  <button
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      exportFormat === 'json'
                        ? 'bg-primary/20 text-primary border border-primary/50'
                        : 'bg-[#2a2a2a] text-slate-400 border border-transparent hover:bg-[#333]'
                    }`}
                    onClick={() => setExportFormat('json')}
                  >
                    JSON
                  </button>
                  <button
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      exportFormat === 'csv'
                        ? 'bg-primary/20 text-primary border border-primary/50'
                        : 'bg-[#2a2a2a] text-slate-400 border border-transparent hover:bg-[#333]'
                    }`}
                    onClick={() => setExportFormat('csv')}
                  >
                    CSV
                  </button>
                </div>
              </div>

              <button
                onClick={handleExport}
                className="w-full py-2.5 rounded-lg bg-primary text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Icon name="download" className="text-[18px]" />
                {t('action.export')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Import data from a backup file. This will merge with existing data.
              </p>

              {/* Browser Extension Sync */}
              <div className="p-3 bg-[#252525] rounded-lg border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="extension" className="text-primary" />
                  <span className="text-sm font-medium text-slate-200">Browser Extension</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Import articles, images, and saved pages from the browser extension.
                </p>
                <button
                  onClick={handleBrowserExtensionImport}
                  className="w-full py-2 rounded-lg bg-[#2a2a2a] text-slate-300 text-sm font-medium hover:bg-[#333] transition-colors flex items-center justify-center gap-2"
                >
                  <Icon name="sync" className="text-[16px]" />
                  Sync from Browser Extension
                </button>
              </div>

              {/* Drop Zone */}
              <p className="text-sm text-slate-400 pt-2 border-t border-white/5">
                Or import from a backup file:
              </p>
              <div
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  isDragOver
                    ? 'border-primary bg-primary/10'
                    : 'border-white/10 hover:border-white/20'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon name="cloud_upload" className="text-3xl text-slate-500 mb-2 mx-auto" />
                <p className="text-sm text-slate-400">
                  {isDragOver ? t('action.drop') : t('action.dragDrop')}
                </p>
                <p className="text-xs text-slate-500 mt-1">JSON or CSV files</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {/* Hidden input for browser extension import */}
                <input
                  id="browser-extension-input"
                  type="file"
                  accept=".json"
                  onChange={handleBrowserExtensionFileSelect}
                  className="hidden"
                />
              </div>

              {importFile && (
                <div className="flex items-center gap-2 p-3 bg-[#2a2a2a] rounded-lg">
                  <Icon name="description" className="text-slate-400" />
                  <span className="flex-1 text-sm text-slate-300 truncate">
                    {importFile.name}
                  </span>
                  <button
                    onClick={() => setImportFile(null)}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <Icon name="close" className="text-[16px]" />
                  </button>
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={!importFile}
                className="w-full py-2.5 rounded-lg bg-primary text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Icon name="upload" className="text-[18px]" />
                {t('action.import')}
              </button>
            </div>
          )}

          {/* Message */}
          {message && (
            <div className={`mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              <Icon name={message.type === 'success' ? 'check_circle' : 'error'} className="text-[18px]" />
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function for translation
function t(key: string): string {
  // Simple translation function - in real app use the i18n service
  const en: Record<string, string> = {
    'msg.exportSuccess': 'Export successful!',
    'msg.importSuccess': 'Import successful!',
    'error.required': 'This field is required',
    'error.invalidFile': 'Invalid file',
    'error.unknown': 'An unknown error occurred',
    'action.export': 'Export',
    'action.import': 'Import',
    'action.drop': 'Drop file here',
    'action.dragDrop': 'Drag & Drop files here',
    'dialog.exportData': 'Export Data',
    'dialog.importData': 'Import Data',
  };
  return en[key] || key;
}

export default ImportExportDialog;
