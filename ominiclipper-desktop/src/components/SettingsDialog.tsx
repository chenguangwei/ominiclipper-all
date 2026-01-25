import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import * as storageService from '../services/storageService';
import { llmProviderService } from '../services/llmProvider';
import { LLMProviderType } from '../types/classification';
import { ColorMode } from '../types';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
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
  const { t, i18n } = useTranslation();

  const [localStoragePath, setLocalStoragePath] = useState<string | null>(storagePath);

  // AI Settings State
  const [selectedProvider, setSelectedProvider] = useState<LLMProviderType>('openai');
  const [selectedModel, setSelectedModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [customApiUrl, setCustomApiUrl] = useState('');

  useEffect(() => {
    setLocalStoragePath(storagePath);
  }, [storagePath]);

  // Load AI settings on open
  useEffect(() => {
    if (isOpen) {
      const savedProvider = (localStorage.getItem('OMNICLIPPER_DEFAULT_PROVIDER') as LLMProviderType) || 'openai';
      setSelectedProvider(savedProvider);

      const savedModel = localStorage.getItem('OMNICLIPPER_DEFAULT_MODEL') || llmProviderService.getDefaultModel(savedProvider);
      setSelectedModel(savedModel);

      setApiKey(llmProviderService.getApiKey(savedProvider));
      setCustomApiUrl(localStorage.getItem('OMNICLIPPER_CUSTOM_API_URL') || '');
    }
  }, [isOpen]);

  // Update API key and default model when provider changes (only if model not valid for provider)
  useEffect(() => {
    setApiKey(llmProviderService.getApiKey(selectedProvider));
    const validModels = llmProviderService.getModels(selectedProvider);
    if (selectedProvider !== 'custom' && !validModels.includes(selectedModel)) {
      setSelectedModel(validModels[0] || '');
    }
  }, [selectedProvider]);

  if (!isOpen) return null;

  const handleSelectStoragePath = async () => {
    const electronAPI = (window as any).electronAPI;

    if (electronAPI?.selectDirectory) {
      try {
        const result = await electronAPI.selectDirectory(t('settings.selectDataStorageDirectory'));
        if (result.success && result.path) {
          setLocalStoragePath(result.path);
        }
      } catch (error) {
        console.error('selectDirectory error:', error);
      }
    } else {
      alert(t('settings.desktopAppOnly'));
    }
  };

  const handleSave = () => {
    // Save Storage Path
    onStoragePathChange(localStoragePath);

    // Save AI Settings
    localStorage.setItem('OMNICLIPPER_DEFAULT_PROVIDER', selectedProvider);
    localStorage.setItem('OMNICLIPPER_DEFAULT_MODEL', selectedModel);
    if (apiKey) {
      llmProviderService.saveApiKey(selectedProvider, apiKey);
    }
    if (customApiUrl) {
      localStorage.setItem('OMNICLIPPER_CUSTOM_API_URL', customApiUrl);
    }

    // Notify components that might be listening (quick hack for now)
    window.dispatchEvent(new Event('storage'));

    onClose();
  };

  const handleResetStoragePath = () => {
    setLocalStoragePath(null);
  };

  const getDefaultStoragePath = () => {
    if ((window as any).electronAPI?.getUserDataPath) {
      return (window as any).electronAPI.getUserDataPath();
    }
    return 'Application Data/OmniCollector';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-[500px] max-w-[90vw] max-h-[90vh] flex flex-col bg-surface-secondary rounded-xl shadow-2xl border border-[rgb(var(--color-border)/var(--border-opacity))] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgb(var(--color-border)/var(--border-opacity))] shrink-0">
          <h2 className="text-lg font-semibold text-content flex items-center gap-2">
            <Icon name="settings" className="text-[20px]" />
            {t('settings.title')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-tertiary transition-colors"
          >
            <Icon name="close" className="text-[20px] text-content-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Appearance */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-content-secondary">{t('settings.appearance')}</label>
              <select
                className="bg-surface-secondary border border-[rgb(var(--color-border)/0.2)] rounded-lg px-2 py-1 text-xs text-content outline-none focus:border-primary"
                value={i18n.language}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="zh">中文</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {(['dark', 'light', 'system'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onColorModeChange(mode)}
                  className={`flex flex - col items - center gap - 2 p - 3 rounded - lg border transition - all ${colorMode === mode
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-surface-tertiary/50 border-transparent hover:bg-surface-tertiary text-content-secondary'
                    } `}
                >
                  <Icon
                    name={
                      mode === 'dark'
                        ? 'dark_mode'
                        : mode === 'light'
                          ? 'light_mode'
                          : 'brightness_auto'
                    }
                    className="text-[24px]"
                  />
                  <span className="text-xs capitalize">{t(`settings.theme.${mode}`)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Storage Location */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-content-secondary">{t('settings.storage_location')}</label>
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-surface-tertiary/50 border border-[rgb(var(--color-border)/0.1)]">
                <div className="flex items-center gap-3 mb-2">
                  <Icon name="folder" className="text-[20px] text-primary" />
                  <span className="text-sm text-content">
                    {localStoragePath || t('settings.default_location')}
                  </span>
                </div>
                <p className="text-xs text-content-secondary ml-8">
                  {localStoragePath
                    ? t('settings.custom_storage_desc')
                    : `${t('settings.default_storage_desc')}${getDefaultStoragePath()}`}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSelectStoragePath}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium transition-colors"
                >
                  <Icon name="folder_open" className="text-[18px]" />
                  {t('settings.choose_directory')}
                </button>
                {localStoragePath && (
                  <button
                    onClick={handleResetStoragePath}
                    className="px-4 py-2 rounded-lg bg-surface-tertiary hover:bg-surface-tertiary/80 text-content font-medium transition-colors"
                  >
                    {t('settings.reset')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-3 pt-4 border-t border-[rgb(var(--color-border)/0.1)]">
            <label className="text-sm font-medium text-content-secondary">{t('settings.advanced')}</label>
            <div className="p-4 rounded-lg bg-surface-tertiary/50 border border-[rgb(var(--color-border)/0.1)] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-content">{t('settings.search_index')}</div>
                  <div className="text-xs text-content-secondary">{t('settings.search_index_desc')}</div>
                </div>
                <button
                  onClick={async () => {
                    const btn = document.getElementById('btn-reindex');
                    if (btn) {
                      btn.innerText = t('settings.indexing');
                      (btn as HTMLButtonElement).disabled = true;
                    }
                    try {
                      await storageService.reindexAllItems((current, total) => {
                        if (btn) btn.innerText = `${t('settings.indexing')} ${current}/${total}...`;
                      });
                      if (btn) btn.innerText = t('settings.completed');
                      setTimeout(() => {
                        if (btn) {
                          btn.innerText = t('settings.rebuild_index');
                          (btn as HTMLButtonElement).disabled = false;
                        }
                      }, 2000);
                    } catch (e) {
                      console.error(e);
                      if (btn) btn.innerText = t('settings.failed');
                    }
                  }}
                  id="btn-reindex"
                  className="px-3 py-1.5 rounded-lg bg-surface-secondary border border-[rgb(var(--color-border)/0.2)] hover:bg-surface-tertiary text-xs font-medium text-content transition-colors"
                >
                  {t('settings.rebuild_index')}
                </button >
              </div >
            </div >
          </div >

          {/* AI Settings */}
          <div className="space-y-3 pt-4 border-t border-[rgb(var(--color-border)/0.1)]">
            <label className="text-sm font-medium text-content-secondary">{t('settings.ai_config')}</label>
            <div className="p-4 rounded-lg bg-surface-tertiary/50 border border-[rgb(var(--color-border)/0.1)] space-y-4">

              {/* Provider Selection */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-content">{t('settings.provider')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="bg-surface-secondary border border-[rgb(var(--color-border)/0.2)] rounded-lg px-3 py-2 text-sm text-content outline-none focus:border-primary"
                    value={selectedProvider}
                    onChange={(e) => {
                      const newProvider = e.target.value as LLMProviderType;
                      setSelectedProvider(newProvider);
                      // Reset model when provider changes
                      const defaultModel = llmProviderService.getDefaultModel(newProvider);
                      setSelectedModel(defaultModel);
                    }}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="siliconflow">SiliconFlow</option>
                    <option value="custom">Custom</option>
                  </select>

                  {/* Model Selection */}
                  <div className="relative">
                    {selectedProvider === 'custom' ? (
                      <input
                        type="text"
                        placeholder={t('settings.model_name_placeholder')}
                        className="w-full bg-surface-secondary border border-[rgb(var(--color-border)/0.2)] rounded-lg px-3 py-2 text-sm text-content outline-none focus:border-primary"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                      />
                    ) : (
                      <select
                        className="w-full bg-surface-secondary border border-[rgb(var(--color-border)/0.2)] rounded-lg px-3 py-2 text-sm text-content outline-none focus:border-primary"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                      >
                        {llmProviderService.getModels(selectedProvider).map(model => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Embedding Model Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-content">{t('settings.embedding_model')}</label>
                  <select
                    className="bg-surface-secondary border border-[rgb(var(--color-border)/0.2)] rounded-lg px-3 py-1.5 text-xs text-content outline-none focus:border-primary"
                    defaultValue={localStorage.getItem('OMNICLIPPER_EMBEDDING_MODEL') || 'all-MiniLM-L6-v2'}
                    onChange={async (e) => {
                      const modelId = e.target.value;
                      if (confirm(t('settings.confirm_embedding_switch'))) {
                        localStorage.setItem('OMNICLIPPER_EMBEDDING_MODEL', modelId);
                        try {
                          await (window as any).electronAPI.invoke('vector:setModel', { modelId });
                          alert(t('settings.embedding_switch_success'));
                        } catch (err) {
                          console.error('Failed to switch embedding model:', err);
                          alert(t('settings.embedding_switch_fail') + err);
                        }
                      } else {
                        e.target.value = localStorage.getItem('OMNICLIPPER_EMBEDDING_MODEL') || 'all-MiniLM-L6-v2';
                      }
                    }}
                  >
                    <option value="all-MiniLM-L6-v2">all-MiniLM-L6-v2 (Fast, Default)</option>
                    <option value="bge-m3">BAAI/bge-m3 (High Precision, Multi-lingual)</option>
                  </select>
                </div>
                <p className="text-[10px] text-content-secondary mt-1">
                  {t('settings.embedding_note')}
                </p>
              </div>

              {/* Custom Base URL */}
              {selectedProvider === 'custom' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-content">{t('settings.custom_api_url')}</label>
                  <input
                    type="text"
                    placeholder={t('settings.custom_api_url_placeholder')}
                    className="w-full bg-surface-secondary border border-[rgb(var(--color-border)/0.2)] rounded-lg px-3 py-2 text-sm text-content outline-none focus:border-primary"
                    value={customApiUrl}
                    onChange={(e) => setCustomApiUrl(e.target.value)}
                  />
                </div>
              )}

              {/* API Key Input */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-content">{t('settings.api_key')}</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder={t('settings.api_key_placeholder', { provider: selectedProvider })}
                    className="w-full bg-surface-secondary border border-[rgb(var(--color-border)/0.2)] rounded-lg px-3 py-2 text-sm text-content outline-none focus:border-primary pr-8"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Icon name="key" className="text-[14px] text-content-secondary" />
                  </div>
                </div>
                <p className="text-[10px] text-content-secondary">
                  {t('settings.api_key_note')}
                </p>
              </div>
            </div>
          </div >

          {/* About */}
          < div className="pt-4 border-t border-[rgb(var(--color-border)/0.1)]" >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Icon name="library_books" className="text-[20px] text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-content">OmniCollector</h3>
                <p className="text-xs text-content-secondary">
                  {t('settings.about_desc', { version: '1.0.0' })}
                </p>
              </div>
            </div>
          </div >
        </div >

        {/* Footer */}
        < div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgb(var(--color-border)/var(--border-opacity))] shrink-0" >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-tertiary hover:bg-surface-tertiary/80 text-content font-medium transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium transition-colors"
          >
            {t('common.save')}
          </button>
        </div >
      </div >
    </div >
  );
};

export default SettingsDialog;
