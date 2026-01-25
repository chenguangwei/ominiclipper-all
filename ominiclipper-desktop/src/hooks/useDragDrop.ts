import { useState, useRef, useEffect, useCallback } from 'react';
import { ResourceItem, FilterState, FileStorageMode, ResourceType } from '@/types';
import * as storageService from '@/services/storageService';
import * as itemMetaService from '@/services/itemMetadataService';
import { extractContentSnippet } from '@/services/contentExtractionService';

// Helper types
interface ScannedFile {
    name: string;
    path: string;
    extension: string;
    size: number;
    mimeType: string;
    modifiedAt: string;
}

interface FileClassification {
    file: ScannedFile;
    category?: string;
    subfolder?: string;
    suggestedTags?: string[];
    confidence?: number;
    reasoning?: string;
    error?: string;
}

// Check if running in Electron environment with required APIs
const isElectron = (): boolean => {
    return !!(window as any).electronAPI?.copyFileToStorage;
};

// Check if required file storage APIs are available
const hasFileStorageAPI = (): boolean => {
    const api = (window as any).electronAPI;
    return !!(api?.copyFileToStorage && api?.saveEmbeddedFile);
};

export const useDragDrop = (
    setItems: (items: ResourceItem[]) => void,
    filterState: FilterState,
    customStoragePath: string | null
) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const dragCounterRef = useRef(0);
    const [pendingDropFile, setPendingDropFile] = useState<File | null>(null);
    const [isFileDropDialogOpen, setIsFileDropDialogOpen] = useState(false);
    const [pendingDropFolder, setPendingDropFolder] = useState<string | null>(null);
    const [isFolderDropDialogOpen, setIsFolderDropDialogOpen] = useState(false);
    const [browserModeWarning, setBrowserModeWarning] = useState<string | null>(null);

    // Detect browser mode and show warning
    useEffect(() => {
        if (typeof window !== 'undefined' && !isElectron()) {
            // Check if we're actually in a browser environment
            const isBrowser = typeof window !== 'undefined' &&
                typeof document !== 'undefined' &&
                !!(window as any).electronAPI;
            if (!isBrowser) {
                setBrowserModeWarning('Running in browser mode. Some features may be limited.');
            }
        }
    }, []);

    // Clear warning after 5 seconds
    useEffect(() => {
        if (browserModeWarning) {
            const timer = setTimeout(() => {
                setBrowserModeWarning(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [browserModeWarning]);

    // Show browser mode warning
    const showBrowserModeWarning = useCallback((message: string) => {
        setBrowserModeWarning(message);
    }, []);

    // Helper to determine resource type from file
    const getResourceTypeFromFile = (file: File): ResourceType => {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';

        // Check by MIME type first
        if (file.type.startsWith('image/')) return ResourceType.IMAGE;
        if (file.type === 'application/pdf') return ResourceType.PDF;
        if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.type === 'application/msword') return ResourceType.WORD;
        if (file.type === 'application/epub+zip') return ResourceType.EPUB;
        if (file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
            file.type === 'application/vnd.ms-powerpoint') return ResourceType.PPT;
        if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.type === 'application/vnd.ms-excel') return ResourceType.EXCEL;

        // Fallback to extension
        switch (ext) {
            case 'pdf': return ResourceType.PDF;
            case 'doc': case 'docx': return ResourceType.WORD;
            case 'epub': return ResourceType.EPUB;
            case 'ppt': case 'pptx': return ResourceType.PPT;
            case 'xls': case 'xlsx': case 'csv': return ResourceType.EXCEL;
            case 'md': case 'markdown': case 'txt': return ResourceType.MARKDOWN;
            case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': case 'svg': return ResourceType.IMAGE;
            case 'html': case 'htm': return ResourceType.WEB;
            default: return ResourceType.UNKNOWN;
        }
    };

    const getResourceTypeFromExtension = (ext: string): ResourceType => {
        const cleanExt = ext.toLowerCase().replace('.', '');
        switch (cleanExt) {
            case 'pdf': return ResourceType.PDF;
            case 'doc': case 'docx': return ResourceType.WORD;
            case 'epub': return ResourceType.EPUB;
            case 'ppt': case 'pptx': return ResourceType.PPT;
            case 'xls': case 'xlsx': case 'csv': return ResourceType.EXCEL;
            case 'md': case 'markdown': case 'txt': return ResourceType.MARKDOWN;
            case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': case 'svg': return ResourceType.IMAGE;
            case 'html': case 'htm': return ResourceType.WEB;
            default: return ResourceType.UNKNOWN;
        }
    };

    // Metadata generation wrapper
    const generateItemMetadata = async (itemId: string, type: ResourceType, filePath: string) => {
        // Implementation note: In original App.tsx this was a standalone function defined inside.
        // We should move this logic to a service if possible or reimplement here.
        // For brevity and correctness, we will call into itemMetadataService if extracted, 
        // or leave as placeholder for now since the original code for this was complex & async background work.
        // Assuming we rely on the storageService's `addItem` which already calls `saveItemMetadata`.
        // The original `generateItemMetadata` was mainly for thumbnails and descriptions.
        // If thumbnailService is available:
        // await thumbnailService.generateThumbnail(itemId, filePath);
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        dragCounterRef.current++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragOver(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) {
            setIsDragOver(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        dragCounterRef.current = 0;
        setIsDragOver(false);

        const files = e.dataTransfer.files;

        // Debug logging to diagnose file path issues
        console.log('[useDragDrop] handleDrop called');
        console.log('[useDragDrop] files.length:', files.length);
        console.log('[useDragDrop] electronAPI available:', !!(window as any).electronAPI);
        console.log('[useDragDrop] copyFileToStorage available:', !!(window as any).electronAPI?.copyFileToStorage);
        console.log('[useDragDrop] saveEmbeddedFile available:', !!(window as any).electronAPI?.saveEmbeddedFile);

        if (files.length > 0) {
            const file = files[0];
            const filePath = (file as any).path;

            console.log('[useDragDrop] file.name:', file.name);
            console.log('[useDragDrop] file.path (Electron):', filePath);
            console.log('[useDragDrop] file.type:', file.type);
            console.log('[useDragDrop] file.size:', file.size);

            if (filePath && (window as any).electronAPI?.isDirectory) {
                try {
                    const isDir = await (window as any).electronAPI.isDirectory(filePath);
                    if (isDir) {
                        setPendingDropFolder(filePath);
                        setIsFolderDropDialogOpen(true);
                        return;
                    }
                } catch (err) {
                    console.error('Failed to check if directory:', err);
                }
            }

            setPendingDropFile(file);
            setIsFileDropDialogOpen(true);
        }
    };

    const handleDropOnFolder = async (folderId: string, files: FileList) => {
        const file = files[0];
        if (!file) return;

        const electronFilePath = (file as any).path;
        const type = getResourceTypeFromFile(file);
        let path: string = '';
        let localPath: string | undefined;
        let embeddedData: string | undefined;
        const originalPath = electronFilePath || file.name;

        // Check for Electron API availability
        if (!isElectron()) {
            showBrowserModeWarning('Browser mode: File will be embedded, not copied to storage.');
        }

        // ALWAYS copy files to managed storage
        if (electronFilePath && (window as any).electronAPI?.copyFileToStorage) {
            try {
                const result = await (window as any).electronAPI.copyFileToStorage(electronFilePath, file.name, customStoragePath);
                if (result.success) {
                    localPath = result.targetPath;
                    path = result.targetPath;
                    console.log('[useDragDrop] Folder drop - copied to storage:', path);
                } else {
                    throw new Error(result.error || 'Failed to copy file');
                }
            } catch (error) {
                console.error('[useDragDrop] Failed to copy file to storage:', error);
                showBrowserModeWarning(`Failed to copy file: ${error instanceof Error ? error.message : 'Unknown error'}`);
                localPath = electronFilePath;
                path = electronFilePath;
            }
        } else if (!electronFilePath) {
            // Browser upload - read content and save to disk
            console.log('[useDragDrop] Folder drop - no file path, saving content to disk...');
            try {
                const buffer = await file.arrayBuffer();
                let binary = '';
                const bytes = new Uint8Array(buffer);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64Data = btoa(binary);

                // Save the file to disk via IPC
                if ((window as any).electronAPI?.saveEmbeddedFile) {
                    const result = await (window as any).electronAPI.saveEmbeddedFile(base64Data, file.name, null);
                    if (result.success && result.targetPath) {
                        localPath = result.targetPath;
                        path = result.targetPath;
                        console.log('[useDragDrop] Folder drop - browser file saved to disk:', path);
                    }
                } else {
                    showBrowserModeWarning('Browser mode: File stored in embedded format only.');
                }

                // Also keep embedded data for quick access
                embeddedData = base64Data;

                // If save failed, at least we have embedded data
                if (!localPath) {
                    path = '';
                    console.log('[useDragDrop] Folder drop - content embedded only, size:', len);
                }
            } catch (e) {
                console.error('[useDragDrop] Failed to read/save file content:', e);
                showBrowserModeWarning('Failed to process file. Using blob URL as fallback.');
                path = URL.createObjectURL(file);
            }
        } else {
            // Fallback: reference original path
            localPath = electronFilePath;
            path = electronFilePath;
        }

        // Extract content from the file for vector search indexing
        let contentSnippet = `Added to folder`;
        const filePathForExtraction = localPath || electronFilePath;
        if (filePathForExtraction) {
            try {
                console.log('[useDragDrop] Extracting content for folder drop:', filePathForExtraction);
                const extracted = await extractContentSnippet(type, filePathForExtraction, 500);
                if (extracted && extracted.length > 10) {
                    contentSnippet = extracted;
                    console.log('[useDragDrop] Extracted content length:', extracted.length);
                }
            } catch (e) {
                console.warn('[useDragDrop] Content extraction failed:', e);
            }
        }

        const newItem = await storageService.addItem({
            title: file.name.replace(/\.[^/.]+$/, ''),
            type,
            tags: [],
            folderId: folderId,
            color: 'tag-blue',
            path,
            localPath,
            embeddedData,
            originalPath,
            storageMode: 'embed' as FileStorageMode,
            fileSize: file.size,
            mimeType: file.type,
            isCloud: false,
            isStarred: false,
            contentSnippet,
        });

        await storageService.flushPendingWrites();
        setItems([...storageService.getItems()]);
    };

    const handleFileDropConfirm = async (mode: FileStorageMode) => {
        if (!pendingDropFile) return;
        const file = pendingDropFile;
        const type = getResourceTypeFromFile(file);
        let path: string = '';
        let localPath: string | undefined;
        let embeddedData: string | undefined;
        const electronFilePath = (file as any).path;
        const originalPath = electronFilePath || file.name;

        // Detailed debug logging
        console.log('=== [useDragDrop] handleFileDropConfirm ===');
        console.log('[useDragDrop] file.name:', file.name);
        console.log('[useDragDrop] file.path (Electron):', electronFilePath);
        console.log('[useDragDrop] file.size:', file.size);
        console.log('[useDragDrop] mode:', mode);
        console.log('[useDragDrop] isElectron():', isElectron());
        console.log('[useDragDrop] electronAPI exists:', !!(window as any).electronAPI);
        console.log('[useDragDrop] copyFileToStorage exists:', !!(window as any).electronAPI?.copyFileToStorage);
        console.log('[useDragDrop] saveEmbeddedFile exists:', !!(window as any).electronAPI?.saveEmbeddedFile);

        // Check for Electron API availability
        if (!isElectron()) {
            console.warn('[useDragDrop] isElectron() returned false - showing browser warning');
            showBrowserModeWarning('Browser mode: File will be embedded, not copied to persistent storage.');
        }

        // ALWAYS copy files to managed storage to ensure files are preserved
        if (electronFilePath && (window as any).electronAPI?.copyFileToStorage) {
            // Option A: Copy to managed storage (for Electron with file path)
            try {
                const result = await (window as any).electronAPI.copyFileToStorage(electronFilePath, file.name, customStoragePath);
                if (result.success) {
                    localPath = result.targetPath;
                    path = result.targetPath;
                    console.log('[useDragDrop] Copied to storage:', path);
                } else {
                    console.warn('[useDragDrop] Copy failed, falling back to reference:', result.error);
                    showBrowserModeWarning(`Copy failed: ${result.error}. Using reference mode.`);
                    localPath = electronFilePath;
                    path = electronFilePath;
                }
            } catch (e) {
                console.error('[useDragDrop] Copy exception:', e);
                showBrowserModeWarning(`Copy failed: ${e instanceof Error ? e.message : 'Unknown error'}. Using reference mode.`);
                localPath = electronFilePath;
                path = electronFilePath;
            }
        } else if (!electronFilePath) {
            // Option B: No electron path (browser drag) - read content and save to disk
            console.log('[useDragDrop] No file path, reading content and saving to disk...');
            try {
                const buffer = await file.arrayBuffer();
                // Convert to base64
                let binary = '';
                const bytes = new Uint8Array(buffer);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64Data = btoa(binary);

                // Save the file to disk via IPC
                if ((window as any).electronAPI?.saveEmbeddedFile) {
                    const result = await (window as any).electronAPI.saveEmbeddedFile(base64Data, file.name, null);
                    if (result.success && result.targetPath) {
                        localPath = result.targetPath;
                        path = result.targetPath;
                        console.log('[useDragDrop] Browser file saved to disk:', path);
                    }
                } else {
                    showBrowserModeWarning('Browser mode: File stored in embedded format only (data will be lost on restart).');
                }

                // Also keep embedded data for embed mode (for quick access without disk read)
                if (mode === 'embed') {
                    embeddedData = base64Data;
                }

                // If save failed, keep embedded data as fallback
                if (!localPath) {
                    embeddedData = base64Data;
                    path = '';
                    console.log('[useDragDrop] Content embedded only (no disk save), size:', len);
                }
            } catch (e) {
                console.error('[useDragDrop] Failed to read/save file content:', e);
                showBrowserModeWarning('Failed to process file. Using blob URL as fallback (will expire on restart).');
                // Last resort - blob URL will expire on restart
                path = URL.createObjectURL(file);
            }
        } else {
            // Fallback: reference original path
            localPath = electronFilePath;
            path = electronFilePath;
        }

        const specialFolders = ['all', 'recent', 'starred', 'uncategorized', 'untagged', 'trash'];
        const targetFolderId = (!specialFolders.includes(filterState.folderId) && filterState.folderId !== 'all')
            ? filterState.folderId : undefined;

        // Extract content from the file for vector search indexing
        let contentSnippet = `Imported from ${file.name}`;
        const filePathForExtraction = localPath || electronFilePath;
        if (filePathForExtraction) {
            try {
                console.log('[useDragDrop] Extracting content from:', filePathForExtraction);
                const extracted = await extractContentSnippet(type, filePathForExtraction, 500);
                if (extracted && extracted.length > 10) {
                    contentSnippet = extracted;
                    console.log('[useDragDrop] Extracted content length:', extracted.length);
                }
            } catch (e) {
                console.warn('[useDragDrop] Content extraction failed:', e);
            }
        }

        // Log the final values before saving
        console.log('=== [useDragDrop] Saving item to storage ===');
        console.log('[useDragDrop] Final path:', path);
        console.log('[useDragDrop] Final localPath:', localPath);
        console.log('[useDragDrop] Final originalPath:', originalPath);
        console.log('[useDragDrop] Has embeddedData:', !!embeddedData, embeddedData ? `(${embeddedData.length} chars)` : '');

        await storageService.addItem({
            title: file.name.replace(/\.[^/.]+$/, ''),
            type,
            tags: [],
            folderId: targetFolderId,
            color: 'tag-blue',
            path,
            localPath,
            embeddedData,
            originalPath,
            storageMode: mode,
            fileSize: file.size,
            mimeType: file.type,
            isCloud: false,
            isStarred: false,
            contentSnippet
        });

        await storageService.flushPendingWrites();
        setItems([...storageService.getItems()]);
        setPendingDropFile(null);
        setIsFileDropDialogOpen(false);
    };

    const handleFileDropClose = () => {
        setPendingDropFile(null);
        setIsFileDropDialogOpen(false);
    };

    const handleFolderDropConfirm = async (files: ScannedFile[], mode: FileStorageMode, classifications?: FileClassification[]) => {
        // Iterate files and add them to storage
        for (const file of files) {
            const type = getResourceTypeFromExtension(file.extension);
            let path = file.path;
            let localPath: string | undefined = file.path; // Set localPath for Reveal in Finder support

            // ALWAYS copy files to managed storage (not just for embed mode)
            if (path && (window as any).electronAPI?.copyFileToStorage) {
                try {
                    const result = await (window as any).electronAPI.copyFileToStorage(path, file.name, customStoragePath);
                    if (result.success) {
                        localPath = result.targetPath;
                        path = result.targetPath;
                        console.log('[useDragDrop] Batch import - copied to storage:', path);
                    }
                } catch (e) {
                    console.warn('[useDragDrop] Batch import - copy failed, using reference:', e);
                }
            }

            // Extract content from the file for vector search indexing
            let contentSnippet = 'Batch imported';
            if (path) {
                try {
                    console.log('[useDragDrop] Extracting content for batch import:', path);
                    const extracted = await extractContentSnippet(type, path, 500);
                    if (extracted && extracted.length > 10) {
                        contentSnippet = extracted;
                    }
                } catch (e) {
                    console.warn('[useDragDrop] Content extraction failed for:', file.name, e);
                }
            }

            await storageService.addItem({
                title: file.name,
                type,
                tags: [],
                folderId: undefined, // Or use subfolders
                color: 'tag-blue',
                path,
                localPath, // Add localPath for Reveal in Finder
                originalPath: file.path, // Store original path for reference
                storageMode: mode,
                fileSize: file.size,
                mimeType: file.mimeType,
                contentSnippet,
                isCloud: false,
                isStarred: false
            });
        }
        await storageService.flushPendingWrites();
        setItems([...storageService.getItems()]);
        setPendingDropFolder(null);
        setIsFolderDropDialogOpen(false);
    };

    return {
        isDragOver, handleDragEnter, handleDragLeave, handleDrop,
        pendingDropFile, isFileDropDialogOpen, handleFileDropConfirm, handleFileDropClose,
        pendingDropFolder, isFolderDropDialogOpen, setPendingDropFolder, setIsFolderDropDialogOpen,
        handleDropOnFolder, handleFolderDropConfirm,
        browserModeWarning, setBrowserModeWarning
    };
};
