/**
 * DocxViewer Component
 * Renders Word documents (.docx) using docx-preview library
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ResourceItem, ResourceType } from '../types';
import Icon from './Icon';
import { isElectron, formatFileSize } from '../services/fileManager';
import { getFileData } from '../utils/fileHelpers';
import * as docx from 'docx-preview';

interface DocxViewerProps {
  item: ResourceItem;
  onClose?: () => void;
}

const DocxViewer: React.FC<DocxViewerProps> = ({ item, onClose }) => {
  // Initial render log
  const electronAPI = (window as any).electronAPI;
  const debugInfo = {
    title: item.title,
    type: item.type,
    localPath: item.localPath,
    storageMode: item.storageMode,
    hasEmbeddedData: !!item.embeddedData,
    hasElectronAPI: !!electronAPI
  };
  console.log('[DocxViewer] Mounted:', debugInfo);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docxData, setDocxData] = useState<ArrayBuffer | null>(null);

  // Load document data using getFileData which handles all sources and path recovery
  useEffect(() => {
    const loadDocx = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log('[DocxViewer] Loading document via getFileData...');
        const arrayBuffer = await getFileData(item);
        console.log('[DocxViewer] Document loaded, size:', arrayBuffer.byteLength);

        // Log basic file validation info
        if (arrayBuffer.byteLength > 4) {
          const header = new Uint8Array(arrayBuffer.slice(0, 4));
          const hex = Array.from(header).map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase();
          console.log('[DocxViewer] Document Header:', hex);
          // ZIP signature is 50 4B 03 04
          if (hex !== '50 4B 03 04') {
            console.warn('[DocxViewer] Warning: Header does not match standard ZIP/DOCX signature');

            // Check for legacy DOC signature (D0 CF 11 E0)
            if (hex === 'D0 CF 11 E0') {
              console.warn('[DocxViewer] Detected legacy .doc format');
              setError('LEGACY_FORMAT_DETECTED');
              setIsLoading(false);
              return; // Stop processing
            }
          }
        }

        setDocxData(arrayBuffer);
      } catch (err) {
        console.error('[DocxViewer] Error loading DOCX:', err);
        setError(err instanceof Error ? err.message : 'Failed to load document');
      } finally {
        setIsLoading(false);
      }
    };

    loadDocx();
  }, [item.id, item.storageMode, item.localPath, item.path, item.embeddedData]);

  // Render DOCX when data is available
  useEffect(() => {
    if (!docxData || !containerRef.current) {
      return;
    }

    console.log('Rendering DOCX document, size:', docxData.byteLength);
    setIsLoading(true);

    // Clear previous content
    containerRef.current.innerHTML = '';

    try {
      // Render the DOCX document
      docx.renderAsync(docxData, containerRef.current, undefined, {
        className: 'docx-viewer', // Custom class for styling
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        debug: false,
      }).then(() => {
        console.log('DOCX render complete');
        setIsLoading(false);
      }).catch((err) => {
        console.error('DOCX render error:', err);
        let msg = err instanceof Error ? err.message : 'Unknown error';

        // Provide more helpful error messages
        if (msg.includes('end of central directory')) {
          msg = 'Invalid DOCX file structure (not a valid ZIP archive). The file might be corrupted or encrypted.';
        }

        setError(`Failed to render document: ${msg}`);
        setIsLoading(false);
      });
    } catch (err) {
      console.error('Error rendering DOCX:', err);
      setError(err instanceof Error ? err.message : 'Failed to render document');
      setIsLoading(false);
    }
  }, [docxData]);

  // Check if error is about expired reference
  const isExpiredError = error?.includes('expired') || error?.includes('re-import');

  // Styles for the DOCX viewer
  const docxStyles = `
    .docx-viewer {
      padding: 24px;
      min-height: 100%;
    }
    .docx-viewer .docx-page {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      margin: 0 auto 24px auto;
      background: white;
      max-width: 100%;
    }
    .docx-viewer body {
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    }
  `;

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

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {/* Show in Folder - for local files */}
          {item.localPath && isElectron() ? (
            <button
              onClick={() => {
                console.log('Showing in folder:', item.localPath);
                (window as any).electronAPI?.showItemInFolder(item.localPath).then((result: any) => {
                  console.log('showItemInFolder result:', result);
                  if (!result.success) {
                    console.error('Failed to show in folder:', result.error);
                  }
                }).catch((err: any) => {
                  console.error('showItemInFolder error:', err);
                });
              }}
              className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Show in Folder"
            >
              <Icon name="folder_open" className="text-[20px]" />
            </button>
          ) : null}
          {/* Open with system app - for local files */}
          {item.localPath && isElectron() ? (
            <button
              onClick={() => {
                console.log('Opening with system app:', item.localPath);
                (window as any).electronAPI?.openPath(item.localPath).then((result: any) => {
                  console.log('openPath result:', result);
                  if (!result.success) {
                    console.error('Failed to open file:', result.error);
                  }
                }).catch((err: any) => {
                  console.error('openPath error:', err);
                });
              }}
              className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Open with Word"
            >
              <Icon name="open_in_new" className="text-[20px]" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document viewer */}
        <div className="flex-1 relative overflow-auto bg-[#2a2a2a]">
          {/* Inject DOCX styles */}
          <style>{docxStyles}</style>

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
                <Icon name={error === 'LEGACY_FORMAT_DETECTED' ? "description" : "warning"} className="text-[48px] text-red-400 mb-4" />
                <p className="text-lg font-medium text-red-400 mb-2">
                  {error === 'LEGACY_FORMAT_DETECTED' ? 'Legacy Format (.doc)' : 'Unable to Open Document'}
                </p>
                <p className="text-sm text-slate-400 mb-6">
                  {error === 'LEGACY_FORMAT_DETECTED'
                    ? 'This is a legacy Microsoft Word 97-2003 document (.doc). The built-in viewer only supports modern Word documents (.docx).'
                    : error}
                </p>

                <div className="flex flex-col gap-3">
                  {/* Open with system app - for local files */}
                  {item.localPath && isElectron() ? (
                    <button
                      onClick={() => {
                        console.log('Opening with system app:', item.localPath);
                        (window as any).electronAPI?.openPath(item.localPath).then((result: any) => {
                          console.log('openPath result:', result);
                          if (!result.success) {
                            console.error('Failed to open file:', result.error);
                          }
                        }).catch((err: any) => {
                          console.error('openPath error:', err);
                        });
                      }}
                      className="w-full px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                    >
                      <Icon name="open_in_new" className="text-[18px]" />
                      Open with Word
                    </button>
                  ) : (
                    <div className="w-full px-4 py-2.5 bg-[#252525] text-slate-400 rounded-lg flex items-center justify-center gap-2">
                      <Icon name="info" className="text-[18px]" />
                      File embedded - cannot open externally
                    </div>
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

          {/* DOCX container */}
          <div
            ref={containerRef}
            className="min-h-full"
            style={{ minHeight: '100%' }}
          />
        </div>
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

export default DocxViewer;
