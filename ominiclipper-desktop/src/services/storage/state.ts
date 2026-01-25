import { LibraryData, SettingsData } from './types';

// Singleton state holder
class MStorageState {
    public libraryCache: LibraryData | null = null;
    public settingsCache: SettingsData | null = null;
    public isElectronEnvironment = false;
    public isInitialized = false;

    constructor() { }
}

export const storageState = new MStorageState();
