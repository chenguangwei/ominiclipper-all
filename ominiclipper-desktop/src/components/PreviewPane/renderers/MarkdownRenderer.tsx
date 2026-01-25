import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { ResourceItem, ColorMode } from '../../../types';
import Icon from '../../Icon';

interface MarkdownRendererProps {
  item: ResourceItem;
  content: ArrayBuffer | string | null;
  loading: boolean;
  error: string | null;
  onOpenDocument?: (item: ResourceItem) => void;
  colorMode: ColorMode;
  highlightText?: string | null;
}

// Helper component to handle highlighting after render
const HighlightedMarkdown: React.FC<{ content: string; highlightText?: string | null }> = ({ content, highlightText }) => {
  // We use a specific ID to scope our search
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlightText || !containerRef.current) return;

    // Simple textual Highlight:
    // This is a naive implementation. A robust one requires traversing text nodes.
    // For MVP, let's find the text node containing the string and scroll to it.

    const findAndHighlight = () => {
      // Clean previous highlights
      const marks = containerRef.current?.querySelectorAll('mark.search-highlight');
      marks?.forEach(m => {
        const parent = m.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(m.textContent || ''), m);
          parent.normalize();
        }
      });

      if (!highlightText) return;

      // Tree Walker to find text nodes
      const walker = document.createTreeWalker(
        containerRef.current!,
        NodeFilter.SHOW_TEXT,
        null
      );

      const nodesToHighlight: { node: Node, index: number }[] = [];
      let node;
      while (node = walker.nextNode()) {
        const idx = node.textContent?.toLowerCase().indexOf(highlightText.toLowerCase());
        if (idx !== undefined && idx !== -1) {
          nodesToHighlight.push({ node, index: idx });
          // Highlight all or just first? Let's highlight first relevant one for deep linking
          // Actually, for deep link, we usually just want to jump to the first one.
          // Let's break after first match for performance in large docs if we just want to jump.
          break;
        }
      }

      if (nodesToHighlight.length > 0) {
        const { node, index } = nodesToHighlight[0];
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + highlightText.length);

        const mark = document.createElement('mark');
        mark.className = 'search-highlight bg-yellow-300 text-black rounded-sm px-0.5';
        try {
          range.surroundContents(mark);
          mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {
          console.warn('Could not highlight range:', e);
        }
      }
    };

    // Small delay to ensure rendering
    setTimeout(findAndHighlight, 100);

  }, [content, highlightText]);

  return (
    <div ref={containerRef}>
      <Markdown>{content}</Markdown>
    </div>
  );
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  item,
  content,
  loading,
  onOpenDocument,
  colorMode,
  highlightText
}) => {
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const isLight = colorMode === 'light';

  useEffect(() => {
    if (!content) {
      setMarkdownContent(null);
      return;
    }

    if (typeof content === 'string') {
      setMarkdownContent(content);
    } else {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(content);
      setMarkdownContent(text);
    }
  }, [content]);

  if (loading) return null;

  return (
    <div className={`h-full flex flex-col ${isLight ? 'bg-white text-gray-800' : 'bg-[#1e1e1e] text-gray-200'}`}>
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className={`prose max-w-none ${isLight ? 'prose-slate' : 'prose-invert'} ${highlightText ? 'highlight-mode' : ''}`}>
          {markdownContent ? (
            <div className="markdown-content">
              <HighlightedMarkdown
                content={markdownContent}
                highlightText={highlightText}
              />
            </div>
          ) : (
            <div className="text-center opacity-50 italic">No content</div>
          )}
        </div>
      </div>

      {onOpenDocument && (
        <div className={`shrink-0 p-4 border-t ${isLight ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-surface-tertiary'} flex justify-center`}>
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
