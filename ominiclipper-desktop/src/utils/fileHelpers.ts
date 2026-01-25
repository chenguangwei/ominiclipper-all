import { ResourceItem, ResourceType } from '../types';
import path from 'path';

/**
 * Check if a path is an absolute file path (not just a filename)
 */
export const isAbsolutePath = (pathStr: string | undefined): boolean => {
  if (!pathStr) return false;
  // Unix absolute path or Windows absolute path
  return pathStr.startsWith('/') || /^[A-Za-z]:[\\/]/.test(pathStr);
};

/**
 * Get a valid file path for reading, preferring localPath over originalPath
 * Only returns path if it's an absolute path (not just a filename)
 */
export const getValidFilePath = (item: ResourceItem): string | null => {
  // Debug logging for path resolution
  console.log('[fileHelpers] getValidFilePath for:', item.title);
  console.log('[fileHelpers] - localPath:', item.localPath);
  console.log('[fileHelpers] - path:', item.path);
  console.log('[fileHelpers] - originalPath:', item.originalPath);

  // Prefer localPath as it's the actual stored file location
  if (item.localPath && isAbsolutePath(item.localPath)) {
    console.log('[fileHelpers] - using localPath (absolute)');
    return item.localPath;
  }
  // path field should also be absolute if it's a file path
  if (item.path && isAbsolutePath(item.path)) {
    console.log('[fileHelpers] - using path (absolute)');
    return item.path;
  }
  // originalPath might be just a filename for display, only use if absolute
  if (item.originalPath && isAbsolutePath(item.originalPath)) {
    console.log('[fileHelpers] - using originalPath (absolute)');
    return item.originalPath;
  }
  console.warn('[fileHelpers] - NO valid absolute path found!');
  return null;
};

/**
 * Get file extension based on ResourceType
 */
export const getFileExtension = (type: ResourceType): string => {
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
};

/**
 * Async version of getValidFilePath that can recover paths and extract embedded data
 * Use this when you need to guarantee a file path for operations like 'Reveal in Finder'
 */
export const getValidFilePathAsync = async (item: ResourceItem): Promise<string | null> => {
  console.log('[fileHelpers] getValidFilePathAsync for:', item.title);

  // First try sync method
  const syncPath = getValidFilePath(item);
  if (syncPath) {
    // Verify the file actually exists
    const exists = await (window as any).electronAPI?.fileExists?.(syncPath);
    if (exists) {
      console.log('[fileHelpers] - sync path exists:', syncPath);
      return syncPath;
    }
    console.log('[fileHelpers] - sync path does not exist, trying recovery...');
  }

  // Try async recovery
  const recoveredPath = await recoverItemPath(item);
  if (recoveredPath) {
    console.log('[fileHelpers] - recovered path:', recoveredPath);
    return recoveredPath;
  }

  // If we have embedded data, extract to storage and return path
  if (item.embeddedData && (window as any).electronAPI?.saveEmbeddedFile) {
    console.log('[fileHelpers] - extracting embedded data to storage...');
    const extension = getFileExtension(item.type);
    // Get filename from originalPath if available, otherwise construct from title
    let fileName = item.originalPath;
    if (!fileName || fileName.startsWith('/')) {
      // If originalPath is a full path, extract just the filename
      fileName = item.originalPath?.split(/[/\\]/).pop() || `${item.title}${extension}`;
    }
    // Ensure extension is present
    if (!fileName.includes('.')) {
      fileName = `${fileName}${extension}`;
    }

    try {
      const result = await (window as any).electronAPI.saveEmbeddedFile(
        item.embeddedData,
        fileName,
        item.id
      );
      if (result.success && result.targetPath) {
        console.log('[fileHelpers] - embedded data extracted to:', result.targetPath);
        return result.targetPath;
      }
    } catch (e) {
      console.error('[fileHelpers] - failed to extract embedded data:', e);
    }
  }

  console.warn('[fileHelpers] - getValidFilePathAsync: no valid path found');
  return null;
};

/**
 * Get the effective resource type, checking file extension for UNKNOWN types
 */
export const getEffectiveType = (item: ResourceItem): ResourceType => {
  if (item.type !== ResourceType.UNKNOWN) {
    return item.type;
  }

  // For UNKNOWN types, check the file extension
  const fileName = item.title || item.originalPath || getValidFilePath(item) || '';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'md':
    case 'markdown':
    case 'txt':
      return ResourceType.MARKDOWN;
    case 'pdf':
      return ResourceType.PDF;
    case 'doc':
    case 'docx':
      return ResourceType.WORD;
    case 'xls':
    case 'xlsx':
    case 'csv':
      return ResourceType.EXCEL;
    case 'ppt':
    case 'pptx':
      return ResourceType.PPT;
    case 'epub':
      return ResourceType.EPUB;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
      return ResourceType.IMAGE;
    default:
      return ResourceType.UNKNOWN;
  }
};

export async function recoverItemPath(item: ResourceItem): Promise<string | null> {
  console.log('[fileHelpers] recoverItemPath called for:', item.id);
  try {
    if (!item.id) return null;

    // [优化] 优先从 originalPath 获取带后缀的文件名，而不是 title
    let fileName = item.title || 'file';
    if (item.originalPath) {
      // 提取文件名部分 (兼容 Windows 和 Unix 路径分隔符)
      const basename = item.originalPath.split(/[\\/]/).pop();
      if (basename) fileName = basename;
    }

    // Check if we have required APIs
    const hasStorageAPI = (window as any).electronAPI?.fileStorageAPI;

    // Option 1: Use fileStorageAPI.getFilePath if available
    if (hasStorageAPI?.getFilePath) {
      try {
        const recoveredPath = await (window as any).electronAPI.fileStorageAPI.getFilePath(item.id, fileName);
        if (recoveredPath) {
          console.log('[fileHelpers] Path recovery returned:', recoveredPath);
          // 验证文件是否真的存在
          const exists = await (window as any).electronAPI.fileExists(recoveredPath);
          if (exists) {
            return recoveredPath;
          }
          console.warn('[fileHelpers] Recovered path does not exist:', recoveredPath);
        }
      } catch (e) {
        console.warn('[fileHelpers] getFilePath API failed:', e);
      }
    }

    // Option 2: 直接检查 legacy documents 目录中与 ID 或文件名匹配的文件
    // 这是针对旧版本存储方式的回退逻辑
    try {
      const userDataPath = await (window as any).electronAPI?.getUserDataPath?.();
      if (userDataPath) {
        const legacyStoragePath = path.join(userDataPath, 'OmniCollector', 'documents');

        if (await (window as any).electronAPI.fileExists?.(legacyStoragePath)) {
          console.log('[fileHelpers] Checking legacy path:', legacyStoragePath);

          // 策略1: 尝试用 ID 作为文件名
          const idFileName = `${item.id}.pdf`; // 假设常见扩展名
          const idPath = path.join(legacyStoragePath, idFileName);
          if (await (window as any).electronAPI.fileExists?.(idPath)) {
            console.log('[fileHelpers] Found by ID in legacy:', idPath);
            return idPath;
          }

          // 策略2: 尝试用 ID 前缀匹配（带时间戳的文件名格式）
          const idPrefix = item.id.split('-')[0];
          // 尝试查找包含前缀的文件
          for (const ext of ['.pdf', '.docx', '.doc', '.epub', '.jpg', '.png']) {
            const guessPath = path.join(legacyStoragePath, `${idPrefix}${ext}`);
            if (await (window as any).electronAPI.fileExists?.(guessPath)) {
              console.log('[fileHelpers] Found by ID prefix in legacy:', guessPath);
              return guessPath;
            }
          }

          // 策略3: 尝试用文件名匹配
          const baseName = item.title?.replace(/\.[^/.]+$/, '') || fileName.replace(/\.[^/.]+$/, '');
          for (const ext of ['.pdf', '.docx', '.doc', '.epub', '.jpg', '.png']) {
            const namePath = path.join(legacyStoragePath, `${baseName}${ext}`);
            if (await (window as any).electronAPI.fileExists?.(namePath)) {
              console.log('[fileHelpers] Found by name in legacy:', namePath);
              return namePath;
            }
          }

          // 策略4: 如果 title 有完整扩展名，尝试直接匹配
          if (item.title && item.title.includes('.')) {
            const directPath = path.join(legacyStoragePath, item.title);
            if (await (window as any).electronAPI.fileExists?.(directPath)) {
              console.log('[fileHelpers] Found by title in legacy:', directPath);
              return directPath;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[fileHelpers] Legacy storage scan failed:', e);
    }

    // Option 3: 最后的尝试 - 检查 items 目录下是否有文件
    // (一些旧版本可能把文件存在那里)
    try {
      const userDataPath = await (window as any).electronAPI?.getUserDataPath?.();
      if (userDataPath && item.id) {
        const itemsPath = path.join(userDataPath, 'OmniCollector', 'items', item.id);
        if (await (window as any).electronAPI.fileExists?.(itemsPath)) {
          // itemsPath 是一个目录，扫描它
          console.log('[fileHelpers] Items path exists but cannot scan:', itemsPath);
          // 如果能列出目录就好了，但暂时返回 itemsPath 本身作为尝试（如果调用者能处理目录）
          // 或者尝试常见文件名
          const guessPath = path.join(itemsPath, fileName);
          if (await (window as any).electronAPI.fileExists?.(guessPath)) {
            return guessPath;
          }
        }
      }
    } catch (e) {
      // 忽略
    }

    // Option 4: 搜索 folders 目录 (文件迁移后可能在这里)
    try {
      const userDataPath = await (window as any).electronAPI?.getUserDataPath?.();
      if (userDataPath && item.id) {
        const foldersPath = path.join(userDataPath, 'OmniCollector', 'folders');

        if (await (window as any).electronAPI.fileExists?.(foldersPath)) {
          console.log('[fileHelpers] Checking folders path:', foldersPath);

          // 策略1: 如果有 folderId，检查对应文件夹
          if (item.folderId) {
            const folderItemPath = path.join(foldersPath, item.folderId, fileName);
            if (await (window as any).electronAPI.fileExists?.(folderItemPath)) {
              console.log('[fileHelpers] Found in folder directory:', folderItemPath);
              return folderItemPath;
            }
          }

          // 策略2: 检查 uncategorized 文件夹
          const uncategorizedPath = path.join(foldersPath, 'uncategorized', fileName);
          if (await (window as any).electronAPI.fileExists?.(uncategorizedPath)) {
            console.log('[fileHelpers] Found in uncategorized folder:', uncategorizedPath);
            return uncategorizedPath;
          }
        }
      }
    } catch (e) {
      console.warn('[fileHelpers] Folders directory scan failed:', e);
    }

    console.warn('[fileHelpers] All recovery attempts failed for item:', item.id);
    return null;
  } catch (e) {
    console.error('[fileHelpers] recoverItemPath threw critical error:', e);
    return null;
  }
}

/**
 * Get file data from multiple sources (embedded data, local file, URL/blob)
 * Returns ArrayBuffer for use with docx-preview, PDF.js, etc.
 */
export const getFileData = async (item: ResourceItem): Promise<ArrayBuffer> => {
  console.log('[fileHelpers] getFileData called for item:', item.id, item.title);
  console.log('[fileHelpers] Item path:', item.path, 'localPath:', item.localPath);

  // 1. Try Embedded Data first (base64 encoded)
  if (item.embeddedData) {
    console.log('[fileHelpers] Using embedded data');
    const binaryString = atob(item.embeddedData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // 2. Check if path is a blob: URL (these expire on restart and can't be recovered)
  const isBlobUrl = item.path?.startsWith('blob:');
  if (isBlobUrl) {
    console.warn('[fileHelpers] Detected blob: URL - these expire on app restart');
    console.log('[fileHelpers] - item.localPath:', item.localPath);
    console.log('[fileHelpers] - item.folderId:', item.folderId);
    console.log('[fileHelpers] - item.storageMode:', item.storageMode);

    // 如果有 localPath，优先尝试使用它
    if (item.localPath && isAbsolutePath(item.localPath)) {
      console.log('[fileHelpers] Using localPath instead of blob URL:', item.localPath);
      try {
        const result = await (window as any).electronAPI.readFile(item.localPath);
        if (result && result.success && result.buffer) {
          if (result.buffer instanceof Uint8Array) {
            return result.buffer.slice(0).buffer;
          }
          if (typeof result.buffer === 'string') {
            const binaryString = atob(result.buffer);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes.buffer;
          }
        }
      } catch (e) {
        console.warn('[fileHelpers] Failed to read from localPath:', e);
      }
    }

    // Try to recover the path before giving up
    const recoveredPath = await recoverItemPath(item);
    if (recoveredPath) {
      console.log('[fileHelpers] Recovered blob URL to:', recoveredPath);
      // Continue to IPC read with recovered path
      const result = await (window as any).electronAPI.readFile(recoveredPath);
      console.log('[fileHelpers] IPC read result:', result?.success ? 'success' : 'failed');
      if (result && result.success && result.buffer) {
        if (result.buffer instanceof Uint8Array) {
          console.log('[fileHelpers] Buffer type: Uint8Array, byteLength:', result.buffer.length);
          return result.buffer.slice(0).buffer;
        }
        if (typeof result.buffer === 'string') {
          console.log('[fileHelpers] Buffer type: base64 string, length:', result.buffer.length);
          const binaryString = atob(result.buffer);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return bytes.buffer;
        }
      } else if (result?.error) {
        console.error('[fileHelpers] IPC read error:', result.error);
      }
    }
    // Cannot recover - blob URLs are session-scoped
    throw new Error('File reference has expired. Please re-import the file.');
  }

  // 3. Try Local File via Electron IPC
  let filePath = getValidFilePath(item);
  console.log('[fileHelpers] getValidFilePath returned:', filePath);

  // If no valid path found, try to recover it
  if (!filePath) {
    console.log('[fileHelpers] No valid path found, attempting recovery...');
    filePath = await recoverItemPath(item);
    if (filePath) {
      console.log('[fileHelpers] Recovered path:', filePath);
    }
  }

  if (filePath && (window as any).electronAPI?.readFile) {
    console.log('[fileHelpers] Reading local file via IPC:', filePath);
    try {
      const result = await (window as any).electronAPI.readFile(filePath);
      console.log('[fileHelpers] IPC read result:', result?.success ? 'success' : 'failed');
      if (result && result.success) {
        if (result.buffer) {
          // Case A: Raw Uint8Array (Preferred)
          if (result.buffer instanceof Uint8Array) {
            console.log('[fileHelpers] Buffer type: Uint8Array, byteLength:', result.buffer.length);
            // 【关键修复】必须使用 slice(0) 复制内存，防止 Buffer 偏移量导致的解析错误
            return result.buffer.slice(0).buffer;
          }
          // Case B: Base64 String (Legacy)
          if (typeof result.buffer === 'string') {
            console.log('[fileHelpers] Buffer type: base64 string, length:', result.buffer.length);
            const binaryString = atob(result.buffer);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes.buffer;
          }
        }
        throw new Error('File read success but buffer is empty');
      } else if (result && result.error) {
        console.error('[fileHelpers] IPC read failed:', result.error);
        throw new Error(result.error);
      }
    } catch (ipcError: any) {
      console.error('[fileHelpers] IPC exception:', ipcError.message);
      throw ipcError;
    }
  }

  // 4. Try HTTP/HTTPS URLs only (blob: URLs are already handled above)
  if (item.path && (item.path.startsWith('http://') || item.path.startsWith('https://'))) {
    console.log('[fileHelpers] Fetching from URL:', item.path);
    try {
      const response = await fetch(item.path);
      if (response.ok) {
        return await response.arrayBuffer();
      }
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    } catch (error) {
      console.warn('[fileHelpers] Fetch error:', error);
      throw new Error('File source is inaccessible.');
    }
  }

  console.error('[fileHelpers] No valid source for item:', item.id);
  throw new Error('No valid document source available. The file may have been moved or deleted.');
};
