/**
 * Preview Pane Component
 * Enhanced with document content preview and light/dark mode support
 */

import React, { useState, useEffect, useRef } from 'react';
import { ResourceItem, ResourceType, ColorMode } from '../types';
import Icon from './Icon';
import { formatDate, formatRelativeTime } from '../services/i18n';
import * as docxPreview from 'docx-preview';
import Markdown from 'react-markdown';
import * as pdfjsLib from 'pdfjs-dist';
import TagSelector from './TagSelector';
import TypeDropdown from './TypeDropdown';

// Configure PDF.js worker (required for PDF.js to work)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Get the effective resource type, checking file extension for UNKNOWN types
 */
const getEffectiveType = (item: ResourceItem): ResourceType => {
  if (item.type !== ResourceType.UNKNOWN) {
    return item.type;
  }

  // For UNKNOWN types, check the file extension
  const filePath = item.localPath || item.originalPath || item.path || '';
  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'md':
    case 'markdown':
    case 'txt':
      return ResourceType.MARKDOWN;
    case 'pdf':
      return ResourceType.PDF;
    case 'doc':
    case 'docx':
      return ResourceType.WORD;
    case 'epub':
      return ResourceType.EPUB;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
      return ResourceType.IMAGE;
    default:
      return ResourceType.UNKNOWN;
  }
};


interface PreviewPaneProps {
  item: ResourceItem | null;
  getTagName: (id: string) => string;
  onDelete?: () => void;
  onEdit?: () => void;
  onToggleStar?: (id: string) => void;
  onGenerateSummary?: (id: string) => void;
  isGeneratingSummary?: boolean;
  onOpenDocument?: (item: ResourceItem) => void;
  colorMode?: ColorMode;
  // Inline editing props
  availableTags?: { id: string; name: string; color?: string; count?: number }[];
  onRemoveTag?: (itemId: string, tagId: string) => void;
  onAddTag?: (itemId: string, tagId: string) => void;
  onCreateTag?: (name: string) => Promise<string | null>;
  onChangeType?: (itemId: string, newType: ResourceType) => void;
}

const PreviewPane: React.FC<PreviewPaneProps> = ({
  item,
  getTagName,
  onDelete,
  onEdit,
  onToggleStar,
  onGenerateSummary,
  isGeneratingSummary = false,
  onOpenDocument,
  colorMode = 'dark',
  // Inline editing props
  availableTags = [],
  onRemoveTag,
  onAddTag,
  onCreateTag,
  onChangeType,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'preview'>('details');
  const isLight = colorMode === 'light';

  // Get the effective type for rendering (checks file extension for UNKNOWN types)
  const effectiveType = item ? getEffectiveType(item) : ResourceType.UNKNOWN;

  // Preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Word document preview
  const wordContainerRef = useRef<HTMLDivElement>(null);

  // PDF preview
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // Markdown preview
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);

  // Load preview when tab changes to preview
  useEffect(() => {
    if (activeTab !== 'preview' || !item) {
      return;
    }

    let isMounted = true;

    const getDocumentUrl = async (itemEffectiveType: ResourceType): Promise<string | null> => {
      console.log('getDocumentUrl called for item:', item.title, 'type:', itemEffectiveType);

      // For embedded data
      if (item.embeddedData) {
        const mimeType = item.mimeType || 'application/octet-stream';
        console.log('Using embedded data');
        return `data:${mimeType};base64,${item.embeddedData}`;
      }

      // For local files in Electron
      const filePath = item.localPath || item.originalPath || item.path;
      console.log('File path:', filePath);

      // For PDF and images, we need to read the file as data URL
      if (filePath && (itemEffectiveType === ResourceType.PDF || itemEffectiveType === ResourceType.IMAGE)) {
        if ((window as any).electronAPI?.readFileAsDataUrl) {
          try {
            console.log('Reading file as data URL...');
            const result = await (window as any).electronAPI.readFileAsDataUrl(filePath);
            if (result.success) {
              console.log('File read successfully');
              return result.dataUrl;
            } else {
              console.error('Failed to read file:', result.error);
            }
          } catch (e) {
            console.error('Failed to read file:', e);
          }
        } else {
          console.error('electronAPI.readFileAsDataUrl not available');
        }
      }

      // Fallback to path (for web URLs)
      if (item.path && (item.path.startsWith('http://') || item.path.startsWith('https://'))) {
        console.log('Using web URL');
        return item.path;
      }

      console.log('No URL available');
      return null;
    };

    // Load Word document preview
    const loadWordPreview = async () => {
      const filePath = item.localPath || item.originalPath || item.path;
      if (!filePath) {
        setPreviewError('No document path available');
        setPreviewLoading(false);
        return;
      }

      try {
        // Read file as ArrayBuffer via Electron API
        if ((window as any).electronAPI?.readFile) {
          const result = await (window as any).electronAPI.readFile(filePath);
          if (result.success && result.buffer) {
            // Convert base64 to ArrayBuffer
            const binaryString = atob(result.buffer);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const arrayBuffer = bytes.buffer;

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
              if (isMounted) {
                setPreviewError('Preview container not available');
                setPreviewLoading(false);
              }
              return;
            }

            // Clear previous content
            container.innerHTML = '';

            // Render Word document
            await docxPreview.renderAsync(arrayBuffer, container, undefined, {
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

            if (isMounted) {
              setPreviewLoading(false);
            }
          } else {
            throw new Error(result.error || 'Failed to read file');
          }
        } else {
          throw new Error('File reading not available');
        }
      } catch (error: any) {
        console.error('Word preview error:', error);
        if (isMounted) {
          setPreviewError(error.message || 'Failed to load Word document');
          setPreviewLoading(false);
        }
      }
    };

    // Load PDF preview (similar to Word - read file as ArrayBuffer and render)
    const loadPdfPreview = async () => {
      console.log('[PDF Preview] loadPdfPreview called');
      console.log('[PDF Preview] pdfContainerRef.current:', pdfContainerRef.current);
      console.log('[PDF Preview] isMounted:', isMounted);

      // Wait for container to be ready BEFORE reading file
      let container = pdfContainerRef.current;
      let attempts = 0;
      while (!container && attempts < 20 && isMounted) {
        await new Promise(resolve => setTimeout(resolve, 50));
        container = pdfContainerRef.current;
        attempts++;
        console.log(`[PDF Preview] Waiting for container, attempt ${attempts}:`, container);
      }

      console.log('[PDF Preview] After waiting, container:', container);

      if (!container || !isMounted) {
        if (isMounted) {
          setPreviewError('Preview container not available');
          setPreviewLoading(false);
        }
        return;
      }

      const filePath = item.localPath || item.originalPath || item.path;
      if (!filePath) {
        setPreviewError('No document path available');
        setPreviewLoading(false);
        return;
      }

      try {
        // Read file as ArrayBuffer via Electron API (like Word does)
        if ((window as any).electronAPI?.readFile) {
          console.log('[PDF Preview] Reading file...');
          const result = await (window as any).electronAPI.readFile(filePath);
          if (result.success && result.buffer) {
            console.log('[PDF Preview] File read successfully');
            // Convert base64 to ArrayBuffer
            const binaryString = atob(result.buffer);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const arrayBuffer = bytes.buffer;

            // Clear previous content
            container.innerHTML = '';
            console.log('[PDF Preview] Container cleared, innerHTML:', container.innerHTML.length);

            // Load PDF document
            console.log('[PDF Preview] Loading PDF document...');
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
            console.log('[PDF Preview] PDF loaded, page count:', pdf.numPages);

            // Render first page
            const page = await pdf.getPage(1);
            console.log('[PDF Preview] Page 1 loaded');
            const viewport = page.getViewport({ scale: 1.5 });
            console.log('[PDF Preview] Viewport:', viewport.width, 'x', viewport.height);

            // Create canvas for rendering
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            // 添加背景色和边框以便调试
            canvas.style.backgroundColor = '#ffffff';
            canvas.style.border = '1px solid #e5e5e5';
            canvas.style.display = 'block';
            canvas.style.margin = '0 auto';
            console.log('[PDF Preview] Canvas created:', canvas.width, 'x', canvas.height);

            container.appendChild(canvas);
            console.log('[PDF Preview] Canvas appended to container');
            console.log('[PDF Preview] Container children count:', container.children.length);

            // Render page to canvas
            console.log('[PDF Preview] Starting page render...');
            await page.render({
              canvasContext: context!,
              viewport: viewport,
              canvas: canvas,
            }).promise;

            console.log('[PDF Preview] PDF first page rendered successfully');
            console.log('[PDF Preview] Final container innerHTML length:', container.innerHTML.length);

            if (isMounted) {
              setPreviewLoading(false);
            }
          } else {
            throw new Error(result.error || 'Failed to read file');
          }
        } else {
          throw new Error('File reading not available');
        }
      } catch (error: any) {
        console.error('PDF preview error:', error);
        if (isMounted) {
          setPreviewError(error.message || 'Failed to load PDF');
          setPreviewLoading(false);
        }
      }
    };

    // Load Markdown preview
    const loadMarkdownPreview = async () => {
      const filePath = item.localPath || item.originalPath || item.path;
      if (!filePath) {
        setPreviewError('No file path available');
        setPreviewLoading(false);
        return;
      }

      try {
        if ((window as any).electronAPI?.readFile) {
          const result = await (window as any).electronAPI.readFile(filePath);
          if (result.success && result.content) {
            if (isMounted) {
              setMarkdownContent(result.content);
              setPreviewLoading(false);
            }
          } else {
            throw new Error(result.error || 'Failed to read file');
          }
        } else {
          throw new Error('File reading not available');
        }
      } catch (error: any) {
        console.error('Markdown preview error:', error);
        if (isMounted) {
          setPreviewError(error.message || 'Failed to load Markdown');
          setPreviewLoading(false);
        }
      }
    };

    const loadPreview = async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      setImageUrl(null);
      setMarkdownContent(null);

      // Get the effective type (checks file extension for UNKNOWN types)
      const effectiveType = getEffectiveType(item);

      try {
        // Word, Markdown and PDF use direct file reading (like Word)
        if (effectiveType === ResourceType.WORD) {
          await loadWordPreview();
        } else if (effectiveType === ResourceType.PDF) {
          await loadPdfPreview();
        } else if (effectiveType === ResourceType.MARKDOWN) {
          await loadMarkdownPreview();
        } else if (effectiveType === ResourceType.IMAGE) {
          // Image uses data URL
          const url = await getDocumentUrl(effectiveType);
          if (isMounted) {
            setImageUrl(url);
            setPreviewLoading(false);
          }
        } else {
          // EPUB and other types
          if (isMounted) {
            setPreviewLoading(false);
          }
        }
      } catch (error: any) {
        if (isMounted) {
          setPreviewError(error.message || 'Failed to load preview');
          setPreviewLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      isMounted = false;
    };
  }, [activeTab, item]);

  // Manual reload function for retry button
  const reloadPreview = () => {
    if (item && activeTab === 'preview') {
      // Force re-run by triggering state change
      setPreviewError(null);
      setPreviewLoading(true);
      // The useEffect will handle the actual loading
    }
  };

  if (!item) {
    return (
      <div className={`flex-1 flex items-center justify-center flex-col gap-2 select-none ${
        isLight ? 'bg-gray-50 text-gray-400' : 'bg-surface-secondary text-content-secondary'
      }`}>
        <Icon name="description" className="text-[64px] opacity-20" />
        <span className="text-sm font-medium opacity-50">No item selected</span>
      </div>
    );
  }

  // Use originalPath if available (for imported files), otherwise use path
  const displayPath = item.originalPath || item.path || 'Local / Library';
  // Check if this item can be viewed in document viewer
  const canViewInDocument = (
    item.type === ResourceType.PDF ||
    item.type === ResourceType.EPUB ||
    item.type === ResourceType.WORD ||
    item.type === ResourceType.IMAGE
  ) && (item.path || item.embeddedData || item.localPath);
  // For document types, always show "View" button
  const shouldShowView = canViewInDocument && onOpenDocument;

  const getBigIcon = () => {
    switch (item.type) {
      case ResourceType.WORD: return <Icon name="description" className="text-[64px] text-word-blue/20" />;
      case ResourceType.PDF: return <Icon name="picture_as_pdf" className="text-[64px] text-pdf-red/20" />;
      case ResourceType.EPUB: return <Icon name="auto_stories" className="text-[64px] text-epub-purple/20" />;
      case ResourceType.IMAGE: return <Icon name="image" className="text-[64px] text-content-secondary/20" />;
      default: return <Icon name="article" className="text-[64px] text-content-secondary/20" />;
    }
  };

  const getKindLabel = () => {
    switch (item.type) {
      case ResourceType.WORD: return 'Microsoft Word';
      case ResourceType.PDF: return 'PDF Document';
      case ResourceType.EPUB: return 'EPUB eBook';
      case ResourceType.WEB: return 'Web Page';
      case ResourceType.IMAGE: return 'Image';
      default: return 'Document';
    }
  };

  // Open in system default application (for documents)
  const handleOpenInSystem = async () => {
    // For documents, try to open with system default app
    const filePath = item.localPath || item.originalPath;
    if (filePath && (window as any).electronAPI?.openPath) {
      try {
        await (window as any).electronAPI.openPath(filePath);
      } catch (error) {
        console.error('Failed to open file:', error);
        // Fallback to viewer if available
        if (shouldShowView && onOpenDocument) {
          onOpenDocument(item);
        }
      }
    } else if (shouldShowView && onOpenDocument) {
      // Fallback to internal viewer
      onOpenDocument(item);
    }
  };

  // Show file in Finder/Explorer
  const handleShowInFolder = async () => {
    const filePath = item.localPath || item.originalPath;
    if (filePath && (window as any).electronAPI?.showItemInFolder) {
      try {
        await (window as any).electronAPI.showItemInFolder(filePath);
      } catch (error) {
        console.error('Failed to show in folder:', error);
      }
    }
  };

  // Open item (document, image, or web link)
  const handleOpen = () => {
    // For web pages, open URL in browser
    if (item.type === ResourceType.WEB && item.path) {
      if ((window as any).electronAPI?.openExternal) {
        (window as any).electronAPI.openExternal(item.path);
      } else {
        window.open(item.path, '_blank');
      }
      return;
    }

    // For images, try to open with system app, or fallback to document viewer
    if (item.type === ResourceType.IMAGE) {
      const filePath = item.localPath || item.originalPath || item.path;
      if (filePath && (window as any).electronAPI?.openPath) {
        try {
          (window as any).electronAPI.openPath(filePath);
          return;
        } catch (error) {
          console.error('Failed to open image:', error);
        }
      }
      // Fallback: open in document viewer
      if (onOpenDocument) {
        onOpenDocument(item);
      } else if (item.path) {
        // Last resort: try to open directly
        if ((window as any).electronAPI?.openExternal) {
          (window as any).electronAPI.openExternal(item.path);
        } else {
          window.open(item.path, '_blank');
        }
      }
      return;
    }

    // For documents with viewer, open in viewer
    if (shouldShowView && onOpenDocument) {
      onOpenDocument(item);
    } else if (item.path) {
      // Fallback: try to open path directly
      if ((window as any).electronAPI?.openExternal) {
        (window as any).electronAPI.openExternal(item.path);
      } else {
        window.open(item.path, '_blank');
      }
    }
  };

  const handleCopyPath = () => {
    if (item.originalPath || item.path) {
      navigator.clipboard.writeText(item.originalPath || item.path || '');
    }
  };

  // Light mode classes
  const mainClass = isLight
    ? 'flex-1 flex flex-col bg-white relative overflow-hidden'
    : 'flex-1 flex flex-col bg-surface-secondary relative overflow-hidden';

  const tabActiveClass = isLight
    ? 'text-[#007aff] border-[#007aff]'
    : 'text-primary border-primary';

  const tabInactiveClass = isLight
    ? 'text-gray-400 border-transparent hover:text-gray-600'
    : 'text-content-secondary border-transparent hover:text-content';

  const headerBannerClass = isLight
    ? 'w-full h-32 bg-gray-100 flex items-center justify-center select-none overflow-hidden relative'
    : 'w-full h-32 bg-surface-tertiary flex items-center justify-center select-none overflow-hidden relative';

  const gradientOverlayClass = isLight
    ? 'bg-gradient-to-t from-gray-100 via-transparent to-transparent'
    : 'bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent';

  const iconBoxClass = isLight
    ? 'h-20 w-20 rounded-xl bg-white border border-gray-200 shadow-lg flex items-center justify-center shrink-0'
    : 'h-20 w-20 rounded-xl bg-surface-tertiary border border-[rgb(var(--color-border)/0.1)] shadow-2xl flex items-center justify-center shrink-0';

  const titleClass = isLight ? 'text-2xl font-bold text-gray-900 leading-tight tracking-tight' : 'text-2xl font-bold text-white leading-tight tracking-tight';

  const detailsSectionClass = isLight ? 'prose max-w-none mt-8 border-t border-gray-200 pt-8' : 'prose prose-invert max-w-none mt-8 border-t border-[rgb(var(--color-border)/var(--border-opacity))] pt-8';

  const labelClass = isLight ? 'text-[10px] uppercase text-gray-400 font-bold mb-1' : 'text-[10px] uppercase text-content-secondary font-bold mb-1';

  const contentClass = isLight ? 'text-base text-gray-700 leading-relaxed font-light' : 'text-base text-content leading-relaxed font-light';

  const detailItemClass = isLight
    ? 'p-3 border-l-2 border-gray-200 pl-4'
    : 'p-3 border-l-2 border-[rgb(var(--color-border)/0.1)] pl-4';

  const openButtonClass = isLight
    ? 'flex-1 bg-[#007aff] hover:bg-[#0066d6] disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm'
    : 'flex-1 bg-primary hover:bg-primary/90 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20';

  const secondaryButtonClass = isLight
    ? 'px-4 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-lg transition-all border border-gray-300 flex items-center gap-2 shadow-sm'
    : 'px-4 bg-surface-tertiary hover:bg-surface-tertiary/80 text-content font-medium py-2 rounded-lg transition-colors border border-[rgb(var(--color-border)/0.1)] flex items-center gap-2';

  const deleteButtonClass = isLight
    ? 'px-4 bg-white hover:bg-red-50 text-gray-500 hover:text-red-500 font-medium py-2.5 rounded-lg transition-all border border-gray-200 flex items-center gap-2 shadow-sm'
    : 'px-4 bg-surface-tertiary hover:bg-red-500/20 text-content hover:text-red-400 font-medium py-2 rounded-lg transition-colors border border-[rgb(var(--color-border)/0.1)] hover:border-red-500/30 flex items-center gap-2';

  return (
    <main className={mainClass}>
      {/* Tabs */}
      <div className={`flex border-b ${isLight ? 'border-gray-200 bg-gray-50' : 'border-[rgb(var(--color-border)/var(--border-opacity))] bg-surface-tertiary/50'}`}>
        <button
          className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'details' ? tabActiveClass : tabInactiveClass
          }`}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
        <button
          className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'preview' ? tabActiveClass : tabInactiveClass
          }`}
          onClick={() => setActiveTab('preview')}
        >
          Preview
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {activeTab === 'details' ? (
          <>
            {/* Header Banner */}
            <div className={headerBannerClass}>
              <div className="absolute inset-0 opacity-10 flex items-center justify-center scale-150 blur-xl">
                {getBigIcon()}
              </div>
              <div className={`absolute inset-0 ${gradientOverlayClass}`}></div>
            </div>

            {/* Content Container */}
            <div className="max-w-3xl mx-auto px-6 -mt-12 relative z-10 pb-20">
              <div className="flex items-start gap-4 mb-4">
                <div className={iconBoxClass}>
                  {item.type === ResourceType.WEB ? (
                    <Icon name="language" className="text-[40px] text-tag-green" />
                  ) : item.type === ResourceType.IMAGE ? (
                    <Icon name="image" className={`text-[40px] ${item.color ? `text-${item.color}` : 'text-content-secondary'}`} />
                  ) : (
                    <Icon
                      name={item.type === ResourceType.WORD ? "description" : "article"}
                      className={`text-[40px] ${
                        item.type === ResourceType.WORD
                          ? "text-word-blue"
                          : item.type === ResourceType.PDF
                          ? "text-pdf-red"
                          : item.type === ResourceType.EPUB
                          ? "text-epub-purple"
                          : "text-content-secondary"
                      }`}
                    />
                  )}
                </div>

                <div className="pt-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {/* Inline type editor */}
                    {onChangeType ? (
                      <TypeDropdown
                        currentType={item.type}
                        onChangeType={(newType) => onChangeType(item.id, newType)}
                        colorMode={colorMode}
                      />
                    ) : (
                      <span className={`text-[10px] font-bold tracking-wider uppercase ${isLight ? 'text-gray-400' : 'text-content-secondary'}`}>{getKindLabel()}</span>
                    )}
                    {item.isCloud && (
                      <Icon name="cloud" className="text-[12px] text-sky-500" />
                    )}
                  </div>
                  <h1 className={`${titleClass} break-words flex items-center gap-2`}>
                    {item.title}
                    {onToggleStar && (
                      <button
                        onClick={() => onToggleStar(item.id)}
                        className="transition-colors flex-shrink-0"
                        title={item.isStarred ? "Remove from Starred" : "Add to Starred"}
                      >
                        <Icon
                          name={item.isStarred ? "star" : "star_border"}
                          className={`text-[20px] ${item.isStarred ? "text-amber-400" : isLight ? "text-gray-300 hover:text-amber-400" : "text-slate-600 hover:text-amber-400"}`}
                        />
                      </button>
                    )}
                  </h1>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-6 ml-[104px]">
                {item.tags.map(tagId => (
                  <span
                    key={tagId}
                    className={`group flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs ${
                      isLight
                        ? 'bg-gray-100 text-gray-600 border border-gray-200'
                        : 'bg-white/5 border border-[rgb(var(--color-border)/0.1)] text-content hover:bg-white/10'
                    } transition-colors`}
                  >
                    {getTagName(tagId)}
                    {/* Inline delete button */}
                    {onRemoveTag && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveTag(item.id, tagId);
                        }}
                        className={`ml-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                          isLight ? 'text-gray-400 hover:text-gray-600' : 'text-content-secondary hover:text-content'
                        }`}
                        title="Remove tag"
                      >
                        <Icon name="close" className="text-[10px]" />
                      </button>
                    )}
                  </span>
                ))}

                {/* Add tag button */}
                {onAddTag && (
                  <TagSelector
                    availableTags={availableTags}
                    selectedTags={item.tags}
                    onAddTag={(tagId) => onAddTag(item.id, tagId)}
                    onCreateTag={onCreateTag}
                    colorMode={colorMode}
                  />
                )}

                {item.color && (
                  <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    isLight
                      ? `bg-white border border-gray-200`
                      : `bg-white/5 border border-[rgb(var(--color-border)/0.1)]`
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${isLight ? '' : `bg-${item.color}`}`} style={isLight ? { backgroundColor: item.color.replace('tag-', '').replace('-', '') } : {}}></div>
                    <span className={isLight ? 'text-gray-600' : `text-${item.color}`}>Label</span>
                  </span>
                )}
              </div>

              {/* Details */}
              <div className={detailsSectionClass}>
                {/* AI Summary Section */}
                {item.aiSummary ? (
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon name="auto_awesome" className={`text-[16px] ${isLight ? 'text-[#007aff]' : 'text-primary'}`} />
                      <h3 className={`text-sm font-semibold uppercase tracking-wide ${isLight ? 'text-[#007aff]' : 'text-primary'}`}>AI Summary</h3>
                    </div>
                    <div className={`p-4 rounded-lg border ${
                      isLight
                        ? 'bg-gradient-to-br from-[#007aff]/5 to-purple-500/5 border-[#007aff]/20 text-gray-700'
                        : 'bg-gradient-to-br from-primary/10 to-purple-500/10 border-primary/20 text-content'
                    }`}>
                      {item.aiSummary}
                    </div>
                  </div>
                ) : (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon name="auto_awesome" className={`text-[16px] ${isLight ? 'text-gray-400' : 'text-content-secondary'}`} />
                        <h3 className={`text-sm font-semibold uppercase tracking-wide ${isLight ? 'text-gray-400' : 'text-content-secondary'}`}>AI Summary</h3>
                      </div>
                      {onGenerateSummary && (
                        <button
                          onClick={() => onGenerateSummary(item.id)}
                          disabled={isGeneratingSummary}
                          className={`text-xs flex items-center gap-1 px-3 py-1 rounded-full transition-colors ${
                            isLight
                              ? 'bg-[#007aff]/10 hover:bg-[#007aff]/20 text-[#007aff]'
                              : 'bg-primary/20 hover:bg-primary/30 text-primary'
                          } disabled:opacity-50`}
                        >
                          <Icon name={isGeneratingSummary ? "sync" : "auto_awesome"} className={`text-[14px] ${isGeneratingSummary ? "animate-spin" : ""}`} />
                          {isGeneratingSummary ? "Generating..." : "Generate with AI"}
                        </button>
                      )}
                    </div>
                    <div className={`text-base leading-relaxed font-light italic ${isLight ? 'text-gray-400' : 'text-content-secondary'}`}>
                      No AI summary available. Click "Generate with AI" to create one.
                    </div>
                  </div>
                )}

                {/* Content Snippet */}
                <h3 className={`text-sm font-semibold uppercase tracking-wide mb-2 ${isLight ? 'text-gray-400' : 'text-content-secondary'}`}>Description</h3>
                <div className={contentClass}>
                  {item.contentSnippet || "No description available."}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-8">
                  <div className={detailItemClass}>
                    <span className={labelClass}>Created</span>
                    <span className={`text-sm ${isLight ? 'text-gray-700' : 'text-content'}`}>{formatDate(item.createdAt)}</span>
                  </div>
                  <div className={detailItemClass}>
                    <span className={labelClass}>Updated</span>
                    <span className={`text-sm ${isLight ? 'text-gray-700' : 'text-content'}`}>{formatRelativeTime(item.updatedAt)}</span>
                  </div>
                  <div className={`${detailItemClass} col-span-2`}>
                    <span className={labelClass}>Location</span>
                    <span className={`text-sm break-all ${isLight ? 'text-gray-700' : 'text-content'}`}>{displayPath}</span>
                    {(item.originalPath || item.path) && (
                      <button
                        onClick={handleCopyPath}
                        className={`mt-1.5 text-xs flex items-center gap-1 ${isLight ? 'text-[#007aff] hover:underline' : 'text-primary hover:underline'}`}
                      >
                        <Icon name="content_copy" className="text-[12px]" />
                        Copy path
                      </button>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-8">
                  <button
                    onClick={handleOpen}
                    disabled={!item.path && !canViewInDocument && !item.embeddedData}
                    className={openButtonClass}
                  >
                    <Icon name={item.type === ResourceType.WEB ? "open_in_new" : shouldShowView ? "visibility" : "open_in_new"} />
                    {item.type === ResourceType.WEB ? "Open" : shouldShowView ? "View" : "Open"}
                  </button>
                  {/* For documents, show "Open in System" button */}
                  {canViewInDocument && (item.localPath || item.originalPath) && (
                    <button
                      onClick={handleOpenInSystem}
                      className={secondaryButtonClass}
                      title="Open with default application"
                    >
                      <Icon name="open_in_new" />
                    </button>
                  )}
                  {/* Show in folder button for local files */}
                  {(item.localPath || item.originalPath) && (
                    <button
                      onClick={handleShowInFolder}
                      className={secondaryButtonClass}
                      title="Show in Finder"
                    >
                      <Icon name="folder_open" />
                    </button>
                  )}
                  {onEdit && (
                    <button onClick={onEdit} className={secondaryButtonClass} title="Edit">
                      <Icon name="edit" />
                    </button>
                  )}
                  {onDelete && (
                    <button onClick={onDelete} className={deleteButtonClass} title="Delete">
                      <Icon name="delete" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          // Preview Tab
          <div className="p-6 h-full flex flex-col">
            {/* Loading State - for types that don't have their own loading UI */}
            {previewLoading && effectiveType !== ResourceType.WORD && effectiveType !== ResourceType.PDF && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className={`animate-spin w-8 h-8 border-2 rounded-full mx-auto mb-3 ${isLight ? 'border-[#007aff] border-t-transparent' : 'border-primary border-t-transparent'}`}></div>
                  <span className={`text-sm ${isLight ? 'text-gray-500' : 'text-content-secondary'}`}>Loading preview...</span>
                </div>
              </div>
            )}

            {/* Error State */}
            {previewError && !previewLoading && (
              <div className={`rounded-lg p-6 text-center ${isLight ? 'bg-red-50 border border-red-200' : 'bg-red-500/10 border border-red-500/20'}`}>
                <Icon name="error" className={`text-[48px] mb-3 ${isLight ? 'text-red-400' : 'text-red-400'}`} />
                <p className={`text-sm ${isLight ? 'text-red-600' : 'text-red-400'}`}>{previewError}</p>
                <button
                  onClick={reloadPreview}
                  className={`mt-4 px-4 py-2 rounded-lg text-sm font-medium ${isLight ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}
                >
                  Try Again
                </button>
              </div>
            )}

            {/* PDF Preview - Canvas rendering (like Word) */}
            {!previewError && effectiveType === ResourceType.PDF && (
              <div className="flex-1 flex flex-col">
                {previewLoading && (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className={`animate-spin w-8 h-8 border-2 rounded-full mx-auto mb-3 ${isLight ? 'border-[#007aff] border-t-transparent' : 'border-primary border-t-transparent'}`}></div>
                      <span className={`text-sm ${isLight ? 'text-gray-500' : 'text-content-secondary'}`}>Loading PDF...</span>
                    </div>
                  </div>
                )}
                <div
                  ref={pdfContainerRef}
                  className={`flex-1 rounded-lg overflow-auto p-4 ${isLight ? 'bg-gray-100' : 'bg-surface-tertiary'} ${previewLoading ? 'hidden' : ''}`}
                  style={{ minHeight: '400px' }}
                >
                  {/* PDF content rendered here by loadPdfPreview */}
                </div>
                {/* Open in Viewer button */}
                {!previewLoading && shouldShowView && onOpenDocument && (
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
            )}

            {/* Image Preview */}
            {!previewLoading && !previewError && effectiveType === ResourceType.IMAGE && (
              <div className="flex-1 flex flex-col">
                <div className={`flex-1 rounded-lg p-4 flex items-center justify-center overflow-auto ${isLight ? 'bg-gray-100' : 'bg-surface-tertiary'}`}>
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={item.title}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                      onError={() => setPreviewError('Failed to load image')}
                    />
                  ) : (
                    <div className="text-center">
                      <Icon name="image" className={`text-[64px] opacity-20 ${isLight ? 'text-gray-400' : 'text-content-secondary'}`} />
                      <p className={`text-sm mt-2 ${isLight ? 'text-gray-500' : 'text-content-secondary'}`}>Image not available</p>
                    </div>
                  )}
                </div>
                {(item.localPath || item.originalPath || item.path || onOpenDocument) && (
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={handleOpen}
                      className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${isLight ? 'bg-[#007aff] text-white hover:bg-[#0066d6]' : 'bg-primary text-white hover:bg-primary/80'}`}
                    >
                      <Icon name="fullscreen" className="text-base" />
                      Open Full Size
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Web Link Preview */}
            {!previewLoading && !previewError && effectiveType === ResourceType.WEB && (
              <div className="space-y-4">
                <div className={`rounded-lg p-4 ${isLight ? 'bg-gray-50 border border-gray-200' : 'bg-surface-tertiary'}`}>
                  <p className={`text-xs mb-2 ${isLight ? 'text-gray-400' : 'text-content-secondary'}`}>URL</p>
                  <a
                    href={item.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-sm break-all hover:underline flex items-center gap-2 ${isLight ? 'text-[#007aff]' : 'text-primary'}`}
                  >
                    <Icon name="link" className="text-base flex-shrink-0" />
                    {item.path}
                  </a>
                </div>
                {item.contentSnippet && (
                  <div className={`rounded-lg p-4 ${isLight ? 'bg-gray-50 border border-gray-200' : 'bg-surface-tertiary'}`}>
                    <p className={`text-xs mb-2 ${isLight ? 'text-gray-400' : 'text-content-secondary'}`}>Description</p>
                    <p className={`text-sm ${isLight ? 'text-gray-700' : 'text-content'}`}>{item.contentSnippet}</p>
                  </div>
                )}
                <button
                  onClick={handleOpen}
                  className={`w-full py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${isLight ? 'bg-[#007aff] text-white hover:bg-[#0066d6]' : 'bg-primary text-white hover:bg-primary/80'}`}
                >
                  <Icon name="open_in_new" className="text-base" />
                  Open in Browser
                </button>
              </div>
            )}

            {/* EPUB Preview */}
            {!previewLoading && !previewError && effectiveType === ResourceType.EPUB && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className={`text-center p-8 rounded-xl ${isLight ? 'bg-purple-50' : 'bg-purple-500/10'}`}>
                  <Icon name="auto_stories" className={`text-[64px] mb-4 ${isLight ? 'text-purple-400' : 'text-epub-purple'}`} />
                  <h4 className={`text-lg font-semibold mb-2 ${isLight ? 'text-gray-800' : 'text-white'}`}>{item.title}</h4>
                  <p className={`text-sm mb-6 ${isLight ? 'text-gray-500' : 'text-content-secondary'}`}>
                    EPUB files require the full reader for best experience
                  </p>
                  {shouldShowView && onOpenDocument && (
                    <button
                      onClick={() => onOpenDocument(item)}
                      className={`px-6 py-3 rounded-lg text-sm font-medium flex items-center gap-2 mx-auto ${isLight ? 'bg-purple-500 text-white hover:bg-purple-600' : 'bg-epub-purple text-white hover:bg-epub-purple/80'}`}
                    >
                      <Icon name="menu_book" className="text-base" />
                      Open in Reader
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Word Document Preview */}
            {!previewError && effectiveType === ResourceType.WORD && (
              <div className="flex-1 flex flex-col">
                {previewLoading && (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className={`animate-spin w-8 h-8 border-2 rounded-full mx-auto mb-3 ${isLight ? 'border-[#007aff] border-t-transparent' : 'border-primary border-t-transparent'}`}></div>
                      <span className={`text-sm ${isLight ? 'text-gray-500' : 'text-content-secondary'}`}>Loading Word document...</span>
                    </div>
                  </div>
                )}
                <div
                  ref={wordContainerRef}
                  className={`flex-1 rounded-lg p-4 overflow-auto ${isLight ? 'bg-white border border-gray-200' : 'bg-white'} ${previewLoading ? 'hidden' : ''}`}
                  style={{ minHeight: '400px' }}
                >
                  {/* Word content will be rendered here by docx-preview */}
                </div>
                {!previewLoading && shouldShowView && onOpenDocument && (
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
            )}

            {/* Markdown Preview */}
            {!previewLoading && !previewError && effectiveType === ResourceType.MARKDOWN && (
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
            )}

            {/* Unknown/Other Type */}
            {!previewLoading && !previewError && effectiveType === ResourceType.UNKNOWN && (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className={`text-center p-8 rounded-xl ${isLight ? 'bg-gray-100' : 'bg-surface-tertiary'}`}>
                  <Icon name="insert_drive_file" className={`text-[64px] mb-4 opacity-30 ${isLight ? 'text-gray-400' : 'text-content-secondary'}`} />
                  <h4 className={`text-lg font-semibold mb-2 ${isLight ? 'text-gray-800' : 'text-white'}`}>{item.title}</h4>
                  <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-content-secondary'}`}>
                    Preview not available for this file type
                  </p>
                  {item.path && (
                    <button
                      onClick={handleOpen}
                      className={`mt-6 px-6 py-3 rounded-lg text-sm font-medium flex items-center gap-2 mx-auto ${isLight ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-surface-tertiary text-content hover:bg-white/10'}`}
                    >
                      <Icon name="open_in_new" className="text-base" />
                      Open with System App
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className={`h-10 border-t flex items-center shrink-0 px-4 ${isLight ? 'border-gray-200 bg-gray-50' : 'border-[rgb(var(--color-border)/var(--border-opacity))] bg-surface-tertiary/60'}`}>
        <div className={`flex items-center gap-1.5 text-[10px] ${isLight ? 'text-gray-400' : 'text-content-secondary'}`}>
          <Icon name="folder" className="text-[14px]" />
          <span className={isLight ? 'hover:text-gray-600 cursor-pointer' : 'hover:text-content cursor-pointer'}>Library</span>
          <Icon name="chevron_right" className="text-[12px] opacity-30" />
          <span className={isLight ? 'text-gray-600 truncate max-w-[200px]' : 'text-content truncate max-w-[200px]'}>{item.title}</span>
        </div>
      </footer>
    </main>
  );
};

export default PreviewPane;
