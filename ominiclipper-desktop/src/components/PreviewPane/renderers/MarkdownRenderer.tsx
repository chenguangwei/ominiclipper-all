import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ResourceItem, ColorMode } from '../../../types';
import Icon from '../../Icon';

// Import KaTeX CSS for math rendering
import 'katex/dist/katex.min.css';

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
const HighlightedMarkdown: React.FC<{
  content: string;
  highlightText?: string | null;
  colorMode: ColorMode;
}> = ({ content, highlightText, colorMode }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isLight = colorMode === 'light';

  useEffect(() => {
    if (!highlightText || !containerRef.current) return;

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

    setTimeout(findAndHighlight, 100);
  }, [content, highlightText]);

  // Custom components for react-markdown
  const components = {
    // Code block with syntax highlighting
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';

      if (!inline && language) {
        return (
          <SyntaxHighlighter
            style={isLight ? oneLight : oneDark}
            language={language}
            PreTag="div"
            className="rounded-lg !my-4"
            showLineNumbers={true}
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        );
      }

      // Inline code
      return (
        <code
          className={`px-1.5 py-0.5 rounded text-sm font-mono ${
            isLight
              ? 'bg-gray-100 text-pink-600'
              : 'bg-gray-800 text-pink-400'
          }`}
          {...props}
        >
          {children}
        </code>
      );
    },

    // Table styling
    table({ children }: any) {
      return (
        <div className="overflow-x-auto my-4">
          <table className={`min-w-full border-collapse ${
            isLight ? 'border-gray-300' : 'border-gray-600'
          }`}>
            {children}
          </table>
        </div>
      );
    },
    th({ children }: any) {
      return (
        <th className={`px-4 py-2 text-left font-semibold border ${
          isLight
            ? 'bg-gray-100 border-gray-300'
            : 'bg-gray-800 border-gray-600'
        }`}>
          {children}
        </th>
      );
    },
    td({ children }: any) {
      return (
        <td className={`px-4 py-2 border ${
          isLight ? 'border-gray-300' : 'border-gray-600'
        }`}>
          {children}
        </td>
      );
    },

    // Blockquote styling
    blockquote({ children }: any) {
      return (
        <blockquote className={`border-l-4 pl-4 my-4 italic ${
          isLight
            ? 'border-blue-500 bg-blue-50 text-gray-700'
            : 'border-blue-400 bg-blue-900/20 text-gray-300'
        } py-2 rounded-r`}>
          {children}
        </blockquote>
      );
    },

    // Link styling with external indicator
    a({ href, children }: any) {
      const isExternal = href?.startsWith('http');
      return (
        <a
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className={`underline decoration-1 underline-offset-2 ${
            isLight
              ? 'text-blue-600 hover:text-blue-800'
              : 'text-blue-400 hover:text-blue-300'
          }`}
        >
          {children}
          {isExternal && <span className="text-xs ml-1">↗</span>}
        </a>
      );
    },

    // Image styling
    img({ src, alt }: any) {
      return (
        <img
          src={src}
          alt={alt || ''}
          className="max-w-full h-auto rounded-lg my-4 shadow-md"
          loading="lazy"
        />
      );
    },

    // Heading with anchor link icon (works with rehype-slug and rehype-autolink-headings)
    // The anchor link is prepended by rehype-autolink-headings, styled via CSS
    h1({ children, id }: any) {
      return (
        <h1 id={id} className={`group relative text-3xl font-bold mt-8 mb-4 pb-2 border-b ${
          isLight ? 'border-gray-200' : 'border-gray-700'
        } [&>.anchor-link]:absolute [&>.anchor-link]:-left-6 [&>.anchor-link]:opacity-0 [&>.anchor-link]:transition-opacity hover:[&>.anchor-link]:opacity-100 [&>.anchor-link]:text-gray-400 [&>.anchor-link]:no-underline`}>
          {children}
        </h1>
      );
    },
    h2({ children, id }: any) {
      return (
        <h2 id={id} className={`group relative text-2xl font-bold mt-6 mb-3 pb-2 border-b ${
          isLight ? 'border-gray-200' : 'border-gray-700'
        } [&>.anchor-link]:absolute [&>.anchor-link]:-left-5 [&>.anchor-link]:opacity-0 [&>.anchor-link]:transition-opacity hover:[&>.anchor-link]:opacity-100 [&>.anchor-link]:text-gray-400 [&>.anchor-link]:no-underline`}>
          {children}
        </h2>
      );
    },
    h3({ children, id }: any) {
      return (
        <h3 id={id} className="group relative text-xl font-semibold mt-5 mb-2 [&>.anchor-link]:absolute [&>.anchor-link]:-left-4 [&>.anchor-link]:opacity-0 [&>.anchor-link]:transition-opacity hover:[&>.anchor-link]:opacity-100 [&>.anchor-link]:text-gray-400 [&>.anchor-link]:no-underline">
          {children}
        </h3>
      );
    },
    h4({ children, id }: any) {
      return (
        <h4 id={id} className="group relative text-lg font-semibold mt-4 mb-2 [&>.anchor-link]:absolute [&>.anchor-link]:-left-4 [&>.anchor-link]:opacity-0 [&>.anchor-link]:transition-opacity hover:[&>.anchor-link]:opacity-100 [&>.anchor-link]:text-gray-400 [&>.anchor-link]:no-underline">
          {children}
        </h4>
      );
    },

    // Task list item (GFM)
    li({ children, className }: any) {
      const isTaskItem = className?.includes('task-list-item');
      if (isTaskItem) {
        return (
          <li className="list-none flex items-start gap-2 my-1">
            {children}
          </li>
        );
      }
      return <li className="my-1">{children}</li>;
    },

    // Horizontal rule
    hr() {
      return (
        <hr className={`my-8 border-t ${
          isLight ? 'border-gray-300' : 'border-gray-600'
        }`} />
      );
    },
  };

  return (
    <div ref={containerRef}>
      <Markdown
        remarkPlugins={[
          remarkGfm,
          remarkMath,
        ]}
        rehypePlugins={[
          rehypeRaw,
          rehypeKatex,
          rehypeSlug,
          [rehypeAutolinkHeadings, {
            behavior: 'prepend',
            properties: {
              className: ['anchor-link'],
              ariaHidden: true,
              tabIndex: -1,
            },
            content: {
              type: 'element',
              tagName: 'span',
              properties: { className: ['anchor-icon'] },
              children: [{ type: 'text', value: '#' }],
            },
          }],
        ]}
        components={components}
      >
        {content}
      </Markdown>
    </div>
  );
};

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
    <div className={`h-full flex flex-col min-h-0 overflow-hidden ${isLight ? 'bg-white text-gray-800' : 'bg-[#1e1e1e] text-gray-200'}`}>
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className={`prose max-w-none ${isLight ? 'prose-slate' : 'prose-invert'} ${highlightText ? 'highlight-mode' : ''}`}>
          {markdownContent ? (
            <div className="markdown-content">
              <HighlightedMarkdown
                content={markdownContent}
                highlightText={highlightText}
                colorMode={colorMode}
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
