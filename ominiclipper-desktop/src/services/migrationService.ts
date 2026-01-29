/**
 * Migration Service
 *
 * Handles one-time data migrations for the application.
 * Primarily used to migrate embedded files to disk storage for better file management.
 */

import { ResourceItem, ResourceType } from '../types';
import * as storageService from './storageService';

// Migration version key for localStorage
const MIGRATION_VERSION_KEY = 'omnicollector_migration_version';
const CURRENT_MIGRATION_VERSION = 1;

/**
 * Get file extension based on resource type
 */
function getFileExtension(type: ResourceType): string {
  switch (type) {
    case ResourceType.PDF: return '.pdf';
    case ResourceType.WORD: return '.docx';
    case ResourceType.EPUB: return '.epub';
    case ResourceType.IMAGE: return '.png';
    case ResourceType.MARKDOWN: return '.md';
    case ResourceType.PPT: return '.pptx';
    case ResourceType.EXCEL: return '.xlsx';
    default: return '';
  }
}

/**
 * Check if migration has already been run
 */
function getMigrationVersion(): number {
  const version = localStorage.getItem(MIGRATION_VERSION_KEY);
  return version ? parseInt(version, 10) : 0;
}

/**
 * Set migration version after successful migration
 */
function setMigrationVersion(version: number): void {
  localStorage.setItem(MIGRATION_VERSION_KEY, version.toString());
}

/**
 * Migrate embedded files to disk storage
 *
 * For items that have embeddedData but no localPath, this function:
 * 1. Decodes the embedded base64 data
 * 2. Saves it to the managed storage directory
 * 3. Updates the item with the new localPath
 */
export async function migrateEmbeddedFilesToDisk(): Promise<{ migrated: number; failed: number }> {
  const items = storageService.getItemsAsResourceItems();
  let migrated = 0;
  let failed = 0;

  // Check if we're in Electron and have the saveEmbeddedFile API
  const electronAPI = (window as any).electronAPI;
  if (!electronAPI?.saveEmbeddedFile) {
    console.log('[Migration] saveEmbeddedFile API not available, skipping migration');
    return { migrated: 0, failed: 0 };
  }

  console.log(`[Migration] Starting embedded file migration for ${items.length} items...`);

  for (const item of items) {
    // Skip items that don't need migration
    if (!item.embeddedData) continue;
    if (item.localPath && item.localPath.startsWith('/')) continue;
    if (item.path && item.path.startsWith('/')) continue;

    console.log(`[Migration] Migrating item: ${item.title} (${item.id})`);

    try {
      const extension = getFileExtension(item.type);
      const fileName = `${item.title}${extension}`;

      const result = await electronAPI.saveEmbeddedFile(
        item.embeddedData,
        fileName,
        item.id
      );

      if (result.success && result.targetPath) {
        // Update the item with the new localPath
        await storageService.updateItem(item.id, {
          localPath: result.targetPath,
          path: result.targetPath
        });
        migrated++;
        console.log(`[Migration] Successfully migrated: ${item.title} -> ${result.targetPath}`);
      } else {
        console.warn(`[Migration] Failed to save embedded file for: ${item.title}`, result.error);
        failed++;
      }
    } catch (e) {
      console.error(`[Migration] Error migrating item ${item.title}:`, e);
      failed++;
    }
  }

  // Flush pending writes to ensure data is persisted
  await storageService.flushPendingWrites();

  console.log(`[Migration] Complete: ${migrated} migrated, ${failed} failed`);
  return { migrated, failed };
}

/**
 * Run all pending migrations
 *
 * Should be called on app startup after storage is initialized.
 */
export async function runMigrations(): Promise<void> {
  const currentVersion = getMigrationVersion();
  console.log(`[Migration] Current migration version: ${currentVersion}`);

  if (currentVersion >= CURRENT_MIGRATION_VERSION) {
    console.log('[Migration] All migrations already applied');
    return;
  }

  // Migration 1: Embedded files to disk
  if (currentVersion < 1) {
    console.log('[Migration] Running migration 1: Embedded files to disk');
    const result = await migrateEmbeddedFilesToDisk();
    if (result.migrated > 0 || result.failed === 0) {
      setMigrationVersion(1);
    }
  }

  console.log('[Migration] All migrations complete');
}
