/**
 * TypeDropdown Component
 * Inline dropdown for changing resource type
 */

import React, { useState, useRef, useEffect } from 'react';
import { ResourceType, ColorMode } from '../types';
import Icon from './Icon';

// Type definitions with icons and colors
const RESOURCE_TYPES = [
  { type: ResourceType.PDF, label: 'PDF', icon: 'picture_as_pdf', color: 'text-pdf-red' },
  { type: ResourceType.WORD, label: 'Word', icon: 'description', color: 'text-word-blue' },
  { type: ResourceType.EPUB, label: 'EPUB', icon: 'auto_stories', color: 'text-epub-purple' },
  { type: ResourceType.IMAGE, label: 'Image', icon: 'image', color: 'text-tag-yellow' },
  { type: ResourceType.MARKDOWN, label: 'Markdown', icon: 'article', color: 'text-tag-blue' },
  { type: ResourceType.PPT, label: 'PPT', icon: 'slideshow', color: 'text-tag-orange' },
  { type: ResourceType.EXCEL, label: 'Excel', icon: 'table_chart', color: 'text-tag-green' },
  { type: ResourceType.WEB, label: 'Web', icon: 'language', color: 'text-tag-green' },
  { type: ResourceType.UNKNOWN, label: 'Unknown', icon: 'draft', color: 'text-content-secondary' },
];

interface TypeDropdownProps {
  currentType: ResourceType;
  onChangeType: (type: ResourceType) => void;
  colorMode?: ColorMode;
  disabled?: boolean;
}

const TypeDropdown: React.FC<TypeDropdownProps> = ({
  currentType,
  onChangeType,
  colorMode = 'dark',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isLight = colorMode === 'light';

  const current = RESOURCE_TYPES.find(t => t.type === currentType) || RESOURCE_TYPES[RESOURCE_TYPES.length - 1];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (type: ResourceType) => {
    if (type !== currentType) {
      onChangeType(type);
    }
    setIsOpen(false);
  };

  // Styles
  const buttonClass = isLight
    ? `flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-gray-100 cursor-pointer'
      }`
    : `flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-white/5 cursor-pointer'
      }`;

  const dropdownClass = isLight
    ? 'absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]'
    : 'absolute top-full left-0 mt-1 z-50 bg-surface-secondary border border-[rgb(var(--color-border)/0.1)] rounded-lg shadow-xl py-1 min-w-[140px]';

  const itemClass = (isSelected: boolean) => isLight
    ? `flex items-center gap-2 w-full px-3 py-1.5 text-sm cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-50 text-blue-600'
          : 'text-gray-700 hover:bg-gray-50'
      }`
    : `flex items-center gap-2 w-full px-3 py-1.5 text-sm cursor-pointer transition-colors ${
        isSelected
          ? 'bg-primary/10 text-primary'
          : 'text-content hover:bg-surface-tertiary'
      }`;

  const labelClass = isLight
    ? 'text-[10px] font-bold tracking-wider uppercase text-gray-400'
    : 'text-[10px] font-bold tracking-wider uppercase text-content-secondary';

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={buttonClass}
        disabled={disabled}
      >
        <Icon name={current.icon} className={`text-[16px] ${current.color}`} />
        <span className={labelClass}>{current.label}</span>
        {!disabled && (
          <Icon
            name="expand_more"
            className={`text-[14px] transition-transform ${isOpen ? 'rotate-180' : ''} ${isLight ? 'text-gray-400' : 'text-content-secondary'}`}
          />
        )}
      </button>

      {isOpen && !disabled && (
        <div className={dropdownClass}>
          {RESOURCE_TYPES.map(({ type, label, icon, color }) => (
            <button
              key={type}
              onClick={() => handleSelect(type)}
              className={itemClass(type === currentType)}
            >
              <Icon name={icon} className={`text-[18px] ${color}`} />
              <span className="flex-1 text-left">{label}</span>
              {type === currentType && (
                <Icon name="check" className={`text-[14px] ${isLight ? 'text-blue-600' : 'text-primary'}`} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TypeDropdown;
