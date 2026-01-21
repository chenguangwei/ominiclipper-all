import React, { useEffect, useRef } from 'react';
import { ResourceItem, ColorMode } from '../../../types';
import Icon from '../../Icon';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker (required for PDF.js to work)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

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

  useEffect(() => {
    if (!content || loading || error) {
      return;
    }

    let isMounted = true;

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
        const pdf = await pdfjsLib.getDocument({ data: content.slice(0) }).promise;

        // Render first page
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });

        // Create canvas for rendering
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.backgroundColor = '#ffffff';
        canvas.style.border = '1px solid #e5e5e5';
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';

        container.appendChild(canvas);

        // Render page to canvas
        await page.render({
          canvasContext: context!,
          viewport: viewport,
          canvas: canvas,
        }).promise;
      } catch (err: any) {
        console.error('PDF preview error:', err);
      }
    };

    renderPDF();

    return () => {
      isMounted = false;
    };
  }, [content, loading, error]);

  const shouldShowView = onOpenDocument;

  return (
    <div className="flex-1 flex flex-col">
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className={`animate-spin w-8 h-8 border-2 rounded-full mx-auto mb-3 ${isLight ? 'border-[#007aff] border-t-transparent' : 'border-primary border-t-transparent'}`}></div>
            <span className={`text-sm ${isLight ? 'text-gray-500' : 'text-content-secondary'}`}>Loading PDF...</span>
          </div>
        </div>
      )}
      <div
        ref={pdfContainerRef}
        className={`flex-1 rounded-lg overflow-auto p-4 ${isLight ? 'bg-gray-100' : 'bg-surface-tertiary'} ${loading ? 'hidden' : ''}`}
        style={{ minHeight: '400px' }}
      >
        {/* PDF content rendered here */}
      </div>
      {/* Open in Viewer button */}
      {!loading && shouldShowView && onOpenDocument && (
        <div className={`flex items-center justify-center gap-4 mt-4 py-3 rounded-lg ${isLight ? 'bg-gray-100' : 'bg-surface-tertiary'}`}>
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
