import React from 'react';
import Icon from '../Icon';
import { IconColorPickerProps, FOLDER_COLORS, FOLDER_ICONS } from './types';

export const IconColorPicker: React.FC<IconColorPickerProps> = ({
  currentIcon = 'folder',
  currentColor,
  onSelect,
  colorMode = 'dark',
}) => {
  const isLight = colorMode === 'light';

  return (
    <div className="p-2">
      {/* Color Picker Row */}
      <div className="flex items-center gap-1.5 mb-3 px-1">
        {FOLDER_COLORS.map((color) => (
          <button
            key={color.name}
            onClick={() => onSelect(currentIcon, color.name)}
            className={`
              w-6 h-6 rounded-full flex items-center justify-center
              transition-all hover:scale-110
              ${currentColor === color.name ? 'ring-2 ring-offset-2 ring-primary' : ''}
              ${isLight ? 'ring-offset-white' : 'ring-offset-[#1a1a1a]'}
            `}
            style={{ backgroundColor: color.hex }}
            title={color.label}
          >
            {currentColor === color.name && (
              <Icon name="check" className="text-white text-[14px]" />
            )}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className={`h-px mb-2 ${isLight ? 'bg-gray-200' : 'bg-white/10'}`} />

      {/* Icon Grid */}
      <div className="grid grid-cols-6 gap-1">
        {FOLDER_ICONS.map((item) => (
          <button
            key={item.icon}
            onClick={() => onSelect(item.icon, currentColor)}
            className={`
              w-8 h-8 rounded-md flex items-center justify-center
              transition-colors
              ${currentIcon === item.icon
                ? isLight
                  ? 'bg-primary/10 text-primary'
                  : 'bg-primary/20 text-primary'
                : isLight
                  ? 'text-gray-600 hover:bg-gray-100'
                  : 'text-gray-400 hover:bg-white/5'
              }
            `}
            title={item.label}
          >
            <Icon
              name={item.icon}
              className="text-[18px]"
              style={currentColor ? { color: FOLDER_COLORS.find(c => c.name === currentColor)?.hex } : undefined}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export default IconColorPicker;
