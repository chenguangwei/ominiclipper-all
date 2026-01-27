# ID-Based Storage & Structured Export Walkthrough

## Changes Implemented

### 1. Storage Backend (Scheme A)
- **New Structure**: New files are now stored in `OmniCollector/files/{id}/{filename}` (ID-based folder) instead of the flat `documents/` directory.
- **Backend Handler**: Added `fs:importFileToIdStorage` in `main.cjs` to handle creating the ID directory and copying the file.
- **Service Update**: Updated `batchImportService.ts` to generate IDs immediately and use the new storage handler.

### 2. Structured Export
- **New Feature**: Added "Export as Folder Structure" in the Import/Export dialog.
- **Logic**: Implemented `src/services/exportService.ts` which reconstructs the logical folder hierarchy (e.g., `Work/Project A/`) physically on disk and copies the original files there.
- **Backend Handler**: Added `fs:exportFile` in `main.cjs` to handle safe copying with duplicate name resolution.

## Verification Steps

### storage
1.  **Import a File**: Drag and drop a file into the app.
2.  **Verify Path**: Check `OmniCollector/files/`. You should see a new folder with the Item ID (e.g., `item-173...`). Inside should be the file.
3.  **Verify App**: The file should appear in the app and open correctly.

### Export
1.  **Create Folders**: In the app, create a folder structure (e.g., `Export Test` -> `Subfolder`).
2.  **Move Files**: Move some files into these folders.
3.  **Run Export**:
    - Go to Settings -> Import/Export -> Export.
    - Click "Export as Folder Structure".
    - Select a destination (e.g., Desktop/ExportResult).
4.  **Verify Result**: Open `ExportResult` on your computer. You should see `Export Test/Subfolder` containing your files. The filenames should be sanitized (original title + extension).

## Notes
- **Legacy Compatibility**: Old files in `documents/` continue to work without migration.
- **Browser Extension**: Fixed a potential issue with browser extension import synchronization.
