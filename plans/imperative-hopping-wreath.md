# 存储方案迁移计划：localStorage → 本地 JSON 文件

## 问题分析

当前 ominiclipper-desktop 使用 `localStorage` 存储所有应用数据，存在以下问题：
- 清除浏览器/Electron 缓存会导致数据丢失
- localStorage 有 5-10MB 的容量限制
- 数据不便于备份和迁移

## 性能方案选择

**推荐方案：JSON 文件为主 + 内存缓存**

| 对比项 | localStorage | JSON 文件 (IPC) |
|-------|-------------|-----------------|
| 读取速度 | ~1ms 同步 | 10-50ms 异步 |
| 写入 | 同步阻塞 | 异步不阻塞 |
| 容量 | 5-10MB | 无限制 |
| 缓存清除 | 数据丢失 | 数据保留 |

**实现策略：**
1. 启动时：JSON → 内存（一次性读取）
2. 运行时：操作内存 + 异步写 JSON（debounce 500ms）
3. 关闭时：确保最后写入完成

## 当前存储键清单

### 核心数据（必须迁移）
| 键名 | 文件 | 数据类型 |
|-----|------|---------|
| `omniclipper_items` | storageService.ts | ResourceItem[] |
| `omniclipper_tags` | storageService.ts | Tag[] |
| `omniclipper_folders` | storageService.ts | Folder[] |

### 应用设置（建议迁移）
| 键名 | 文件 | 数据类型 |
|-----|------|---------|
| `app_color_mode` | App.tsx | ColorMode |
| `app_theme_id` | App.tsx | string |
| `omniclipper_storage_path` | App.tsx | string |
| `omniclipper_filter_state` | storageService.ts | FilterState |
| `omniclipper_view_mode` | storageService.ts | ViewMode |
| `LOCALE_KEY` | i18n.ts | string |

### 缓存/临时数据（可选迁移）
| 键名 | 文件 | 数据类型 |
|-----|------|---------|
| `omniclipper_recent_files` | fileManager.ts | RecentFile[] |
| `omniclipper_favorite_folders` | fileManager.ts | string[] |
| `OMNICLIPPER_AI_CACHE_*` | aiClassifier.ts | CacheEntry |
| `OMNICLIPPER_LLM_*` | llmProvider.ts | 各种 |
| `OMNICLIPPER_RULES` | ruleConfig.ts | Rule[] |

---

## 实现方案

### 存储位置
```
{userData}/OmniClipper/
├── data/
│   ├── library.json      # 核心数据：items, tags, folders
│   └── settings.json     # 应用设置
├── documents/            # 已有：复制的文档文件
└── backups/              # 新增：自动备份（保留最近5个）
    └── library-{timestamp}.json
```

`{userData}` 路径：
- macOS: `~/Library/Application Support/ominiclipper-desktop`
- Windows: `%APPDATA%/ominiclipper-desktop`
- Linux: `~/.config/ominiclipper-desktop`

### 数据结构

**library.json** - 核心数据
```json
{
  "version": 1,
  "lastModified": "2025-01-18T12:00:00.000Z",
  "items": [
    {
      "id": "uuid",
      "title": "文档标题",
      "type": "PDF",
      "tags": ["tag-id-1"],
      "folderId": "folder-id",
      "createdAt": "...",
      "updatedAt": "...",
      ...
    }
  ],
  "tags": [
    { "id": "tag-id-1", "name": "工作", "color": "blue" }
  ],
  "folders": [
    { "id": "folder-id", "name": "项目文档" }
  ]
}
```

**settings.json** - 应用设置
```json
{
  "version": 1,
  "colorMode": "dark",
  "themeId": "blue",
  "locale": "zh_CN",
  "customStoragePath": null,
  "viewMode": "list",
  "filterState": {
    "search": "",
    "tagId": null,
    "folderId": "all"
  },
  "recentFiles": [],
  "favoriteFolders": []
}
```

---

## 修改文件清单

### 1. electron/main.cjs （约 150 行新增代码）
新增 IPC 句柄：
```javascript
// 数据路径
ipcMain.handle('storage:getDataPath', () => {
  return path.join(app.getPath('userData'), 'OmniClipper', 'data');
});

// 读取 library.json
ipcMain.handle('storage:readLibrary', async () => {
  const filePath = path.join(dataPath, 'library.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
});

// 写入 library.json（带自动备份）
ipcMain.handle('storage:writeLibrary', async (event, data) => {
  // 1. 如果已存在，先备份
  // 2. 写入新数据
  // 3. 清理旧备份（保留最近5个）
});

// 读取/写入 settings.json
ipcMain.handle('storage:readSettings', ...);
ipcMain.handle('storage:writeSettings', ...);

// 迁移：从 localStorage 数据写入 JSON
ipcMain.handle('storage:migrate', async (event, legacyData) => {
  // legacyData = { items, tags, folders, settings }
});
```

### 2. electron/preload.js （约 20 行新增代码）
```javascript
storageAPI: {
  getDataPath: () => ipcRenderer.invoke('storage:getDataPath'),
  readLibrary: () => ipcRenderer.invoke('storage:readLibrary'),
  writeLibrary: (data) => ipcRenderer.invoke('storage:writeLibrary', data),
  readSettings: () => ipcRenderer.invoke('storage:readSettings'),
  writeSettings: (data) => ipcRenderer.invoke('storage:writeSettings', data),
  migrate: (legacyData) => ipcRenderer.invoke('storage:migrate', legacyData),
}
```

### 3. services/storageService.ts （重构，约 200 行修改）

**核心变化：**
- 同步 API → 异步 API
- 添加内存缓存层
- 添加 debounce 写入
- 添加迁移逻辑

```typescript
// 内存缓存
let libraryCache: LibraryData | null = null;
let settingsCache: SettingsData | null = null;
let writeDebounceTimer: NodeJS.Timeout | null = null;

// 初始化（启动时调用一次）
export async function initStorage(): Promise<void> {
  const isElectron = !!(window as any).electronAPI?.storageAPI;

  if (isElectron) {
    // 尝试从 JSON 读取
    libraryCache = await window.electronAPI.storageAPI.readLibrary();

    if (!libraryCache) {
      // JSON 不存在，检查 localStorage 是否有数据需要迁移
      const legacyItems = localStorage.getItem('omniclipper_items');
      if (legacyItems) {
        await migrateFromLocalStorage();
      } else {
        // 初始化空数据
        libraryCache = { version: 1, items: [], tags: [], folders: [] };
      }
    }
  } else {
    // Web 环境，继续使用 localStorage
    // ...
  }
}

// 获取资源（同步，从内存读取）
export function getItems(): ResourceItem[] {
  return libraryCache?.items || [];
}

// 保存资源（异步，写入 JSON）
export async function saveItems(items: ResourceItem[]): Promise<void> {
  if (libraryCache) {
    libraryCache.items = items;
    libraryCache.lastModified = new Date().toISOString();
    scheduleWrite(); // debounce 写入
  }
}

// 防抖写入
function scheduleWrite() {
  if (writeDebounceTimer) clearTimeout(writeDebounceTimer);
  writeDebounceTimer = setTimeout(async () => {
    await window.electronAPI.storageAPI.writeLibrary(libraryCache);
  }, 500);
}
```

### 4. App.tsx （约 50 行修改）
```typescript
// 添加初始化状态
const [isStorageReady, setIsStorageReady] = useState(false);

// 启动时初始化存储
useEffect(() => {
  const init = async () => {
    await storageService.initStorage();
    setItems(storageService.getItems());
    setTags(storageService.getTags());
    setFolders(storageService.getFolders());
    setIsStorageReady(true);
  };
  init();
}, []);

// 显示加载状态直到存储就绪
if (!isStorageReady) {
  return <LoadingScreen />;
}
```

### 5. services/fileManager.ts （约 30 行修改）
- 将 `recentFiles` 和 `favoriteFolders` 迁移到 settings.json
- 使用 storageService 的 settings API

---

## 实现步骤

### Step 1: 扩展 Electron 主进程 [electron/main.cjs]
- 添加数据目录创建逻辑
- 实现 6 个 IPC 句柄
- 实现备份逻辑

### Step 2: 更新预加载脚本 [electron/preload.js]
- 暴露 storageAPI 对象

### Step 3: 重构存储服务 [services/storageService.ts]
- 添加异步初始化
- 实现内存缓存 + debounce 写入
- 实现迁移逻辑
- 保持原有 API 签名（getItems/saveItems 等）

### Step 4: 更新主应用 [App.tsx]
- 添加异步初始化流程
- 添加加载状态
- 更新设置读写

### Step 5: 更新文件管理器 [services/fileManager.ts]
- 使用新的 settings API

---

## 验证方案

1. **新安装测试**：首次启动，确认创建空的 JSON 文件
2. **迁移测试**：有 localStorage 数据时启动，确认迁移成功
3. **增删改测试**：操作 items/tags/folders，检查 JSON 文件更新
4. **缓存清除测试**：清除 Electron 缓存后重启，数据仍在
5. **备份测试**：多次修改后检查 backups 目录

---

## 风险与回退

| 风险 | 缓解措施 |
|-----|---------|
| 迁移数据损坏 | 迁移前备份 localStorage 到 JSON |
| JSON 写入失败 | 错误处理 + 通知用户 |
| 版本不兼容 | version 字段 + 升级逻辑 |

**回退方案**：保留 localStorage 读取能力，迁移失败时降级
