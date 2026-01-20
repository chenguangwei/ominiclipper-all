import React from 'react';
import Icon from './Icon';
import { ColorMode } from '../types';

interface ContextMenuProps {
  x: number;
  y: number;
  isVisible: boolean;
  onClose: () => void;
  onDelete?: () => void;
  onRevealInFinder?: () => void;
  onEdit?: () => void;
  onOpen?: () => void;
  colorMode?: ColorMode;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  isVisible,
  onClose,
  onDelete,
  onRevealInFinder,
  onEdit,
  onOpen,
  colorMode = 'dark',
}) => {
  const isLight = colorMode === 'light';

  if (!isVisible) return null;

  const menuClass = isLight
    ? 'fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[180px]'
    : 'fixed z-50 bg-surface-tertiary border border-[rgb(var(--color-border)/0.1)] rounded-lg shadow-xl py-1 min-w-[180px]';

  const menuItemClass = (hasDivider: boolean) => isLight
    ? `flex items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer ${
        hasDivider ? 'border-t border-gray-200' : ''
      } text-gray-700 hover:bg-gray-50`
    : `flex items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer ${
        hasDivider ? 'border-t border-[rgb(var(--color-border)/0.1)]' : ''
      } text-content-secondary hover:bg-surface-tertiary hover:text-content`;

  const deleteItemClass = isLight
    ? 'flex items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer text-red-500 hover:bg-red-50'
    : 'flex items-center gap-2 px-3 py-2 text-sm transition-colors cursor-pointer text-red-400 hover:bg-red-500/20';

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <div
        className={menuClass}
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        {onOpen && (
          <button
            onClick={() => {
              onOpen();
              onClose();
            }}
            className={menuItemClass(false)}
          >
            <Icon name="open_in_new" className="text-[18px]" />
            <span>Open</span>
          </button>
        )}

        {onEdit && (
          <button
            onClick={() => {
              onEdit();
              onClose();
            }}
            className={menuItemClass(false)}
          >
            <Icon name="edit" className="text-[18px]" />
            <span>Edit</span>
          </button>
        )}

        {onRevealInFinder && (
          <button
            onClick={() => {
              onRevealInFinder();
              onClose();
            }}
            className={menuItemClass(false)}
          >
            <Icon name="folder_open" className="text-[18px]" />
            <span>Reveal in Finder</span>
          </button>
        )}

        {onDelete && (
          <button
            onClick={() => {
              onDelete();
              onClose();
            }}
            className={menuItemClass(true)}
          >
            <Icon name="delete" className="text-[18px]" />
            <span>Delete</span>
          </button>
        )}
      </div>
    </>
  );
};

export default ContextMenu;
