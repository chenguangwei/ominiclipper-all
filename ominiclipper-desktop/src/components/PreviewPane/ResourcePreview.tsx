import React from 'react';
import { ResourceItem, ResourceType, ColorMode } from '../../types';
import { useFileContent } from '../../hooks/useFileContent';
import { getEffectiveType, getValidFilePath, recoverItemPath, getValidFilePathAsync } from '../../utils/fileHelpers';
import Icon from '../Icon';
import PdfRenderer from './renderers/PdfRenderer';
import WordRenderer from './renderers/WordRenderer';
import MarkdownRenderer from './renderers/MarkdownRenderer';
import ImageRenderer from './renderers/ImageRenderer';
import WebRenderer from './renderers/WebRenderer';

interface ResourcePreviewProps {
  item: ResourceItem;
  activeTab: 'details' | 'preview';
  onOpenDocument?: (item: ResourceItem) => void;
  colorMode?: ColorMode;
  highlightText?: string | null;
}

const ResourcePreview: React.FC<ResourcePreviewProps> = ({
  item,
  activeTab,
  onOpenDocument,
  colorMode = 'dark',
  highlightText,
}) => {
  const isLight = colorMode === 'light';
  const effectiveType = getEffectiveType(item);
  const { content, url, loading, error, reload } = useFileContent(item, activeTab);

  // Debug logging
  console.log('[ResourcePreview] item.type:', item.type, 'effectiveType:', effectiveType, 'ResourceType.PDF:', ResourceType.PDF);

  // Check if this item can be viewed in document viewer
  const canViewInDocument = (
    item.type === ResourceType.PDF ||
    item.type === ResourceType.EPUB ||
    item.type === ResourceType.WORD ||
    item.type === ResourceType.IMAGE
  ) && (item.path || item.embeddedData || item.localPath);
  const shouldShowView = canViewInDocument && onOpenDocument;

  const renderPreview = () => {
    switch (effectiveType) {
      case ResourceType.PDF:
        return (
          <PdfRenderer
            item={item}
            content={content}
            loading={loading}
            error={error}
            onOpenDocument={onOpenDocument}
            colorMode={colorMode}
          />
        );
      case ResourceType.WORD:
        return (
          <WordRenderer
            item={item}
            content={content}
            loading={loading}
            error={error}
            onOpenDocument={onOpenDocument}
            colorMode={colorMode}
          />
        );
      case ResourceType.MARKDOWN:
        return (
          <MarkdownRenderer
            item={item}
            content={content}
            loading={loading}
            error={error}
            onOpenDocument={onOpenDocument}
            colorMode={colorMode}
          />
        );
      case ResourceType.IMAGE:
        return (
          <ImageRenderer
            item={item}
            url={url}
            loading={loading}
            error={error}
            onOpenDocument={onOpenDocument}
            colorMode={colorMode}
          />
        );
      case ResourceType.WEB:
        return <WebRenderer item={item} colorMode={colorMode} />;
      case ResourceType.EPUB:
        return (
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
        );
      case ResourceType.PPT:
        return (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className={`text-center p-8 rounded-xl ${isLight ? 'bg-orange-50' : 'bg-orange-500/10'}`}>
              <Icon name="slideshow" className={`text-[64px] mb-4 ${isLight ? 'text-orange-400' : 'text-orange-400'}`} />
              <h4 className={`text-lg font-semibold mb-2 ${isLight ? 'text-gray-800' : 'text-white'}`}>{item.title}</h4>
              <p className={`text-sm mb-6 ${isLight ? 'text-gray-500' : 'text-content-secondary'}`}>
                Presentation preview not available inline
              </p>
              {(item.path || item.embeddedData) && (
                <button
                  onClick={async () => {
                    const path = await getValidFilePathAsync(item);
                    if (path && (window as any).electronAPI?.openPath) {
                      (window as any).electronAPI.openPath(path);
                    } else if (path) {
                      window.open(path, '_blank');
                    } else {
                      alert('Unable to open file. The file may not be available.');
                    }
                  }}
                  className={`px-6 py-3 rounded-lg text-sm font-medium flex items-center gap-2 mx-auto ${isLight ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-orange-500 text-white hover:bg-orange-600/80'}`}
                >
                  <Icon name="open_in_new" className="text-base" />
                  Open in PowerPoint
                </button>
              )}
            </div>
          </div>
        );
      case ResourceType.EXCEL:
        return (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className={`text-center p-8 rounded-xl ${isLight ? 'bg-green-50' : 'bg-green-500/10'}`}>
              <Icon name="table_view" className={`text-[64px] mb-4 ${isLight ? 'text-green-500' : 'text-green-500'}`} />
              <h4 className={`text-lg font-semibold mb-2 ${isLight ? 'text-gray-800' : 'text-white'}`}>{item.title}</h4>
              <p className={`text-sm mb-6 ${isLight ? 'text-gray-500' : 'text-content-secondary'}`}>
                Spreadsheet preview not available inline
              </p>
              {(item.path || item.embeddedData) && (
                <button
                  onClick={async () => {
                    const path = await getValidFilePathAsync(item);
                    if (path && (window as any).electronAPI?.openPath) {
                      (window as any).electronAPI.openPath(path);
                    } else if (path) {
                      window.open(path, '_blank');
                    } else {
                      alert('Unable to open file. The file may not be available.');
                    }
                  }}
                  className={`px-6 py-3 rounded-lg text-sm font-medium flex items-center gap-2 mx-auto ${isLight ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-green-600 text-white hover:bg-green-600/80'}`}
                >
                  <Icon name="open_in_new" className="text-base" />
                  Open in Excel
                </button>
              )}
            </div>
          </div>
        );
      default:
        return (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className={`text-center p-8 rounded-xl ${isLight ? 'bg-gray-100' : 'bg-surface-tertiary'}`}>
              <Icon name="insert_drive_file" className={`text-[64px] mb-4 opacity-30 ${isLight ? 'text-gray-400' : 'text-content-secondary'}`} />
              <h4 className={`text-lg font-semibold mb-2 ${isLight ? 'text-gray-800' : 'text-white'}`}>{item.title}</h4>
              <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-content-secondary'}`}>
                Preview not available for this file type
              </p>
              {(item.path || item.embeddedData) && (
                <button
                  onClick={async () => {
                    const path = await getValidFilePathAsync(item);
                    if (path && (window as any).electronAPI?.openPath) {
                      (window as any).electronAPI.openPath(path);
                    } else if (path) {
                      window.open(path, '_blank');
                    } else {
                      alert('Unable to open file. The file may not be available.');
                    }
                  }}
                  className={`mt-6 px-6 py-3 rounded-lg text-sm font-medium flex items-center gap-2 mx-auto ${isLight ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-surface-tertiary text-content hover:bg-white/10'}`}
                >
                  <Icon name="open_in_new" className="text-base" />
                  Open with System App
                </button>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Loading State - for types that don't have their own loading UI */}
      {loading && effectiveType !== ResourceType.WORD && effectiveType !== ResourceType.PDF && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className={`animate-spin w-8 h-8 border-2 rounded-full mx-auto mb-3 ${isLight ? 'border-[#007aff] border-t-transparent' : 'border-primary border-t-transparent'}`}></div>
            <span className={`text-sm ${isLight ? 'text-gray-500' : 'text-content-secondary'}`}>Loading preview...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className={`rounded-lg p-6 text-center ${isLight ? 'bg-red-50 border border-red-200' : 'bg-red-500/10 border border-red-500/20'}`}>
          <Icon name="error" className={`text-[48px] mb-3 ${isLight ? 'text-red-400' : 'text-red-400'}`} />
          <p className={`text-sm ${isLight ? 'text-red-600' : 'text-red-400'}`}>{error}</p>
          <button
            onClick={reload}
            className={`mt-4 px-4 py-2 rounded-lg text-sm font-medium ${isLight ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Render Preview */}
      {!error && renderPreview()}
    </div>
  );
};

export default ResourcePreview;
