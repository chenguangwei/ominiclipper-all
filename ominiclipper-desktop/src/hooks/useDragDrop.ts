import { useState, useRef, useEffect, useCallback } from 'react';
import { ResourceItem, FilterState, FileStorageMode, ResourceType } from '@/types';
import * as storageService from '@/services/storageService';
import { extractContentSnippet } from '@/services/contentExtractionService';
import { importSingleFile, classifyAndImportFile, BatchImportFile } from '@/services/batchImportService';

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
    setFolders: (folders: any[]) => void,
    setTags: (tags: any[]) => void,
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

    // Import progress state
    const [importProgress, setImportProgress] = useState<{
        isVisible: boolean;
        status: 'preparing' | 'classifying' | 'importing' | 'indexing' | 'complete' | 'error';
        fileName?: string;
        progress?: number;
        message?: string;
    }>({ isVisible: false, status: 'preparing' });

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

        console.log('[useDragDrop] handleDropOnFolder called for file:', file.name);

        try {
            // Use importSingleFile which handles storage (Scheme A support),
            // but override classification to target the specific folder.
            const result = await importSingleFile(file, {
                storageMode: 'embed', // Or should we infer from settings? Defaulting to embed for now as per prior logic
                useRules: false, // Force to specific folder
                useAI: false,    // Force to specific folder
                autoCreateFolders: false,
                targetFolderId: folderId
            });

            if (result.success) {
                console.log('[useDragDrop] File dropped on folder successfully:', result.file.path);
            } else {
                console.error('[useDragDrop] Failed to drop file on folder:', result.error);
                showBrowserModeWarning(`Import failed: ${result.error}`);
            }

            await storageService.flushPendingWrites();
            setItems([...storageService.getItemsAsResourceItems()]);
        } catch (error) {
            console.error('[useDragDrop] Exception dropping file on folder:', error);
            showBrowserModeWarning(`Import exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleFileDropConfirm = async (mode: FileStorageMode) => {
        if (!pendingDropFile) return;

        console.log('=== [useDragDrop] handleFileDropConfirm ===');
        console.log('[useDragDrop] Calling importSingleFile with auto-classification');

        try {
            const specialFolders = ['all', 'recent', 'starred', 'uncategorized', 'untagged', 'trash'];
            const targetFolderId = (filterState.folderId && !specialFolders.includes(filterState.folderId))
                ? filterState.folderId : undefined;

            // Show progress
            setImportProgress({ isVisible: true, status: 'preparing', fileName: pendingDropFile.name });

            // Update to classifying
            setImportProgress(prev => ({ ...prev, status: 'classifying', message: 'Analyzing file...' }));

            const result = await importSingleFile(pendingDropFile, {
                storageMode: mode,
                useRules: true,
                useAI: true,
                autoCreateFolders: true,
                targetFolderId: targetFolderId
            });

            if (result.success) {
                setImportProgress(prev => ({ ...prev, status: 'importing', message: 'Saving file...' }));
                console.log('[useDragDrop] Import successful:', result.classification);
                if (result.classification?.isAiclassified) {
                    console.log('[useDragDrop] AI classified to:', result.classification.folderName);
                }

                // Show complete
                setImportProgress(prev => ({ ...prev, status: 'complete', message: 'File imported!' }));
                setTimeout(() => setImportProgress(prev => ({ ...prev, isVisible: false })), 1500);
            } else {
                console.error('[useDragDrop] Import failed:', result.error);
                setImportProgress({ isVisible: true, status: 'error', fileName: pendingDropFile.name, message: result.error });
                setTimeout(() => setImportProgress(prev => ({ ...prev, isVisible: false })), 3000);
            }
        } catch (error) {
            console.error('[useDragDrop] Import exception:', error);
            setImportProgress({ isVisible: true, status: 'error', fileName: pendingDropFile?.name, message: error instanceof Error ? error.message : 'Unknown error' });
            setTimeout(() => setImportProgress(prev => ({ ...prev, isVisible: false })), 3000);
        }

        await storageService.flushPendingWrites();
        setItems([...storageService.getItemsAsResourceItems()]);
        setFolders([...storageService.getFolders()]); // Sync folders
        setTags([...storageService.getTags()]);       // Sync tags
        setPendingDropFile(null);
        setIsFileDropDialogOpen(false);
    };

    const handleFileDropClose = () => {
        setPendingDropFile(null);
        setIsFileDropDialogOpen(false);
    };

    const handleFolderDropConfirm = async (files: ScannedFile[], mode: FileStorageMode, classifications?: FileClassification[]) => {
        // Prepare storage service data for synchronous access
        const folders = storageService.getFolders();
        const tags = storageService.getTags();

        // Iterate files and add them to storage using consistent batch import logic
        for (const file of files) {
            try {
                // Map ScannedFile to BatchImportFile
                const batchFile: BatchImportFile = {
                    name: file.name,
                    path: file.path,
                    extension: file.extension,
                    size: file.size,
                    mimeType: file.mimeType,
                    modifiedAt: file.modifiedAt
                };

                // Use classifyAndImportFile from batch service
                // This handles Scheme A storage (ID based), content extraction, etc.
                await classifyAndImportFile(batchFile, folders, tags, {
                    storageMode: mode,
                    useRules: true, // Allow rules? Maybe yes, for tags.
                    useAI: false,   // Maybe disable AI for speed if just dropping folder? Or user expects it. 
                    // "Folder Drop" usually implies "Import this folder structure".
                    // But here we are just importing flat list of files from drag-drop.
                    // Let's keep rules on, AI off for speed unless asked.
                    autoCreateFolders: false, // Don't create random folders, unless we want to recreate source structure (which we don't have here easily)
                    targetFolderId: undefined // Or use pendingDropFolder logic if it was a target drop? 
                    // Actually this function is called when dropping A FOLDER from OS.
                    // Usually users expect the items to just be added.
                });

            } catch (e) {
                console.error('[useDragDrop] Failed to import file from folder drop:', file.name, e);
            }
        }

        await storageService.flushPendingWrites();
        setItems([...storageService.getItemsAsResourceItems()]);
        setFolders([...storageService.getFolders()]); // Sync folders
        setTags([...storageService.getTags()]);       // Sync tags
        setPendingDropFolder(null);
        setIsFolderDropDialogOpen(false);
    };

    return {
        isDragOver, handleDragEnter, handleDragLeave, handleDrop,
        pendingDropFile, isFileDropDialogOpen, handleFileDropConfirm, handleFileDropClose,
        pendingDropFolder, isFolderDropDialogOpen, setPendingDropFolder, setIsFolderDropDialogOpen,
        handleDropOnFolder, handleFolderDropConfirm,
        browserModeWarning, setBrowserModeWarning,
        importProgress
    };
};
