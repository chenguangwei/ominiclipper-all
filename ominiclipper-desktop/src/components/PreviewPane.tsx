/**
 * Preview Pane Component
 * Enhanced with document content preview and light/dark mode support
 * Refactored to split into modular components
 */

import React, { useState } from 'react';
import { ResourceItem, ColorMode } from '../types';
import Icon from './Icon';
import ResourceDetails from './PreviewPane/ResourceDetails';
import ResourcePreview from './PreviewPane/ResourcePreview';

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
  highlightText?: string | null;
  // Inline editing props
  availableTags?: { id: string; name: string; color?: string; count?: number }[];
  onRemoveTag?: (itemId: string, tagId: string) => void;
  onAddTag?: (itemId: string, tagId: string) => void;
  onCreateTag?: (name: string) => Promise<string | null>;
  onChangeType?: (itemId: string, newType: any) => void;
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
  highlightText,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'preview'>('details');
  const isLight = colorMode === 'light';

  // Automatically switch to preview tab when highlightText is provided (Deep Linking)
  React.useEffect(() => {
    if (highlightText) {
      setActiveTab('preview');
    }
  }, [highlightText]);

  if (!item) {
    return (
      <div className={`flex-1 flex items-center justify-center flex-col gap-2 select-none ${isLight ? 'bg-gray-50 text-gray-400' : 'bg-surface-secondary text-content-secondary'
        }`}>
        <Icon name="description" className="text-[64px] opacity-20" />
        <span className="text-sm font-medium opacity-50">No item selected</span>
      </div>
    );
  }

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

  return (
    <main className={mainClass}>
      {/* Tabs */}
      <div className={`flex border-b ${isLight ? 'border-gray-200 bg-gray-50' : 'border-[rgb(var(--color-border)/var(--border-opacity))] bg-surface-tertiary/50'}`}>
        <button
          className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'details' ? tabActiveClass : tabInactiveClass
            }`}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
        <button
          className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'preview' ? tabActiveClass : tabInactiveClass
            }`}
          onClick={() => setActiveTab('preview')}
        >
          Preview
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {activeTab === 'details' ? (
          <ResourceDetails
            item={item}
            getTagName={getTagName}
            onDelete={onDelete}
            onEdit={onEdit}
            onToggleStar={onToggleStar}
            onGenerateSummary={onGenerateSummary}
            isGeneratingSummary={isGeneratingSummary}
            onOpenDocument={onOpenDocument}
            colorMode={colorMode}
            availableTags={availableTags}
            onRemoveTag={onRemoveTag}
            onAddTag={onAddTag}
            onCreateTag={onCreateTag}
            onChangeType={onChangeType}
          />
        ) : (
          <ResourcePreview
            item={item}
            activeTab={activeTab}
            onOpenDocument={onOpenDocument}
            colorMode={colorMode}
            highlightText={highlightText}
          />
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
