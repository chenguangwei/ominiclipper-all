# OmniCollector 功能实现记录

> 本文档记录了从 OmniClipper 升级到 OmniCollector 的所有功能实现过程。

## 目录

1. [应用重命名](#1-应用重命名-omniclipper--omnicollector)
2. [缩略图生成服务](#2-缩略图生成服务)
3. [自动描述生成](#3-自动描述生成)
4. [All Items 筛选 UI](#4-all-items-筛选-ui)
5. [拖拽到文件夹自动分类](#5-拖拽到文件夹自动分类)
6. [批量导入与分类](#6-批量导入与分类)

---

## 1. 应用重命名: OmniClipper → OmniCollector

### 目的
将应用名称从 "OmniClipper" 更改为 "OmniCollector"，更好地反映应用的资源收集和管理功能。

### 修改的文件

#### 1.1 package.json
```json
// 修改前
"name": "ominiclipper-desktop",
"appId": "com.omniclipper.desktop",
"productName": "OmniClipper",
"copyright": "Copyright © 2026 OmniClipper"

// 修改后
"name": "omnicollector-desktop",
"appId": "com.omnicollector.desktop",
"productName": "OmniCollector",
"copyright": "Copyright © 2026 OmniCollector"
```

#### 1.2 index.html
```html
<!-- 修改前 -->
<title>Ominiclipper</title>

<!-- 修改后 -->
<title>OmniCollector</title>
```

#### 1.3 electron/main.cjs
- 文件头注释: `OmniClipper Desktop` → `OmniCollector Desktop`
- 窗口标题: `title: 'OmniClipper'` → `title: 'OmniCollector'`
- macOS 菜单: `About OmniClipper` → `About OmniCollector`
- 隐藏菜单: `Hide OmniClipper` → `Hide OmniCollector`
- 存储路径: `'OmniClipper'` → `'OmniCollector'`

#### 1.4 components/Sidebar.tsx
```tsx
// 修改前
<span className="font-semibold text-sm text-content">OmniClipper</span>

// 修改后
<span className="font-semibold text-sm text-content">OmniCollector</span>
```

#### 1.5 components/SettingsDialog.tsx
```tsx
// 修改前
return 'Application Data/OmniClipper';
<h3>OmniClipper</h3>
<p>Version 1.0.0 - Your personal clipper manager</p>

// 修改后
return 'Application Data/OmniCollector';
<h3>OmniCollector</h3>
<p>Version 1.0.0 - Your personal resource manager</p>
```

#### 1.6 services/i18n.ts
```typescript
// 英文和中文翻译都更新
'app.title': 'OmniCollector'
```

#### 1.7 components/ImportExportDialog.tsx
```typescript
// 导出文件名前缀
filename = `omnicollector-export-${date}.json`
filename = `omnicollector-export-${date}.csv`
```

#### 1.8 electron/httpServer.cjs
```javascript
// 端口文件名
const PORT_FILE = '.omnicollector_port';

// API 响应
sendJson(res, 200, { status: 'ok', server: 'omnicollector-desktop' });
```

#### 1.9 其他服务文件头注释更新
- services/storageService.ts
- services/fileOrganizer.ts
- services/ruleConfig.ts
- services/aiClassifier.ts
- services/ruleEngine.ts
- services/llmProvider.ts
- services/subscriptionManager.ts
- types/classification.ts
- pages/ClassificationSettings.tsx
- components/AutoClassifyDialog.tsx
- electron/preload.js

---

## 2. 缩略图生成服务

### 目的
为所有文件类型生成缩略图，在 Grid View 中提供更好的视觉预览体验。

### 实现步骤

#### 2.1 扩展 ResourceType 枚举 (types.ts)
```typescript
// 添加新类型
export enum ResourceType {
  WORD = 'WORD',
  PDF = 'PDF',
  EPUB = 'EPUB',
  WEB = 'WEB',
  IMAGE = 'IMAGE',
  MARKDOWN = 'MARKDOWN',
  PPT = 'PPT',      // 新增
  EXCEL = 'EXCEL',  // 新增
  UNKNOWN = 'UNKNOWN'
}
```

#### 2.2 扩展 ResourceItem 接口 (types.ts)
```typescript
export interface ResourceItem {
  // ... 现有字段
  thumbnailUrl?: string;  // 新增: 缓存的缩略图 data URL
  description?: string;   // 新增: 自动生成或手动编辑的描述
}
```

#### 2.3 缩略图服务 (services/thumbnailService.ts)
已有完整实现，支持以下格式：
- **PDF**: 使用 pdfjs-dist 渲染第一页
- **图片**: Canvas 缩放
- **Markdown**: Canvas 渲染文本预览
- **DOCX**: 占位图（需要 html2canvas）
- **EPUB/PPT/Excel**: 占位图

关键函数：
```typescript
// 主入口函数
export const generateThumbnail = async (
  itemId: string,
  type: ResourceType,
  filePath: string
): Promise<ThumbnailInfo>

// 生成并保存缩略图
export const generateAndSaveThumbnail = async (
  itemId: string,
  type: ResourceType,
  filePath: string
): Promise<string | null>
```

#### 2.4 更新 GridView 组件 (components/GridView.tsx)
```tsx
// 新增图标支持
const getIconForType = (type: ResourceType) => {
  switch (type) {
    // ... 现有类型
    case ResourceType.MARKDOWN: return <Icon name="article" />;
    case ResourceType.PPT: return <Icon name="slideshow" />;
    case ResourceType.EXCEL: return <Icon name="table_chart" />;
  }
};

// 新增缩略图获取函数
const getThumbnailSrc = (item: ResourceItem): string | null => {
  // 优先使用缓存的缩略图
  if (item.thumbnailUrl) return item.thumbnailUrl;
  // 图片类型使用原始数据
  if (item.type === ResourceType.IMAGE) {
    return item.embeddedData || item.localPath || item.path;
  }
  return null;
};

// 渲染逻辑更新
{(() => {
  const thumbnailSrc = getThumbnailSrc(item);
  return thumbnailSrc ? (
    <img src={thumbnailSrc} ... />
  ) : getIconForType(item.type);
})()}
```

#### 2.5 文件类型识别扩展 (App.tsx)
```typescript
const getResourceTypeFromFile = (file: File): ResourceType => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    // ... 现有类型
    case 'md': case 'markdown': return ResourceType.MARKDOWN;
    case 'ppt': case 'pptx': return ResourceType.PPT;
    case 'xls': case 'xlsx': case 'csv': return ResourceType.EXCEL;
  }
};
```

#### 2.6 自动生成元数据 (App.tsx)
```typescript
// 导入服务
import * as thumbnailService from './services/thumbnailService';
import * as contentExtractionService from './services/contentExtractionService';

// 生成缩略图和描述的辅助函数
const generateItemMetadata = async (
  itemId: string,
  type: ResourceType,
  filePath: string | undefined
) => {
  if (!filePath) return;

  try {
    // 生成缩略图
    const thumbnailDataUrl = await thumbnailService.generateAndSaveThumbnail(
      itemId, type, filePath
    );

    // 生成描述
    const description = await contentExtractionService.generateAutoDescription(
      type, filePath, ''
    );

    // 更新 item
    if (thumbnailDataUrl || description) {
      await storageService.updateItem(itemId, {
        thumbnailUrl: thumbnailDataUrl,
        description
      });
      setItems([...storageService.getItems()]);
    }
  } catch (error) {
    console.error('[App] Failed to generate item metadata:', error);
  }
};
```

#### 2.7 在导入时调用元数据生成
```typescript
// handleDropOnFolder 中
const newItem = await storageService.addItem({...});
if (newItem) {
  generateItemMetadata(newItem.id, type, localPath || path);
}

// handleFileDropConfirm 中
const newItem = await storageService.addItem({...});
if (newItem) {
  generateItemMetadata(newItem.id, type, localPath || path);
}
```

---

## 3. 自动描述生成

### 目的
从文档内容中自动提取描述/摘要，便于用户快速了解文件内容。

### 实现 (services/contentExtractionService.ts)

#### 3.1 支持的文件类型
- **PDF**: 提取前 3 页文本
- **DOCX**: 提取前几个段落
- **Markdown**: 提取非标题段落
- **EPUB**: 基本文件信息（待完善）
- **图片**: 文件名和格式信息
- **Web**: URL 信息
- **PPT/Excel**: 基本文件信息（待完善）

#### 3.2 核心函数
```typescript
// 根据类型提取内容
export const extractContentSnippet = async (
  type: ResourceType,
  filePath: string,
  maxLength = 500
): Promise<string>

// 生成自动描述
export const generateAutoDescription = async (
  type: ResourceType,
  filePath: string | undefined,
  title: string
): Promise<string>

// 处理 item 并添加描述
export const processItemWithAutoDescription = async (
  item: ResourceItem
): Promise<ResourceItem>
```

#### 3.3 PDF 内容提取示例
```typescript
export const extractPdfContent = async (
  filePath: string,
  maxLength = 500
): Promise<string> => {
  const pdfjs = await import('pdfjs-dist');
  const loadingTask = pdfjs.getDocument(filePath);
  const pdf = await loadingTask.promise;

  let fullText = '';
  const pagesToExtract = Math.min(pdf.numPages, 3);

  for (let i = 1; i <= pagesToExtract; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return cleanText(fullText, maxLength);
};
```

---

## 4. All Items 筛选 UI

### 目的
在 TopBar 中添加便捷的筛选功能，支持按类型、颜色、标签筛选资源。

### 实现步骤

#### 4.1 扩展 FilterState (types.ts)
```typescript
export interface FilterState {
  search: string;
  tagId: string | null;
  color: string | null;
  folderId: string;
  isStarred?: boolean;
  typeFilter?: ResourceType | null;  // 新增: 类型筛选
}
```

#### 4.2 更新 TopBar 组件 (components/TopBar.tsx)

##### 新增 Props
```typescript
interface TopBarProps {
  // ... 现有 props
  tags?: Tag[];
  selectedTypeFilter?: ResourceType | null;
  onTypeFilterChange?: (type: ResourceType | null) => void;
  selectedTagFilter?: string | null;
  onTagFilterChange?: (tagId: string | null) => void;
  selectedColorFilter?: string | null;
  onColorFilterChange?: (color: string | null) => void;
}
```

##### 筛选选项定义
```typescript
// 类型筛选选项
const TYPE_FILTERS = [
  { type: null, label: 'All Types', icon: 'apps' },
  { type: ResourceType.PDF, label: 'PDF', icon: 'picture_as_pdf' },
  { type: ResourceType.WORD, label: 'Word', icon: 'description' },
  { type: ResourceType.EPUB, label: 'EPUB', icon: 'auto_stories' },
  { type: ResourceType.IMAGE, label: 'Images', icon: 'image' },
  { type: ResourceType.MARKDOWN, label: 'Markdown', icon: 'article' },
  { type: ResourceType.PPT, label: 'PPT', icon: 'slideshow' },
  { type: ResourceType.EXCEL, label: 'Excel', icon: 'table_chart' },
  { type: ResourceType.WEB, label: 'Web', icon: 'language' },
];

// 颜色筛选选项
const COLOR_FILTERS = [
  { color: null, label: 'All Colors' },
  { color: 'tag-blue', label: 'Blue' },
  { color: 'tag-green', label: 'Green' },
  { color: 'tag-orange', label: 'Orange' },
  { color: 'tag-red', label: 'Red' },
  { color: 'tag-yellow', label: 'Yellow' },
];
```

##### 下拉菜单状态
```typescript
const [showTypeDropdown, setShowTypeDropdown] = useState(false);
const [showColorDropdown, setShowColorDropdown] = useState(false);
const [showTagDropdown, setShowTagDropdown] = useState(false);
```

##### UI 结构
```tsx
{/* Filter Buttons */}
{onTypeFilterChange && (
  <div className="hidden md:flex items-center gap-1 ml-2">
    {/* Type Filter Dropdown */}
    <div className="relative">
      <button onClick={...}>
        <Icon name={...} />
        <span>Type</span>
        <Icon name="expand_more" />
      </button>
      {showTypeDropdown && (
        <div className="absolute ...">
          {TYPE_FILTERS.map(({type, label, icon}) => (
            <button onClick={() => onTypeFilterChange(type)}>
              <Icon name={icon} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>

    {/* Color Filter Dropdown */}
    {/* Tag Filter Dropdown */}
    {/* Clear Filters Button */}
  </div>
)}
```

#### 4.3 更新 App.tsx 筛选逻辑

##### 传递 props 给 TopBar
```tsx
<TopBar
  // ... 现有 props
  tags={tags}
  selectedTypeFilter={filterState.typeFilter || null}
  onTypeFilterChange={(type) => setFilterState(prev => ({ ...prev, typeFilter: type }))}
  selectedTagFilter={filterState.tagId}
  onTagFilterChange={(tagId) => setFilterState(prev => ({ ...prev, tagId }))}
  selectedColorFilter={filterState.color}
  onColorFilterChange={(color) => setFilterState(prev => ({ ...prev, color }))}
/>
```

##### 更新 filteredItems 计算
```typescript
const filteredItems = useMemo(() => {
  let result = items.filter(item => {
    // Search filter
    if (filterState.search && !item.title.toLowerCase().includes(filterState.search.toLowerCase())) {
      return false;
    }

    // Type filter (新增)
    if (filterState.typeFilter && item.type !== filterState.typeFilter) {
      return false;
    }

    // Tag filter
    // Color filter
    // Folder logic
    // ...
  });
  // ...
}, [filterState, items, tags, sortType, getDescendantFolderIds]);
```

##### 更新活动筛选条
```tsx
{/* Active Filters Bar */}
{(filterState.tagId || filterState.color || filterState.typeFilter) && (
  <div className="flex items-center gap-2 ...">
    {filterState.typeFilter && (
      <div className="flex items-center ...">
        <span>{filterState.typeFilter}</span>
        <Icon name="close" onClick={() => setFilterState(...)} />
      </div>
    )}
    {/* Tag and Color filters */}
  </div>
)}
```

---

## 5. 拖拽到文件夹自动分类

### 目的
当用户拖拽文件到特定文件夹时，自动将文件归入该文件夹。

### 实现 (已存在于代码中)

#### 5.1 Sidebar 组件拖放处理 (components/Sidebar.tsx)
```tsx
// TreeItem 组件支持拖放
<div
  onDragOver={(e) => {
    e.preventDefault();
    if (isDropTarget) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }}
  onDrop={(e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDropTarget && onDropOnFolder && e.dataTransfer.files.length > 0) {
      onDropOnFolder(id, e.dataTransfer.files);
    }
  }}
  className={`... ${isDropTarget ? 'ring-2 ring-primary bg-primary/10' : ''}`}
>
```

#### 5.2 App.tsx 中的处理函数
```typescript
// 处理拖放到侧边栏文件夹
const handleDropOnFolder = async (folderId: string, files: FileList) => {
  const file = files[0];
  if (!file) return;

  // 复制文件到存储
  // ...

  // 添加 item 并指定 folderId
  const newItem = await storageService.addItem({
    title: file.name.replace(/\.[^/.]+$/, ''),
    type,
    folderId: folderId,  // 自动归入目标文件夹
    // ...
  });

  // 生成缩略图和描述
  if (newItem) {
    generateItemMetadata(newItem.id, type, localPath || path);
  }
};
```

#### 5.3 主区域拖放自动归入当前文件夹
```typescript
const handleFileDropConfirm = async (mode: FileStorageMode) => {
  // ...

  // 自动归入当前选中的文件夹（非特殊文件夹）
  const specialFolders = ['all', 'recent', 'starred', 'uncategorized', 'untagged', 'trash'];
  const targetFolderId = (!specialFolders.includes(filterState.folderId))
    ? filterState.folderId
    : undefined;

  const newItem = await storageService.addItem({
    // ...
    folderId: targetFolderId,
  });
};
```

---

## 6. 批量导入与分类

### 目的
支持批量导入文件夹，并通过规则引擎或 AI 自动分类。

### 实现 (services/batchImportService.ts)

#### 6.1 接口定义
```typescript
export interface BatchImportOptions {
  storageMode: FileStorageMode;
  useRules: boolean;        // 使用规则分类
  useAI: boolean;           // 使用 AI 分类
  autoCreateFolders: boolean;
  targetFolderId?: string;
  onProgress?: (progress: BatchImportProgress) => void;
}

export interface BatchImportResult {
  success: boolean;
  file: BatchImportFile;
  classification?: {
    folderId?: string;
    folderName?: string;
    tags: string[];
    confidence: number;
    reasoning: string;
    isAiclassified: boolean;
  };
  error?: string;
}
```

#### 6.2 主要函数

##### 批量导入
```typescript
export const batchImport = async (
  dirPath: string,
  options: BatchImportOptions
): Promise<BatchImportResult[]> => {
  // 扫描目录
  const scanResult = await electronAPI.scanDirectory(dirPath, {
    recursive: true,
    maxDepth: 3,
  });

  // 遍历文件并分类
  for (const file of files) {
    const result = await classifyAndImportFile(file, folders, tags, options);
    results.push(result);
  }

  return results;
};
```

##### 分类并导入单个文件
```typescript
const classifyAndImportFile = async (
  file: BatchImportFile,
  folders: Folder[],
  tags: Tag[],
  options: BatchImportOptions
): Promise<BatchImportResult> => {
  // 1. 规则分类
  if (options.useRules) {
    classification = await ruleEngine.classifyFile(file.name, file.path, type);
  }

  // 2. AI 分类（如果规则置信度低）
  if (options.useAI && (!classification || classification.confidence < 0.8)) {
    const aiResult = await aiClassifier.classify({...});
    classification = mergeResults(classification, aiResult);
  }

  // 3. 创建/查找目标文件夹
  if (classification?.subfolder && options.autoCreateFolders) {
    targetFolderId = findOrCreateFolder(classification.subfolder);
  }

  // 4. 处理标签
  // 5. 复制文件
  // 6. 添加到存储

  return { success: true, file, classification };
};
```

##### 快捷导入函数
```typescript
// 使用 AI + 规则
export const quickImport = async (dirPath, onProgress) => {
  return batchImport(dirPath, {
    storageMode: 'embed',
    useRules: true,
    useAI: true,
    autoCreateFolders: true,
    onProgress,
  });
};

// 仅使用规则
export const rulesBasedImport = async (dirPath, targetFolderId, onProgress) => {
  return batchImport(dirPath, {
    storageMode: 'embed',
    useRules: true,
    useAI: false,
    autoCreateFolders: false,
    targetFolderId,
    onProgress,
  });
};

// 仅使用 AI
export const aiBasedImport = async (dirPath, targetFolderId, onProgress) => {
  return batchImport(dirPath, {
    storageMode: 'embed',
    useRules: false,
    useAI: true,
    autoCreateFolders: true,
    targetFolderId,
    onProgress,
  });
};
```

#### 6.3 FolderDropDialog UI (components/FolderDropDialog.tsx)

提供可视化的批量导入界面：
- 文件扫描和预览
- 分类模式选择（无/规则/AI）
- 分类结果预览
- 文件选择
- 进度显示

```typescript
type ClassifyMode = 'none' | 'rule' | 'ai';

// 分类执行
const runClassification = async () => {
  if (classifyMode === 'rule') {
    const results = ruleEngine.classify(resourceItems);
    // 处理结果
  } else if (classifyMode === 'ai') {
    const results = await aiClassifier.classifyBatch(
      resourceItems,
      (processed, total) => setClassifyProgress({ current: processed, total })
    );
    // 处理结果
  }
};
```

---

## 构建修复

### 问题: thumbnailService.ts 中的 await 错误
```
ERROR: "await" can only be used inside an "async" function
```

### 解决方案
简化 DOCX 缩略图生成，移除对未安装的 `html2canvas` 依赖：

```typescript
// 修改前: 复杂的 Promise 链式调用
return new Promise((resolve) => {
  docx.renderAsync(...).then(() => {
    const html2canvas = (await import('html2canvas')).default;  // 错误: await 在非 async 函数中
    // ...
  });
});

// 修改后: 简化实现，使用占位图
export const generateDocxThumbnail = async (filePath: string): Promise<string | null> => {
  console.log('[Thumbnail] DOCX thumbnail using placeholder');
  return null;  // 返回 null 使用占位图
};
```

---

## 总结

本次更新实现了以下功能：

| 功能 | 状态 | 说明 |
|------|------|------|
| 应用重命名 | ✅ 完成 | OmniClipper → OmniCollector |
| 缩略图生成 | ✅ 完成 | 支持 PDF、图片、Markdown，其他使用占位图 |
| 自动描述 | ✅ 完成 | 支持 PDF、DOCX、Markdown 内容提取 |
| 筛选 UI | ✅ 完成 | 类型、颜色、标签下拉筛选 |
| 拖拽分类 | ✅ 完成 | 拖到文件夹自动归入 |
| 批量导入 | ✅ 完成 | 规则 + AI 混合分类 |

构建命令: `npm run build`
