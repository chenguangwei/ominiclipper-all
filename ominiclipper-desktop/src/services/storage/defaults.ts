import { INITIAL_TAGS, INITIAL_FOLDERS } from '../../constants';
import { SettingsData } from './types';

export const DEFAULTS = {
    get LIBRARY_CACHE() {
        return {
            version: 1,
            lastModified: new Date().toISOString(),
            items: [],
            tags: INITIAL_TAGS,
            folders: INITIAL_FOLDERS,
        };
    },
    get SETTINGS(): SettingsData {
        return {
            version: 1,
            colorMode: 'dark',
            themeId: 'blue',
            locale: 'en',
            customStoragePath: null,
            viewMode: 'list',
            filterState: { search: '', tagId: null, color: null, folderId: 'all' },
            recentFiles: [],
            favoriteFolders: [],
        };
    }
};
