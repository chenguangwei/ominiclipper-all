import { ResourceItem, Folder, Tag } from '../types';

/**
 * Service for exporting library data
 */

// Helper to sanitize filenames
const sanitize = (name: string): string => {
    return name.replace(/[\\/:*?"<>|]/g, '_');
};

/**
 * Export specific items to a target directory with structured folders
 * @param targetRootDir The absolute path of the directory to export to
 * @param items List of items to export
 * @param folders List of all folders (to resolve hierarchy)
 * @param tags List of all tags (optional, for future use)
 */
export const exportToStructuredFolder = async (
    targetRootDir: string,
    items: ResourceItem[],
    folders: Folder[],
    tags: Tag[],
    onProgress?: (current: number, total: number, filename: string) => void
): Promise<{ success: boolean; count: number; errors: string[] }> => {
    const electronAPI = (window as any).electronAPI;

    if (!electronAPI?.exportFile) {
        console.error('Export API not available');
        return { success: false, count: 0, errors: ['Electron API not available'] };
    }

    const errors: string[] = [];
    let successCount = 0;

    // Helper to build folder path cache
    const folderPathCache = new Map<string, string>();

    const getFolderPath = (folderId: string | undefined): string => {
        if (!folderId) return ''; // Root
        if (folderPathCache.has(folderId)) return folderPathCache.get(folderId)!;

        const folder = folders.find(f => f.id === folderId);
        if (!folder) return ''; // Folder not found, treat as root

        const parentPath = getFolderPath(folder.parentId);
        const currentPath = parentPath ? `${parentPath}/${sanitize(folder.name)}` : sanitize(folder.name);

        folderPathCache.set(folderId, currentPath);
        return currentPath;
    };

    // Process items
    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Skip if path is missing
        if (!item.path && !item.originalPath) {
            errors.push(`Item "${item.title}" has no file path.`);
            continue;
        }

        const sourcePath = item.path || item.localPath || item.originalPath || '';

        // Resolve relative storage path to absolute if needed
        // (Assuming item.path is absolute if local, or relative to storage)
        // For now we assume if it starts with /, it's absolute. 
        // If not, we might need to ask main process to resolve it but sourcePath passed to exportFile should optionally handle it.
        // However, usually `item.path` stored in DB is absolute for our current implementation.

        // Determine export subfolder structure
        const relFolderStruct = getFolderPath(item.folderId);
        const targetDir = relFolderStruct
            ? `${targetRootDir}/${relFolderStruct}`
            : targetRootDir;

        try {
            if (onProgress) onProgress(i + 1, items.length, item.title);

            const result = await electronAPI.exportFile(
                sourcePath,
                targetDir,
                // Use title as filename, adding extension from original type or source path
                `${sanitize(item.title)}${getExtension(sourcePath, item.type)}`
            );

            if (result.success) {
                successCount++;
            } else {
                errors.push(`Failed to export "${item.title}": ${result.error}`);
            }
        } catch (err: any) {
            errors.push(`Exception exporting "${item.title}": ${err.message}`);
        }
    }

    return {
        success: errors.length === 0,
        count: successCount,
        errors
    };
};

const getExtension = (pathStr: string, type: string): string => {
    // Try to get from path
    if (pathStr) {
        const extId = pathStr.lastIndexOf('.');
        if (extId > 0) return pathStr.substring(extId);
    }
    // Fallback map
    const typeMap: Record<string, string> = {
        'pdf': '.pdf',
        'image': '.png', // generic fallback
        'markdown': '.md',
        'web': '.html'
    };
    // If type is generic, we might lose extension if path is missing.
    return typeMap[type] || '';
};
