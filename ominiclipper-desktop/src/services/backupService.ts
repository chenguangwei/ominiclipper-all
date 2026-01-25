/**
 * Backup Service
 * Handles automatic backups of library data (Eagle-style)
 *
 * Backup structure:
 * - backup/backup-YYYY-MM-DD HH.MM.SS.SSS.json
 *
 * Features:
 * - Automatic backup before critical writes
 * - Configurable retention (keep last N backups)
 * - Manual backup trigger
 * - Backup listing and restoration
 */

// Check if running in Electron
function isElectron(): boolean {
  return !!(window as any).electronAPI?.backupAPI;
}

// ============================================
// Types
// ============================================

export interface BackupInfo {
  path: string;
  fileName: string;
  timestamp: Date;
  size: number;
  itemCount: number;
}

export interface BackupConfig {
  autoBackup: boolean;
  maxBackups: number;
  minInterval: number; // Minimum interval between auto backups (ms)
}

// ============================================
// Default Config
// ============================================

const DEFAULT_CONFIG: BackupConfig = {
  autoBackup: true,
  maxBackups: 30, // Keep last 30 backups
  minInterval: 60000, // 1 minute minimum interval
};

// ============================================
// State
// ============================================

let lastBackupTime = 0;
let config: BackupConfig = DEFAULT_CONFIG;

// ============================================
// API Functions
// ============================================

/**
 * Configure backup service
 */
export function configureBackupService(partialConfig: Partial<BackupConfig>): void {
  config = { ...config, ...partialConfig };
}

/**
 * Create a manual backup
 */
export async function createBackup(data: any): Promise<{ success: boolean; path?: string; error?: string }> {
  if (isElectron()) {
    // Add metadata to backup
    const backupData = {
      ...data,
      _backupInfo: {
        timestamp: new Date().toISOString(),
        version: 1,
        itemCount: data.items?.length || 0,
      },
    };

    const result = await (window as any).electronAPI.backupAPI.createBackup(backupData);
    if (result.success) {
      lastBackupTime = Date.now();
    }
    return result;
  }
  return { success: false, error: 'Not in Electron environment' };
}

/**
 * List all available backups
 */
export async function listBackups(): Promise<BackupInfo[]> {
  if (isElectron()) {
    return await (window as any).electronAPI.backupAPI.listBackups();
  }
  return [];
}

/**
 * Restore from a backup
 */
export async function restoreBackup(backupPath: string): Promise<{ success: boolean; data?: any; error?: string }> {
  if (isElectron()) {
    return await (window as any).electronAPI.backupAPI.restoreBackup(backupPath);
  }
  return { success: false, error: 'Not in Electron environment' };
}

/**
 * Delete a specific backup
 */
export async function deleteBackup(backupPath: string): Promise<{ success: boolean; error?: string }> {
  if (isElectron()) {
    return await (window as any).electronAPI.backupAPI.deleteBackup(backupPath);
  }
  return { success: false, error: 'Not in Electron environment' };
}

/**
 * Clean up old backups, keeping only the most recent N
 */
export async function cleanupOldBackups(keepCount?: number): Promise<{ deleted: number; error?: string }> {
  if (isElectron()) {
    return await (window as any).electronAPI.backupAPI.cleanupOldBackups(keepCount || config.maxBackups);
  }
  return { deleted: 0, error: 'Not in Electron environment' };
}

/**
 * Get the backup directory path
 */
export async function getBackupPath(): Promise<string> {
  if (isElectron()) {
    return await (window as any).electronAPI.backupAPI.getBackupPath();
  }
  return '';
}

/**
 * Check if enough time has passed since last backup (for auto-backup)
 */
export function canAutoBackup(): boolean {
  if (!config.autoBackup) return false;
  const now = Date.now();
  return now - lastBackupTime >= config.minInterval;
}

/**
 * Check if backup is needed and create one if appropriate
 */
export async function maybeCreateBackup(data: any): Promise<{ created: boolean; path?: string }> {
  if (!canAutoBackup()) {
    return { created: false };
  }

  const result = await createBackup(data);
  return {
    created: result.success,
    path: result.success ? result.path : undefined,
  };
}

/**
 * Get the most recent backup
 */
export async function getMostRecentBackup(): Promise<BackupInfo | null> {
  const backups = await listBackups();
  if (backups.length === 0) return null;

  // Sort by timestamp descending
  return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
}

/**
 * Get backup age in milliseconds
 */
export async function getBackupAge(): Promise<number | null> {
  const mostRecent = await getMostRecentBackup();
  if (!mostRecent) return null;

  return Date.now() - mostRecent.timestamp.getTime();
}
