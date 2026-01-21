/**
 * Content Extraction Service
 * Automatically extracts descriptions/content snippets from various document types:
 * - PDF: Extract text from first few pages
 * - DOCX: Extract first paragraph and key info
 * - EPUB: Extract description from metadata
 * - Images: Use OCR if available, or file metadata
 * - Web: Extract meta description or first paragraph
 * - Markdown: Extract first paragraphs
 * - PPT/Excel: Extract slide titles or cell content
 */

import { ResourceType, ResourceItem } from '../types';

// Simple path.basename replacement for browser compatibility
function getBasename(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

// Simple path.extname replacement for browser compatibility
function getExtname(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filePath.slice(lastDot);
}

// Check if running in Electron
function isElectron(): boolean {
  return !!(window as any).electronAPI?.readFile;
}

// ============================================
// Content Snippet Extraction per type
// ============================================

/**
 * Extract content snippet from PDF
 */
export const extractPdfContent = async (filePath: string, maxLength = 500): Promise<string> => {
  if (!isElectron()) return '';

  try {
    const pdfjs = await import('pdfjs-dist');
    // Worker is configured globally in App.tsx, no need to set here

    // 读取文件内容并传递给 pdfjs 作为 ArrayBuffer
    const fileData = await (window as any).electronAPI.readFile(filePath);
    if (!fileData?.buffer) {
      console.warn('[Content] Failed to read PDF file');
      return '';
    }
    const arrayBuffer = Uint8Array.from(atob(fileData.buffer), c => c.charCodeAt(0));

    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    // Extract text from first 3 pages
    let fullText = '';
    const pagesToExtract = Math.min(pdf.numPages, 3);

    for (let i = 1; i <= pagesToExtract; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }

    // Clean up and truncate
    return cleanText(fullText, maxLength);
  } catch (error) {
    console.error('[Content] Failed to extract PDF content:', error);
    return '';
  }
};

/**
 * Extract content snippet from DOCX
 */
export const extractDocxContent = async (filePath: string, maxLength = 500): Promise<string> => {
  if (!isElectron()) return '';

  try {
    const fileData = await (window as any).electronAPI.readFile(filePath);
    if (!fileData?.success) return '';

    const arrayBuffer = Uint8Array.from(atob(fileData.buffer), c => c.charCodeAt(0));
    const docx = await import('docx-preview');
    const container = document.createElement('div');
    container.style.display = 'none';
    document.body.appendChild(container);

    return new Promise((resolve) => {
      docx.renderAsync(arrayBuffer, container, undefined, {
        className: 'docx',
        inWrapper: false,
        showBorders: false,
      }).then(() => {
        // Extract text from first few paragraphs
        const paragraphs = container.querySelectorAll('p');
        let text = '';
        let count = 0;
        for (const p of paragraphs) {
          if (count >= 3) break;
          const pText = p.textContent?.trim();
          if (pText && pText.length > 10) {
            text += pText + '\n';
            count++;
          }
        }
        document.body.removeChild(container);
        resolve(cleanText(text, maxLength));
      }).catch(() => {
        document.body.removeChild(container);
        resolve('');
      });
    });
  } catch (error) {
    console.error('[Content] Failed to extract DOCX content:', error);
    return '';
  }
};

/**
 * Extract content snippet from EPUB
 */
export const extractEpubContent = async (filePath: string, maxLength = 500): Promise<string> => {
  // EPUB parsing is complex - extract basic info for now
  // Could use epub.js in future
  console.log('[Content] EPUB content extraction not yet fully implemented');
  return `EPUB document: ${getBasename(filePath)}`;
};

/**
 * Extract content snippet from Image (using file name and basic info)
 */
export const extractImageContent = async (filePath: string, maxLength = 200): Promise<string> => {
  // For images, use file name and basic info
  // Could integrate OCR in future
  const fileName = getBasename(filePath);
  const ext = getExtname(filePath).toUpperCase();
  return `Image (${ext.slice(1)}): ${fileName}`;
};

/**
 * Extract content snippet from Web URL
 */
export const extractWebContent = async (url: string, maxLength = 500): Promise<string> => {
  // For web links, we can't extract content without fetching
  // The browser extension would handle this
  return `Web link: ${url}`;
};

/**
 * Extract content snippet from Markdown
 */
export const extractMarkdownContent = async (filePath: string, maxLength = 500): Promise<string> => {
  if (!isElectron()) return '';

  try {
    const fileData = await (window as any).electronAPI.readFile(filePath);
    if (!fileData?.content) return '';

    // Extract first few paragraphs (text before first heading)
    const content = fileData.content;
    const paragraphs = content.split(/\n\n+/).filter((p: string) => p.trim().length > 0);
    let text = '';
    let count = 0;

    for (const p of paragraphs) {
      if (count >= 3) break;
      // Skip if it looks like a heading
      if (!p.startsWith('#') && !p.startsWith('---')) {
        text += p.trim() + '\n';
        count++;
      }
    }

    return cleanText(text, maxLength);
  } catch (error) {
    console.error('[Content] Failed to extract MD content:', error);
    return '';
  }
};

/**
 * Extract content snippet from PPT
 */
export const extractPptContent = async (filePath: string, maxLength = 300): Promise<string> => {
  // PPT parsing is complex - return basic info
  console.log('[Content] PPT content extraction not yet implemented');
  return `PowerPoint presentation: ${getBasename(filePath)}`;
};

/**
 * Extract content snippet from Excel
 */
export const extractExcelContent = async (filePath: string, maxLength = 300): Promise<string> => {
  // Excel parsing is complex - return basic info
  console.log('[Content] Excel content extraction not yet implemented');
  return `Excel spreadsheet: ${getBasename(filePath)}`;
};

/**
 * Clean and truncate text
 */
const cleanText = (text: string, maxLength: number): string => {
  // Remove extra whitespace
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/[\r\n]+/g, '\n')
    .trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // Try to truncate at a sentence boundary
  const truncated = cleaned.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');

  if (lastPeriod > maxLength * 0.5) {
    return truncated.slice(0, lastPeriod + 1);
  } else if (lastNewline > maxLength * 0.5) {
    return truncated.slice(0, lastNewline);
  }

  return truncated + '...';
};

// ============================================
// Main Content Extraction Function
// ============================================

/**
 * Extract content snippet based on resource type
 */
export const extractContentSnippet = async (
  type: ResourceType,
  filePath: string,
  maxLength = 500
): Promise<string> => {
  switch (type) {
    case ResourceType.PDF:
      return await extractPdfContent(filePath, maxLength);
    case ResourceType.WORD:
      return await extractDocxContent(filePath, maxLength);
    case ResourceType.EPUB:
      return await extractEpubContent(filePath, maxLength);
    case ResourceType.IMAGE:
      return await extractImageContent(filePath, maxLength);
    case ResourceType.WEB:
      return await extractWebContent(filePath, maxLength);
    case ResourceType.MARKDOWN:
      return await extractMarkdownContent(filePath, maxLength);
    case ResourceType.PPT:
      return await extractPptContent(filePath, maxLength);
    case ResourceType.EXCEL:
      return await extractExcelContent(filePath, maxLength);
    default:
      return '';
  }
};

/**
 * Generate content snippet during item creation
 * This is called automatically when adding new items
 */
export const generateAutoDescription = async (
  type: ResourceType,
  filePath: string | undefined,
  title: string
): Promise<string> => {
  // If we have a file path and can extract content
  if (filePath) {
    const snippet = await extractContentSnippet(type, filePath, 300);
    if (snippet) {
      return snippet;
    }
  }

  // Fallback to title-based description
  return `Resource: ${title}`;
};

// Helper to get path from item
const getFilePathFromItem = (item: any): string | undefined => {
  // Try localPath first (for embedded files)
  if (item.localPath) return item.localPath;
  // Fall back to path
  if (item.path && !item.path.startsWith('http')) return item.path;
  return undefined;
};

/**
 * Process item and add auto-description
 */
export const processItemWithAutoDescription = async (
  item: ResourceItem
): Promise<ResourceItem> => {
  const filePath = getFilePathFromItem(item);
  const snippet = await generateAutoDescription(item.type, filePath, item.title);
  return { ...item, description: snippet };
};
