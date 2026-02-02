import React, { useState, useCallback, useEffect } from 'react';
import { ResourceItem, ColorMode, ResourceType } from '../../../types';
import Icon from '../../Icon';
import { getValidFilePath } from '../../../utils/fileHelpers';
import * as storageService from '../../../services/storageService';

interface ImageRendererProps {
  item: ResourceItem;
  url: string | null;
  loading: boolean;
  error: string | null;
  onOpenDocument?: (item: ResourceItem) => void;
  colorMode?: ColorMode;
}

// Lightbox component for full-screen image viewing
const ImageLightbox: React.FC<{
  src: string;
  alt: string;
  onClose: () => void;
  colorMode: ColorMode;
}> = ({ src, alt, onClose, colorMode }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const isLight = colorMode === 'light';

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setScale(s => Math.min(s + 0.25, 5));
      if (e.key === '-') setScale(s => Math.max(s - 0.25, 0.25));
      if (e.key === '0') { setScale(1); setPosition({ x: 0, y: 0 }); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(s => Math.min(Math.max(s + delta, 0.25), 5));
  }, []);

  // Handle drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
      >
        <Icon name="close" className="text-2xl" />
      </button>

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 rounded-full px-4 py-2 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); setScale(s => Math.max(s - 0.25, 0.25)); }}
          className="p-1 hover:bg-white/10 rounded text-white"
        >
          <Icon name="remove" className="text-xl" />
        </button>
        <span className="text-white text-sm min-w-[60px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(s + 0.25, 5)); }}
          className="p-1 hover:bg-white/10 rounded text-white"
        >
          <Icon name="add" className="text-xl" />
        </button>
        <div className="w-px h-4 bg-white/30 mx-1" />
        <button
          onClick={(e) => { e.stopPropagation(); setScale(1); setPosition({ x: 0, y: 0 }); }}
          className="p-1 hover:bg-white/10 rounded text-white text-xs"
        >
          Reset
        </button>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="absolute bottom-4 right-4 text-white/50 text-xs z-10">
        <span>Scroll to zoom • Drag to pan • ESC to close</span>
      </div>

      {/* Image */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        className="max-w-[95vw] max-h-[95vh] object-contain select-none"
        style={{
          transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        }}
        draggable={false}
      />
    </div>
  );
};

const ImageRenderer: React.FC<ImageRendererProps> = ({
  item,
  url,
  loading,
  error,
  onOpenDocument,
  colorMode = 'dark',
}) => {
  const [showLightbox, setShowLightbox] = useState(false);
  const isLight = colorMode === 'light';

  const handleOpen = async () => {
    if (item.type === ResourceType.IMAGE) {
      // For browser extension images with sourceUrl, open in browser directly
      if (item.sourceUrl) {
        window.open(item.sourceUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      // For existing items, sourceUrl might only be in full metadata (backward compatibility)
      try {
        const fullItem = await storageService.getItemById(item.id);
        if (fullItem?.sourceUrl) {
          window.open(fullItem.sourceUrl, '_blank', 'noopener,noreferrer');
          return;
        }
      } catch (e) {
        console.warn('[ImageRenderer] Failed to load full item metadata:', e);
      }

      // For local files, open with system app
      const filePath = getValidFilePath(item);
      if (filePath && (window as any).electronAPI?.openPath) {
        try {
          (window as any).electronAPI.openPath(filePath);
        } catch (error) {
          console.error('Failed to open image:', error);
        }
      }
    }
  };

  const handleImageClick = () => {
    if (url) {
      setShowLightbox(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className={`flex-1 rounded-lg p-4 flex items-center justify-center overflow-auto ${isLight ? 'bg-gray-100' : 'bg-surface-tertiary'}`}>
        {url ? (
          <img
            src={url}
            alt={item.title}
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg cursor-zoom-in hover:opacity-90 transition-opacity"
            onClick={handleImageClick}
            onError={() => console.error('Failed to load image')}
          />
        ) : (
          <div className="text-center">
            <Icon name="image" className={`text-[64px] opacity-20 ${isLight ? 'text-gray-400' : 'text-content-secondary'}`} />
            <p className={`text-sm mt-2 ${isLight ? 'text-gray-500' : 'text-content-secondary'}`}>Image not available</p>
          </div>
        )}
      </div>

      <div className="flex justify-center gap-2 mt-4">
        {url && (
          <button
            onClick={handleImageClick}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${isLight ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-surface-tertiary text-content hover:bg-white/10'}`}
          >
            <Icon name="zoom_in" className="text-base" />
            Zoom
          </button>
        )}
        {(item.sourceUrl || getValidFilePath(item)) && (
          <button
            onClick={handleOpen}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${isLight ? 'bg-[#007aff] text-white hover:bg-[#0066d6]' : 'bg-primary text-white hover:bg-primary/80'}`}
          >
            <Icon name="open_in_new" className="text-base" />
            {item.sourceUrl ? 'Open in Browser' : 'Open External'}
          </button>
        )}
      </div>

      {/* Lightbox */}
      {showLightbox && url && (
        <ImageLightbox
          src={url}
          alt={item.title}
          onClose={() => setShowLightbox(false)}
          colorMode={colorMode}
        />
      )}
    </div>
  );
};

export default ImageRenderer;
