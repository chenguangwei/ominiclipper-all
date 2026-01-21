import { ResourceItem, ResourceType } from '../types';

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
 * Get the effective resource type, checking file extension for UNKNOWN types
 */
export const getEffectiveType = (item: ResourceItem): ResourceType => {
  if (item.type !== ResourceType.UNKNOWN) {
    return item.type;
  }

  // For UNKNOWN types, check the file extension
  // Use title, originalPath (for display filename), or valid file path
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

/**
 * Get file data from multiple sources (embedded data, local file, URL/blob)
 * Returns ArrayBuffer for use with docx-preview, PDF.js, etc.
 */
export const getFileData = async (item: ResourceItem): Promise<ArrayBuffer> => {
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

  // 2. Try Local File via Electron IPC
  const filePath = getValidFilePath(item);
  if (filePath && (window as any).electronAPI?.readFile) {
    console.log('[fileHelpers] Reading local file via IPC:', filePath);
    const result = await (window as any).electronAPI.readFile(filePath);
    if (result && result.success && result.buffer) {
      // Check if we received raw Buffer/Uint8Array (preferred)
      if (result.buffer instanceof Uint8Array) {
        console.log('[fileHelpers] Received raw Uint8Array, making clean copy. Size:', result.buffer.byteLength);
        // Use slice(0) to create a clean copy without byteOffset issues
        // Direct .buffer access can return shared memory with garbage data
        return result.buffer.slice(0).buffer;
      }

      // Fallback: Decode base64 string (legacy)
      if (typeof result.buffer === 'string') {
        console.log('[fileHelpers] Received base64 string, decoding...');
        const binaryString = atob(result.buffer);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      }
    }
  }

  // 3. Try URL or Blob (web URLs, blob URLs)
  if (item.path && (item.path.startsWith('http://') || item.path.startsWith('https://') || item.path.startsWith('blob:'))) {
    console.log('[fileHelpers] Fetching from URL:', item.path);
    const response = await fetch(item.path);
    if (response.ok) {
      return await response.arrayBuffer();
    }
  }

  throw new Error('No valid document source available. The file may have been moved or deleted.');
};
