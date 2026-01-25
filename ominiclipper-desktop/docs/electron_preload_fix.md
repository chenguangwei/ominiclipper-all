# Electron Preload Script Fix (2026-01-25)

## Problem
The renderer process was unable to access `window.electronAPI`, resulting in the error:
`[Storage] window.electronAPI exists: false`

## Root Cause
1.  **Project Configuration**: The project uses `"type": "module"` in `package.json`, causing all `.js` files to be treated as ES Modules.
2.  **Vite Build Issue**: The `vite-plugin-electron` was transpiling the TypeScript preload script into a bundled CJS file (`dist-electron/preload/preload.cjs`). However, the resulting bundle (wrapped in `__commonJS`) was either failing to execute correctly or incompatible with the bleeding-edge Electron v35 environment when loaded as a preload script.
3.  **Path Resolution**: Initial path resolution logic for the preload script relied on `process.cwd()`, which was brittle in different environments.

## Solution

### 1. Bypass Build for Preload
Instead of relying on the Vite build output for the preload script, we created a manual CommonJS file that bypasses the bundler.

**Created File**: `electron/preload/manual.cjs`
-   Written in pure CommonJS syntax (`require`/`module.exports`).
-   Contains the full implementation of `contextBridge` exposures.
-   Directly referenced by the main process.

### 2. Robust Path Resolution
Updated `electron/main/index.ts` to use a reliable path resolution strategy and point to the manual file.

```typescript
// electron/main/index.ts

// MANUAL FIX: Use the unbundled manual.cjs file to bypass build wrapping issues
const preloadPath = path.resolve(__dirname, '../../electron/preload/manual.cjs');

mainWindow = new BrowserWindow({
  // ...
  webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // REQUIRED: Must be false for require() to work in preload
      preload: preloadPath
  }
});
```

## Verification
-   **Terminal**: You should see logs indicating the preload path: `[createWindow] Target Preload Path: .../electron/preload/manual.cjs`
-   **Browser Console**: You should see the success log: `[Preload] Script starting (MANUAL CJS)...`
-   **Functionality**: `window.electronAPI` is now defined, and storage/file operations work correctly.

## Future Recommendations
-   If you upgrade or downgrade Electron versions, retain this `manual.cjs` approach unless you confirm the build tooling (Vite/Rollup) is correctly configuring CJS output for the specific Electron version.
-   Avoid using `.js` extensions for CommonJS files in this project; always use `.cjs`.
