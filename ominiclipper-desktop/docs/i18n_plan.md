# i18n Implementation Plan

## Goal
Enable multi-language support (English and Chinese initially) for OmniClipper Desktop, allowing users to switch languages in the application settings.

## Technology Stack
- **Library**: `react-i18next` (based on `i18next`)
- **Storage**: Persist language preference in `localStorage` and `settings.json` via Electron IPC.

## Steps

### 1. Installation
- Install `i18next`, `react-i18next`, `i18next-browser-languagedetector`.

### 2. Configuration
- Create `src/i18n/config.ts`.
- Initialize `i18next` with resources structure.
- Configure automatic language detection (with fallback to 'en').

### 3. Translation Resources
- Create `src/i18n/locales/en.json`: English translations.
- Create `src/i18n/locales/zh.json`: Chinese (Simplified) translations.
- Structure translations by component/feature (e.g., `common`, `sidebar`, `settings`, `auth`).

### 4. UI Implementation
- **Initialize**: Import i18n config in `src/main.tsx`.
- **Settings**: Add "Language" selector in `SettingsDialog.tsx` under Appearance or General settings.
- **Components**: Replace hardcoded strings with `t('key')` hooks in:
    - `Sidebar.tsx`
    - `SettingsDialog.tsx`
    - `AuthDialog.tsx`
    - `App.tsx` (headings, toasts, etc.)

### 5. Persistence
- Ensure language selection updates:
    - React state (via i18n.changeLanguage)
    - `localStorage` (via detector or manual save)
    - Backend `settings.json` (sync if necessary)

## Verification
- Verify language switching updates UI immediately without reload.
- Verify persistence after app restart.
- Check English and Chinese texts for correctness.
