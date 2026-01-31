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
import { saveItemMetadata } from './itemFileMetadataService';
import { generateAndSaveThumbnail } from './thumbnailService';

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
  isTempFile?: boolean;
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
  existingItemId?: string; // ID of existing item if duplicate
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
  skipFileStorage?: boolean; // Skip copying/embedding file (if already handled)
  onProgress?: (progress: BatchImportProgress) => void;
  overridePath?: string; // Explicitly provided path
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
    case '.md': case '.markdown': case '.txt':
    case '.ts': case '.tsx': case '.js': case '.jsx':
    case '.py': case '.java': case '.c': case '.cpp': case '.h':
    case '.cs': case '.go': case '.rs': case '.rb': case '.php':
    case '.swift': case '.kt': case '.scala': case '.clj':
    case '.sh': case '.bash': case '.zsh': case '.fish':
    case '.yaml': case '.yml': case '.json': case '.xml': case '.sql':
    case '.css': case '.scss': case '.less':
      return ResourceType.MARKDOWN;
    case '.ppt': case '.pptx': return ResourceType.PPT;
    case '.xls': case '.xlsx': case '.csv': return ResourceType.EXCEL;
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
export const classifyAndImportFile = async (
  file: BatchImportFile,
  folders: Folder[],
  tags: Tag[],
  options: BatchImportOptions
): Promise<BatchImportResult> => {
  const type = getResourceTypeFromExtension(file.extension);
  const api = (window as any).electronAPI;

  try {
    // Step 0: Deduplication Check
    let fileHash = '';
    if (api?.calculateHash && file.path) {
      const hashResult = await api.calculateHash(file.path);
      if (hashResult.success && hashResult.hash) {
        fileHash = hashResult.hash;

        // Check for existing item
        const existingItem = await storageService.getItemByHash(fileHash, true); // Check trash too

        if (existingItem) {
          console.log(`[BatchImport] Duplicate found for ${file.name} (Hash: ${fileHash})`);

          if (existingItem.deletedAt) {
            // Restore from trash
            console.log(`[BatchImport] Restoring item from trash: ${existingItem.id}`);
            await storageService.restoreItem(existingItem.id);
            // Update metadata to indicate restored? Maybe not needed.
            return {
              success: true,
              file,
              classification: {
                tags: existingItem.tags,
                confidence: 1,
                reasoning: 'Restored from Trash (Exact File Match)',
                isAiclassified: false,
              }
            };
          } else {
            // Already exists and active
            console.log(`[BatchImport] Item already exists: ${existingItem.id}. Skipping physical import.`);
            return {
              success: true,
              file,
              classification: {
                tags: existingItem.tags,
                confidence: 1,
                reasoning: 'Duplicate Skipped (Exact File Match)',
                isAiclassified: false,
              }
            };
          }
        }
      }
    }

    // Step 1: Try rule-based classification first
    let classification = null;
    let isAiclassified = false;

    if (options.useRules) {
      classification = await ruleEngine.classifyFile(file.name, file.path, type);

      // If high-confidence rule match, skip AI
      if (classification) {
        console.log(`[BatchImport] Rule match for ${file.name}: ${classification.category}`);
      }
    }

    // Always try to extract content snippet if possible, regardless of classification method
    // This ensures we have actual content for search/display, not just the rule description
    let contentSnippet = '';
    try {
      const extracted = await contentExtraction.extractContentSnippet(
        type,
        file.path,
        500
      );
      if (extracted && extracted.length > 10) {
        contentSnippet = extracted;
      }
    } catch (e) {
      console.warn(`[BatchImport] Content extraction failed for ${file.name}:`, e);
    }

    // Step 2: If no rule match or low confidence OR missing tags, use AI
    // We want AI to enrich tags even if Rule Engine found a folder
    const ruleHasTags = classification?.suggestedTags && classification.suggestedTags.length > 0;
    const ruleHighConfidence = classification && classification.confidence >= 0.8;

    if (options.useAI && (!classification || !ruleHighConfidence || !ruleHasTags)) {
      // Call AI classifier with the extracted content
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
      console.log('[BatchImport] AI classification result:', aiResult);
      if (aiResult) {
        // Merge AI result with rule result
        // Logic: Rule Folder wins if High Confidence. AI Tags add to Rule Tags.

        // Determine base values (Rule or existing)
        const baseCategory = classification?.category || '';
        const baseSubfolder = classification?.subfolder || '';
        const baseReasoning = classification?.reasoning || '';
        const baseTags = classification?.suggestedTags || [];

        // Determine final folder
        // CHANGED: AI overrides Rule if AI provides a subfolder
        const finalSubfolder = aiResult.subfolder ? aiResult.subfolder : (baseSubfolder || '');

        // Merge tags (Set union)
        const mergedTags = [...new Set([...baseTags, ...(aiResult.suggestedTags || [])])];

        // REMOVED: Do not add category as a tag
        /*
        if (aiResult.category && aiResult.category !== 'Uncategorized' && aiResult.category !== '未分类' && !mergedTags.includes(aiResult.category)) {
          mergedTags.push(aiResult.category);
        }
        */

        const finalTags = mergedTags;

        classification = {
          folderId: aiResult.folderId,  // Use resolved folder ID
          category: aiResult.category || baseCategory,
          subfolder: finalSubfolder,
          suggestedTags: finalTags,
          confidence: Math.max(aiResult.confidence || 0, classification?.confidence || 0),
          reasoning: aiResult.reasoning
            ? `${aiResult.reasoning} ${baseReasoning ? `(Rule: ${baseReasoning})` : ''}`
            : baseReasoning,
        };
        isAiclassified = true;
        console.log(`[BatchImport] AI classification enriched: ${file.name}`);
      }
    }

    // Step 3: Determine target folder
    let targetFolderId: string | undefined = options.targetFolderId;

    if (classification?.subfolder && options.autoCreateFolders) {
      // Find or create folder based on classification (recursive)
      // Normalizes path: "Work/Insurance/Solutions" or "Work/Insurance"
      // Note: classification.category might be "Work", so we should check if subfolder already includes it

      let folderPath = classification.subfolder.split('/').filter(p => p.trim().length > 0);

      // If classification has a specific folderId (resolved from category), start there
      // But if subfolder is a full path (e.g. "Work/Insurance"), we should start from root if the first part matches category

      let parentId: string | undefined = undefined;

      // Check if the path is absolute or relative to category
      // If we have a category folder, and the first part of subfolder matches it, we assume full path
      if (classification.folderId) {
        // Resolve the root folder to check its real name (e.g. "Work") vs localized name (e.g. "工作")
        const rootFolder = folders.find(f => f.id === classification.folderId);

        if (rootFolder && folderPath.length > 0) {
          const firstSegment = folderPath[0].trim();
          // Check if first segment matches Category (localized) OR System Name (English)
          const isRootMatch =
            firstSegment === classification.category ||
            firstSegment.toLowerCase() === rootFolder.name.toLowerCase();

          if (isRootMatch) {
            // It's a full path (e.g. "工作/Project" or "Work/Project")
            // Anchor to the existing ID and consume the first segment
            parentId = classification.folderId;
            folderPath.shift();
          } else {
            // It's a relative path (e.g. "Project")
            // Anchor to the existing ID and keep all segments
            parentId = classification.folderId;
          }
        } else {
          // Fallback if folder lookup failed
          parentId = classification.folderId;
        }
      } else if (classification.category && folderPath[0] === classification.category) {
        // No folderId resolved, but path matches category string? 
        // This implies creating a new root folder with that name, or using undefined parent.
        // We'll leave parentId undefined so it searches/creates at root.
        // But we should probably NOT shift, because we want to create "Category/Sub" if it doesn't exist?
        // Actually, if we want to treat "Category" as the container, we should let the loop create it.
        // So parentId = undefined, do nothing special.
      }

      for (const folderName of folderPath) {
        // Case-insensitive check for existing folder
        let existingFolder = folders.find(
          f => f.name.trim().toLowerCase() === folderName.trim().toLowerCase() && f.parentId === parentId
        );

        if (!existingFolder) {
          // Create new folder
          // Note: addFolder generates its own ID and adds to store. We must use the RETURNED folder.
          const newFolderData = {
            name: folderName.trim(),
            parentId,
            icon: 'folder'
          };

          existingFolder = await storageService.addFolder(newFolderData);
          folders = storageService.getFolders(); // Refresh folders list (to get the updated array)

          console.log(`[BatchImport] Created new folder: ${existingFolder.name} (id: ${existingFolder.id}, parent: ${existingFolder.parentId})`);
        }

        parentId = existingFolder.id;
      }

      targetFolderId = parentId;
    } else if (!targetFolderId && classification?.folderId) {
      // Fallback to category folder if no subfolder specified
      targetFolderId = classification.folderId;
    }

    // Step 4: Process tags
    const itemTags: string[] = [];
    if (classification?.folderName) {
      // If folderName is a path, take the leaf
      const nameParts = classification.folderName.split('/');
      const leafFolder = nameParts[nameParts.length - 1];

      // Add folder name as tag if not ignored (e.g. Uncategorized)
      if (leafFolder && leafFolder !== 'Uncategorized' && leafFolder !== '未分类' && leafFolder !== 'Default') {
        itemTags.push(getOrAddTag(leafFolder, tags));
      }
    }

    // Auto-tag based on extension for code files
    const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.c', '.cpp', '.h', '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.sh', '.bash', '.yaml', '.yml', '.json', '.xml', '.sql', '.css', '.scss'];
    if (codeExts.includes(file.extension.toLowerCase())) {
      itemTags.push(getOrAddTag('Code', tags));
      const ext = file.extension.toLowerCase();
      const langMap: Record<string, string> = {
        '.ts': 'TypeScript', '.tsx': 'React', '.js': 'JavaScript', '.jsx': 'React',
        '.py': 'Python', '.java': 'Java', '.c': 'C', '.cpp': 'C++', '.cs': 'C#',
        '.go': 'Go', '.rs': 'Rust', '.rb': 'Ruby', '.php': 'PHP', '.swift': 'Swift',
        '.kt': 'Kotlin', '.sh': 'Shell', '.bash': 'Shell', '.yaml': 'YAML',
        '.yml': 'YAML', '.json': 'JSON', '.xml': 'XML', '.sql': 'SQL',
        '.css': 'CSS', '.scss': 'SASS'
      };
      if (langMap[ext]) {
        itemTags.push(getOrAddTag(langMap[ext], tags));
      }
    }

    if (classification?.suggestedTags) {
      for (const tagName of classification.suggestedTags) {
        itemTags.push(getOrAddTag(tagName, tags));
      }
    }

    // Helper to get ID for tag or create it
    function getOrAddTag(tagName: string, currentTags: Tag[]): string {
      const normalizedName = tagName.trim();
      // Case-insensitive duplicate check
      let existingTag = currentTags.find(t => t.name.trim().toLowerCase() === normalizedName.toLowerCase());

      if (!existingTag) {
        console.log(`[BatchImport] Creating new tag: "${normalizedName}"`);
        // Use storageService.addTag to create and persist.
        existingTag = storageService.addTag({
          name: normalizedName,
          color: 'tag-purple',
        });
      }
      return existingTag.id;
    }

    // Step 5: ID-based Storage (Scheme A)
    // We generate ID first to determine storage path
    const itemId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let localPath: string | undefined;
    let finalPath: string | undefined;

    // Default to file.path
    localPath = file.path;
    finalPath = file.path;

    if (!options.skipFileStorage && isElectron()) {
      try {
        const api = (window as any).electronAPI;

        // Check storageMode to decide whether to copy file
        if (options.storageMode === 'embed') {
          // EMBED mode: Copy file to files/{itemId}/ directory
          if (api.importFileToIdStorage) {
            const result = await api.importFileToIdStorage(file.path, itemId);
            if (result.success) {
              localPath = result.targetPath;
              finalPath = result.targetPath;

              // Clean up temp file if it was explicitly marked as temporary
              if (file.isTempFile) {
                console.log('[BatchImport] Deleting temporary file marked isTempFile:', file.path);
                const deleteResult = await api.deleteFile(file.path);
                if (deleteResult.success) {
                  console.log('[BatchImport] Successfully cleaned up temp file');
                } else {
                  console.warn('[BatchImport] Failed to clean up temp file:', deleteResult.error);
                }
              } else {
                // Fallback: check if it looks like a temp file in root (legacy behavior safety)
                const filesRoot = await api.fileStorageAPI?.getStoragePath();
                if (filesRoot && file.path.startsWith(filesRoot) && !file.path.includes(itemId)) {
                  console.log('[BatchImport] Deleting guessed temporary file:', file.path);
                  const deleteResult = await api.deleteFile(file.path);
                  if (deleteResult.success) console.log('[BatchImport] Cleaned up temp file');
                }
              }
            } else {
              console.error('[BatchImport] ID storage import failed:', result.error);
            }
          } else if (api.copyFileToStorage) {
            // Fallback to legacy flat storage
            const copyResult = await api.copyFileToStorage(file.path, file.name);
            if (copyResult.success) {
              localPath = copyResult.targetPath;
              finalPath = copyResult.targetPath;
            }
          }
        } else {
          // REFERENCE mode: Don't copy file, only ensure directory exists for metadata.json
          console.log('[BatchImport] Reference mode - not copying file, keeping original path:', file.path);
          if (api.ensureItemDirectory) {
            await api.ensureItemDirectory(itemId);
          }
          // localPath and finalPath stay as original file.path
        }
      } catch (error) {
        console.error('[BatchImport] File storage operation failed:', error);
      }
    }

    // Step 6: Add item to storage
    const newItem = await storageService.addItem({
      id: itemId, // Pass the pre-generated ID
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

      contentSnippet: contentSnippet || classification?.reasoning || `Imported from ${file.name}`,
      fileHash, // Save the hash
    });

    // Step 7: Save metadata.json to ID storage (Scheme A)
    // Use the full ResourceItem to ensure correct format for metadataToResourceItem
    if (isElectron()) {
      try {
        await saveItemMetadata(newItem);
        console.log('[BatchImport] Saved metadata.json for item:', itemId, 'path:', finalPath);
      } catch (err) {
        console.error('[BatchImport] Failed to save metadata.json:', err);
      }

      // Step 8: Generate thumbnail for the item (async, non-blocking)
      // This creates preview thumbnails for PDFs, Word docs, images, etc.
      if (finalPath) {
        generateAndSaveThumbnail(itemId, type, finalPath)
          .then(thumbnailUrl => {
            if (thumbnailUrl) {
              // Update the item with thumbnail URL
              storageService.updateItem(itemId, { thumbnailUrl }).catch(err => {
                console.warn('[BatchImport] Failed to save thumbnail URL:', err);
              });
              console.log('[BatchImport] Thumbnail generated for:', itemId);
            }
          })
          .catch(err => {
            console.warn('[BatchImport] Thumbnail generation failed:', err);
          });
      }
    }

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
// ============================================
// Single File Import
// ============================================

/**
 * Single file import wrapper for Drag and Drop
 */
export const importSingleFile = async (
  file: File,
  options: BatchImportOptions
): Promise<BatchImportResult> => {
  const isAbsolutePath = (path: string) => {
    return path && (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path));
  };

  let filePath = options.overridePath || (file as any).path || file.name;
  let skipFileStorage = false;

  // If path is not absolute (e.g. browser drag or restricted Electron file object),
  // we must save the content manually first.
  if (!isAbsolutePath(filePath) && (window as any).electronAPI?.saveEmbeddedFile) {
    if (options.storageMode === 'reference') {
      console.error('[BatchImport] Reference mode requires absolute path, but none found:', filePath);
      throw new Error('Reference Mode requires a valid system file path. Unable to resolve path for this file.');
    }

    console.log('[BatchImport] Invalid file path detected in EMBED mode, saving content manually:', filePath);
    try {
      const buffer = await file.arrayBuffer();
      const binary = new Uint8Array(buffer);
      // Convert to base64 for IPC
      let binaryString = '';
      for (let i = 0; i < binary.length; i++) {
        binaryString += String.fromCharCode(binary[i]);
      }
      const base64Data = btoa(binaryString);

      const saveResult = await (window as any).electronAPI.saveEmbeddedFile(
        base64Data,
        file.name,
        null // No ID yet
      );

      if (saveResult.success && saveResult.targetPath) {
        console.log('[BatchImport] Content saved manually to:', saveResult.targetPath);
        filePath = saveResult.targetPath;
        // We saved it to a temporary location (documents), now let classifyAndImportFile move/copy it to the correct ID folder
        // skipFileStorage = true; // CHANGED: Do not skip, so it gets copied to files/{id}
      } else {
        console.error('[BatchImport] Failed to save manual content:', saveResult.error);
      }
    } catch (e) {
      console.error('[BatchImport] Exception saving manual content:', e);
    }
  }

  // 1. Convert File to BatchImportFile structure
  const batchFile: BatchImportFile = {
    name: file.name,
    path: filePath,
    extension: `.${file.name.split('.').pop() || ''}`,
    size: file.size,
    mimeType: file.type,
    modifiedAt: new Date(file.lastModified).toISOString(),
    // If original path wasn't absolute (so we saved it manually) AND the path changed (it was updated to targetPath), it's a temp file
    isTempFile: !isAbsolutePath((file as any).path || file.name) && filePath !== ((file as any).path || file.name)
  };

  // 2. Refresh folders and tags
  // storageService getters are synchronous and return in-memory state
  const existingFolders = storageService.getFolders();
  const existingTags = storageService.getTags();

  // 3. Call internal classification logic
  return classifyAndImportFile(
    batchFile,
    existingFolders,
    existingTags,
    { ...options, skipFileStorage }
  );
};
