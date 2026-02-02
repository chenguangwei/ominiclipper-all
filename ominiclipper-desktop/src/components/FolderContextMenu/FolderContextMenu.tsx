import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MenuItem, MenuDivider } from './MenuItem';
import IconColorPicker from './IconColorPicker';
import { FolderContextMenuProps } from './types';

export const FolderContextMenu: React.FC<FolderContextMenuProps> = ({
  folder,
  position,
  isOpen,
  onClose,
  folders,
  expandedIds,
  isSystemFolder,
  onCreateFolder,
  onCreateSubfolder,
  onRename,
  onDelete,
  onClone,
  onMove,
  onToggleExpand,
  onExpandSiblings,
  onExpandAll,
  onCollapseAll,
  onChangeIcon,
  colorMode = 'dark',
}) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const isLight = colorMode === 'light';

  // Check if folder has children
  const hasChildren = folders.some(f => f.parentId === folder.id);
  const isExpanded = expandedIds.has(folder.id);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = position.x;
      let adjustedY = position.y;

      // Adjust horizontal position
      if (rect.right > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 10;
      }

      // Adjust vertical position
      if (rect.bottom > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 10;
      }

      if (adjustedX !== position.x || adjustedY !== position.y) {
        menu.style.left = `${adjustedX}px`;
        menu.style.top = `${adjustedY}px`;
      }
    }
  }, [isOpen, position]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop for closing */}
      <div
        className="fixed inset-0 z-[200]"
        onClick={onClose}
      />

      {/* Context Menu */}
      <div
        ref={menuRef}
        className={`
          fixed z-[201] min-w-[240px] rounded-lg shadow-xl py-1
          border animate-in fade-in zoom-in-95 duration-100
          ${isLight
            ? 'bg-white border-gray-200'
            : 'bg-[#1a1a1a] border-white/10'
          }
        `}
        style={{ left: position.x, top: position.y }}
      >
        {/* New Folder - creates sibling */}
        <MenuItem
          icon="create_new_folder"
          label={t('context_menu.new_folder', '新增文件夹')}
          shortcut="⌘⇧N"
          onClick={() => {
            onCreateFolder(folder.id);
            onClose();
          }}
          colorMode={colorMode}
        />

        {/* New Subfolder */}
        <MenuItem
          icon="folder_copy"
          label={t('context_menu.new_subfolder', '新增子文件夹')}
          shortcut="⌥N"
          onClick={() => {
            onCreateSubfolder(folder.id);
            onClose();
          }}
          colorMode={colorMode}
        />

        {/* Move Folder */}
        <MenuItem
          icon="drive_file_move"
          label={t('context_menu.move_folder', '移动文件夹')}
          onClick={() => {
            onMove(folder);
            onClose();
          }}
          disabled={isSystemFolder}
          colorMode={colorMode}
        />

        <MenuDivider colorMode={colorMode} />

        {/* Rename */}
        <MenuItem
          icon="edit"
          label={t('context_menu.rename', '重命名')}
          shortcut="⌘R"
          onClick={() => {
            onRename(folder);
            onClose();
          }}
          disabled={isSystemFolder}
          colorMode={colorMode}
        />

        <MenuDivider colorMode={colorMode} />

        {/* Expand/Collapse */}
        <MenuItem
          icon={isExpanded ? 'unfold_less' : 'unfold_more'}
          label={isExpanded
            ? t('context_menu.collapse_folder', '收起文件夹')
            : t('context_menu.expand_folder', '展开文件夹')
          }
          onClick={() => {
            onToggleExpand(folder.id);
            onClose();
          }}
          disabled={!hasChildren}
          colorMode={colorMode}
        />

        {/* Expand/Collapse Siblings */}
        <MenuItem
          icon="format_list_bulleted"
          label={t('context_menu.toggle_siblings', '展开/收起同阶层文件夹')}
          onClick={() => {
            onExpandSiblings(folder.id);
            onClose();
          }}
          colorMode={colorMode}
        />

        {/* Expand/Collapse All */}
        <MenuItem
          icon="account_tree"
          label={t('context_menu.toggle_all', '展开/收起所有文件夹')}
          shortcut="/"
          onClick={() => {
            // Check if any folder is expanded
            const anyExpanded = folders.some(f => expandedIds.has(f.id));
            if (anyExpanded) {
              onCollapseAll();
            } else {
              onExpandAll();
            }
            onClose();
          }}
          colorMode={colorMode}
        />

        <MenuDivider colorMode={colorMode} />

        {/* Clone */}
        <MenuItem
          icon="content_copy"
          label={t('context_menu.clone', '克隆')}
          onClick={() => {
            onClone(folder.id);
            onClose();
          }}
          disabled={isSystemFolder}
          colorMode={colorMode}
        />

        <MenuDivider colorMode={colorMode} />

        {/* Folder Icon with color picker submenu */}
        <MenuItem
          icon="palette"
          label={t('context_menu.folder_icon', '文件夹图标')}
          hasSubmenu
          disabled={isSystemFolder}
          colorMode={colorMode}
        >
          <IconColorPicker
            currentIcon={folder.icon || 'folder'}
            currentColor={folder.color}
            onSelect={(icon, color) => {
              onChangeIcon(folder.id, icon, color);
              onClose();
            }}
            colorMode={colorMode}
          />
        </MenuItem>

        <MenuDivider colorMode={colorMode} />

        {/* Delete */}
        <MenuItem
          icon="delete"
          label={t('context_menu.delete_folder', '删除文件夹')}
          shortcut="⌘⌫"
          onClick={() => {
            onDelete(folder.id);
            onClose();
          }}
          disabled={isSystemFolder}
          danger
          colorMode={colorMode}
        />
      </div>
    </>
  );
};

export default FolderContextMenu;
