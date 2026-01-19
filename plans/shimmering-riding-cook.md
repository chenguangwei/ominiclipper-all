# OmniClipper 浏览器插件重构计划

## 目标
重构浏览器插件，实现完整的网站/文章/图片收藏功能，与桌面端共用统一数据协议。

## 数据协议统一 (关键)

统一使用桌面端的 `ResourceItem` 类型：
```typescript
type ResourceType = 'WEB' | 'ARTICLE' | 'IMAGE' | 'NOTE'

interface ResourceItem {
  id: string
  title: string
  type: ResourceType
  url?: string
  content?: string           // 文章markdown内容
  tags: string[]
  folderId?: string
  color?: string
  createdAt: number
  updatedAt: number
  isCloud: boolean           // 是否同步到云端
  isStarred: boolean

  // 网站特有
  favicon?: string
  siteName?: string
  description?: string

  // 文章特有
  markdown?: string
  author?: string
  readingTime?: number

  // 图片特有
  imageData?: string         // Base64
  imageMimeType?: string
  imageSize?: { width: number; height: number }
  sourceUrl?: string
}
```

**存储位置**: `localStorage` key: `OMNICLIPPER_ITEMS` (与桌面端一致)

## 实现步骤

### Step 1: 更新类型定义

**文件**: `browser-extension/types.ts`
- 替换现有 `SavedItem` 为 `ResourceItem`
- 与 `ominiclipper-desktop/types.ts` 保持一致

### Step 2: 安装依赖
```bash
cd browser-extension
npm install @mozilla/readability turndown html2canvas
npm install -D @types/turndown
```

### Step 3: 增强内容提取 (content.js)

**3.1 Favicon提取**
```javascript
function extractFavicon() {
  const icons = [
    document.querySelector('link[rel="icon"]')?.href,
    document.querySelector('link[rel="shortcut icon"]')?.href,
    document.querySelector('link[rel="apple-touch-icon"]')?.href,
    `${location.origin}/favicon.ico`
  ];
  return icons.find(Boolean);
}
```

**3.2 文章提取 (Readability + Turndown)**
```javascript
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

function extractArticle() {
  const clone = document.cloneNode(true);
  const reader = new Readability(clone);
  const article = reader.parse();

  const turndown = new TurndownService({ headingStyle: 'atx' });
  return {
    title: article.title,
    content: turndown.turndown(article.content),
    author: article.byline,
    readingTime: Math.ceil(article.textContent.split(/\s+/).length / 200)
  };
}
```

**3.3 截图功能 (html2canvas)**
```javascript
import html2canvas from 'html2canvas';

async function captureScreenshot(mode) {
  if (mode === 'full') {
    return await html2canvas(document.body, { useCORS: true });
  }
  if (mode === 'visible') {
    return await html2canvas(document.body, {
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    });
  }
  if (mode === 'selection') {
    // 显示选区工具，用户框选后截图
    return await showSelectionTool();
  }
}
```

### Step 4: 重构 CaptureForm UI

**新布局**:
```
┌─────────────────────────────────┐
│ [🌐网站] [📄文章] [🖼图片] [📝笔记] │
├─────────────────────────────────┤
│                                 │
│    (根据选中Tab显示不同内容)      │
│                                 │
├─────────────────────────────────┤
│ 🏷️ 标签: [添加标签...]           │
│ 📁 文件夹: [选择文件夹]           │
├─────────────────────────────────┤
│      [💾 保存]  [☁️ 保存并同步]    │
└─────────────────────────────────┘
```

**Tab内容**:

1. **网站Tab** - 一键保存书签
   - 自动显示: favicon + title + description
   - URL (只读)
   - 可编辑: title, description

2. **文章Tab** - 提取正文
   - [提取文章] 按钮
   - Markdown预览/编辑区域
   - 显示: 作者、阅读时间

3. **图片Tab** - 截图/上传
   - [区域截图] [整页截图] [可见区域]
   - 拖拽上传区域
   - 图片预览

4. **笔记Tab** - 纯文本
   - 标题输入
   - 内容编辑器

### Step 5: 更新 StorageService

```typescript
// 使用与桌面端相同的 key
const STORAGE_KEY = 'OMNICLIPPER_ITEMS';
const TAGS_KEY = 'OMNICLIPPER_TAGS';
const FOLDERS_KEY = 'OMNICLIPPER_FOLDERS';

class StorageService {
  getItems(): ResourceItem[] {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  }

  saveItem(item: ResourceItem): void {
    const items = this.getItems();
    items.unshift(item);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

    if (item.isCloud) {
      this.syncToSupabase(item);
    }
  }
}
```

### Step 6: 更新 HistoryView

- 按类型显示不同图标: 🌐网站 📄文章 🖼图片 📝笔记
- 图片类型显示缩略图
- 文章类型显示阅读时间
- 点击文章可预览Markdown

### Step 7: Background 同步

```javascript
// 监听存储变化，自动同步
chrome.storage.onChanged.addListener((changes) => {
  if (changes.OMNICLIPPER_ITEMS) {
    syncToSupabase(changes.OMNICLIPPER_ITEMS.newValue);
  }
});
```

## 文件修改清单

| 文件 | 修改 |
|------|------|
| `types.ts` | 替换为 ResourceItem 协议 |
| `content.js` | 添加 Readability/截图/favicon |
| `CaptureForm.tsx` | 4个Tab重构 |
| `HistoryView.tsx` | 支持新类型显示 |
| `storageService.ts` | 统一存储key |
| `background.js` | Supabase同步 |
| `manifest.json` | 添加权限 |
| `package.json` | 新增依赖 |

## Manifest 权限更新
```json
{
  "permissions": [
    "storage",
    "activeTab",
    "tabs",
    "contextMenus",
    "notifications",
    "alarms",
    "clipboardWrite"  // 新增：复制截图
  ]
}
```

## 验证步骤

1. **构建测试**: `npm run build` 无错误
2. **加载扩展**: Chrome加载dist文件夹成功
3. **网站收藏**: 打开任意网页，点击插件，保存网站书签
4. **文章提取**: 打开新闻文章，提取正文为Markdown
5. **截图功能**: 测试区域/整页/可见区域截图
6. **桌面同步**: 打开桌面端，确认数据同步显示
