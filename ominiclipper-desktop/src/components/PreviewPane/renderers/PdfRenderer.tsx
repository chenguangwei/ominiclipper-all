import React, { useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// Use explicit path that matches our vite config copy
import { ResourceItem, ColorMode, ResourceType } from '../../../types';
import Icon from '../../Icon';

// Configure PDF.js worker
// In dev, the vite plugin serves it at /pdf.worker.min.mjs
// In prod, it is copied to dist/pdf.worker.min.mjs
interface PdfRendererProps {
  item: ResourceItem;
  content: ArrayBuffer | null;
  loading: boolean;
  error: string | null;
  onOpenDocument?: (item: ResourceItem) => void;
  colorMode?: ColorMode;
}

const PdfRenderer: React.FC<PdfRendererProps> = ({
  item,
  content,
  loading,
  error,
  onOpenDocument,
  colorMode = 'dark',
}) => {
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const isLight = colorMode === 'light';
  const [renderError, setRenderError] = React.useState<string | null>(null);

  useEffect(() => {
    if (!content || loading || error) {
      return;
    }

    let isMounted = true;
    setRenderError(null);

    const renderPDF = async () => {
      // Wait for container to be ready
      let container = pdfContainerRef.current;
      let attempts = 0;
      while (!container && attempts < 20 && isMounted) {
        await new Promise(resolve => setTimeout(resolve, 50));
        container = pdfContainerRef.current;
        attempts++;
      }

      if (!container || !isMounted) {
        return;
      }

      try {
        // Clear previous content
        container.innerHTML = '';

        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({ data: content.slice(0) });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;

        console.log(`Rendering PDF with ${totalPages} pages`);

        // Render all pages
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          if (!isMounted) break;

          // Process each page
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.5 });

          // Create wrapper for the page to add spacing
          const pageWrapper = document.createElement('div');
          pageWrapper.style.marginBottom = '20px';
          pageWrapper.style.display = 'flex';
          pageWrapper.style.justifyContent = 'center';
          container.appendChild(pageWrapper);

          // Create canvas for rendering
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          // Style canvas
          canvas.style.backgroundColor = '#ffffff';
          canvas.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
          if (isLight) {
            canvas.style.border = '1px solid #e5e5e5';
          }

          pageWrapper.appendChild(canvas);

          // Render page to canvas
          // Use await to render sequentially to avoid overwhelming the browser
          await page.render({
            canvasContext: context!,
            viewport: viewport,
            canvas: canvas,
          }).promise;
        }

      } catch (err: any) {
        console.error('PDF preview error:', err);
        if (isMounted) setRenderError('Failed to render PDF: ' + (err.message || 'Unknown error'));
      }
    };

    renderPDF();

    return () => {
      isMounted = false;
    };
  }, [content, loading, error, isLight]);

  const shouldShowView = onOpenDocument;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className={`animate-spin w-8 h-8 border-2 rounded-full mx-auto mb-3 ${isLight ? 'border-[#007aff] border-t-transparent' : 'border-primary border-t-transparent'}`}></div>
            <span className={`text-sm ${isLight ? 'text-gray-500' : 'text-content-secondary'}`}>Loading PDF...</span>
          </div>
        </div>
      )}

      {/* Scrollable Container */}
      <div
        ref={pdfContainerRef}
        className={`flex-1 overflow-y-auto p-4 ${isLight ? 'bg-gray-100' : 'bg-surface-tertiary'} ${loading ? 'hidden' : ''}`}
        style={{ minHeight: '400px' }}
      >
        {renderError && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <Icon name="error" className="text-red-400 text-[48px] mb-2" />
            <p className={isLight ? 'text-gray-600' : 'text-gray-300'}>{renderError}</p>
          </div>
        )}
      </div>

      {/* Open in Viewer button (optional footer) */}
      {/* Open in Viewer button (optional footer) */}
      {onOpenDocument && (
        <div className={`flex items-center justify-center gap-4 py-3 shrink-0 border-t ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-surface-tertiary border-gray-700'}`}>
          <button
            onClick={() => onOpenDocument(item)}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${isLight ? 'bg-[#007aff] text-white hover:bg-[#0066d6]' : 'bg-primary text-white hover:bg-primary/80'}`}
          >
            <Icon name="fullscreen" className="text-base" />
            Full View
          </button>
        </div>
      )}
    </div>
  );
};

export default PdfRenderer;
