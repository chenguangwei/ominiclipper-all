/**
 * Document Viewer Component
 * Renders PDF and EPUB documents in-app
 * Uses Chromium's native PDF viewer for PDFs (no network dependency)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ResourceItem, ResourceType } from '../types';
import Icon from './Icon';
import DocxViewer from './DocxViewer';
import PdfRenderer from './PreviewPane/renderers/PdfRenderer';
import * as documentViewer from '../services/documentViewer';
import { formatFileSize, getUsablePath, isElectron, readLocalFileAsDataUrl, recoverItemPath } from '../services/fileManager';

interface DocumentViewerProps {
  item: ResourceItem;
  onClose?: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ item, onClose }) => {
  // Use DocxViewer for Word documents
  if (item.type === ResourceType.WORD) {
    return <DocxViewer item={item} onClose={onClose} />;
  }

  // Only PDF and EPUB are supported in the in-app viewer
  const supportedTypes = [ResourceType.PDF, ResourceType.EPUB];
  if (!supportedTypes.includes(item.type)) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1a1a1a] text-slate-400">
        <div className="text-center max-w-md p-6">
          <Icon name="info" className="text-[48px] mb-4 opacity-50" />
          <p className="text-lg font-medium text-slate-300 mb-2">Preview Not Available</p>
          <p className="text-sm text-slate-400 mb-6">
            In-app preview is not available for {item.type} files.
            Please use an external application to view this file.
          </p>
          <div className="flex flex-col gap-3">
            {item.localPath && (
              <button
                onClick={() => {
                  (window as any).electronAPI?.openPath(item.localPath);
                }}
                className="w-full px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="open_in_new" className="text-[18px]" />
                Open with System App
              </button>
            )}
            {item.path && (item.path.startsWith('http://') || item.path.startsWith('https://')) && (
              <a
                href={item.path}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="open_in_new" className="text-[18px]" />
                Open in Browser
              </a>
            )}
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 bg-[#252525] rounded-lg text-slate-300 hover:bg-[#303030] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const viewerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [toc, setToc] = useState<documentViewer.TocEntry[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [useNativeViewer, setUseNativeViewer] = useState(false);
  const [pdfContent, setPdfContent] = useState<ArrayBuffer | null>(null);

  // Get usable path (handles embedded data)
  const rawDocumentPath = getUsablePath(item);
  const [resolvedPath, setResolvedPath] = useState<string | null>(null);

  // Debug logging
  console.log('DocumentViewer - rawDocumentPath:', rawDocumentPath?.substring(0, 50) + '...');
  console.log('DocumentViewer - item.type:', item.type);
  console.log('DocumentViewer - item.storageMode:', item.storageMode);
  console.log('DocumentViewer - item.localPath:', item.localPath);

  // Resolve local file paths in Electron environment
  useEffect(() => {
    const resolvePath = async () => {
      setError(null);

      if (!rawDocumentPath) {
        setResolvedPath(null);
        setError('No document path available');
        setIsLoading(false);
        return;
      }

      // For PDF files, use native Chromium viewer via data URL
      if (item.type === ResourceType.PDF) {
        setUseNativeViewer(true);

        // Priority 1: Embedded data - convert to ArrayBuffer for PDF.js
        if (item.storageMode === 'embed' && item.embeddedData) {
          console.log('Using embedded data for PDF');
          // Decode base64 to ArrayBuffer
          const binaryString = window.atob(item.embeddedData);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          setPdfContent(bytes.buffer);
          setIsLoading(false);
          return;
        }

        // Priority 2: Local file in Electron - read as ArrayBuffer
        if (isElectron()) {
          // Try localPath first
          let filePath = item.localPath;

          // If localPath is missing or path is a stale blob, try to recover
          if (!filePath || (item.path && item.path.startsWith('blob:'))) {
            console.log('DocumentViewer: Checking for path recovery...');
            const recovered = await recoverItemPath(item);
            if (recovered) {
              console.log('DocumentViewer: Path recovered:', recovered);
              filePath = recovered;
            }
          }

          // If we have a valid file path, read it as ArrayBuffer
          if (filePath && !filePath.startsWith('http') && !filePath.startsWith('blob:')) {
            console.log('Reading file as ArrayBuffer from:', filePath);
            try {
              const result = await (window as any).electronAPI.fs.readFile(filePath);
              if (result.success && result.buffer) {
                // Electron sends buffer as Uint8Array/Buffer, convert to ArrayBuffer
                // Note: result.buffer from IPC might be a Node Buffer, which matches Uint8Array
                const buffer = result.buffer.buffer ? result.buffer.buffer : result.buffer;
                setPdfContent(buffer);
                setIsLoading(false);
                return;
              }
            } catch (e) {
              console.error('Failed to read local PDF:', e);
            }
          }

          // Fallback: try item.path or originalPath if not blob
          const fallbackPath = item.path || item.originalPath;
          if (fallbackPath && !fallbackPath.startsWith('http') && !fallbackPath.startsWith('blob:')) {
            console.log('Fallback: Reading from', fallbackPath);
            const dataUrl = await readLocalFileAsDataUrl(fallbackPath);
            if (dataUrl) {
              setResolvedPath(dataUrl);
              setIsLoading(false);
              return;
            }
          }
        }

        // Priority 3: HTTP/HTTPS URLs - use directly
        if (rawDocumentPath.startsWith('http://') || rawDocumentPath.startsWith('https://')) {
          setResolvedPath(rawDocumentPath);
          setIsLoading(false);
          return;
        }

        setError('Unable to resolve PDF path. The file may be missing.');
        setIsLoading(false);
        return;
      }

      // For EPUB and other documents, use the existing library-based approach
      setUseNativeViewer(false);

      // If it's a local file reference in Electron, read it as data URL
      if (isElectron()) {
        let filePath = item.localPath;

        // If localPath is missing or path is a stale blob, try to recover
        if (!filePath || (item.path && item.path.startsWith('blob:'))) {
          console.log('DocumentViewer: Checking for path recovery...');
          const recovered = await recoverItemPath(item);
          if (recovered) {
            console.log('DocumentViewer: Path recovered:', recovered);
            filePath = recovered;
          }
        }

        // Read the file if we have a valid path
        if (filePath && !filePath.startsWith('http') && !filePath.startsWith('blob:') && !filePath.startsWith('data:')) {
          console.log('Loading local file:', filePath);
          setIsLoading(true);
          const dataUrl = await readLocalFileAsDataUrl(filePath);
          if (dataUrl) {
            console.log('Local file loaded successfully, size:', dataUrl.length);
            setResolvedPath(dataUrl);
          } else {
            console.error('Failed to load local file');
            setResolvedPath(null);
            setError('Failed to read local file. The file may have been moved or deleted.');
            setIsLoading(false);
          }
          return;
        }

        // Fallback: try item.path if not blob
        if (item.path && !item.path.startsWith('http') && !item.path.startsWith('blob:')) {
          console.log('Fallback: Reading from', item.path);
          setIsLoading(true);
          const dataUrl = await readLocalFileAsDataUrl(item.path);
          if (dataUrl) {
            setResolvedPath(dataUrl);
          } else {
            setResolvedPath(null);
            setError('Failed to read local file. The file may have been moved or deleted.');
            setIsLoading(false);
          }
          return;
        }
      }

      // For embedded data or other URLs, use as-is
      console.log('Using raw document path directly');
      setResolvedPath(rawDocumentPath);
    };

    resolvePath();
  }, [rawDocumentPath, item.storageMode, item.localPath, item.type, item.embeddedData, item.path]);

  const loadDocument = useCallback(async () => {
    // For native viewer (PDF), we don't need to load via documentViewer service
    if (useNativeViewer) {
      console.log('Using native Chromium PDF viewer');
      return;
    }

    if (!containerRef.current) {
      return;
    }

    if (!resolvedPath) {
      // Still waiting for path resolution
      console.log('Waiting for path resolution...');
      return;
    }

    const container = containerRef.current;
    setIsLoading(true);
    setError(null);

    console.log('Loading document:', resolvedPath.substring(0, 100) + '...');

    try {
      const viewer = await documentViewer.renderDocument(
        resolvedPath,
        item.type,
        container,
        {
          onTocLoad: (tocEntries) => {
            setToc(tocEntries);
          },
          onPageChange: (page, total) => {
            setCurrentPage(page);
            setTotalPages(total);
          },
          onRenderComplete: () => {
            setIsLoading(false);
            console.log('Document render complete');
          },
          onError: (err) => {
            console.error('Document viewer error:', err);
            setError(err);
            setIsLoading(false);
          },
        }
      );

      if (viewer) {
        viewerRef.current = viewer;
        console.log('Document viewer initialized successfully');
      } else {
        setError('Failed to initialize document viewer');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Load document error:', err);
      setError(`Failed to load document: ${err}`);
      setIsLoading(false);
    }
  }, [resolvedPath, item.type, useNativeViewer]);

  // Load document when resolvedPath changes
  useEffect(() => {
    if (resolvedPath && !useNativeViewer) {
      loadDocument();
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.cleanup();
        viewerRef.current = null;
      }
    };
  }, [resolvedPath, retryCount, useNativeViewer, loadDocument]);

  // Handle iframe load event for native PDF viewer
  const handleIframeLoad = useCallback(() => {
    console.log('PDF iframe loaded successfully');
    setIsLoading(false);
  }, []);

  // Handle iframe error
  const handleIframeError = useCallback(() => {
    console.error('PDF iframe failed to load');
    setError('Failed to load PDF. The file may be corrupted or inaccessible.');
    setIsLoading(false);
  }, []);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const handleNavigate = (href: string) => {
    if (viewerRef.current?.navigateTo) {
      viewerRef.current.navigateTo(href);
    }
  };

  if (!rawDocumentPath) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1a1a1a] text-slate-400">
        <div className="text-center">
          <Icon name="warning" className="text-[48px] mb-4 opacity-50" />
          <p>No document path available</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-[#252525] rounded-lg text-slate-300 hover:bg-[#303030] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Check if error is about expired reference
  const isExpiredError = error?.includes('expired') || error?.includes('re-import');

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a]">
      {/* Toolbar */}
      <div className="h-12 border-b border-white/5 bg-[#252525] flex items-center px-4 shrink-0">
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Close"
          >
            <Icon name="arrow_back" className="text-[20px]" />
          </button>
          <span className="text-sm font-medium text-slate-200 truncate max-w-[300px]">
            {item.title}
          </span>
        </div>

        {/* Navigation - only show for PDF.js rendered PDFs (not native viewer) */}
        {item.type === ResourceType.PDF && totalPages > 0 && !useNativeViewer && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => viewerRef.current?.setPage?.(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1.5 rounded hover:bg-white/10 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Icon name="chevron_left" className="text-[20px]" />
            </button>
            <span className="text-xs text-slate-400 min-w-[60px] text-center">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => viewerRef.current?.setPage?.(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded hover:bg-white/10 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Icon name="chevron_right" className="text-[20px]" />
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {toc.length > 0 && (
            <button
              onClick={() => setShowToc(!showToc)}
              className={`p-1.5 rounded transition-colors ${showToc
                ? 'bg-primary text-white'
                : 'hover:bg-white/10 text-slate-400 hover:text-white'
                }`}
              title="Table of Contents"
            >
              <Icon name="list" className="text-[20px]" />
            </button>
          )}
          {/* Show in Folder - for local files */}
          {item.localPath && isElectron() && (
            <button
              onClick={() => {
                (window as any).electronAPI?.showItemInFolder(item.localPath);
              }}
              className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Show in Folder"
            >
              <Icon name="folder_open" className="text-[20px]" />
            </button>
          )}
          <a
            href={item.path}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Open in new tab"
          >
            <Icon name="open_in_new" className="text-[20px]" />
          </a>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document viewer */}
        <div className="flex-1 relative overflow-auto">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a] z-10">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-400">Loading document...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a]">
              <div className="text-center max-w-md p-6">
                <Icon name="warning" className="text-[48px] text-red-400 mb-4" />
                <p className="text-lg font-medium text-red-400 mb-2">Unable to Open Document</p>
                <p className="text-sm text-slate-400 mb-6">{error}</p>

                <div className="flex flex-col gap-3">
                  {/* Retry button */}
                  <button
                    onClick={handleRetry}
                    className="w-full px-4 py-2.5 bg-[#252525] rounded-lg text-slate-300 hover:bg-[#303030] transition-colors flex items-center justify-center gap-2"
                  >
                    <Icon name="refresh" className="text-[18px]" />
                    Retry
                  </button>

                  {/* Open externally - only for non-data URLs */}
                  {resolvedPath && !resolvedPath.startsWith('data:') && !resolvedPath.startsWith('localfile:') && (
                    <a
                      href={resolvedPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                    >
                      <Icon name="open_in_new" className="text-[18px]" />
                      Open in External Viewer
                    </a>
                  )}

                  {/* Open with system app - for local files */}
                  {item.localPath && isElectron() && (
                    <button
                      onClick={() => {
                        (window as any).electronAPI?.openPath(item.localPath);
                      }}
                      className="w-full px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                    >
                      <Icon name="open_in_new" className="text-[18px]" />
                      Open with System App
                    </button>
                  )}

                  {/* Close button */}
                  <button
                    onClick={onClose}
                    className="w-full px-4 py-2.5 text-slate-400 hover:text-white transition-colors"
                  >
                    Close
                  </button>
                </div>

                {/* Hint for expired references */}
                {isExpiredError && (
                  <p className="text-xs text-slate-500 mt-4 p-3 bg-[#252525] rounded-lg">
                    <Icon name="info" className="text-[14px] mr-1 inline-block" />
                    Tip: Drag and drop the file again to re-import it.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* PDF Viewer using PdfRenderer (pdfjs-dist) */}
          {item.type === ResourceType.PDF && !error && (
            <PdfRenderer
              item={item}
              content={pdfContent}
              loading={isLoading}
              error={error}
              colorMode="dark"
            />
          )}

          {/* Iframe for other content (not currently used for PDF) */}
          {useNativeViewer && resolvedPath && !error && item.type !== ResourceType.PDF && (
            <iframe
              ref={iframeRef}
              src={resolvedPath}
              className="w-full h-full border-0"
              title={item.title}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
          )}

          {/* EPUB and other documents use the container */}
          {!useNativeViewer && <div ref={containerRef} className="h-full" />}
        </div>

        {/* Table of Contents sidebar */}
        {showToc && toc.length > 0 && (
          <div className="w-64 border-l border-white/5 bg-[#1e1e1e] overflow-y-auto shrink-0">
            <div className="p-3 border-b border-white/5">
              <h3 className="text-sm font-medium text-slate-300">Contents</h3>
            </div>
            <div className="p-2">
              {toc.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => handleNavigate(entry.href!)}
                  className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200 rounded transition-colors truncate"
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="h-8 border-t border-white/5 bg-[#252525] flex items-center justify-between px-4 shrink-0 text-[10px] text-slate-500">
        <div className="flex items-center gap-4">
          <span>{item.type}</span>
          {item.fileSize && <span>{formatFileSize(item.fileSize)}</span>}
        </div>
        <div className="flex items-center gap-4">
          {item.mimeType && <span>{item.mimeType}</span>}
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
