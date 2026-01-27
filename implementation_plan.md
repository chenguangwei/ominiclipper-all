# Storage Architecture Update & Structured Export Plan

## Goal
1.  **Switch to Scheme A (ID-Based Storage)**: All new files should be stored in `OmniCollector/files/{id}/{filename}` to ensure scalability and better file management.
2.  **Implement Structured Export**: Provide a feature to export all original documents into a physical folder structure that mirrors the logical folder hierarchy (e.g., `Export/Work/ProjectA/doc.pdf`), excluding metadata files.

## User Review Required
> [!IMPORTANT]
> - Existing files in the legacy `documents/` folder will **NOT** be moved automatically to avoid breakage. They will remain supported. Only *new* imports will use the ID-based structure.
> - The Export feature is a one-way operation (snapshot). It does not maintain a live sync.

## Proposed Changes

### Backend (Electron `main.cjs`)
#### [MODIFY] `ipcMain` handlers
- Update or create a new handler `fs:importFileToIdStorage` that:
    1. Accepts `sourcePath` and `itemId`.
    2. Creates `OmniCollector/files/{itemId}/`.
    3. Copies the source file into that directory.
    4. Returns the new relative or absolute path.

- Add new handler `fs:exportLibrary` (or implemented in frontend logic calling `fs:copyFile`):
    - It's better to implement the heavy lifting in the Main process to avoid UI freezing, but frontend orchestration allows better progress tracking.
    - Given the complexity of the logical structure (which exists in `library.json` in the renderer), the **Frontend** will calculate the target paths and instruct the **Backend** to copy files one by one (or in batches).

### Frontend Services

#### [MODIFY] `src/services/storageService.ts`
- Update `addItem` logic (or the caller) to prefer the new storage path format.

#### [MODIFY] `src/services/batchImportService.ts` & `src/hooks/useDragDrop.ts`
- Change the import flow:
    1. Generate `itemId` *before* physical copy (currently `itemId` is generated inside `addItem`).
    2. Call the new `fs:importFileToIdStorage` with the pre-generated ID.
    3. Save the item record with the returned path.

#### [NEW] `src/services/exportService.ts`
- Implement `exportLibraryToFolder(targetRootDir, folders, items)`:
    - Build a map of Folder ID -> Path string.
    - Iterate through all items.
    - Resolve target path: `targetRootDir + / + folderPath + / + filename`.
    - access `electronAPI.copyFile(source, destination)`.

### UI Changes

#### [MODIFY] `src/components/ImportExportDialog.tsx`
- Add a new tab or section: "Export Documents".
- Button: "Export as Folder Structure".
- Options: "Include Tags as subfolders?" (Maybe later, strict folder structure for now).

## Verification Plan
### Manual Verification
1.  **Import Test**: Drag a new file. Verify it appears in `OmniCollector/files/{new_id}/`.
2.  **Legacy Test**: Verify opening an old file still works.
3.  **Export Test**:
    - Create a hierarchy: `Folder A` -> `Subfolder B`.
    - Put files in Root, A, and B.
    - Run Export.
    - Check target directory: Should see `Folder A/Subfolder B` with correct files.
    - Check that no `.json` or `.png` (thumbnails) are exported.
