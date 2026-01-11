<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# OmniClipper Desktop

一款功能强大的资源管理桌面客户端，用于管理数字资源、文档和网页剪辑。采用 macOS 原生风格设计，支持多视图模式、智能分类和云端同步。

## 功能特性

### 多视图模式
- **列表详情视图** - 左侧列表 + 右侧预览面板
- **表格视图** - 完整的表格数据展示
- **网格视图** - 卡片式网格布局 + 预览面板

### 资源管理
- **多种资源类型** - Word、PDF、EPUB、网页、图片
- **文件夹管理** - 支持嵌套文件夹结构
- **标签系统** - 分层标签，支持颜色标记
- **色标分类** - 快速视觉分类
- **文件拖拽导入** - 直接拖拽文件到窗口导入

### 智能过滤
- **全文搜索** - 标题关键词搜索
- **标签过滤** - 按标签筛选（支持层级）
- **颜色过滤** - 按色标筛选
- **文件夹过滤** - 按文件夹筛选
- **特殊视图** - 全部项目、回收站、最近、收藏、分类、未标记

### 个性化
- **主题系统** - 6 个预设主题（Blue、Emerald、Violet、Amber、Rose、Cyan）
- **深色模式** - 原生深色界面
- **主题持久化** - localStorage 存储偏好

### 云端功能
- **Supabase 集成** - 云端数据存储
- **用户认证** - 邮箱注册/登录
- **云同步标记** - 项目同步状态指示
- **Pro 会员** - 高级云功能

### 快捷键支持
| 快捷键 | 功能 |
|--------|------|
| `Cmd/Ctrl + N` | 新建资源 |
| `Cmd/Ctrl + F` | 聚焦搜索 |
| `Cmd/Ctrl + E` | 导入/导出 |
| `Cmd/Ctrl + 1/2/3` | 切换视图 |
| `Delete` | 删除选中 |
| `Escape` | 关闭对话框 |
| `↑/↓` | 导航项目 |

## 技术栈

| 类别 | 技术 |
|------|------|
| UI 框架 | React 19 + TypeScript |
| 构建工具 | Vite 6.2 |
| 样式 | Tailwind CSS |
| 图标 | Google Material Symbols |
| 后端服务 | Supabase |
| 桌面打包 | Electron |
| 字体 | Inter (Google Fonts) |

## 项目结构

```
ominiclipper-desktop/
├── App.tsx                 # 主应用组件（状态管理、过滤逻辑）
├── index.tsx               # 应用入口
├── index.html              # HTML 模板（Tailwind CDN、字体）
├── types.ts                # TypeScript 类型定义
├── constants.ts            # 常量、主题、模拟数据
├── supabaseClient.ts       # Supabase 客户端管理
├── vite.config.ts          # Vite 配置
├── package.json            # 项目配置 & Electron 打包
├── electron/
│   ├── main.js             # Electron 主进程
│   └── preload.js          # 预加载脚本
├── services/
│   ├── storageService.ts   # 本地存储服务
│   ├── i18n.ts             # 多语言支持
│   ├── fileManager.ts      # 文件路径管理服务
│   └── documentViewer.ts   # PDF/EPUB 文档渲染服务
└── components/
    ├── TopBar.tsx          # 顶部工具栏（搜索、视图切换）
    ├── Sidebar.tsx         # 左侧边栏（文件夹、标签、用户）
    ├── ListDetailView.tsx  # 列表详情视图
    ├── PreviewPane.tsx     # 预览面板（项目详情、内容预览、AI摘要）
    ├── TableView.tsx       # 表格视图
    ├── GridView.tsx        # 网格视图
    ├── AuthDialog.tsx      # 认证/设置对话框
    ├── ImportExportDialog.tsx  # 导入/导出对话框
    ├── CreateResourceDialog.tsx   # 创建资源对话框
    ├── CreateFolderDialog.tsx     # 创建文件夹对话框
    ├── CreateTagDialog.tsx        # 创建标签对话框
    ├── ConfirmDialog.tsx          # 确认对话框
    ├── DocumentViewer.tsx         # PDF/EPUB 文档全屏查看器
    └── Icon.tsx            # 图标组件
```

## 界面布局

```
┌─────────────────────────────────────────────────┐
│                    TopBar                       │
│  (交通灯 | 视图切换 | 搜索 | 同步 | 添加)        │
├─────────┬───────────────────────────────────────┤
│         │         Active Filters Bar            │
│ Sidebar │    (当前活跃的标签和颜色过滤)          │
│         ├───────────────────────────────────────┤
│ • 库    │                                       │
│ • 文件夹 │     Content Area (根据视图模式)       │
│ • 标签  │     • LIST_DETAIL: 列表 + 预览        │
│ • 用户  │     • TABLE: 完整表格                 │
│         │     • GRID: 网格 + 预览               │
│         │                                       │
└─────────┴───────────────────────────────────────┘
```

## 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn

### 安装

1. 安装依赖：
   ```bash
   cd ominiclipper-desktop
   npm install
   ```

2. 配置环境变量，在 `.env.local` 中设置：
   ```
   GEMINI_API_KEY=your_gemini_api_key
   ```

3. 启动开发服务器：
   ```bash
   npm run dev
   ```

4. 访问 http://localhost:3000

### 构建 Web 版本

```bash
npm run build
```

### 构建 Electron 桌面应用

```bash
# 构建所有平台
npm run electron:build

# 或指定平台
npm run electron:build:mac   # macOS
npm run electron:build:win   # Windows
npm run electron:build:linux # Linux
```

打包后的应用将位于 `release/` 目录。

### 运行 Electron 开发版本

```bash
npm run electron
```

## 配置说明

### Supabase 配置
在设置对话框的 Connection 标签页中配置：
- Supabase URL
- Supabase Anon Key

### 主题配置
在设置对话框的 Appearance 标签页中选择主题：
- Blue（默认）
- Emerald
- Violet
- Amber
- Rose
- Cyan

## 数据类型

### 资源类型 (ResourceType)
| 类型 | 说明 | 图标颜色 |
|------|------|----------|
| WORD | Word 文档 | #2b579a |
| PDF | PDF 文档 | #f40f02 |
| EPUB | 电子书 | #9c27b0 |
| WEB | 网页链接 | 主题色 |
| IMAGE | 图片 | 主题色 |

### 视图模式 (ViewMode)
| 模式 | 说明 |
|------|------|
| LIST_DETAIL | 侧边栏 → 列表 → 详情预览 |
| TABLE | 侧边栏 → 完整表格 |
| GRID | 侧边栏 → 网格 → 详情预览 |

## 与浏览器扩展联动

本桌面客户端与 `browser-extension` 浏览器扩展配合使用：
- 浏览器扩展负责网页内容的快速捕获
- 桌面客户端提供完整的资料管理功能
- 两者通过 Supabase 云端数据同步实现联动

## 开发状态

### 已完成
- [x] 主界面布局（TopBar、Sidebar、内容区）
- [x] 三种视图模式（列表、表格、网格）
- [x] 预览面板
- [x] 文件夹树形结构
- [x] 标签树形结构
- [x] 多维度过滤系统
- [x] 主题系统（6 个预设主题）
- [x] 认证对话框 UI
- [x] Supabase 客户端集成
- [x] 响应式设计
- [x] 文件拖拽导入
- [x] 文档内容预览（Details/Preview 双标签页）
- [x] 快捷键支持
- [x] 数据导入/导出 UI（JSON/CSV）
- [x] 多语言支持 (i18n)
- [x] Electron 桌面应用打包
- [x] 实际文件路径管理（收藏、最近打开、文件统计）
- [x] 文档全文内容预览（PDF/EPUB 内嵌渲染）
- [x] AI 智能摘要功能

### 待实现
- [ ] 无（所有计划功能已完成）

## 设计风格

- **设计语言**: macOS Monterey 风格
- **配色**: 深色主题（#1a1a1a, #1e1e1e, #252525）
- **字体**: Inter，系统字体回退
- **特效**: 毛玻璃效果 (backdrop-filter)
- **图标**: Google Material Symbols Outlined

## 许可证

MIT License
