import React, { useState, useEffect } from 'react';
import Icon from './Icon';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  colorMode: 'dark' | 'light' | 'system';
  onColorModeChange: (mode: 'dark' | 'light' | 'system') => void;
  storagePath: string | null;
  onStoragePathChange: (path: string | null) => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen,
  onClose,
  colorMode,
  onColorModeChange,
  storagePath,
  onStoragePathChange,
}) => {
  const [localStoragePath, setLocalStoragePath] = useState<string | null>(storagePath);

  useEffect(() => {
    setLocalStoragePath(storagePath);
  }, [storagePath]);

  if (!isOpen) return null;

  const handleSelectStoragePath = async () => {
    const electronAPI = (window as any).electronAPI;
    console.log('electronAPI:', electronAPI);
    console.log('selectDirectory:', electronAPI?.selectDirectory);

    if (electronAPI?.selectDirectory) {
      try {
        const result = await electronAPI.selectDirectory('Select Data Storage Directory');
        console.log('selectDirectory result:', result);
        if (result.success && result.path) {
          setLocalStoragePath(result.path);
        }
      } catch (error) {
        console.error('selectDirectory error:', error);
      }
    } else {
      console.warn('selectDirectory not available - not running in Electron or API not exposed');
      alert('This feature is only available in the desktop app');
    }
  };

  const handleSave = () => {
    onStoragePathChange(localStoragePath);
    onClose();
  };

  const handleResetStoragePath = () => {
    setLocalStoragePath(null);
  };

  const getDefaultStoragePath = () => {
    if ((window as any).electronAPI?.getUserDataPath) {
      return (window as any).electronAPI.getUserDataPath();
    }
    return 'Application Data/OmniClipper';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-[500px] max-w-[90vw] bg-surface-secondary rounded-xl shadow-2xl border border-[rgb(var(--color-border)/var(--border-opacity))] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgb(var(--color-border)/var(--border-opacity))]">
          <h2 className="text-lg font-semibold text-content flex items-center gap-2">
            <Icon name="settings" className="text-[20px]" />
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-tertiary transition-colors"
          >
            <Icon name="close" className="text-[20px] text-content-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Appearance */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-content-secondary">Appearance</label>
            <div className="grid grid-cols-3 gap-3">
              {(['dark', 'light', 'system'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onColorModeChange(mode)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                    colorMode === mode
                      ? 'bg-primary/20 border-primary/50 ring-2 ring-primary/30'
                      : 'bg-surface-tertiary/50 border-transparent hover:bg-surface-tertiary'
                  }`}
                >
                  <Icon
                    name={
                      mode === 'dark'
                        ? 'dark_mode'
                        : mode === 'light'
                        ? 'light_mode'
                        : 'brightness_auto'
                    }
                    className={`text-[24px] ${colorMode === mode ? 'text-primary' : 'text-content-secondary'}`}
                  />
                  <span className={`text-xs capitalize ${colorMode === mode ? 'text-primary' : 'text-content-secondary'}`}>
                    {mode}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Storage Location */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-content-secondary">Data Storage Location</label>
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-surface-tertiary/50 border border-[rgb(var(--color-border)/0.1)]">
                <div className="flex items-center gap-3 mb-2">
                  <Icon name="folder" className="text-[20px] text-primary" />
                  <span className="text-sm text-content">
                    {localStoragePath || 'Default Location'}
                  </span>
                </div>
                <p className="text-xs text-content-secondary ml-8">
                  {localStoragePath
                    ? 'Custom storage directory for imported files'
                    : `Default: ${getDefaultStoragePath()}`}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSelectStoragePath}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium transition-colors"
                >
                  <Icon name="folder_open" className="text-[18px]" />
                  Choose Directory
                </button>
                {localStoragePath && (
                  <button
                    onClick={handleResetStoragePath}
                    className="px-4 py-2 rounded-lg bg-surface-tertiary hover:bg-surface-tertiary/80 text-content font-medium transition-colors"
                  >
                    Reset to Default
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* About */}
          <div className="pt-4 border-t border-[rgb(var(--color-border)/0.1)]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Icon name="library_books" className="text-[20px] text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-content">OmniClipper</h3>
                <p className="text-xs text-content-secondary">
                  Version 1.0.0 - Your personal clipper manager
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgb(var(--color-border)/var(--border-opacity))]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-tertiary hover:bg-surface-tertiary/80 text-content font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsDialog;
