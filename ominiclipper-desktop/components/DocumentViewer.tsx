/**
 * Document Viewer Component
 * Renders PDF and EPUB documents in-app
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ResourceItem, ResourceType } from '../types';
import Icon from './Icon';
import * as documentViewer from '../services/documentViewer';
import { formatFileSize, getUsablePath } from '../services/fileManager';

interface DocumentViewerProps {
  item: ResourceItem;
  onClose?: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ item, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [toc, setToc] = useState<documentViewer.TocEntry[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Get usable path (handles embedded data)
  const documentPath = getUsablePath(item);

  // Debug logging
  console.log('DocumentViewer - documentPath:', documentPath?.substring(0, 50) + '...');
  console.log('DocumentViewer - item.type:', item.type);
  console.log('DocumentViewer - item.storageMode:', item.storageMode);

  const loadDocument = useCallback(async () => {
    if (!containerRef.current || !documentPath) {
      setError('No document path available');
      setIsLoading(false);
      return;
    }

    const container = containerRef.current;
    setIsLoading(true);
    setError(null);

    console.log('Loading document:', documentPath.substring(0, 50) + '...');

    try {
      const viewer = await documentViewer.renderDocument(
        documentPath,
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
      } else if (!error) {
        setError('Failed to initialize document viewer');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Load document error:', err);
      setError(`Failed to load document: ${err}`);
      setIsLoading(false);
    }
  }, [documentPath, item.type]);

  useEffect(() => {
    loadDocument();

    return () => {
      if (viewerRef.current) {
        viewerRef.current.cleanup();
      }
    };
  }, [loadDocument, retryCount]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const handleNavigate = (href: string) => {
    if (viewerRef.current?.navigateTo) {
      viewerRef.current.navigateTo(href);
    }
  };

  if (!documentPath) {
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

        {/* Navigation */}
        {item.type === ResourceType.PDF && totalPages > 0 && (
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
              className={`p-1.5 rounded transition-colors ${
                showToc
                  ? 'bg-primary text-white'
                  : 'hover:bg-white/10 text-slate-400 hover:text-white'
              }`}
              title="Table of Contents"
            >
              <Icon name="list" className="text-[20px]" />
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
                  {documentPath && !documentPath.startsWith('data:') && (
                    <a
                      href={documentPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                    >
                      <Icon name="open_in_new" className="text-[18px]" />
                      Open in External Viewer
                    </a>
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

          <div ref={containerRef} className="h-full" />
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
