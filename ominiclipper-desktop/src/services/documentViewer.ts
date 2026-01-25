/**
 * Document Viewer Service
 * Handles PDF and EPUB document rendering
 */

import { ResourceType } from '../types';

// Use local pdfjs-dist package instead of CDN
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Document viewer state
export interface DocumentViewerState {
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  scale: number;
  toc: TocEntry[];
}

export interface TocEntry {
  id: string;
  label: string;
  href?: string;
}

// Initialize PDF.js using local package
export async function initPdfJs(): Promise<boolean> {
  if ((window as any).pdfjsLib) {
    console.log('PDF.js already loaded');
    return true;
  }

  try {
    // Use dynamic import to load the local pdfjs-dist package
    const pdfjs = await import('pdfjs-dist');

    // Set the worker source to the locally bundled worker
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

    // Expose pdfjsLib globally for the renderPdf function
    (window as any).pdfjsLib = pdfjs;

    console.log('PDF.js loaded successfully with local worker');
    return true;
  } catch (error) {
    console.error('Failed to load PDF.js:', error);
    return false;
  }
}

// Initialize EPUB.js with fallback CDNs
export async function initEpubJs(): Promise<boolean> {
  if ((window as any).ePub) {
    console.log('EPUB.js already loaded');
    return true;
  }

  // Try each CDN until one works
  for (const cdn of EPUB_JS_CDNS) {
    console.log(`Trying to load EPUB.js from: ${cdn}`);
    const loaded = await loadScript(`${cdn}/epub.min.js`);

    if (loaded && (window as any).ePub) {
      console.log('EPUB.js loaded successfully from:', cdn);
      return true;
    }
  }

  console.error('Failed to load EPUB.js from all CDNs');
  return false;
}

// Get document type from URL/path
export function getDocumentType(url: string): ResourceType | null {
  const ext = url.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return ResourceType.PDF;
    case 'epub':
      return ResourceType.EPUB;
    default:
      return null;
  }
}

// Check if URL is valid and accessible
async function validateDocumentUrl(url: string): Promise<{ valid: boolean; error?: string }> {
  if (!url) {
    return { valid: false, error: 'No document path provided' };
  }

  // Data URLs are always valid (embedded content)
  if (url.startsWith('data:')) {
    return { valid: true };
  }

  // For blob URLs, check if still valid
  if (url.startsWith('blob:')) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) {
        return { valid: false, error: 'Document reference has expired. Please re-import the file.' };
      }
      return { valid: true };
    } catch {
      return { valid: false, error: 'Document reference has expired. Please re-import the file.' };
    }
  }

  // HTTP/HTTPS URLs - assume valid, will fail during load if not
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return { valid: true };
  }

  // File paths - assume valid for now
  return { valid: true };
}

// Get user-friendly error message from PDF.js error
function getPdfErrorMessage(error: any): string {
  const message = error?.message || String(error);

  if (error?.name === 'InvalidPDFException' || message.includes('Invalid PDF')) {
    return 'Invalid or corrupted PDF file';
  }
  if (error?.name === 'MissingPDFException' || message.includes('Missing PDF')) {
    return 'PDF file not found. It may have been moved or deleted.';
  }
  if (error?.name === 'UnexpectedResponseException') {
    return 'Could not fetch the document. Check your network connection.';
  }
  if (message.includes('blob:') || message.includes('Failed to fetch')) {
    return 'Document reference has expired. Please re-import the file.';
  }
  if (message.includes('password')) {
    return 'This PDF is password protected.';
  }

  return `Failed to load PDF: ${message}`;
}

// Render PDF document
export async function renderPdf(
  url: string,
  container: HTMLElement,
  options?: {
    page?: number;
    scale?: number;
    onPageChange?: (page: number, total: number) => void;
    onRenderComplete?: () => void;
    onError?: (error: string) => void;
  }
): Promise<{ cleanup: () => void; setPage: (page: number) => void } | null> {
  const pdfjsLib = (window as any).pdfjsLib;
  if (!pdfjsLib) {
    options?.onError?.('PDF.js not initialized. Please wait and try again.');
    return null;
  }

  // Validate URL first
  const validation = await validateDocumentUrl(url);
  if (!validation.valid) {
    options?.onError?.(validation.error || 'Invalid document URL');
    return null;
  }

  let pdfDoc: any = null;
  let currentPage = options?.page || 1;
  let scale = options?.scale || 1.2;

  try {
    // For data URLs and regular URLs, pass the URL directly
    // PDF.js 4.x accepts both string URLs and TypedArrays
    // Use built-in cMaps (no external CDN needed for most PDFs)
    const loadingTask = pdfjsLib.getDocument({
      url: url,
      cMapPacked: true,
    });
    pdfDoc = await loadingTask.promise;

    const totalPages = pdfDoc.numPages;
    options?.onPageChange?.(currentPage, totalPages);

    const renderPage = async (pageNum: number) => {
      if (!pdfDoc) return;

      container.innerHTML = '';

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.className = 'max-w-full h-auto rounded-lg shadow-lg';

      container.appendChild(canvas);

      const renderContext = {
        canvasContext: context!,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      options?.onRenderComplete?.();
    };

    await renderPage(currentPage);

    // Navigation controls
    const navControls = createNavigationControls(
      currentPage,
      totalPages,
      (page) => {
        currentPage = page;
        renderPage(page);
        options?.onPageChange?.(page, totalPages);
      },
      (newScale) => {
        scale = newScale;
        renderPage(currentPage);
      }
    );

    const navContainer = document.createElement('div');
    navContainer.className = 'pdf-nav-controls absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-[#2a2a2a] border border-white/10 rounded-lg p-2 flex items-center gap-2 shadow-xl';
    navContainer.appendChild(navControls);

    // Add zoom controls
    const zoomControls = createZoomControls(scale, (newScale) => {
      scale = newScale;
      renderPage(currentPage);
    });
    navContainer.appendChild(zoomControls);

    container.style.position = 'relative';
    container.appendChild(navContainer);

    return {
      cleanup: () => {
        if (pdfDoc) {
          pdfDoc.destroy();
          pdfDoc = null;
        }
        container.innerHTML = '';
      },
      setPage: (page: number) => {
        if (page >= 1 && page <= totalPages) {
          currentPage = page;
          renderPage(page);
        }
      },
    };
  } catch (error: any) {
    console.error('PDF render error:', error);
    const errorMessage = getPdfErrorMessage(error);
    options?.onError?.(errorMessage);
    return null;
  }
}

// Create navigation controls
function createNavigationControls(
  currentPage: number,
  totalPages: number,
  onPageChange: (page: number) => void,
  onZoom: (scale: number) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'flex items-center gap-2';

  // Previous page button
  const prevBtn = document.createElement('button');
  prevBtn.innerHTML = '◀';
  prevBtn.className = 'p-1.5 rounded hover:bg-white/10 text-slate-300 transition-colors';
  prevBtn.onclick = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  // Page indicator
  const pageIndicator = document.createElement('span');
  pageIndicator.className = 'text-xs text-slate-400 min-w-[60px] text-center';
  pageIndicator.textContent = `${currentPage} / ${totalPages}`;

  // Next page button
  const nextBtn = document.createElement('button');
  nextBtn.innerHTML = '▶';
  nextBtn.className = 'p-1.5 rounded hover:bg-white/10 text-slate-300 transition-colors';
  nextBtn.onclick = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  container.appendChild(prevBtn);
  container.appendChild(pageIndicator);
  container.appendChild(nextBtn);

  return container;
}

// Create zoom controls
function createZoomControls(
  currentScale: number,
  onZoomChange: (scale: number) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'flex items-center gap-1 ml-2 border-l border-white/10 pl-2';

  // Zoom out
  const zoomOutBtn = document.createElement('button');
  zoomOutBtn.innerHTML = '−';
  zoomOutBtn.className = 'p-1.5 rounded hover:bg-white/10 text-slate-300 transition-colors';
  zoomOutBtn.onclick = () => {
    if (currentScale > 0.5) {
      onZoomChange(currentScale - 0.1);
    }
  };

  // Zoom indicator
  const zoomIndicator = document.createElement('span');
  zoomIndicator.className = 'text-xs text-slate-400 min-w-[40px] text-center';
  zoomIndicator.textContent = `${Math.round(currentScale * 100)}%`;

  // Zoom in
  const zoomInBtn = document.createElement('button');
  zoomInBtn.innerHTML = '+';
  zoomInBtn.className = 'p-1.5 rounded hover:bg-white/10 text-slate-300 transition-colors';
  zoomInBtn.onclick = () => {
    if (currentScale < 3) {
      onZoomChange(currentScale + 0.1);
    }
  };

  container.appendChild(zoomOutBtn);
  container.appendChild(zoomIndicator);
  container.appendChild(zoomInBtn);

  return container;
}

// Render EPUB document
export async function renderEpub(
  url: string,
  container: HTMLElement,
  options?: {
    onTocLoad?: (toc: TocEntry[]) => void;
    onError?: (error: string) => void;
  }
): Promise<{ cleanup: () => void; navigateTo: (href: string) => void; generateToc: () => TocEntry[] } | null> {
  const ePub = (window as any).ePub;
  if (!ePub) {
    options?.onError?.('EPUB.js not initialized. Please wait and try again.');
    return null;
  }

  // Validate URL first
  const validation = await validateDocumentUrl(url);
  if (!validation.valid) {
    options?.onError?.(validation.error || 'Invalid document URL');
    return null;
  }

  let book: any = null;
  let rendition: any = null;

  try {
    book = ePub(url);
    await book.ready;

    // Get table of contents
    const toc: TocEntry[] = [];
    const nav = await book.loaded.navigation;
    if (nav.toc) {
      nav.toc.forEach((item: any) => {
        toc.push({
          id: item.id,
          label: item.label,
          href: item.href,
        });
      });
    }
    options?.onTocLoad?.(toc);

    // Create rendering
    rendition = book.renderTo(container, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
    });

    // Display first page
    await rendition.display();

    return {
      cleanup: () => {
        if (rendition) {
          rendition.destroy();
        }
        if (book) {
          book.destroy();
        }
        container.innerHTML = '';
      },
      navigateTo: (href: string) => {
        if (rendition) {
          rendition.display(href);
        }
      },
      generateToc: () => toc,
    };
  } catch (error: any) {
    const message = error?.message || String(error);
    if (message.includes('blob:') || message.includes('Failed to fetch')) {
      options?.onError?.('Document reference has expired. Please re-import the file.');
    } else {
      options?.onError?.(`Failed to load EPUB: ${message}`);
    }
    return null;
  }
}

// Render document based on type
export async function renderDocument(
  url: string,
  type: ResourceType,
  container: HTMLElement,
  options?: {
    onTocLoad?: (toc: TocEntry[]) => void;
    onPageChange?: (page: number, total: number) => void;
    onRenderComplete?: () => void;
    onError?: (error: string) => void;
  }
): Promise<{ cleanup: () => void; navigateTo?: (href: string) => void; setPage?: (page: number) => void } | null> {
  container.innerHTML = '';
  container.className = 'document-viewer h-full overflow-auto p-4 flex flex-col items-center';

  // Show loading state
  const loadingEl = document.createElement('div');
  loadingEl.className = 'flex items-center justify-center h-full text-slate-400';
  loadingEl.innerHTML = `
    <div class="text-center">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
      <span>Loading document...</span>
    </div>
  `;
  container.appendChild(loadingEl);

  try {
    let viewer: any = null;

    if (type === ResourceType.PDF) {
      const pdfReady = await initPdfJs();
      if (!pdfReady) {
        throw new Error('Failed to load PDF.js');
      }

      // Remove loading indicator
      container.innerHTML = '';

      viewer = await renderPdf(url, container, {
        onPageChange: options?.onPageChange,
        onRenderComplete: options?.onRenderComplete,
        onError: options?.onError,
      });
    } else if (type === ResourceType.EPUB) {
      const epubReady = await initEpubJs();
      if (!epubReady) {
        throw new Error('Failed to load EPUB.js');
      }

      // Remove loading indicator
      container.innerHTML = '';

      viewer = await renderEpub(url, container, {
        onTocLoad: options?.onTocLoad,
        onError: options?.onError,
      });
    } else {
      throw new Error(`Unsupported document type: ${type}`);
    }

    return viewer || null;
  } catch (error) {
    container.innerHTML = `
      <div class="flex items-center justify-center h-full text-red-400">
        <div class="text-center">
          <span class="text-4xl block mb-2">⚠️</span>
          <span>Failed to load document: ${error}</span>
        </div>
      </div>
    `;
    options?.onError?.(`Failed to render document: ${error}`);
    return null;
  }
}

// Extract text from PDF
export async function extractTextFromPdf(url: string): Promise<string> {
  const pdfjsLib = (window as any).pdfjsLib;
  if (!pdfjsLib) {
    throw new Error('PDF.js not initialized');
  }

  try {
    const loadingTask = pdfjsLib.getDocument(url);
    const pdfDoc = await loadingTask.promise;
    const textContent: string[] = [];

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const text = await page.getTextContent();
      const pageText = text.items
        .map((item: any) => item.str)
        .join(' ');
      textContent.push(pageText);
    }

    pdfDoc.destroy();
    return textContent.join('\n\n');
  } catch (error) {
    throw new Error(`Failed to extract text: ${error}`);
  }
}

// Extract text from EPUB
export async function extractTextFromEpub(url: string): Promise<string> {
  const ePub = (window as any).ePub;
  if (!ePub) {
    throw new Error('EPUB.js not initialized');
  }

  try {
    const book = ePub(url);
    await book.ready;

    const chapters: string[] = [];

    // Get all spine items
    const spine = book.packaging.spine;
    for (const item of spine) {
      try {
        const doc = await book.load(item.href);
        const text = doc.documentElement.textContent || '';
        chapters.push(text);
      } catch (e) {
        // Skip failed chapters
      }
    }

    book.destroy();
    return chapters.join('\n\n');
  } catch (error) {
    throw new Error(`Failed to extract text: ${error}`);
  }
}
