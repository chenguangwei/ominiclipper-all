import React, { useEffect, useRef } from 'react';
import { ResourceItem, ColorMode, ResourceType } from '../../../types';
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

  // Check for legacy .doc format (D0 CF 11 E0)
  const isLegacyDoc = React.useMemo(() => {
    if (content && content.byteLength >= 4) {
      const header = new Uint8Array(content.slice(0, 4));
      const hex = Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
      return hex === 'D0 CF 11 E0';
    }
    return false;
  }, [content]);

  useEffect(() => {
    // 增加 content.byteLength 检查，防止空数据渲染
    if (!content || content.byteLength === 0 || loading || error || isLegacyDoc) {
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

        // Create a copy of the buffer to prevent detachment issues
        const contentCopy = content.slice(0);

        // Render Word document
        await docxPreview.renderAsync(contentCopy, container, undefined, {
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



  if (isLegacyDoc) {
    return (
      <div className="flex-1 flex flex-col h-full min-h-0 items-center justify-center p-6 text-center">
        <Icon name="description" className="text-[48px] text-red-400 mb-4" />
        <h3 className={`text-lg font-medium mb-2 ${isLight ? 'text-gray-900' : 'text-red-400'}`}>
          Legacy Format (.doc)
        </h3>
        <p className={`text-sm max-w-md mb-6 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>
          This is a legacy Microsoft Word 97-2003 document. The built-in viewer only supports modern Word documents (.docx).
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {item.localPath && (window as any).electronAPI ? (
            <button
              onClick={() => (window as any).electronAPI?.openPath(item.localPath)}
              className={`w-full px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors ${isLight
                ? 'bg-[#007aff] text-white hover:bg-[#0066d6]'
                : 'bg-primary text-white hover:bg-primary/90'
                }`}
            >
              <Icon name="open_in_new" className="text-[18px]" />
              Open with Word
            </button>
          ) : (
            <div className={`w-full px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 ${isLight ? 'bg-gray-100 text-gray-500' : 'bg-[#252525] text-slate-400'}`}>
              <Icon name="info" className="text-[18px]" />
              Cannot open externally
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
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

export default WordRenderer;
