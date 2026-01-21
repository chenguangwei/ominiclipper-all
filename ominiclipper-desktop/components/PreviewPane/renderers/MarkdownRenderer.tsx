import React, { useEffect, useState } from 'react';
import { ResourceItem, ColorMode } from 'types';
import Icon from 'components/Icon';
import Markdown from 'react-markdown';

interface MarkdownRendererProps {
  item: ResourceItem;
  content: ArrayBuffer | null;
  loading: boolean;
  error: string | null;
  onOpenDocument?: (item: ResourceItem) => void;
  colorMode?: ColorMode;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  item,
  content,
  loading,
  error,
  onOpenDocument,
  colorMode = 'dark',
}) => {
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const isLight = colorMode === 'light';

  useEffect(() => {
    if (!content || loading || error) {
      return;
    }

    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(content);
    setMarkdownContent(text);
  }, [content, loading, error]);

  const shouldShowView = onOpenDocument;

  return (
    <div className="flex-1 flex flex-col">
      <div
        className={`flex-1 rounded-lg p-6 overflow-auto prose max-w-none ${
          isLight
            ? 'bg-white border border-gray-200 prose-gray'
            : 'bg-surface-tertiary prose-invert'
        }`}
        style={{ minHeight: '400px' }}
      >
        {markdownContent ? (
          <div className="markdown-content">
            <Markdown>{markdownContent}</Markdown>
          </div>
        ) : (
          <div className="text-center py-8">
            <Icon name="article" className={`text-[48px] opacity-20 ${isLight ? 'text-gray-400' : 'text-content-secondary'}`} />
            <p className={`text-sm mt-2 ${isLight ? 'text-gray-500' : 'text-content-secondary'}`}>No content available</p>
          </div>
        )}
      </div>
      {shouldShowView && onOpenDocument && (
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

export default MarkdownRenderer;
