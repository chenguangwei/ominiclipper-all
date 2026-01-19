# OmniClipper Desktop 功能实现计划

## 概述

实现三个功能：
1. **Dark/Light/System 主题切换** - 三种模式支持
2. **文件嵌入模式选择** - 每次拖入文件时弹出对话框选择
3. **文档打开错误修复** - 修复 PDF/EPUB 无法打开的问题

---

## 功能 1: 主题切换 (Dark/Light/System)

### 需修改的文件

| 文件 | 修改内容 |
|------|---------|
| `constants.ts` | 添加 ColorMode 类型和 Light/Dark 颜色定义 |
| `index.html` | 添加 CSS 变量和 Tailwind 语义化颜色类 |
| `App.tsx` | 添加 colorMode 状态和切换逻辑 |
| `components/AuthDialog.tsx` | 添加主题模式选择器 UI |
| 所有组件 | 将硬编码颜色替换为 CSS 变量类 |

### 实现步骤

**Step 1**: 在 `constants.ts` 添加类型定义
```typescript
export type ColorMode = 'dark' | 'light' | 'system';
```

**Step 2**: 在 `index.html` 添加 CSS 变量
- 深色模式变量 (`:root.dark`)
- 浅色模式变量 (`:root:not(.dark)`)
- Tailwind 扩展: `surface`, `surface-secondary`, `content` 等语义化类

**Step 3**: 在 `App.tsx` 添加主题管理
- `colorMode` state 和 localStorage 持久化
- `applyColorMode()` 函数切换 HTML class
- 监听系统偏好变化 (System 模式)
- 传递给 AuthDialog

**Step 4**: 在 `AuthDialog.tsx` Appearance 标签添加模式选择器
- Light / Dark / System 三个按钮
- 图标: light_mode, dark_mode, settings_suggest

**Step 5**: 替换所有组件中的硬编码颜色
| 旧值 | 新值 |
|------|------|
| `bg-[#1e1e1e]` | `bg-surface` |
| `bg-[#1a1a1a]` | `bg-surface-secondary` |
| `bg-[#252525]` | `bg-surface-tertiary` |
| `text-slate-200` | `text-content` |
| `text-slate-400` | `text-content-secondary` |

---

## 功能 2: 文件嵌入模式选择

### 需修改/创建的文件

| 文件 | 修改内容 |
|------|---------|
| `types.ts` | 添加 FileStorageMode、embeddedData 等字段 |
| `components/FileDropDialog.tsx` | **新建** - 文件导入对话框 |
| `services/fileManager.ts` | 添加 fileToBase64, base64ToBlob 工具函数 |
| `App.tsx` | 修改 handleDrop 逻辑，添加对话框状态 |

### 实现步骤

**Step 1**: 在 `types.ts` 扩展 ResourceItem
```typescript
export type FileStorageMode = 'embed' | 'reference';

export interface ResourceItem {
  // ... 现有字段
  storageMode?: FileStorageMode;
  embeddedData?: string;  // Base64 数据
  originalPath?: string;  // 原始文件路径
  fileSize?: number;
  mimeType?: string;
}
```

**Step 2**: 创建 `FileDropDialog.tsx`
- 显示文件名和大小
- 两个选项按钮: "嵌入文件内容" / "仅存储路径"
- 大文件 (>5MB) 时显示警告

**Step 3**: 在 `fileManager.ts` 添加工具函数
```typescript
export async function fileToBase64(file: File): Promise<string>
export function base64ToBlob(base64: string): string
```

**Step 4**: 修改 `App.tsx` handleDrop
- 拖入文件时打开 FileDropDialog
- 根据用户选择处理文件存储
- 嵌入模式: 转 Base64 存储
- 引用模式: 存储 blob URL / 文件路径

**Step 5**: 应用加载时处理嵌入文件
- 从 localStorage 加载时，embeddedData 直接作为 data URL 使用

---

## 功能 3: 文档打开错误修复

### 问题根因

1. **Blob URL 过期**: `URL.createObjectURL()` 创建的 URL 刷新后失效
2. **错误信息不明确**: 用户不知道发生了什么
3. **没有恢复机制**: 出错后无法重试

### 需修改的文件

| 文件 | 修改内容 |
|------|---------|
| `services/documentViewer.ts` | 增强错误处理和 URL 验证 |
| `components/DocumentViewer.tsx` | 添加重试和恢复 UI |

### 实现步骤

**Step 1**: 在 `documentViewer.ts` 增强 renderPdf
- 加载前验证 URL 有效性
- Blob URL: 用 fetch HEAD 检查是否过期
- Data URL: 验证 MIME 类型
- 提供具体的错误信息

**Step 2**: 在 `DocumentViewer.tsx` 改进错误显示
```tsx
{error && (
  <div className="error-container">
    <Icon name="warning" />
    <p>{error}</p>
    <button onClick={retry}>重试</button>
    <a href={item.path} target="_blank">在外部打开</a>
    {error.includes('expired') && (
      <p>提示: 重新拖入文件可恢复访问</p>
    )}
  </div>
)}
```

**Step 3**: 结合功能 2 的嵌入模式
- 嵌入的文件使用 data URL，永不过期
- 引用模式的文件显示过期提示，引导重新导入

---

## 实现顺序

1. **先实现功能 2** (文件嵌入) - 这是解决功能 3 的基础
2. **再实现功能 3** (错误修复) - 利用嵌入模式解决 blob URL 问题
3. **最后实现功能 1** (主题切换) - 独立功能，需要修改多个组件

---

## 验证测试

### 功能 1 测试
- [ ] 设置中显示 Light/Dark/System 三个选项
- [ ] 切换到 Light 模式，所有 UI 变为浅色
- [ ] 切换到 Dark 模式，恢复深色
- [ ] 切换到 System，跟随系统设置
- [ ] 刷新页面，主题保持不变

### 功能 2 测试
- [ ] 拖入 PDF 文件，弹出选择对话框
- [ ] 选择"嵌入"，文件可正常预览
- [ ] 刷新页面，嵌入的文件仍可打开
- [ ] 选择"路径引用"，文件可预览
- [ ] 拖入 >5MB 文件，显示警告

### 功能 3 测试
- [ ] 嵌入模式的 PDF 刷新后仍可打开
- [ ] 路径模式的文件过期后显示友好错误
- [ ] 错误信息提示重新导入
- [ ] 重试按钮可用
- [ ] 外部打开链接可用

---

## 关键文件列表

- `/ominiclipper-desktop/App.tsx`
- `/ominiclipper-desktop/index.html`
- `/ominiclipper-desktop/types.ts`
- `/ominiclipper-desktop/constants.ts`
- `/ominiclipper-desktop/components/AuthDialog.tsx`
- `/ominiclipper-desktop/components/DocumentViewer.tsx`
- `/ominiclipper-desktop/components/FileDropDialog.tsx` (新建)
- `/ominiclipper-desktop/services/documentViewer.ts`
- `/ominiclipper-desktop/services/fileManager.ts`
- `/ominiclipper-desktop/components/Sidebar.tsx`
- `/ominiclipper-desktop/components/TopBar.tsx`
- `/ominiclipper-desktop/components/PreviewPane.tsx`
- `/ominiclipper-desktop/components/ListDetailView.tsx`
- `/ominiclipper-desktop/components/TableView.tsx`
