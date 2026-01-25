/**
 * Storage Service Facade
 * 
 * This file aggregates the modularized storage services into a single API
 * to maintain backward compatibility with the rest of the application.
 */

import { vectorStoreService } from './vectorStoreService';

// Re-export core persistence logic
export * from './storage/persistence';

// Re-export domain logic
export * from './storage/items';
export { reindexAllItems } from './storage/items';
export * from './storage/tags_folders';
// Re-export settings
export * from './storage/settings';
export { setCustomStoragePath } from './storage/settings';

// Export vector store initialization which was previously part of storageService
export const initVectorStore = async () => {
  return vectorStoreService.initialize();
};

// Export legacy types if needed by consumers (though they should import from types/index.ts)
// export * from './storage/types';
