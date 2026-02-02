import { useState, useCallback } from 'react';
import { Folder } from '@/types';
import * as storageService from '@/services/storageService';
import * as folderOps from '@/services/folderOperations';
import { INITIAL_FOLDERS } from '@/constants';

interface ContextMenuState {
  folder: Folder;
  position: { x: number; y: number };
}

interface UseFolderContextMenuOptions {
  folders: Folder[];
  setFolders: (folders: Folder[]) => void;
  expandedIds: Set<string>;
  setExpandedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export const useFolderContextMenu = ({
  folders,
  setFolders,
  expandedIds,
  setExpandedIds,
}: UseFolderContextMenuOptions) => {
  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Dialog states
  const [renameDialog, setRenameDialog] = useState<{ folder: Folder } | null>(null);
  const [moveDialog, setMoveDialog] = useState<{ folder: Folder } | null>(null);

  // Inline editing state - ID of folder being edited inline
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  // Check if folder is a system folder (protected from delete/rename)
  const isSystemFolder = useCallback((folderId: string): boolean => {
    return INITIAL_FOLDERS.some(f => f.id === folderId);
  }, []);

  // Open context menu
  const openContextMenu = useCallback((folder: Folder, position: { x: number; y: number }) => {
    setContextMenu({ folder, position });
  }, []);

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Refresh folders from storage
  const refreshFolders = useCallback(() => {
    setFolders([...storageService.getFolders()]);
  }, [setFolders]);

  // Handle rename
  const handleRename = useCallback((folder: Folder) => {
    setRenameDialog({ folder });
  }, []);

  const handleRenameConfirm = useCallback(async (folderId: string, newName: string) => {
    if (!newName.trim()) return false;

    try {
      storageService.updateFolder(folderId, { name: newName.trim() });
      refreshFolders();
      setRenameDialog(null);
      return true;
    } catch (err) {
      console.error('[useFolderContextMenu] Rename failed:', err);
      return false;
    }
  }, [refreshFolders]);

  const handleRenameCancel = useCallback(() => {
    setRenameDialog(null);
  }, []);

  // Handle clone
  const handleClone = useCallback(async (folderId: string) => {
    try {
      await folderOps.cloneFolder(folderId, folders);
      refreshFolders();
    } catch (err) {
      console.error('[useFolderContextMenu] Clone failed:', err);
    }
  }, [folders, refreshFolders]);

  // Handle move
  const handleMove = useCallback((folder: Folder) => {
    setMoveDialog({ folder });
  }, []);

  const handleMoveConfirm = useCallback(async (folderId: string, targetParentId: string | undefined) => {
    try {
      const success = await folderOps.moveFolder(folderId, targetParentId, folders);
      if (success) {
        refreshFolders();
        setMoveDialog(null);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[useFolderContextMenu] Move failed:', err);
      return false;
    }
  }, [folders, refreshFolders]);

  const handleMoveCancel = useCallback(() => {
    setMoveDialog(null);
  }, []);

  // Handle delete
  const handleDelete = useCallback(async (folderId: string) => {
    try {
      await storageService.deleteFolder(folderId);
      refreshFolders();
    } catch (err) {
      console.error('[useFolderContextMenu] Delete failed:', err);
    }
  }, [refreshFolders]);

  // Handle icon/color change
  const handleChangeIcon = useCallback(async (folderId: string, icon: string, color?: string) => {
    try {
      storageService.updateFolder(folderId, { icon, color });
      refreshFolders();
    } catch (err) {
      console.error('[useFolderContextMenu] Change icon failed:', err);
    }
  }, [refreshFolders]);

  // Handle toggle expand
  const handleToggleExpand = useCallback((folderId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, [setExpandedIds]);

  // Handle expand/collapse siblings
  const handleExpandSiblings = useCallback((folderId: string) => {
    const siblings = folderOps.getSiblingFolders(folderId, folders);
    const folder = folders.find(f => f.id === folderId);

    // Include the current folder in the list
    const allSiblings = folder ? [folder, ...siblings] : siblings;

    // Check if any sibling is expanded
    const anyExpanded = allSiblings.some(f => expandedIds.has(f.id));

    setExpandedIds(prev => {
      const next = new Set(prev);
      allSiblings.forEach(f => {
        if (anyExpanded) {
          next.delete(f.id);
        } else {
          next.add(f.id);
        }
      });
      return next;
    });
  }, [folders, expandedIds, setExpandedIds]);

  // Handle expand all
  const handleExpandAll = useCallback(() => {
    setExpandedIds(new Set(folders.map(f => f.id)));
  }, [folders, setExpandedIds]);

  // Handle collapse all
  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, [setExpandedIds]);

  // ========================================
  // Inline Folder Creation (New Folder / New Subfolder)
  // ========================================

  // Create sibling folder (same level) with inline edit
  const handleCreateSiblingFolder = useCallback(async (currentFolderId: string) => {
    const currentFolder = folders.find(f => f.id === currentFolderId);
    const parentId = currentFolder?.parentId; // Same parent = sibling

    try {
      const newFolder = await storageService.addFolder({
        name: '未命名文件夹',
        parentId,
        icon: 'folder',
      });

      // Refresh folders first
      setFolders([...storageService.getFolders()]);

      // Expand parent to show new folder (if has parent)
      if (parentId) {
        setExpandedIds(prev => new Set([...prev, parentId]));
      }

      // Enter inline edit mode for new folder
      setEditingFolderId(newFolder.id);

      return newFolder;
    } catch (err) {
      console.error('[useFolderContextMenu] Create sibling folder failed:', err);
      return null;
    }
  }, [folders, setFolders, setExpandedIds]);

  // Create child folder (subfolder) with inline edit
  const handleCreateChildFolder = useCallback(async (parentFolderId: string) => {
    try {
      const newFolder = await storageService.addFolder({
        name: '未命名文件夹',
        parentId: parentFolderId,
        icon: 'folder',
      });

      // Refresh folders first
      setFolders([...storageService.getFolders()]);

      // Expand parent to show new subfolder
      setExpandedIds(prev => new Set([...prev, parentFolderId]));

      // Enter inline edit mode for new folder
      setEditingFolderId(newFolder.id);

      return newFolder;
    } catch (err) {
      console.error('[useFolderContextMenu] Create child folder failed:', err);
      return null;
    }
  }, [setFolders, setExpandedIds]);

  // Handle inline edit complete (save or delete)
  const handleInlineEditComplete = useCallback(async (folderId: string, newName: string) => {
    const trimmedName = newName.trim();

    try {
      if (!trimmedName || trimmedName === '未命名文件夹') {
        // Empty name or default name - delete the folder
        await storageService.deleteFolder(folderId);
      } else {
        // Save the new name
        storageService.updateFolder(folderId, { name: trimmedName });
      }

      setFolders([...storageService.getFolders()]);
    } catch (err) {
      console.error('[useFolderContextMenu] Inline edit complete failed:', err);
    }

    setEditingFolderId(null);
  }, [setFolders]);

  // Handle inline edit cancel (delete if new folder)
  const handleInlineEditCancel = useCallback(async (folderId: string) => {
    // Check if this is a new folder (name is still "未命名文件夹")
    const folder = folders.find(f => f.id === folderId);

    try {
      if (folder?.name === '未命名文件夹') {
        // This is a new folder that was just created - delete it
        await storageService.deleteFolder(folderId);
        setFolders([...storageService.getFolders()]);
      }
    } catch (err) {
      console.error('[useFolderContextMenu] Inline edit cancel failed:', err);
    }

    setEditingFolderId(null);
  }, [folders, setFolders]);

  return {
    // Context menu state
    contextMenu,
    openContextMenu,
    closeContextMenu,

    // Dialog states
    renameDialog,
    moveDialog,

    // Inline editing state
    editingFolderId,
    setEditingFolderId,

    // Utility
    isSystemFolder,

    // Actions
    handleRename,
    handleRenameConfirm,
    handleRenameCancel,
    handleClone,
    handleMove,
    handleMoveConfirm,
    handleMoveCancel,
    handleDelete,
    handleChangeIcon,
    handleToggleExpand,
    handleExpandSiblings,
    handleExpandAll,
    handleCollapseAll,

    // Inline folder creation
    handleCreateSiblingFolder,
    handleCreateChildFolder,
    handleInlineEditComplete,
    handleInlineEditCancel,
  };
};

export default useFolderContextMenu;
