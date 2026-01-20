# OmniCollector 功能完善实现总结

## 概述

本次更新解决了用户反馈的 4 个核心问题：

1. **GridView 缩略图不全** - 部分类型资源没有缩略图
2. **Split View Detail 编辑不便** - 标签和类型修改需要弹框，UX 体验差
3. **Split View List 缺少描述** - Item 下面缺少描述文字
4. **自动分类功能不完整** - 文件整理依赖 Node.js 模块无法在浏览器运行

---

## Phase 1: 缩略图生成修复

### 1.1 修复 PDF 缩略图

**文件**: `services/thumbnailService.ts`

**问题**: `URL.parse is not a function` - pdfjs 需要传入 ArrayBuffer 而非文件路径

**解决方案**: 先通过 IPC 读取文件为 base64，再转换为 ArrayBuffer 传给 pdfjs

```typescript
export const generatePdfThumbnail = async (filePath: string): Promise<string | null> => {
  if (!isElectron()) return null;
  try {
    // 1. 通过 IPC 读取文件为 base64
    const fileData = await (window as any).electronAPI.readFile(filePath);
    if (!fileData?.buffer) return null;

    // 2. 转换为 ArrayBuffer
    const arrayBuffer = Uint8Array.from(atob(fileData.buffer), c => c.charCodeAt(0));

    // 3. 传给 pdfjs
    const pdfjs = await import('pdfjs-dist');
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    // ... 渲染逻辑
  } catch (error) {
    console.error('[Thumbnail] PDF error:', error);
    return null;
  }
};
```

### 1.2 修复图片缩略图

**文件**: `services/thumbnailService.ts`

**问题**: `Not allowed to load local resource` - 浏览器不能直接加载 file:// URL

**解决方案**: 通过 IPC 读取文件为 base64 data URL

```typescript
export const generateImageThumbnail = async (filePath: string): Promise<string | null> => {
  if (isElectron()) {
    const fileData = await (window as any).electronAPI.readFile(filePath);
    if (!fileData?.buffer) return null;
    // 转换为 data URL 并缩放
  }
};
```

### 1.3 移除 path 模块依赖

**文件**: `services/thumbnailService.ts`, `services/contentExtractionService.ts`, `services/storageService.ts`

**问题**: `path.basename` 在浏览器环境不可用

**解决方案**: 使用浏览器兼容的路径工具函数

```typescript
// Browser-compatible path utilities
const pathUtils = {
  basename: (filePath: string): string => {
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || filePath;
  },
  join: (...parts: string[]): string => {
    return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
  },
};
```

### 1.4 实现 DOCX 缩略图

**文件**: `services/thumbnailService.ts`

**依赖**: `html2canvas`

**实现**: 使用 docx-preview 渲染文档到隐藏容器，然后用 html2canvas 截图

```typescript
export const generateDocxThumbnail = async (filePath: string): Promise<string | null> => {
  if (!isElectron()) return null;
  try {
    const fileData = await (window as any).electronAPI.readFile(filePath);
    const arrayBuffer = Uint8Array.from(atob(fileData.buffer), c => c.charCodeAt(0));

    const docx = await import('docx-preview');
    const html2canvas = (await import('html2canvas')).default;

    // 创建隐藏容器渲染 DOCX
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;width:800px;background:white;';
    document.body.appendChild(container);

    await docx.renderAsync(arrayBuffer, container);
    await new Promise(resolve => setTimeout(resolve, 200));

    // 截取缩略图
    const canvas = await html2canvas(container, { width: 300, height: 400 });
    document.body.removeChild(container);

    return canvas.toDataURL('image/jpeg', 0.7);
  } catch (error) {
    return null;
  }
};
```

### 1.5 实现 EPUB 封面提取

**文件**: `services/thumbnailService.ts`

**依赖**: `jszip`

**实现**: 使用 JSZip 解压 EPUB 并查找封面图片

```typescript
export const generateEpubThumbnail = async (filePath: string): Promise<string | null> => {
  try {
    const fileData = await (window as any).electronAPI.readFile(filePath);
    const arrayBuffer = Uint8Array.from(atob(fileData.buffer), c => c.charCodeAt(0));

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(arrayBuffer);

    // 查找封面图片
    const coverPatterns = ['cover.jpg', 'cover.png', 'OEBPS/images/cover'];
    for (const pattern of coverPatterns) {
      const coverFile = Object.keys(zip.files).find(f => f.includes(pattern));
      if (coverFile) {
        const coverData = await zip.files[coverFile].async('base64');
        return `data:image/jpeg;base64,${coverData}`;
      }
    }
    return null;
  } catch (error) {
    return null;
  }
};
```

---

## Phase 2: Detail 面板 UX 改进

### 2.1 创建 TagSelector 组件

**新文件**: `components/TagSelector.tsx`

**功能**:
- 下拉选择器添加标签
- 支持搜索过滤
- 支持快速创建新标签

```typescript
interface TagSelectorProps {
  availableTags: Tag[];
  selectedTags: string[];
  onAddTag: (tagId: string) => void;
  onCreateTag?: (name: string) => Promise<string | null>;
  colorMode?: ColorMode;
}
```

### 2.2 创建 TypeDropdown 组件

**新文件**: `components/TypeDropdown.tsx`

**功能**:
- 下拉选择器修改资源类型
- 显示类型图标和颜色
- 支持禁用状态

```typescript
interface TypeDropdownProps {
  currentType: ResourceType;
  onChangeType: (type: ResourceType) => void;
  colorMode?: ColorMode;
  disabled?: boolean;
}
```

### 2.3 修改 PreviewPane 支持 Inline 编辑

**文件**: `components/PreviewPane.tsx`

**新增 Props**:

```typescript
interface PreviewPaneProps {
  // ... 原有 props
  // Inline 编辑 props
  availableTags?: Tag[];
  onRemoveTag?: (itemId: string, tagId: string) => void;
  onAddTag?: (itemId: string, tagId: string) => void;
  onCreateTag?: (name: string) => Promise<string | null>;
  onChangeType?: (itemId: string, newType: ResourceType) => void;
}
```

**UI 变化**:
- 标签区域：每个标签悬停显示 × 删除按钮
- 标签区域：末尾添加 TagSelector 组件
- 类型显示：替换为 TypeDropdown 组件

### 2.4 App.tsx 添加处理函数

**文件**: `App.tsx`

```typescript
// 移除标签
const handleRemoveTag = async (itemId: string, tagId: string) => {
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  const newTags = item.tags.filter(t => t !== tagId);
  await storageService.updateItem(itemId, { tags: newTags });
  setItems([...storageService.getItems()]);
};

// 添加标签
const handleAddTagToItem = async (itemId: string, tagId: string) => {
  const item = items.find(i => i.id === itemId);
  if (!item || item.tags.includes(tagId)) return;
  const newTags = [...item.tags, tagId];
  await storageService.updateItem(itemId, { tags: newTags });
  setItems([...storageService.getItems()]);
};

// 创建并添加标签
const handleCreateTagInline = async (name: string): Promise<string | null> => {
  const newTag = await storageService.addTag({ name, color: 'tag-blue' });
  if (newTag) {
    setTags([...storageService.getTags()]);
    return newTag.id;
  }
  return null;
};

// 修改类型
const handleChangeType = async (itemId: string, newType: ResourceType) => {
  await storageService.updateItem(itemId, { type: newType });
  setItems([...storageService.getItems()]);
};
```

---

## Phase 3: List 项目描述显示

### 3.1 修改 ListDetailView

**文件**: `components/ListDetailView.tsx`

**变化**: 在标题下方添加描述显示（最多 2 行，100 字符）

```tsx
<div className="flex-1 min-w-0">
  <h4 className={itemTitleClass(selectedId === item.id)}>{item.title}</h4>
  {/* 新增：描述显示 */}
  {(item.description || item.contentSnippet) && (
    <p className={`text-[11px] ${isLight ? 'text-gray-400' : 'text-content-secondary'} line-clamp-2 mt-0.5 leading-relaxed`}>
      {(item.description || item.contentSnippet || '').slice(0, 100)}
      {(item.description || item.contentSnippet || '').length > 100 ? '...' : ''}
    </p>
  )}
  <p className={itemDateClass}>
    {new Date(item.updatedAt).toLocaleDateString()}
  </p>
</div>
```

---

## Phase 4: 自动分类功能修复

### 4.1 修复 fileOrganizer.ts

**文件**: `services/fileOrganizer.ts`

**问题**: 使用 `require('fs')` 和 `require('path')` 在浏览器不可用

**解决方案**: 改用 Electron IPC 调用

```typescript
private isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI;
}

private async moveLocalFile(sourcePath: string, targetFolder: string): Promise<string> {
  if (!this.isElectron()) {
    console.warn('[FileOrganizer] Not in Electron environment');
    return sourcePath;
  }

  const electronAPI = (window as any).electronAPI;
  const fileName = this.getBasename(sourcePath);
  const newPath = `${targetFolder}/${fileName}`;

  // 使用 IPC 调用主进程移动文件
  if (electronAPI.fileAPI?.moveFile) {
    const result = await electronAPI.fileAPI.moveFile(sourcePath, newPath);
    if (result?.success) {
      return result.newPath || newPath;
    }
  }
  return sourcePath;
}
```

### 4.2 添加单文件分类函数

**文件**: `services/ruleEngine.ts`

**新增**: `classifyFile` 函数用于单个文件的规则分类

```typescript
export const classifyFile = async (
  fileName: string,
  filePath: string,
  type: string
): Promise<{
  category: string;
  subfolder: string;
  confidence: number;
  reasoning: string;
  suggestedTags: string[];
} | null> => {
  // 创建临时 ResourceItem 对象
  const tempItem: ResourceItem = {
    id: 'temp-classify',
    title: fileName.replace(/\.[^/.]+$/, ''),
    type: type as any,
    // ...
  };

  // 使用规则引擎分类
  const results = ruleEngine.classify([tempItem]);
  const result = results[0];

  if (result && result.rule) {
    return {
      category: result.rule.name,
      subfolder: result.rule.action.targetFolder || '',
      confidence: result.confidence || 1.0,
      reasoning: result.rule.description || '',
      suggestedTags: result.suggestedTags || [],
    };
  }
  return null;
};
```

### 4.3 移除冗余依赖

**文件**: `services/batchImportService.ts`

移除未使用的 `path` 模块导入：

```diff
- import path from 'path';
```

---

## 新增依赖

```bash
npm install html2canvas jszip
```

---

## 文件变更清单

| 文件 | 修改类型 | 描述 |
|------|---------|------|
| `services/thumbnailService.ts` | 修改 | 修复 PDF/图片缩略图，添加 DOCX/EPUB 支持 |
| `services/contentExtractionService.ts` | 修改 | 移除 path 依赖，添加浏览器兼容函数 |
| `services/storageService.ts` | 修改 | 移除 path 依赖，使用 pathUtils |
| `services/fileOrganizer.ts` | 修改 | 改用 Electron IPC 移动文件 |
| `services/ruleEngine.ts` | 修改 | 添加 classifyFile 函数 |
| `services/batchImportService.ts` | 修改 | 移除未使用的 path 导入 |
| `components/TagSelector.tsx` | **新建** | 标签下拉选择器组件 |
| `components/TypeDropdown.tsx` | **新建** | 类型下拉选择器组件 |
| `components/PreviewPane.tsx` | 修改 | 添加 inline 标签/类型编辑 |
| `components/ListDetailView.tsx` | 修改 | 添加项目描述显示 |
| `App.tsx` | 修改 | 添加 inline 编辑处理函数 |

---

## 缩略图支持状态

| 类型 | 状态 | 实现方式 |
|------|------|---------|
| PDF | ✅ 完成 | pdfjs-dist + canvas |
| IMAGE | ✅ 完成 | IPC 读取 + canvas 缩放 |
| WORD/DOCX | ✅ 完成 | docx-preview + html2canvas |
| EPUB | ✅ 完成 | JSZip 提取封面图片 |
| MARKDOWN | ✅ 完成 | 文本渲染到 canvas |
| PPT | 🔄 占位符 | 显示彩色图标占位 |
| EXCEL | 🔄 占位符 | 显示彩色图标占位 |
| WEB | 🔄 占位符 | 显示彩色图标占位 |

---

## 常见问题排查

### 1. `504 (Outdated Optimize Dep)` 错误

清除 Vite 缓存并重启：
```bash
rm -rf node_modules/.vite
npm run dev
```

### 2. `Invalid hook call` 错误

通常是 HMR 问题，重启 dev server 即可解决。

### 3. 缩略图不生成

检查控制台是否有 `[Thumbnail]` 相关错误日志，常见原因：
- 文件路径不存在
- Electron IPC API 未正确暴露
- 文件读取权限问题

---

## 后续优化建议

1. **PPT/Excel 缩略图**: 可考虑使用 SheetJS 或 pptxgenjs 提取首页内容
2. **Web 缩略图**: 可集成 puppeteer 或网页截图 API
3. **AI 分类增强**: 完善 aiClassifier.ts 的调用逻辑
4. **性能优化**: 考虑使用 Web Worker 处理大文件的缩略图生成
