import React from 'react';
import { ResourceItem, ColorMode } from '../../../types';
import Icon from '../../Icon';
import { getValidFilePath } from '../../../utils/fileHelpers';

interface ImageRendererProps {
  item: ResourceItem;
  url: string | null;
  loading: boolean;
  error: string | null;
  onOpenDocument?: (item: ResourceItem) => void;
  colorMode?: ColorMode;
}

const ImageRenderer: React.FC<ImageRendererProps> = ({
  item,
  url,
  loading,
  error,
  onOpenDocument,
  colorMode = 'dark',
}) => {
  const isLight = colorMode === 'light';

  const handleOpen = () => {
    if (item.type === ResourceType.IMAGE) {
      const filePath = getValidFilePath(item);
      if (filePath && (window as any).electronAPI?.openPath) {
        try {
          (window as any).electronAPI.openPath(filePath);
        } catch (error) {
          console.error('Failed to open image:', error);
          if (onOpenDocument) {
            onOpenDocument(item);
          }
        }
      } else if (onOpenDocument) {
        onOpenDocument(item);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className={`flex-1 rounded-lg p-4 flex items-center justify-center overflow-auto ${isLight ? 'bg-gray-100' : 'bg-surface-tertiary'}`}>
        {url ? (
          <img
            src={url}
            alt={item.title}
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            onError={() => console.error('Failed to load image')}
          />
        ) : (
          <div className="text-center">
            <Icon name="image" className={`text-[64px] opacity-20 ${isLight ? 'text-gray-400' : 'text-content-secondary'}`} />
            <p className={`text-sm mt-2 ${isLight ? 'text-gray-500' : 'text-content-secondary'}`}>Image not available</p>
          </div>
        )}
      </div>
      {(getValidFilePath(item) || onOpenDocument) && (
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
  );
};

export default ImageRenderer;
