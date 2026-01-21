import React from 'react';
import { ResourceItem, ColorMode } from 'types';
import Icon from '../../Icon';

interface WebRendererProps {
  item: ResourceItem;
  colorMode?: ColorMode;
}

const WebRenderer: React.FC<WebRendererProps> = ({
  item,
  colorMode = 'dark',
}) => {
  const isLight = colorMode === 'light';

  const handleOpen = () => {
    if (item.path) {
      if ((window as any).electronAPI?.openExternal) {
        (window as any).electronAPI.openExternal(item.path);
      } else {
        window.open(item.path, '_blank');
      }
    }
  };

  return (
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
  );
};

export default WebRenderer;
