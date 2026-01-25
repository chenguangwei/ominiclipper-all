import { ColorMode } from '../../types';
import { storageState } from './state';
import { scheduleSettingsWrite } from './persistence';

export const getSettings = () => {
    if (!storageState.settingsCache) {
        // Safe fallback if called before init (shouldn't happen but TS safe)
        return { themeId: 'blue', colorMode: 'dark', customStoragePath: null };
    }
    return storageState.settingsCache;
};

export const setThemeId = (id: string) => {
    if (storageState.settingsCache) {
        storageState.settingsCache.themeId = id;
        scheduleSettingsWrite();
    }
};

export const setColorMode = (mode: ColorMode) => {
    if (storageState.settingsCache) {
        storageState.settingsCache.colorMode = mode;
        scheduleSettingsWrite();
    }
};

export const getRecentFiles = (): string[] => {
    return storageState.settingsCache?.recentFiles || [];
};

export const setRecentFiles = (files: string[]) => {
    if (storageState.settingsCache) {
        storageState.settingsCache.recentFiles = files;
        scheduleSettingsWrite();
    }
};

export const getFavoriteFolders = (): string[] => {
    return storageState.settingsCache?.favoriteFolders || [];
};

export const setFavoriteFolders = (folders: string[]) => {
    if (storageState.settingsCache) {
        storageState.settingsCache.favoriteFolders = folders;
        scheduleSettingsWrite();
    }
};

export const setCustomStoragePath = (path: string | null) => {
    if (storageState.settingsCache) {
        storageState.settingsCache.customStoragePath = path;
        scheduleSettingsWrite();
    }
};
