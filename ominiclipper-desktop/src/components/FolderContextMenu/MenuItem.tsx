import React, { useState } from 'react';
import Icon from '../Icon';
import { MenuItemProps, MenuDividerProps } from './types';

export const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  label,
  shortcut,
  onClick,
  disabled = false,
  danger = false,
  hasSubmenu = false,
  children,
  colorMode = 'dark',
}) => {
  const [showSubmenu, setShowSubmenu] = useState(false);
  const isLight = colorMode === 'light';

  const handleClick = () => {
    if (!disabled && onClick && !hasSubmenu) {
      onClick();
    }
  };

  const baseClasses = `
    w-full flex items-center gap-3 px-3 py-2 text-sm cursor-pointer
    transition-colors relative
  `;

  const colorClasses = disabled
    ? isLight
      ? 'text-gray-400 cursor-not-allowed'
      : 'text-gray-600 cursor-not-allowed'
    : danger
      ? isLight
        ? 'text-red-600 hover:bg-red-50'
        : 'text-red-400 hover:bg-red-500/10'
      : isLight
        ? 'text-gray-700 hover:bg-gray-100'
        : 'text-gray-200 hover:bg-white/5';

  return (
    <div
      className="relative"
      onMouseEnter={() => hasSubmenu && setShowSubmenu(true)}
      onMouseLeave={() => hasSubmenu && setShowSubmenu(false)}
    >
      <button
        onClick={handleClick}
        disabled={disabled}
        className={`${baseClasses} ${colorClasses}`}
      >
        <Icon
          name={icon}
          className={`text-[18px] ${disabled ? 'opacity-50' : ''}`}
        />
        <span className="flex-1 text-left truncate">{label}</span>
        {shortcut && (
          <span className={`text-xs ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
            {shortcut}
          </span>
        )}
        {hasSubmenu && (
          <Icon name="chevron_right" className="text-[16px] ml-1" />
        )}
      </button>

      {/* Submenu */}
      {hasSubmenu && showSubmenu && children && (
        <div
          className={`
            absolute left-full top-0 ml-1 min-w-[200px] rounded-lg shadow-xl
            border z-[300] py-1
            ${isLight
              ? 'bg-white border-gray-200'
              : 'bg-[#1a1a1a] border-white/10'
            }
          `}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export const MenuDivider: React.FC<MenuDividerProps> = ({ colorMode = 'dark' }) => {
  const isLight = colorMode === 'light';
  return (
    <div
      className={`my-1 h-px ${isLight ? 'bg-gray-200' : 'bg-white/10'}`}
    />
  );
};

export default MenuItem;
