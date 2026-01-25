import { useEffect } from 'react';
import { ResourceItem } from '@/types';

export const useKeyboardShortcuts = (
    selectedItemId: string | null,
    setSelectedItemId: (id: string | null) => void,
    filteredItems: ResourceItem[],
    handleDeleteResource: (id: string) => void,
    setIsCreateResourceOpen: (v: boolean) => void,
    setIsCreateFolderOpen: (v: boolean) => void,
    setIsCreateTagOpen: (v: boolean) => void,
    setIsImportExportOpen: (v: boolean) => void,
    setIsAuthOpen: (v: boolean) => void
) => {

    // General shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if typing in input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            // Cmd/Ctrl + N: New resource
            if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
                e.preventDefault();
                setIsCreateResourceOpen(true);
            }

            // Cmd/Ctrl + F: Focus search
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
                searchInput?.focus();
            }

            // Cmd/Ctrl + E: Export
            if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
                e.preventDefault();
                setIsImportExportOpen(true);
            }

            // Delete: Delete selected item
            if (e.key === 'Delete' && selectedItemId) {
                e.preventDefault();
                handleDeleteResource(selectedItemId);
            }

            // Escape: Close dialogs
            if (e.key === 'Escape') {
                setIsCreateResourceOpen(false);
                setIsCreateFolderOpen(false);
                setIsCreateTagOpen(false);
                setIsImportExportOpen(false);
                setIsAuthOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedItemId, handleDeleteResource]);

    // Arrow keys navigation
    useEffect(() => {
        const handleArrowKey = (e: KeyboardEvent) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && filteredItems.length > 0) {
                const currentIndex = filteredItems.findIndex(item => item.id === selectedItemId);
                let newIndex = currentIndex;

                if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                    newIndex = currentIndex < filteredItems.length - 1 ? currentIndex + 1 : 0;
                } else {
                    newIndex = currentIndex > 0 ? currentIndex - 1 : filteredItems.length - 1;
                }

                setSelectedItemId(filteredItems[newIndex].id);
            }
        };

        window.addEventListener('keydown', handleArrowKey);
        return () => window.removeEventListener('keydown', handleArrowKey);
    }, [selectedItemId, filteredItems, setSelectedItemId]);
};
