<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# OmniClipper - Web Collector

A powerful browser extension for collecting web content, supporting website bookmarks, article extraction, and image capture with local storage and cloud sync (Feishu/Supabase).

## Features

### 1. Website Collection
- **One-click Save** - Instantly save any webpage as a bookmark
- **Auto-capture** - Automatically extracts URL, title, description, favicon, and site name
- **Smart Tags** - Predefined tags (Work, Inspiration, Dev, Design, Reading, Tool, Other) + custom tags

### 2. Article Extraction
- **Full Content Capture** - Extract complete article content similar to Clearly Reader
- **Markdown Format** - Articles saved in clean Markdown format for easy editing
- **Reading Time** - Auto-calculated reading time based on word count
- **Author Detection** - Extracts author info when available

### 3. Image Collection
- **Screenshot Capture**
  - Area Selection - Draw a box to capture specific region
  - Visible Area - Capture current viewport
  - Full Page - Capture entire page (currently captures visible area)
- **Drag & Drop** - Drop images directly into the extension
- **File Upload** - Click to upload images from local files
- **Auto-fill** - Automatically fills image name from page title and description from page metadata

### Data Storage
- **Local Storage** - Browser localStorage with offline-first approach
- **Feishu Base** - Sync to enterprise Feishu knowledge base
- **Supabase** - Cloud database storage with user authentication

### Data Management
- **History View** - Browse all saved items with type filtering (Website/Article/Image)
- **Tag Filtering** - Quick search by tags
- **Export** - JSON and CSV export options
- **Sync Status** - Visual indicators for sync state

### User Authentication
- **Email Registration/Login**
- **OAuth Support** - Google, GitHub third-party login
- **Subscription Management** - Free / Pro plans

## Tech Stack

| Category | Technology |
|----------|------------|
| UI Framework | React 19 + TypeScript |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |
| Backend Service | Supabase |
| Enterprise Integration | Feishu Lark API |

## Project Structure

```
browser-extension/
├── App.tsx                 # Main app component (400x600 popup layout)
├── index.tsx               # App entry point
├── index.html              # HTML template
├── manifest.json           # Chrome Extension Manifest v3
├── types.ts                # TypeScript type definitions
├── vite.config.ts          # Vite configuration
├── components/
│   ├── CaptureForm.tsx     # Capture form (Website/Article/Image tabs)
│   ├── HistoryView.tsx     # History view with type filtering
│   └── SettingsView.tsx    # Settings and authentication panel
├── services/
│   ├── storageService.ts   # Local storage service (unified keys with desktop)
│   ├── feishuService.ts    # Feishu API integration
│   ├── supabaseService.ts  # Supabase sync service
│   └── i18n.ts             # Multi-language support
├── content.js              # Content script - page content extraction
├── content.css             # Content script styles
├── background.js           # Background service - sync & notifications
└── _locales/               # Localization resources
    ├── en/messages.json    # English
    ├── zh_CN/messages.json # Chinese (Simplified)
    └── ja/messages.json    # Japanese
```

## Quick Start

### Requirements
- Node.js 18+
- npm or yarn

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

### Load Extension in Chrome

1. After building, extension files are in `dist` directory
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the `dist` directory

### Keyboard Shortcuts

- `Ctrl+Shift+S` / `Command+Shift+S` - Capture current page
- `Ctrl+Shift+X` / `Command+Shift+X` - Capture selected content

## Configuration

### Feishu Base Configuration
Configure in Settings panel:
- App ID
- App Secret
- Base App Token
- Table ID

### Supabase Configuration
- Supabase URL
- Anon Key
- Table Name (default: omniclipper_items)

## Desktop Client Integration

This browser extension works together with `ominiclipper-desktop`:
- Browser extension for quick web content capture
- Desktop client provides complete resource management
- Both share unified data format via cloud sync

### Unified Data Protocol
Browser extension and desktop app use the same storage keys:
- `OMNICLIPPER_ITEMS` - Resource items
- `OMNICLIPPER_TAGS` - Tags
- `OMNICLIPPER_FOLDERS` - Folders
- `OMNICLIPPER_SETTINGS` - Settings

## Development Status

### Completed
- [x] Three-tab UI (Website/Article/Image)
- [x] Website bookmark with auto-fill (URL, title, description, favicon)
- [x] Article extraction to Markdown (like Clearly Reader)
- [x] Image capture (area selection, visible area, drag & drop)
- [x] Local storage with unified keys
- [x] Feishu API integration
- [x] Supabase authentication and sync
- [x] Content script for page extraction
- [x] Background service for offline sync
- [x] Multi-language support (en, zh_CN, ja)
- [x] JSON/CSV export

### Known Limitations
- Full page screenshot currently captures visible area only (scrolling capture requires complex implementation)
- Content script must be injected on some pages (handled automatically with retry)

## License

MIT License
