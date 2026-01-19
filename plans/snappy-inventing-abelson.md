# 修复计划：文件导入存储丢失和 PDF 预览问题

## 问题 1：拖拽导入文件后重启丢失

### 用户确认
- 场景：拖拽导入文件
- 问题：重启后列表中看不到导入的文件

### 根因分析
`storageService.getItems()` 在 localStorage 没有数据时会保存并返回 MOCK 数据：
```typescript
if (stored) {
  return JSON.parse(stored);
}
// 首次加载使用 MOCK 数据并保存
saveItems(MOCK_ITEMS);
return MOCK_ITEMS;
```

这会导致新导入的数据被 MOCK 数据覆盖。

### 修复方案
修改 `services/storageService.ts` 的 `getItems()` 函数：
- 不再自动保存 MOCK 数据
- 只返回 localStorage 中的真实数据或空数组

### 修改文件
- `services/storageService.ts:21-34`

---

## 问题 2：PreviewPane Preview 标签页 PDF 完全不显示

### 用户确认
- 问题：PDF 预览完全不显示

### 根因分析
PDF.js worker 配置使用 `import.meta.url`，在 Electron 环境中可能无法正确加载：
```typescript
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();
```

### 修复方案
使用 CDN 加载 PDF.js worker（更可靠）：
```typescript
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
```

### 修改文件
- `components/PreviewPane.tsx:14-18`

---

## 实施步骤

### Step 1: 修复 storageService (文件: services/storageService.ts)
```
1.1 修改 getItems() 不自动保存 MOCK 数据
1.2 只返回 localStorage 数据或空数组
```

### Step 2: 修复 PDF.js worker 配置 (文件: components/PreviewPane.tsx)
```
2.1 将 workerSrc 改为使用 CDN URL
```

### Step 3: 测试验证
```
3.1 拖拽导入一个文件 -> 重启应用 -> 确认文件仍在列表中
3.2 导入一个 PDF 文件 -> 点击进入详情 -> 切换到 Preview 标签 -> 确认 PDF 预览正常显示
```
