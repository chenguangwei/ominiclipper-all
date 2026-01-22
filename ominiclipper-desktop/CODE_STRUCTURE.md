# OmniClipper Desktop - 代码结构文档

> 最后更新: 2026-01-22

## 1. 主目录结构

```
ominiclipper-desktop/
├── App.tsx                    # 主应用组件 (~55KB, 状态管理中枢)
├── index.tsx                  # 应用入口
├── index.html                 # HTML模板
├── types.ts                   # 核心TypeScript类型定义
├── types/                     # 扩展类型定义
│   ├── classification.ts     # AI分类类型
│   └── chat.ts              # 聊天/AI助手类型
├── constants.ts              # 常量、颜色主题、模拟数据
├── supabaseClient.ts         # Supabase云同步客户端
├── services/                 # 业务逻辑层 (24个服务)
├── components/               # React UI组件
├── hooks/                    # 自定义React Hooks
├── utils/                    # 工具函数
├── electron/                 # Electron主进程和IPC处理器
├── pages/                    # 页面组件
├── sql/                      # SQL schema文件
└── dist-electron/            # 构建后的Electron文件
```

## 2. 核心组件 (components/)

### 2.1 主要UI组件

| 组件 | 用途 | 关键功能 |
|------|------|----------|
| **App.tsx** | 主应用组件 | 路由、全局状态管理 |
| **Sidebar.tsx** | 左侧导航栏 | 文件夹树、标签、用户资料、AI助手 |
| **TopBar.tsx** | 顶部工具栏 | 搜索、视图切换、操作按钮 |
| **ListDetailView.tsx** | 三栏视图 | 侧边栏->列表->详情 |
| **GridView.tsx** | 网格视图 | 缩略图展示资源 |
| **TableView.tsx** | 表格视图 | 表格形式展示数据 |
| **PreviewPane.tsx** | 预览面板 | Details/Preview标签页 |
| **DocumentViewer.tsx** | 文档阅读器 | 全屏PDF/EPUB阅读 |

### 2.2 对话框组件

| 组件 | 用途 |
|------|------|
| **CreateResourceDialog.tsx** | 创建/编辑资源 |
| **CreateFolderDialog.tsx** | 创建/编辑文件夹 |
| **CreateTagDialog.tsx** | 创建/编辑标签 |
| **AuthDialog.tsx** | 认证和订阅管理 |
| **SettingsDialog.tsx** | 应用设置 |
| **ImportExportDialog.tsx** | JSON/CSV导入导出 |
| **AutoClassifyDialog.tsx** | AI文件分类 |
| **FileDropDialog.tsx** | 拖拽文件导入 |
| **FolderDropDialog.tsx** | 拖拽文件夹导入 |

### 2.3 预览面板渲染器 (PreviewPane/renderers)

| 渲染器 | 用途 | 技术栈 |
|--------|------|--------|
| **PdfRenderer.tsx** | PDF文档预览 | PDF.js |
| **WordRenderer.tsx** | DOCX文档预览 | docx-preview |
| **MarkdownRenderer.tsx** | Markdown渲染 | 原生HTML |
| **ImageRenderer.tsx** | 图片预览 | 支持缩放/平移 |
| **WebRenderer.tsx** | Web URL渲染 | iframe |

### 2.4 辅助组件

| 组件 | 用途 |
|------|------|
| **ResourceDetails.tsx** | 预览面板中的元数据显示 |
| **ResourcePreview.tsx** | 预览标签内容路由 |
| **TagSelector.tsx** | 标签选择UI |
| **TypeDropdown.tsx** | 资源类型选择器 |
| **ContextMenu.tsx** | 右键菜单 |
| **Icon.tsx** | Material Symbols图标封装 |
| **AIAssistant.tsx** | AI聊天助手面板 |

## 3. 服务层 (services/)

### 3.1 数据持久化与存储

| 服务 | 用途 | 关键特性 |
|------|------|----------|
| **storageService.ts** | 核心本地存储 | library.json、settings.json、内存缓存、防抖写入 |
| **fileStorageService.ts** | Eagle风格文件存储 | items/{id}/ 结构 |
| **backupService.ts** | 自动备份与恢复 | 自动创建备份、恢复功能 |
| **mtimeService.ts** | 文件修改时间追踪 | mtime监控 |
| **itemMetadataService.ts** | 单项元数据管理 | 每项metadata.json |

### 3.2 文档处理

| 服务 | 用途 |
|------|------|
| **contentExtractionService.ts** | 从PDF、DOCX、EPUB、图片提取文本片段 |
| **thumbnailService.ts** | 为所有文档类型生成缩略图 |
| **documentViewer.ts** | PDF/EPUB渲染 |

### 3.3 AI与分类

| 服务 | 用途 |
|------|------|
| **aiClassifier.ts** | AI文件分类 |
| **llmProvider.ts** | LLM集成 (OpenAI、Anthropic、DeepSeek、SiliconFlow) |
| **vectorStoreService.ts** | 向量存储 (LanceDB) |
| **hybridSearchService.ts** | 混合搜索 (向量+BM25) |
| **chatService.ts** | AI聊天会话管理 |

### 3.4 文件管理

| 服务 | 用途 |
|------|------|
| **fileManager.ts** | 文件路径管理、最近文件、收藏、统计 |
| **fileOrganizer.ts** | 基于规则自动整理文件 |
| **folderDirectoryService.ts** | 物理文件夹创建/删除 |
| **batchImportService.ts** | 批量导入(带进度追踪) |

### 3.5 规则与配置

| 服务 | 用途 |
|------|------|
| **ruleEngine.ts** | 分类规则执行引擎 |
| **ruleConfig.ts** | 规则配置管理 |
| **subscriptionManager.ts** | 用户订阅和令牌配额追踪 |

### 3.6 工具服务

| 服务 | 用途 |
|------|------|
| **i18n.ts** | 国际化 (英文/中文) |

## 4. 自定义Hooks (hooks/)

| Hook | 用途 | 核心模式 |
|------|------|----------|
| **useFileContent.ts** | 异步文件内容加载 + 防陈旧数据 | 追踪contentItemId防止陈旧数据覆盖；包含竞态条件保护 |

### Hook模式特点

1. **状态管理**: 使用 `useState`
2. **回调**: 使用 `useCallback` 封装异步操作
3. **副作用**: `useEffect` 管理副作用
4. **错误处理**: 捕获并暴露错误
5. **内存管理**: 正确释放blob URL

## 5. 工具函数 (utils/)

### 5.1 fileHelpers.ts - 文件路径与数据工具

| 函数 | 用途 |
|------|------|
| `isAbsolutePath()` | 验证绝对路径 |
| `getValidFilePath()` | 获取可用路径，优先localPath |
| `getEffectiveType()` | 从扩展名确定资源类型 |
| `tryRecoverFilePath()` | 通过Electron API恢复路径，扫描旧存储 |
| `getFileData()` | **核心函数** - 从嵌入数据、本地文件(IPC)或URL获取ArrayBuffer |

### 工具模式特点

1. **浏览器兼容性**: 避免Node.js path模块
2. **Electron检测**: 检查 `window.electronAPI` 可用性
3. **降级链**: `getFileData()` 优先级: embeddedData → blob URL恢复 → 本地文件(IPC) → HTTP URL
4. **错误处理**: 返回null或抛出描述性错误
5. **Buffer处理**: 一致使用 `Uint8Array.slice(0).buffer` 防止内存问题

## 6. Electron层 (electron/)

### 6.1 主进程文件

| 文件 | 用途 |
|------|------|
| **main.cjs** | Electron主进程 (~50KB): BrowserWindow、IPC处理器、菜单、协议注册、httpServer、vectorService、searchIndexManager集成 |
| **main.js** | 开发/主入口 |
| **preload.js** | 安全contextBridge API暴露 |
| **httpServer.cjs** | 本地HTTP服务器用于文件服务 |
| **vectorService.cjs** | LanceDB向量数据库操作 |
| **searchIndexManager.cjs** | BM25搜索索引 (SQLite FTS5) |
| **textChunker.cjs** | RAG索引文本分块 |

### 6.2 IPC处理器 (通过preload暴露)

| API命名空间 | 方法 |
|------------|------|
| `electronAPI` | getUserDataPath, readFile, fileExists, openPath, openExternal |
| `fileStorageAPI` | Eagle风格存储操作，包括新增的 `moveFileToFolder` 用于文件夹迁移 |
| `vectorAPI` | 向量搜索操作 |
| `searchAPI` | BM25搜索操作 |

## 7. 类型系统架构

### 7.1 核心类型 (types.ts)

```typescript
enum ResourceType { WORD, PDF, EPUB, WEB, IMAGE, MARKDOWN, PPT, EXCEL, UNKNOWN }
enum ViewMode { LIST_DETAIL, TABLE, GRID }
type FileStorageMode = 'embed' | 'reference'
type ColorMode = 'dark' | 'light' | 'system'

interface ResourceItem {
  id, title, type, tags, folderId, color, createdAt, updatedAt,
  path?, localPath?, fileSize?, mimeType?, isCloud, isStarred,
  contentSnippet?, aiSummary?, storageMode?, embeddedData?,
  originalPath?, source?, thumbnailUrl?, description?
}

interface Tag { id, name, color?, count?, parentId? }
interface Folder { id, name, parentId?, icon? }
interface FilterState { search, tagId, color, folderId, isStarred?, typeFilter? }
```

### 7.2 扩展类型 (types/classification.ts)

- `ClassificationMode = 'rule' | 'ai' | 'hybrid'`
- `ClassificationRule` (条件和动作)
- `AIClassifierConfig` (LLM配置)
- `UserSubscription` (配额追踪)
- `RuleCondition` / `RuleAction` 类型

## 8. 关键架构模式

### 8.1 Electron/渲染进程分离

- **主进程**: 文件系统、IPC、向量搜索
- **渲染进程**: UI、文档渲染
- **通信**: 通过contextBridge安全API

### 8.2 存储策略

- **Electron**: app userData目录中的JSON文件
- **Eagle风格**: 每项 `items/{id}/metadata.json`
- **Web回退**: localStorage (有限容量)

### 8.3 文档渲染管道

1. `ResourcePreview.tsx` 路由到对应渲染器
2. 渲染器调用 `useFileContent` hook
3. `fileHelpers.getFileData()` 通过IPC/HTTP获取
4. 渲染器使用PDF.js、docx-preview等显示

### 8.4 混合搜索架构

- **向量搜索**: LanceDB向量 + Apache Arrow schema
- **BM25搜索**: SQLite FTS5全文搜索 + 文本分块
- **混合模式**: 向量相似度 + 关键词匹配组合

## 9. 文件路径处理 (关键)

### 处理挑战

- **Blob URL过期**: Blob URL重启后过期，`tryRecoverFilePath()` 尝试恢复
- **路径优先级**: `localPath` > `path` > `originalPath`
- **旧存储扫描**: 扫描 `~/Library/Application Support/OmniCollector/documents`
- **macOS NFD/NFC**: 处理Unicode归一化问题

### 恢复策略 (4层降级)

1. 尝试文件Storage API获取路径
2. 从embeddedData恢复文件名
3. 扫描旧存储目录
4. 尝试常见扩展名

### 文件夹迁移 (2026-01-22新增)

当资源的 `folderId` 改变时，文件会自动迁移到对应的分类目录：

**存储结构变化**：
```
原来: files/{itemId}/{filename}
迁移后: folders/{folderId}/{filename}
```

**迁移逻辑** (`storageService.ts:updateItem`)：
- **reference模式** (`localPath` 存在): 使用 `fileAPI.moveFile`
- **embed模式**: 使用 `fileStorageAPI.moveFileToFolder`

**目标路径**：
- `folders/{folderId}/` - 分类文件夹
- `folders/uncategorized/` - 未分类文件夹

## 10. 最近修改 (2026-01-21)

| 文件 | 修改类型 | 描述 |
|------|----------|------|
| main.cjs | 🔴修复 | macOS文件名Unicode编码处理、文件路径恢复 |
| main.cjs | 🟣新增 | 添加 `fileStorage:moveFileToFolder` IPC处理器支持文件夹迁移 |
| useFileContent.ts | 🔄增强 | 陈旧数据预防、竞态条件保护 |
| fileHelpers.ts | 🔴修复 | Blob URL恢复、错误处理 |
| fileHelpers.ts | 🔴修复 | blob URL 场景下优先使用 localPath 恢复文件 |
| fileHelpers.ts | 🔴修复 | `tryRecoverFilePath` 添加 folders 目录搜索 |
| thumbnailService.ts | 🔴修复 | ArrayBuffer byteOffset问题 |
| contentExtractionService.ts | ✅改进 | 一致的ArrayBuffer处理 |
| DocumentViewer.tsx | 🔴增强 | 路径恢复机制 |
| WordRenderer.tsx | 🔄增强 | 防御性数据验证 |
| storageService.ts | 🔄增强 | 支持embed模式文件自动迁移到分类文件夹 |
| fileStorageService.ts | 🟣新增 | 添加 `moveFileToFolder` 封装函数 |
| preload.js | 🟣新增 | 添加 `moveFileToFolder` API暴露 |
| storageService.ts | 🔵发现 | JSON文件读写与内存缓存 |

## 11. 依赖版本

- **Electron**: 35.0.0 (从40.0.0降级)
- **数据库**: LanceDB v0.23.0 (API变更: `.toArray()` 而非 `.execute()`)
- **PDF渲染**: PDF.js (本地worker配置)
- **DOCX渲染**: docx-preview

## 12. 代码审查检查清单

### 12.1 Buffer/ArrayBuffer处理

- [ ] 使用 `Uint8Array.slice(0).buffer` 而非直接使用buffer
- [ ] 避免共享ArrayBuffer导致的数据篡改
- [ ] 正确处理byteOffset和byteLength

### 12.2 文件路径处理

- [ ] 优先使用 `localPath` 而非 `path`
- [ ] 处理Blob URL过期场景
- [ ] 处理macOS NFD/NFC编码问题

### 12.3 React组件

- [ ] 正确使用 `useCallback` 和 `useEffect`
- [ ] 清理副作用 (blob URLs, timers)
- [ ] 防止竞态条件 (使用contentItemId追踪)

### 12.4 错误处理

- [ ] 降级链完整 (try-catch覆盖所有获取方式)
- [ ] 返回null而非无效路径
- [ ] 详细的错误日志
