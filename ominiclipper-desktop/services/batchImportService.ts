/**
 * Batch Import Service
 * Handles batch importing files with automatic classification
 * Supports both rules-based and AI-based classification (hybrid mode)
 */

import { ResourceItem, ResourceType, FileStorageMode, Folder, Tag } from '../types';
import * as storageService from './storageService';
import * as ruleEngine from './ruleEngine';
import aiClassifier from './aiClassifier';
import * as contentExtraction from './contentExtractionService';

// Check if running in Electron
function isElectron(): boolean {
  return !!(window as any).electronAPI?.scanDirectory;
}

// ============================================
// Types
// ============================================

export interface BatchImportFile {
  name: string;
  path: string;
  extension: string;
  size: number;
  mimeType: string;
  modifiedAt: string;
}

export interface BatchImportResult {
  success: boolean;
  file: BatchImportFile;
  classification?: {
    folderId?: string;
    folderName?: string;
    tags: string[];
    confidence: number;
    reasoning: string;
    isAiclassified: boolean; // Whether AI was used for classification
  };
  error?: string;
}

export interface BatchImportProgress {
  total: number;
  processed: number;
  currentFile: string;
  results: BatchImportResult[];
}

export interface BatchImportOptions {
  storageMode: FileStorageMode;
  useRules: boolean;        // Use rule-based classification
  useAI: boolean;           // Use AI classification
  autoCreateFolders: boolean; // Auto-create folders from classification
  targetFolderId?: string;  // Override target folder
  onProgress?: (progress: BatchImportProgress) => void;
}

// ============================================
// Helper Functions
// ============================================

const getResourceTypeFromExtension = (ext: string): ResourceType => {
  switch (ext.toLowerCase()) {
    case '.pdf': return ResourceType.PDF;
    case '.doc': case '.docx': return ResourceType.WORD;
    case '.epub': return ResourceType.EPUB;
    case '.jpg': case '.jpeg': case '.png': case '.gif': case '.webp': return ResourceType.IMAGE;
    case '.md': case '.markdown': return ResourceType.MARKDOWN;
    case '.ppt': case '.pptx': return ResourceType.PPT;
    case '.xls': case '.xlsx': return ResourceType.EXCEL;
    case '.html': case '.htm': return ResourceType.WEB;
    default: return ResourceType.UNKNOWN;
  }
};

// ============================================
// Batch Import Main Function
// ============================================

/**
 * Batch import files from a directory with automatic classification
 */
export const batchImport = async (
  dirPath: string,
  options: BatchImportOptions
): Promise<BatchImportResult[]> => {
  const results: BatchImportResult[] = [];
  const progress: BatchImportProgress = {
    total: 0,
    processed: 0,
    currentFile: '',
    results: [],
  };

  // Get existing folders and tags
  const existingFolders = storageService.getFolders();
  const existingTags = storageService.getTags();

  if (!isElectron()) {
    console.error('[BatchImport] Electron API not available');
    return [];
  }

  // Scan directory
  try {
    const scanResult = await (window as any).electronAPI.scanDirectory(dirPath, {
      recursive: true,
      maxDepth: 3,
    });

    if (!scanResult.success) {
      throw new Error(scanResult.error || 'Failed to scan directory');
    }

    const files = scanResult.files;
    progress.total = files.length;

    for (const file of files) {
      progress.currentFile = file.name;
      progress.processed++;

      // Notify progress
      if (options.onProgress) {
        options.onProgress({ ...progress });
      }

      // Classify file
      const result = await classifyAndImportFile(
        file,
        existingFolders,
        existingTags,
        options
      );

      results.push(result);
      progress.results.push(result);
    }

    // Refresh state
    await storageService.flushPendingWrites();

    return results;
  } catch (error) {
    console.error('[BatchImport] Failed to scan directory:', error);
    throw error;
  }
};

/**
 * Classify a single file and import it
 */
const classifyAndImportFile = async (
  file: BatchImportFile,
  folders: Folder[],
  tags: Tag[],
  options: BatchImportOptions
): Promise<BatchImportResult> => {
  const type = getResourceTypeFromExtension(file.extension);

  try {
    // Step 1: Try rule-based classification first
    let classification = null;
    let isAiclassified = false;

    if (options.useRules) {
      classification = await ruleEngine.classifyFile(file.name, file.path, type);

      // If high-confidence rule match, skip AI
      if (classification && classification.confidence >= 0.9) {
        console.log(`[BatchImport] Rule match for ${file.name}: ${classification.category}`);
      }
    }

    // Step 2: If no rule match or low confidence, use AI
    if (options.useAI && (!classification || classification.confidence < 0.8)) {
      // Extract content for AI classification
      const contentSnippet = await contentExtraction.extractContentSnippet(
        type,
        file.path,
        500
      );

      // Call AI classifier
      const aiResult = await aiClassifier.classify({
        id: 'temp',
        title: file.name.replace(/\.[^/.]+$/, ''),
        type,
        tags: [],
        folderId: undefined,
        color: 'tag-blue',
        path: file.path,
        localPath: undefined,
        originalPath: file.path,
        storageMode: 'embed' as FileStorageMode,
        fileSize: file.size,
        mimeType: file.mimeType,
        isCloud: false,
        isStarred: false,
        contentSnippet,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      if (aiResult) {
        // Merge AI result with rule result (AI takes precedence)
        classification = {
          category: aiResult.category || classification?.category || '',
          subfolder: aiResult.subfolder || classification?.subfolder || '',
          confidence: aiResult.confidence || classification?.confidence || 0.5,
          reasoning: aiResult.reasoning || classification?.reasoning || '',
          suggestedTags: aiResult.suggestedTags || classification?.suggestedTags || [],
        };
        isAiclassified = true;
        console.log(`[BatchImport] AI classification for ${file.name}: ${aiResult.category}`);
      }
    }

    // Step 3: Determine target folder
    let targetFolderId: string | undefined = options.targetFolderId;

    if (classification?.subfolder && options.autoCreateFolders) {
      // Find or create folder based on classification
      const folderPath = classification.subfolder.split('/');
      let parentId: string | undefined;

      for (const folderName of folderPath) {
        let existingFolder = folders.find(
          f => f.name === folderName && f.parentId === parentId
        );

        if (!existingFolder) {
          // Create new folder
          const newFolder: Folder = {
            id: `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: folderName,
            parentId,
          };
          storageService.addFolder(newFolder);
          folders = storageService.getFolders(); // Refresh folders list
          existingFolder = newFolder;
        }

        parentId = existingFolder.id;
      }

      targetFolderId = parentId;
    }

    // Step 4: Process tags
    const itemTags: string[] = [];
    if (classification?.suggestedTags) {
      for (const tagName of classification.suggestedTags) {
        let existingTag = tags.find(t => t.name === tagName);
        if (!existingTag) {
          // Create new tag
          existingTag = {
            id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: tagName,
            color: 'tag-purple',
          };
          storageService.addTag(existingTag);
          tags = storageService.getTags(); // Refresh tags list
        }
        itemTags.push(existingTag.id);
      }
    }

    // Step 5: Copy file to storage if needed
    let localPath: string | undefined;
    let finalPath: string | undefined;

    if (options.storageMode === 'embed' && isElectron()) {
      try {
        const copyResult = await (window as any).electronAPI.copyFileToStorage(
          file.path,
          file.name
        );
        if (copyResult.success) {
          localPath = copyResult.targetPath;
          finalPath = copyResult.targetPath;
        } else {
          localPath = file.path;
          finalPath = file.path;
        }
      } catch (error) {
        console.error('[BatchImport] Failed to copy file:', error);
        localPath = file.path;
        finalPath = file.path;
      }
    } else {
      localPath = file.path;
      finalPath = file.path;
    }

    // Step 6: Add item to storage
    const newItem = storageService.addItem({
      title: file.name.replace(/\.[^/.]+$/, ''),
      type,
      tags: itemTags,
      folderId: targetFolderId,
      color: 'tag-blue',
      path: finalPath,
      localPath,
      embeddedData: undefined,
      originalPath: file.path,
      storageMode: options.storageMode,
      fileSize: file.size,
      mimeType: file.mimeType,
      isCloud: false,
      isStarred: false,
      contentSnippet: classification?.reasoning || `Imported from ${file.name}`,
    });

    return {
      success: true,
      file,
      classification: {
        folderId: targetFolderId,
        folderName: classification?.subfolder,
        tags: itemTags,
        confidence: classification?.confidence || 0,
        reasoning: classification?.reasoning || '',
        isAiclassified,
      },
    };
  } catch (error) {
    console.error(`[BatchImport] Failed to import ${file.name}:`, error);
    return {
      success: false,
      file,
      error: String(error),
    };
  }
};

// ============================================
// Quick Import Functions
// ============================================

/**
 * Quick import with default settings (AI + rules, auto-create folders)
 */
export const quickImport = async (
  dirPath: string,
  onProgress?: (progress: BatchImportProgress) => void
): Promise<BatchImportResult[]> => {
  return batchImport(dirPath, {
    storageMode: 'embed',
    useRules: true,
    useAI: true,
    autoCreateFolders: true,
    onProgress,
  });
};

/**
 * Import with rules only (no AI)
 */
export const rulesBasedImport = async (
  dirPath: string,
  targetFolderId?: string,
  onProgress?: (progress: BatchImportProgress) => void
): Promise<BatchImportResult[]> => {
  return batchImport(dirPath, {
    storageMode: 'embed',
    useRules: true,
    useAI: false,
    autoCreateFolders: false,
    targetFolderId,
    onProgress,
  });
};

/**
 * Import with AI only (no rules)
 */
export const aiBasedImport = async (
  dirPath: string,
  targetFolderId?: string,
  onProgress?: (progress: BatchImportProgress) => void
): Promise<BatchImportResult[]> => {
  return batchImport(dirPath, {
    storageMode: 'embed',
    useRules: false,
    useAI: true,
    autoCreateFolders: true,
    targetFolderId,
    onProgress,
  });
};

// ============================================
// Statistics
// ============================================

/**
 * Get statistics for a batch import result
 */
export const getImportStats = (results: BatchImportResult[]): {
  total: number;
  success: number;
  failed: number;
  aiClassified: number;
  ruleClassified: number;
  folderDistribution: Record<string, number>;
  tagDistribution: Record<string, number>;
} => {
  const stats = {
    total: results.length,
    success: 0,
    failed: 0,
    aiClassified: 0,
    ruleClassified: 0,
    folderDistribution: {} as Record<string, number>,
    tagDistribution: {} as Record<string, number>,
  };

  for (const result of results) {
    if (result.success) {
      stats.success++;
      if (result.classification) {
        if (result.classification.isAiclassified) {
          stats.aiClassified++;
        } else {
          stats.ruleClassified++;
        }

        // Count folders
        const folderName = result.classification.folderName || 'uncategorized';
        stats.folderDistribution[folderName] = (stats.folderDistribution[folderName] || 0) + 1;

        // Count tags
        for (const tag of result.classification.tags) {
          stats.tagDistribution[tag] = (stats.tagDistribution[tag] || 0) + 1;
        }
      }
    } else {
      stats.failed++;
    }
  }

  return stats;
};
