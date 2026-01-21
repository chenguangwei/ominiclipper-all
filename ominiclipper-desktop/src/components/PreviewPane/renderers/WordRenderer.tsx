import React, { useEffect, useRef } from 'react';
import { ResourceItem, ColorMode } from '../../../types';
import Icon from '../../Icon';
import * as docxPreview from 'docx-preview';

interface WordRendererProps {
  item: ResourceItem;
  content: ArrayBuffer | null;
  loading: boolean;
  error: string | null;
  onOpenDocument?: (item: ResourceItem) => void;
  colorMode?: ColorMode;
}

const WordRenderer: React.FC<WordRendererProps> = ({
  item,
  content,
  loading,
  error,
  onOpenDocument,
  colorMode = 'dark',
}) => {
  const wordContainerRef = useRef<HTMLDivElement>(null);
  const isLight = colorMode === 'light';

  useEffect(() => {
    if (!content || loading || error) {
      return;
    }

    let isMounted = true;

    const renderWord = async () => {
      // Wait for container to be ready
      const waitForContainer = async (maxAttempts = 10): Promise<HTMLDivElement | null> => {
        for (let i = 0; i < maxAttempts; i++) {
          if (wordContainerRef.current) {
            return wordContainerRef.current;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return null;
      };

      const container = await waitForContainer();
      if (!container || !isMounted) {
        return;
      }

      try {
        // Clear previous content
        container.innerHTML = '';

        // Render Word document
        await docxPreview.renderAsync(content, container, undefined, {
          className: 'docx-preview-content',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: false,
          trimXmlDeclaration: true,
          useBase64URL: true,
        });
      } catch (err: any) {
        console.error('Word preview error:', err);
      }
    };

    renderWord();

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
            <span className={`text-sm ${isLight ? 'text-gray-500' : 'text-content-secondary'}`}>Loading Word document...</span>
          </div>
        </div>
      )}
      <div
        ref={wordContainerRef}
        className={`flex-1 rounded-lg p-4 overflow-auto ${isLight ? 'bg-white border border-gray-200' : 'bg-white'} ${loading ? 'hidden' : ''}`}
        style={{ minHeight: '400px' }}
      >
        {/* Word content will be rendered here by docx-preview */}
      </div>
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

export default WordRenderer;
