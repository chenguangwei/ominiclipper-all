/**
 * Thumbnail Generation Service
 * Generates thumbnails for various document types:
 * - PDF: First page as image
 * - DOCX: First page preview using docx-preview
 * - EPUB: Cover image
 * - Images: Scaled version
 * - Web: Screenshot or favicon
 * - Markdown: First few lines as preview
 * - PPT/Excel: First slide/page preview
 */

import { ResourceType } from '../types';

// Check if running in Electron
function isElectron(): boolean {
  return !!(window as any).electronAPI?.fileAPI;
}

// Simple path.basename replacement for browser
function getBasename(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

// Thumbnail storage interface
export interface ThumbnailInfo {
  itemId: string;
  thumbnailPath: string | null;
  thumbnailDataUrl: string | null;
  generatedAt: string;
  width: number;
  height: number;
}

// ============================================
// Thumbnail Generation per type
// ============================================

/**
 * Generate thumbnail for a PDF file
 */
export const generatePdfThumbnail = async (filePath: string): Promise<string | null> => {
  if (!isElectron()) return null;

  try {
    // Use pdfjs-dist in renderer to render first page
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

    // 读取文件内容并传递给 pdfjs 作为 ArrayBuffer
    const fileData = await (window as any).electronAPI.readFile(filePath);
    if (!fileData?.buffer) {
      console.warn('[Thumbnail] Failed to read PDF file');
      return null;
    }
    const arrayBuffer = Uint8Array.from(atob(fileData.buffer), c => c.charCodeAt(0));

    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    } as any).promise;

    return canvas.toDataURL('image/jpeg', 0.7);
  } catch (error) {
    console.error('[Thumbnail] Failed to generate PDF thumbnail:', error);
    return null;
  }
};

/**
 * Generate thumbnail for a DOCX file
 * Uses docx-preview to render and html2canvas to capture
 */
export const generateDocxThumbnail = async (filePath: string): Promise<string | null> => {
  if (!isElectron()) return null;

  try {
    // Read file via IPC
    const fileData = await (window as any).electronAPI.readFile(filePath);
    if (!fileData?.buffer) {
      console.warn('[Thumbnail] Failed to read DOCX file');
      return null;
    }

    // Convert base64 to ArrayBuffer
    const arrayBuffer = Uint8Array.from(atob(fileData.buffer), c => c.charCodeAt(0));

    // Dynamic import docx-preview and html2canvas
    const docx = await import('docx-preview');
    const html2canvas = (await import('html2canvas')).default;

    // Create hidden container
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;background:white;';
    document.body.appendChild(container);

    // Render DOCX
    await docx.renderAsync(arrayBuffer, container, undefined, {
      className: 'docx-thumbnail-preview',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: false,
    });

    // Wait for rendering to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    // Capture as canvas
    const canvas = await html2canvas(container, {
      width: 300,
      height: 400,
      scale: 1,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
    });

    // Cleanup
    document.body.removeChild(container);

    return canvas.toDataURL('image/jpeg', 0.7);
  } catch (error) {
    console.error('[Thumbnail] Failed to generate DOCX thumbnail:', error);
    return null;
  }
};

/**
 * Generate thumbnail for an image file
 */
export const generateImageThumbnail = async (filePath: string, maxWidth = 300): Promise<string | null> => {
  return new Promise((resolve) => {
    // 在 Electron 中读取文件内容并转换为 data URL
    if (isElectron()) {
      (window as any).electronAPI.readFile(filePath).then((fileData: any) => {
        if (!fileData?.buffer) {
          console.error('[Thumbnail] Failed to read image file');
          resolve(null);
          return;
        }
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ratio = maxWidth / img.width;
          canvas.width = maxWidth;
          canvas.height = img.height * ratio;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => {
          console.error('[Thumbnail] Failed to load image data');
          resolve(null);
        };
        img.src = `data:image;base64,${fileData.buffer}`;
      }).catch((error: any) => {
        console.error('[Thumbnail] Failed to read image file:', error);
        resolve(null);
      });
    } else {
      // 浏览器模式
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => {
        console.error('[Thumbnail] Failed to load image:', filePath);
        resolve(null);
      };
      img.src = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
    }
  });
};

/**
 * Generate thumbnail for EPUB - extract cover image from epub archive
 */
export const generateEpubThumbnail = async (filePath: string): Promise<string | null> => {
  if (!isElectron()) return null;

  try {
    // Read file via IPC
    const fileData = await (window as any).electronAPI.readFile(filePath);
    if (!fileData?.buffer) {
      console.warn('[Thumbnail] Failed to read EPUB file');
      return null;
    }

    // Convert base64 to ArrayBuffer
    const arrayBuffer = Uint8Array.from(atob(fileData.buffer), c => c.charCodeAt(0));

    // Dynamic import JSZip
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Common cover image patterns in EPUB files
    const coverPatterns = [
      'cover.jpg', 'cover.jpeg', 'cover.png', 'cover.gif',
      'Cover.jpg', 'Cover.jpeg', 'Cover.png',
      'OEBPS/images/cover', 'OEBPS/Images/cover',
      'OPS/images/cover', 'images/cover', 'Images/cover',
      'EPUB/images/cover', 'epub/images/cover',
    ];

    // Search for cover image
    const fileNames = Object.keys(zip.files);
    let coverFile: string | null = null;

    // First try exact pattern matches
    for (const pattern of coverPatterns) {
      const found = fileNames.find(f =>
        f.toLowerCase().includes(pattern.toLowerCase()) &&
        (f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.gif'))
      );
      if (found) {
        coverFile = found;
        break;
      }
    }

    // If not found, look for any image with "cover" in name
    if (!coverFile) {
      coverFile = fileNames.find(f =>
        f.toLowerCase().includes('cover') &&
        (f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.gif'))
      ) || null;
    }

    // If still not found, try to find any image
    if (!coverFile) {
      coverFile = fileNames.find(f =>
        (f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png')) &&
        !f.includes('__MACOSX')
      ) || null;
    }

    if (!coverFile) {
      console.log('[Thumbnail] No cover image found in EPUB');
      return null;
    }

    // Extract cover image
    const coverData = await zip.files[coverFile].async('base64');
    const ext = coverFile.split('.').pop()?.toLowerCase() || 'jpeg';
    const mimeType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';

    // Scale the image to thumbnail size
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 300;
        const maxHeight = 400;
        let width = img.width;
        let height = img.height;

        // Scale to fit
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => {
        console.error('[Thumbnail] Failed to load EPUB cover image');
        resolve(null);
      };
      img.src = `data:${mimeType};base64,${coverData}`;
    });
  } catch (error) {
    console.error('[Thumbnail] Failed to generate EPUB thumbnail:', error);
    return null;
  }
};

/**
 * Generate thumbnail for Markdown - show first few lines
 */
export const generateMarkdownThumbnail = async (filePath: string): Promise<string | null> => {
  if (!isElectron()) return null;

  try {
    const fileData = await (window as any).electronAPI.readFile(filePath);
    if (!fileData?.content) return null;

    const lines = fileData.content.split('\n').slice(0, 10).join('\n');
    const preview = `data:text/markdown;base64,${btoa(lines)}`;

    // Create a visual preview using canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = 300;
    canvas.height = 200;

    // Draw background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw preview text
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    const lines2 = lines.slice(0, 200).split('\n');
    let y = 20;
    for (const line of lines2) {
      if (y > 180) break;
      ctx.fillText(line.slice(0, 45), 10, y);
      y += 14;
    }

    return canvas.toDataURL('image/jpeg', 0.7);
  } catch (error) {
    console.error('[Thumbnail] Failed to generate MD thumbnail:', error);
    return null;
  }
};

/**
 * Generate thumbnail for PPT - show first slide preview
 */
export const generatePptThumbnail = async (filePath: string): Promise<string | null> => {
  // PPT parsing is complex - return placeholder
  console.log('[Thumbnail] PPT thumbnail not yet implemented');
  return null;
};

/**
 * Generate thumbnail for Excel - show first rows
 */
export const generateExcelThumbnail = async (filePath: string): Promise<string | null> => {
  // Excel parsing is complex - return placeholder
  console.log('[Thumbnail] Excel thumbnail not yet implemented');
  return null;
};

/**
 * Generate placeholder thumbnail for unknown types
 */
export const generatePlaceholderThumbnail = async (type: ResourceType): Promise<string | null> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  canvas.width = 300;
  canvas.height = 400;

  // Different colors for different types
  const colors: Record<ResourceType, string> = {
    [ResourceType.PDF]: '#f44336',
    [ResourceType.WORD]: '#2196f3',
    [ResourceType.EPUB]: '#ff9800',
    [ResourceType.IMAGE]: '#4caf50',
    [ResourceType.WEB]: '#9c27b0',
    [ResourceType.MARKDOWN]: '#607d8b',
    [ResourceType.PPT]: '#ff5722',
    [ResourceType.EXCEL]: '#4caf50',
    [ResourceType.UNKNOWN]: '#9e9e9e',
  };

  const bgColor = colors[type] || '#9e9e9e';

  // Draw background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw icon placeholder
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '48px Material Icons';
  ctx.textAlign = 'center';
  ctx.fillText(getIconForType(type), canvas.width / 2, canvas.height / 2);

  return canvas.toDataURL('image/jpeg', 0.7);
};

/**
 * Get Material icon name for resource type
 */
const getIconForType = (type: ResourceType): string => {
  const icons: Record<ResourceType, string> = {
    [ResourceType.PDF]: 'picture_as_pdf',
    [ResourceType.WORD]: 'description',
    [ResourceType.EPUB]: 'menu_book',
    [ResourceType.IMAGE]: 'image',
    [ResourceType.WEB]: 'language',
    [ResourceType.MARKDOWN]: 'article',
    [ResourceType.PPT]: 'slideshow',
    [ResourceType.EXCEL]: 'table_chart',
    [ResourceType.UNKNOWN]: 'insert_drive_file',
  };
  return icons[type] || 'insert_drive_file';
};

// ============================================
// Main Thumbnail Generation Function
// ============================================

/**
 * Generate thumbnail for any supported file type
 */
export const generateThumbnail = async (
  itemId: string,
  type: ResourceType,
  filePath: string
): Promise<ThumbnailInfo> => {
  const startTime = Date.now();
  let thumbnailDataUrl: string | null = null;

  console.log(`[Thumbnail] Generating thumbnail for ${itemId} (${type})`);

  switch (type) {
    case ResourceType.PDF:
      thumbnailDataUrl = await generatePdfThumbnail(filePath);
      break;
    case ResourceType.WORD:
      thumbnailDataUrl = await generateDocxThumbnail(filePath);
      break;
    case ResourceType.EPUB:
      thumbnailDataUrl = await generateEpubThumbnail(filePath);
      break;
    case ResourceType.IMAGE:
      thumbnailDataUrl = await generateImageThumbnail(filePath);
      break;
    case ResourceType.MARKDOWN:
      thumbnailDataUrl = await generateMarkdownThumbnail(filePath);
      break;
    case ResourceType.PPT:
      thumbnailDataUrl = await generatePptThumbnail(filePath);
      break;
    case ResourceType.EXCEL:
      thumbnailDataUrl = await generateExcelThumbnail(filePath);
      break;
    default:
      thumbnailDataUrl = await generatePlaceholderThumbnail(type);
  }

  // If no thumbnail generated, use placeholder
  if (!thumbnailDataUrl) {
    thumbnailDataUrl = await generatePlaceholderThumbnail(type);
  }

  const elapsed = Date.now() - startTime;
  console.log(`[Thumbnail] Generated in ${elapsed}ms`);

  return {
    itemId,
    thumbnailPath: null,
    thumbnailDataUrl,
    generatedAt: new Date().toISOString(),
    width: 300,
    height: 400,
  };
};

/**
 * Generate thumbnail using IPC (renderer-side generation, main process storage)
 */
export const generateAndSaveThumbnail = async (
  itemId: string,
  type: ResourceType,
  filePath: string
): Promise<string | null> => {
  if (!isElectron()) {
    // Web mode - generate and return data URL
    const thumbnail = await generateThumbnail(itemId, type, filePath);
    return thumbnail.thumbnailDataUrl;
  }

  try {
    // Generate thumbnail in renderer
    const thumbnail = await generateThumbnail(itemId, type, filePath);

    if (thumbnail.thumbnailDataUrl) {
      // Save to storage via IPC
      const result = await (window as any).electronAPI.fileStorageAPI.saveThumbnail(
        itemId,
        thumbnail.thumbnailDataUrl
      );

      if (result.success) {
        console.log(`[Thumbnail] Saved thumbnail for ${itemId}`);
        return thumbnail.thumbnailDataUrl;
      }
    }
  } catch (error) {
    console.error('[Thumbnail] Failed to generate/save thumbnail:', error);
  }

  return null;
};

/**
 * Load cached thumbnail from storage
 */
export const loadThumbnail = async (itemId: string): Promise<string | null> => {
  if (!isElectron()) return null;

  try {
    const result = await (window as any).electronAPI.fileStorageAPI.readThumbnail(itemId);
    return result?.dataUrl || null;
  } catch (error) {
    console.error('[Thumbnail] Failed to load thumbnail:', error);
    return null;
  }
};

/**
 * Delete thumbnail from storage
 */
export const deleteThumbnail = async (itemId: string): Promise<boolean> => {
  if (!isElectron()) return true;

  try {
    const result = await (window as any).electronAPI.fileStorageAPI.deleteThumbnail(itemId);
    return result?.success || false;
  } catch (error) {
    console.error('[Thumbnail] Failed to delete thumbnail:', error);
    return false;
  }
};
