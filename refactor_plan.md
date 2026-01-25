# Ominiclipper Project Refactoring Plan

This document outlines the strategy to reorganize the `ominiclipper-all` project and refactor key large files to improve maintainability, verifyability, and developer experience.

## 1. Directory Structure Reorganization

The current project has a flat structure mixed with some folders. We will move towards a standard "monorepo-like" or separated source structure.

### 1.1 Browser Extension (`browser-extension`)

**Current Issues:**
- Source files (`background.js`, `content.js`) are in the project root.
- React app files (`App.tsx`) are also in the root.
- Mixed build and configuration files with source code.

**Proposed Structure:**

```text
browser-extension/
├── src/
│   ├── background/         # Background script logic
│   │   └── index.ts        # Entry point (was background.js)
│   ├── content/            # Content scripts
│   │   ├── index.ts        # Entry point (was content.js)
│   │   └── styles.css      # Content styles
│   ├── popup/              # Extension Popup (React App)
│   │   ├── App.tsx
│   │   ├── index.tsx
│   │   ├── components/     # Popup-specific components
│   │   └── pages/          # Popup routes/views
│   ├── components/         # Shared UI components
│   ├── services/           # Shared business logic
│   ├── utils/              # Helper functions
│   ├── types/              # TypeScript definitions
│   └── assets/             # Images, fonts, etc.
├── public/                 # Static assets
│   ├── manifest.json
│   └── icons/
├── ...config files
```

**Action Items:**
1.  Create `src` directory with subdirectories.
2.  Move `background.js` -> `src/background/index.ts` (ensure `vite.config.ts` entry points are updated).
3.  Move `content.js` -> `src/content/index.ts`.
4.  Move React files (`App.tsx`, `index.tsx`) -> `src/popup/`.
5.  Update `vite.config.ts` to point to new input paths.

### 1.2 Desktop Application (`ominiclipper-desktop`)

**Current Issues:**
- `App.tsx` in root is too large.
- Electron main process code is in `electron/` but renderer code is in root.
- Lack of clear separation between "features".

**Proposed Structure:**

```text
ominiclipper-desktop/
├── electron/               # Electron Main & Preload
│   ├── main/
│   │   └── index.ts
│   └── preload/
│       └── index.ts
├── src/                    # Renderer Process (React)
│   ├── app/                # App-wide setup
│   │   ├── App.tsx         # Root component (cleaned up)
│   │   ├── main.tsx        # Entry point (was index.tsx)
│   │   └── routes.tsx      # Routing definitions
│   ├── components/         # Shared UI Components
│   ├── features/           # Feature-based modules (Optional but recommended)
│   │   ├── file-manager/
│   │   ├── settings/
│   │   └── editor/
│   ├── services/           # Application services
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Helpers
│   ├── types/              # Type definitions
│   └── assets/
├── ...config files
```

**Action Items:**
1.  Move renderer source files (React code) into `src/`.
2.  Adopt `electron-vite` standard structure or configure `vite.config.ts` to look for root in `src`.

## 2. Refactoring Large Files

The following files utilize > 500 lines and require splitting.

### 2.1 `ominiclipper-desktop/App.tsx` (~1570 lines)

**Problem:** Acts as a "God Object", handling routing, global state, command handling, and layout.

**Refactoring Strategy:**
1.  **Extract Providers:** Move context providers (Theme, Auth, Data) into `src/providers/AppProviders.tsx`.
2.  **Extract Layout:** Move the sidebar, top bar, and main content structure into `src/layouts/MainLayout.tsx`.
3.  **Extract Routing:** Move the switch/route logic into `src/routes/AppRoutes.tsx`.
4.  **Extract Initialization:** Move `useEffect` hooks that handle initial load, global event listeners (like 'copy', 'paste') into custom hooks (e.g., `useAppInitialization.ts`, `useGlobalShortcuts.ts`).

### 2.2 `ominiclipper-desktop/services/storageService.ts` (~1330 lines)

**Problem:** likely handles too many distinct storage concerns (Local, Cloud/Supabase, Caching, FileSystem).

**Refactoring Strategy:**
1.  **Split by Domain:**
    - `src/services/storage/localFileService.ts`: Native file system operations.
    - `src/services/storage/cloudStorageService.ts`: Supabase storage interactions.
    - `src/services/storage/syncService.ts`: Synchronization logic between local and cloud.
2.  **Use Composition:** Create a `StorageManager` class that orchestrates these smaller services if a unified API is needed.

### 2.3 `browser-extension/background.js` (~970 lines)

**Problem:** Handles all background events: install, context menus, runtime messages, storage sync.

**Refactoring Strategy:**
1.  **Modularize Handlers:**
    - `src/background/handlers/installHandler.ts`: `onInstalled` events.
    - `src/background/handlers/messageHandler.ts`: `onMessage` dispatcher.
    - `src/background/handlers/contextMenuHandler.ts`: Context menu creation/execution.
2.  **Main Entry Point:** `src/background/index.ts` should only register the high-level listeners and delegate to handlers.

### 2.4 Other Large Files
-   **`components/CaptureForm.tsx` (Extension):** Extract the Form UI into smaller sub-components (`TagInput`, `CategorySelect`, `NoteField`). Move submission logic to a custom hook `useCaptureForm`.
-   **`services/ruleEngine.ts` (Desktop):** Split into specific rule types (e.g., `FileRuleProcessor`, `ContentRuleProcessor`).
-   **`services/fileManager.ts` (Desktop):** Separate UI-state logic (selection, view mode) from actual Data-manipulation logic (move, delete, rename).

## 3. Implementation Steps for AI Architect

When using this plan, follow this order to minimize breakage:

1.  **Setup Phase:**
    -   Create new directories (`src`, `src/components`, etc.).
    -   Update `tsconfig.json` to include new paths (`@/*` alias mapping to `src/*`).

2.  **Migration Phase (Low Risk):**
    -   Move independent `utils` and `types`.
    -   Move independent `components` (buttons, inputs) to `src/components`.

3.  **Migration Phase (Medium Risk):**
    -   Move `services`. Note: Update imports in all consumers.
    -   Refactor `storageService.ts` incrementally (extract one class at a time).

4.  **Refactoring Phase (High Risk):**
    -   Refactor `App.tsx`: Create `MainLayout` first, then plug existing `App` content into it, then peel off features.
    -   Verify the application starts after each major extraction.

5.  **Cleanup:**
    -   Remove old root files.
    -   Fix any lingering relative imports (../../../).

## 4. Verification

-   **Build Check:** Run `npm run build` after each move.
-   **Lint Check:** Run `npm run lint` to catch import errors.
-   **Manual Test:** Verify critical flows (Capture in extension, File list in desktop) after touching `App.tsx` or `services`.
