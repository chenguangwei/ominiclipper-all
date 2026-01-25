import { ResourceItem, Tag, Folder, FilterState } from '../../types';

export interface LibraryData {
    version: number;
    lastModified: string;
    items: ResourceItem[];
    tags: Tag[];
    folders: Folder[];
}

export interface SettingsData {
    version: number;
    colorMode: string;
    themeId: string;
    locale: string;
    customStoragePath: string | null;
    viewMode: string;
    filterState: FilterState;
    recentFiles: any[];
    favoriteFolders: string[];
}

export const STORAGE_KEYS = {
    ITEMS: 'omniclipper_items',
    TAGS: 'omniclipper_tags',
    FOLDERS: 'omniclipper_folders',
    FILTER_STATE: 'omniclipper_filter_state',
    VIEW_MODE: 'omniclipper_view_mode',
    COLOR_MODE: 'app_color_mode',
    THEME_ID: 'app_theme_id',
    STORAGE_PATH: 'omniclipper_storage_path',
    RECENT_FILES: 'omniclipper_recent_files',
    FAVORITE_FOLDERS: 'omniclipper_favorite_folders',
    LOCALE: 'LOCALE_KEY',
};
