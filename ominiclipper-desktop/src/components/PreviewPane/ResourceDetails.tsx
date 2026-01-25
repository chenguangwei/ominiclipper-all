import React from 'react';
import { ResourceItem, ResourceType, ColorMode } from '../../types';
import Icon from '../Icon';
import { formatDate, formatRelativeTime } from '../../services/i18n';
import TagSelector from '../TagSelector';
import TypeDropdown from '../TypeDropdown';
import { getValidFilePath, recoverItemPath, getValidFilePathAsync, getFileExtension } from '../../utils/fileHelpers';

interface ResourceDetailsProps {
  item: ResourceItem;
  getTagName: (id: string) => string;
  onDelete?: () => void;
  onEdit?: () => void;
  onToggleStar?: (id: string) => void;
  onGenerateSummary?: (id: string) => void;
  isGeneratingSummary?: boolean;
  onOpenDocument?: (item: ResourceItem) => void;
  colorMode?: ColorMode;
  availableTags?: { id: string; name: string; color?: string; count?: number }[];
  onRemoveTag?: (itemId: string, tagId: string) => void;
  onAddTag?: (itemId: string, tagId: string) => void;
  onCreateTag?: (name: string) => Promise<string | null>;
  onChangeType?: (itemId: string, newType: ResourceType) => void;
}

const ResourceDetails: React.FC<ResourceDetailsProps> = ({
  item,
  getTagName,
  onDelete,
  onEdit,
  onToggleStar,
  onGenerateSummary,
  isGeneratingSummary = false,
  onOpenDocument,
  colorMode = 'dark',
  availableTags = [],
  onRemoveTag,
  onAddTag,
  onCreateTag,
  onChangeType,
}) => {
  const isLight = colorMode === 'light';

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

  // Helper: Check if there's a physical file on disk that can be revealed
  // Returns true if we have a valid path OR can extract embedded data to a file
  const hasRevealableFile = (): boolean => {
    // If we have a valid absolute path, we can reveal it
    if (getValidFilePath(item)) return true;

    // For reference mode, the original file should still exist
    if (item.storageMode === 'reference' && item.originalPath?.startsWith('/')) return true;

    // If we have embedded data AND the saveEmbeddedFile API, we can extract to a file
    const hasEmbeddedData = !!item.embeddedData;
    const hasSaveAPI = !!(window as any).electronAPI?.saveEmbeddedFile;
    console.log('[hasRevealableFile] Checking:', {
      title: item.title,
      hasEmbeddedData,
      hasSaveAPI,
      embeddedDataLength: item.embeddedData?.length || 0
    });
    if (hasEmbeddedData && hasSaveAPI) return true;

    // If we have an absolute originalPath, we can try to reveal it
    if (item.originalPath?.startsWith('/')) return true;

    return false;
  };

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
    console.log('[ResourceDetails] handleOpenInSystem called for:', item.title);

    // Use the new async function that handles all path resolution and extraction
    const filePath = await getValidFilePathAsync(item);
    console.log('[ResourceDetails] Resolved file path for system open:', filePath);

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
    } else {
      console.warn('[ResourceDetails] Could not open file: No valid path found even after recovery.');
      alert('Unable to open the file with system application. The file may have been moved or deleted.');
    }
  };

  // Show file in Finder/Explorer
  const handleShowInFolder = async () => {
    console.log('[ResourceDetails] handleShowInFolder called for:', item.title);

    // Use the new async function that handles all path resolution and extraction
    const filePath = await getValidFilePathAsync(item);
    console.log('[ResourceDetails] Resolved file path:', filePath);

    if (filePath && (window as any).electronAPI?.showItemInFolder) {
      try {
        await (window as any).electronAPI.showItemInFolder(filePath);
      } catch (error) {
        console.error('Failed to show in folder:', error);
        alert('Unable to reveal file in Finder. The file may have been moved or deleted.');
      }
    } else if (item.embeddedData && !(window as any).electronAPI?.saveEmbeddedFile) {
      // We have embedded data but no API to extract it
      alert('Unable to extract file. The saveEmbeddedFile API is not available.');
    } else {
      console.warn('[ResourceDetails] Could not find or create file path for Reveal in Finder.');
      alert('Unable to locate the file. It may have been moved, deleted, or was imported without copying to storage.');
    }
  };

  // Open item (document, image, or web link)
  const handleOpen = async () => {
    // For web pages, open URL in browser
    if (item.type === ResourceType.WEB && item.path) {
      if ((window as any).electronAPI?.openExternal) {
        (window as any).electronAPI.openExternal(item.path);
      } else {
        window.open(item.path, '_blank');
      }
      return;
    }

    // For documents with viewer, try internal viewer first
    if (shouldShowView && onOpenDocument) {
      onOpenDocument(item);
      return;
    }

    // For images, try to open with system app, or fallback to document viewer
    if (item.type === ResourceType.IMAGE) {
      // Use validated file path
      let filePath = getValidFilePath(item);

      if (!filePath) {
        filePath = await recoverItemPath(item);
      }

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
      } else if (item.path && (item.path.startsWith('http://') || item.path.startsWith('https://'))) {
        // Last resort: try to open web URL directly
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
    } else if (item.path && (item.path.startsWith('http://') || item.path.startsWith('https://'))) {
      // Fallback: try to open web URL directly
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
                className={`text-[40px] ${item.type === ResourceType.WORD
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
              className={`group flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs ${isLight
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
                  className={`ml-1 opacity-0 group-hover:opacity-100 transition-opacity ${isLight ? 'text-gray-400 hover:text-gray-600' : 'text-content-secondary hover:text-content'
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
            <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${isLight
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
              <div className={`p-4 rounded-lg border ${isLight
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
                    className={`text-xs flex items-center gap-1 px-3 py-1 rounded-full transition-colors ${isLight
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
            {/* For documents, show "Open in System" button - only if we have a file on disk */}
            {canViewInDocument && hasRevealableFile() && (
              <button
                onClick={handleOpenInSystem}
                className={secondaryButtonClass}
                title="Open with default application"
              >
                <Icon name="open_in_new" />
              </button>
            )}
            {/* Show in folder button - only if we have a file on disk that can be revealed */}
            {hasRevealableFile() && (
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
  );
};

export default ResourceDetails;
