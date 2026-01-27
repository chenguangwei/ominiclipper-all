import { useState, useEffect } from 'react';
import * as storageService from '@/services/storageService';
import { runMigrations } from '@/services/migrationService';
import { APP_THEMES } from '@/constants';
import { ResourceItem, Tag, Folder, ColorMode } from '@/types';
import { getLocale } from '@/services/i18n';
import aiClassifier from '@/services/aiClassifier';
import { llmProviderService } from '@/services/llmProvider';

export const useAppInit = (
    setItems: (items: ResourceItem[]) => void,
    setTags: (tags: Tag[]) => void,
    setFolders: (folders: Folder[]) => void
) => {
    const [isStorageReady, setIsStorageReady] = useState(false);
    const [currentThemeId, setCurrentThemeId] = useState<string>('blue');
    const [colorMode, setColorModeState] = useState<ColorMode>('dark');
    const [customStoragePath, setCustomStoragePath] = useState<string | null>(null);

    // Internal function to apply theme CSS without saving
    const applyThemeInternal = (themeId: string) => {
        const theme = APP_THEMES.find(t => t.id === themeId);
        if (theme) {
            document.documentElement.style.setProperty('--color-primary', theme.rgb);
        }
    };

    // Internal function to apply color mode CSS without saving
    const applyColorModeInternal = (mode: ColorMode) => {
        const html = document.documentElement;
        let effectiveMode = mode;

        if (mode === 'system') {
            effectiveMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        if (effectiveMode === 'dark') {
            html.classList.add('dark');
            html.classList.remove('light');
        } else {
            html.classList.remove('dark');
            html.classList.add('light');
        }
    };

    // Initialize storage service (async)
    useEffect(() => {
        const initApp = async () => {
            console.log('[App] Initializing storage...');
            await storageService.initStorage();

            // Load data from storage after initialization
            setItems(storageService.getItems());
            setTags(storageService.getTags());
            setFolders(storageService.getFolders());

            // Load settings
            const settings = storageService.getSettings();
            setColorModeState(settings.colorMode as ColorMode);
            setCurrentThemeId(settings.themeId);
            setCustomStoragePath(settings.customStoragePath);

            // Initialize AI Classifier
            const savedProvider = (localStorage.getItem('OMNICLIPPER_DEFAULT_PROVIDER') as any) || 'openai';
            const savedModel = localStorage.getItem('OMNICLIPPER_DEFAULT_MODEL') || llmProviderService.getDefaultModel(savedProvider);
            const apiKey = llmProviderService.getApiKey(savedProvider);

            if (apiKey) {
                console.log('[App] Configuring AI Classifier with provider:', savedProvider);
                aiClassifier.configure({
                    provider: savedProvider,
                    model: savedModel,
                    apiKey: apiKey
                });
            } else {
                console.log('[App] AI Classifier not configured (no API key)');
            }

            // Apply theme and color mode (internal versions, don't save back)
            applyThemeInternal(settings.themeId);
            applyColorModeInternal(settings.colorMode as ColorMode);

            setIsStorageReady(true);
            console.log('[App] Storage initialized successfully');

            // Run data migrations (async, non-blocking)
            runMigrations().then(() => {
                // Refresh items after migration in case localPath was updated
                setItems(storageService.getItems());
                console.log('[App] Migrations complete');
            }).catch(e => {
                console.error('[App] Migration error:', e);
            });

            // Initialize vector store for semantic search (async, non-blocking)
            storageService.initVectorStore().then(success => {
                if (success) {
                    console.log('[App] Vector store ready for semantic search');
                }
            });
        };

        initApp();

        // Initialize i18n log
        console.log('Current locale:', getLocale());

        // Add beforeunload handler to flush pending writes when page is closed
        // This is more reliable than useEffect cleanup in dev mode (HMR, Ctrl+C)
        const handleBeforeUnload = () => {
            console.log('[App] beforeunload: flushing pending writes...');
            storageService.flushPendingWrites();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Cleanup: flush pending writes on unmount
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            storageService.flushPendingWrites();
        };
    }, []);

    // Listen for system preference changes (color mode)
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (colorMode === 'system') {
                applyColorModeInternal('system');
            }
        };
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [colorMode]);

    // Public methods to change theme/mode
    const applyTheme = (themeId: string) => {
        applyThemeInternal(themeId);
        setCurrentThemeId(themeId);
        storageService.setThemeId(themeId);
    };

    const applyColorMode = (mode: ColorMode) => {
        applyColorModeInternal(mode);
        setColorModeState(mode);
        storageService.setColorMode(mode);
    };

    const updateStoragePath = (path: string | null) => {
        setCustomStoragePath(path);
        storageService.setCustomStoragePath(path);
    };

    return {
        isStorageReady,
        currentThemeId,
        colorMode,
        customStoragePath,
        applyTheme,
        applyColorMode,
        setStoragePath: updateStoragePath
    };
};
