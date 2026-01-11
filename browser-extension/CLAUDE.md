# CLAUDE.md

This file provides guidance to Claude when working with this codebase.

## Project Overview

OmniClipper Browser Extension - A Chrome Extension v3 for collecting web content including websites, articles, and images. Supports multiple storage backends: local storage, Feishu, and Supabase.

### Key Features

1. **Website Collection**
   - One-click save webpage bookmarks
   - Auto-capture: URL, title, description, favicon, site name
   - Smart tag suggestions based on content

2. **Article Extraction**
   - Full article content extraction (like Clearly Reader)
   - Converts HTML to clean Markdown format
   - Calculates reading time
   - Extracts author information

3. **Image Collection**
   - Screenshot capture: Area selection, Visible area, Full page
   - Drag & drop image upload
   - Auto-fill image name from page title
   - Auto-fill description from page metadata

4. **Storage & Sync**
   - Local storage with unified keys (compatible with desktop app)
   - Feishu Base cloud sync
   - Supabase cloud sync with authentication
   - Offline queue with automatic retry

## Architecture

```
browser-extension/
├── App.tsx                 # Main popup component (400x600 layout)
├── index.tsx               # App entry
├── manifest.json           # Chrome Extension Manifest v3
├── types.ts                # TypeScript definitions (ResourceItem, etc.)
├── components/
│   ├── CaptureForm.tsx     # 3 tabs: Website/Article/Image
│   ├── HistoryView.tsx     # List with type filtering
│   └── SettingsView.tsx    # Settings & auth
├── services/
│   ├── storageService.ts   # Unified storage keys
│   ├── feishuService.ts    # Feishu API
│   ├── supabaseService.ts  # Supabase sync
│   └── i18n.ts             # i18n support
├── content.js              # Content script - page extraction
├── content.css             # Content script styles
├── background.js           # Service worker - sync & screenshots
└── _locales/               # Translations (en, zh_CN, ja)
```

## Data Protocol

### ResourceItem (Unified with Desktop)
```typescript
interface ResourceItem {
  id: string;
  title: string;
  type: 'WEB' | 'ARTICLE' | 'IMAGE';
  tags: string[];
  url?: string;
  isCloud: boolean;
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;

  // Website specific
  favicon?: string;
  siteName?: string;
  description?: string;

  // Article specific
  markdown?: string;
  author?: string;
  readingTime?: number;

  // Image specific
  imageData?: string;      // Base64
  imageSize?: { width: number; height: number };
  sourceUrl?: string;
}
```

### Storage Keys (Shared with Desktop)
- `OMNICLIPPER_ITEMS` - Resource items
- `OMNICLIPPER_TAGS` - Tags
- `OMNICLIPPER_FOLDERS` - Folders
- `OMNICLIPPER_SETTINGS` - Settings

## Development

### Commands
```bash
npm install       # Install dependencies
npm run dev       # Start dev server (http://localhost:3000)
npm run build     # Build to dist/
```

### Load in Chrome
1. `npm run build`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `dist` folder

### Keyboard Shortcuts
- `Ctrl+Shift+S` / `Command+Shift+S` - Capture page
- `Ctrl+Shift+X` / `Command+Shift+X` - Capture selection

## Key Implementation Details

### Content Script Connection
The content script may not be available on some pages (chrome://, extension pages, etc.). The popup handles this by:
1. Sending a `PING` message to check availability
2. Using `chrome.scripting.executeScript` to inject if needed
3. Falling back to basic tab info if injection fails

### Screenshot Capture
- **Visible Area**: Uses `chrome.tabs.captureVisibleTab` from background
- **Area Selection**: Content script creates overlay, user draws selection
- **Full Page**: Currently captures visible area (scrolling capture is complex)

### Article Extraction
Uses a Readability-like algorithm:
1. Clone document
2. Remove unwanted elements (nav, ads, etc.)
3. Find main content container
4. Convert to Markdown with `htmlToMarkdown()`

## Permissions Required
```json
{
  "permissions": [
    "storage",
    "activeTab",
    "tabs",
    "contextMenus",
    "notifications",
    "alarms",
    "scripting"
  ],
  "host_permissions": ["<all_urls>"]
}
```

## Common Issues

### "Could not establish connection"
- Content script not loaded on the page
- Solution: Refresh the page and try again
- The extension auto-injects content script when possible

### Screenshot not working
- Some pages block screenshot (chrome://, bank sites, etc.)
- Extension pages cannot be captured
- Make sure popup is open when capturing visible area

## Tech Stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS 4
- Lucide React (icons)
- Supabase (backend)
- Feishu API (enterprise)
