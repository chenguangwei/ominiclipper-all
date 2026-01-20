# Eagle 风格存储架构实现文档

## 概述

OmniClipper Desktop 借鉴 Eagle 的存储架构，实现了以下特性：
- 物理文件夹同步（新建 folder 时创建实际目录）
- Item 元数据独立存储（每个资源一个 metadata.json）
- mtime 追踪机制
- 自动备份系统

## 目录结构

```
{storagePath}/OmniClipper/
├── data/
│   ├── library.json           # 核心数据（items, tags, folders）
│   ├── settings.json          # 应用设置
│   ├── mtime.json             # 资源修改时间映射
│   └── backup/                # 自动备份
│       └── backup-YYYY-MM-DD HH.MM.SS.SSS.json
├── folders/                   # 物理文件夹目录
│   └── {folderId}/            # 每个 folder 一个目录
│       └── {nested folders}/
└── items/                     # 资源目录
    ├── index.json             # 资源索引（轻量）
    └── {itemId}/              # 每个资源一个目录
        └── metadata.json      # 资源元数据
```

## 核心文件

### 新建文件

| 文件 | 说明 |
|-----|------|
| `services/folderDirectoryService.ts` | 物理文件夹管理服务 |
| `services/itemMetadataService.ts` | Item 元数据管理服务 |
| `services/mtimeService.ts` | mtime 追踪服务 |
| `services/backupService.ts` | 自动备份服务 |

### 修改文件

| 文件 | 修改内容 |
|-----|---------|
| `electron/main.cjs` | 添加 `folder:*` 和 `item:*` IPC 处理器 |
| `electron/preload.js` | 暴露 `folderAPI` 和 `itemAPI` |
| `services/storageService.ts` | 集成新服务，修改为异步操作 |
| `App.tsx` | 处理异步文件夹和资源操作 |

## API 参考

### Folder Directory API (`folderAPI`)

```typescript
// 获取 folders 目录路径
getFoldersPath(): Promise<string>

// 创建物理文件夹
createFolder(folderId: string): Promise<{ success: boolean; path?: string; error?: string }>

// 删除物理文件夹
deleteFolder(folderId: string): Promise<{ success: boolean; error?: string }>

// 检查文件夹是否存在
folderExists(folderId: string): Promise<boolean>
```

### Item Metadata API (`itemAPI`)

```typescript
// 获取 items 目录路径
getItemsPath(): Promise<string>

// 保存 item 元数据
saveItemMetadata(itemId: string, metadata: ItemMetadata): Promise<{ success: boolean; path?: string; error?: string }>

// 读取 item 元数据
readItemMetadata(itemId: string): Promise<ItemMetadata | null>

// 删除 item 元数据
deleteItemMetadata(itemId: string): Promise<{ success: boolean; error?: string }>

// 保存资源索引
saveItemsIndex(index: ItemsIndex): Promise<{ success: boolean; error?: string }>

// 读取资源索引
readItemsIndex(): Promise<ItemsIndex | null>
```

## storageService.ts 异步改造

### 改造前（同步）
```typescript
export const addItem = (item: Omit<ResourceItem, 'id' | 'createdAt' | 'updatedAt'>): ResourceItem => {
  // ...
};

export const deleteFolder = (id: string): boolean => {
  // ...
};
```

### 改造后（异步）
```typescript
export const addItem = async (item: Omit<ResourceItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<ResourceItem> => {
  // 创建内存中的 item
  const newItem = { ... };

  // 保存到 library.json
  const items = getItems();
  items.unshift(newItem);
  saveItems(items);

  // 保存到 items/{itemId}/metadata.json
  if (isElectronEnvironment) {
    await itemMetaService.saveItemMetadata(newItem);
  }

  return newItem;
};

export const deleteFolder = async (id: string): Promise<boolean> => {
  // 从 library.json 删除
  // ...

  // 删除物理文件夹
  if (isElectronEnvironment) {
    await folderDirService.deleteFolderPhysical(folderId);
  }

  return true;
};
```

## ItemMetadata 结构

```typescript
interface ItemMetadata {
  id: string;
  name: string;
  title: string;
  type: string;
  tags: string[];
  folderId: string | null;
  color: string;
  path: string | null;
  localPath: string | null;
  originalPath: string | null;
  storageMode: string;
  fileSize: number;
  mimeType: string;
  isCloud: boolean;
  isStarred: boolean;
  contentSnippet: string | null;
  aiSummary: string | null;
  embeddedData: string | null;
  createdAt: string;
  updatedAt: string;
  btime?: number;
  mtime?: number;
  lastModified?: number;
}
```

## MTime 结构

```json
{
  "itemId1": 1765762138530,
  "itemId2": 1767864276658,
  "all": 100
}
```

## 状态刷新机制

由于 `saveItems()` 使用 500ms 防抖，修改数据后需要强制刷新：

```typescript
// 错误方式 - 可能读取到旧数据
storageService.addItem(newItem);
setItems(storageService.getItems());

// 正确方式 - 等待防抖完成
await storageService.addItem(newItem);
await storageService.flushPendingWrites();
setItems([...storageService.getItems()]);  // 创建新数组引用确保 React 检测变化
```

## 验证方法

1. **文件夹同步**: 新建文件夹 → 检查 `folders/{folderId}/` 是否创建
2. **资源存储**: 导入文件 → 检查 `items/{itemId}/` 是否创建并包含 metadata.json
3. **JSON 拆分**: 重启应用 → 验证数据正确加载
4. **备份机制**: 多次操作 → 检查 backup/ 目录生成备份
