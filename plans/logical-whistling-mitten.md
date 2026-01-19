# Ominiclipper Desktop 实施计划

## 项目概述

构建一个桌面资料收藏客户端，支持收藏网站、文章、文档（Word、PDF、EPUB）、图片和文件路径链接。采用 macOS 风格深色主题，支持标签分类、颜色标记、卡片/列表视图切换。

## 技术栈

- **框架**: Electron + electron-vite
- **前端**: Vue 3 + TypeScript
- **构建工具**: Vite
- **样式**: TailwindCSS
- **状态管理**: Pinia
- **本地存储**: SQLite (better-sqlite3)
- **国际化**: vue-i18n (中英双语)
- **图标**: Material Symbols
- **浏览器插件通信**: WebSocket 本地服务

---

## 实施阶段

### 阶段 1: 项目初始化与基础架构

#### 1.1 项目脚手架搭建
- [ ] 使用 electron-vite 初始化项目结构
- [ ] 配置 package.json 完整依赖
- [ ] 配置 TypeScript (tsconfig.json)
- [ ] 配置 TailwindCSS 及自定义主题色
- [ ] 配置 ESLint + Prettier

#### 1.2 目录结构创建
```
ominiclipper-desktop/
├── electron/
│   ├── main/
│   │   └── index.ts          # Electron 主进程
│   ├── preload/
│   │   └── index.ts          # 预加载脚本
│   └── utils/
│       └── database.ts       # SQLite 工具
├── src/
│   ├── components/
│   │   ├── layout/           # 布局组件
│   │   ├── common/           # 通用组件
│   │   └── resource/         # 资源相关组件
│   ├── views/
│   │   └── MainView.vue      # 主视图
│   ├── stores/
│   │   ├── resource.ts       # 资源状态
│   │   └── tag.ts            # 标签状态
│   ├── services/
│   │   ├── database.ts       # 数据库服务
│   │   └── resource.ts       # 资源服务
│   ├── locales/
│   │   ├── zh-CN.ts          # 中文
│   │   └── en-US.ts          # 英文
│   ├── types/
│   │   └── index.ts          # 类型定义
│   ├── App.vue
│   └── main.ts
├── browser-extension/         # 浏览器插件
│   ├── manifest.json
│   ├── popup/
│   ├── content/
│   └── background/
├── library/                   # 本地资源库
├── resources/                 # 应用资源
└── electron-vite.config.ts
```

#### 1.3 Electron 主进程配置
- [ ] 创建窗口配置（无边框、macOS 样式）
- [ ] 配置 IPC 通信
- [ ] 集成 better-sqlite3

---

### 阶段 2: 数据层实现

#### 2.1 数据库设计
```sql
-- 资源表
CREATE TABLE resources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,        -- website/article/document/image/file_link
  url TEXT,
  file_path TEXT,
  content TEXT,
  thumbnail TEXT,
  color TEXT,                -- 颜色标记
  starred INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

-- 标签表
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  parent_id TEXT,
  FOREIGN KEY (parent_id) REFERENCES tags(id)
);

-- 资源-标签关联表
CREATE TABLE resource_tags (
  resource_id TEXT,
  tag_id TEXT,
  PRIMARY KEY (resource_id, tag_id),
  FOREIGN KEY (resource_id) REFERENCES resources(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);
```

#### 2.2 类型定义
- [ ] Resource 类型（包含各种资源类型）
- [ ] Tag 类型（支持层级）
- [ ] Filter 类型（筛选条件）

#### 2.3 数据服务
- [ ] ResourceService: CRUD 操作
- [ ] TagService: 标签管理
- [ ] SearchService: 搜索功能

---

### 阶段 3: UI 组件开发

#### 3.1 布局组件
- [ ] **AppHeader.vue**: 顶部栏（交通灯按钮、搜索框、添加按钮）
- [ ] **FilterBar.vue**: 过滤条（当前筛选标签展示）
- [ ] **Sidebar.vue**: 侧边栏（Smart Feed、颜色、标签树）
- [ ] **MainContent.vue**: 主内容区

#### 3.2 资源列表组件
- [ ] **ResourceList.vue**: 资源列表容器
- [ ] **ResourceCard.vue**: 卡片视图项
- [ ] **ResourceRow.vue**: 表格视图行
- [ ] **ResourceDetail.vue**: 资源详情面板

#### 3.3 通用组件
- [ ] **TagChip.vue**: 标签徽章
- [ ] **ColorDot.vue**: 颜色标记点
- [ ] **ViewToggle.vue**: 视图切换按钮
- [ ] **SearchInput.vue**: 搜索输入框
- [ ] **IconButton.vue**: 图标按钮

#### 3.4 标签组件
- [ ] **TagTree.vue**: 标签树形列表
- [ ] **TagItem.vue**: 单个标签项（支持展开/折叠）
- [ ] **ColorPicker.vue**: 颜色选择器

---

### 阶段 4: 状态管理

#### 4.1 Pinia Stores
- [ ] **useResourceStore**: 资源列表、当前选中、筛选状态
- [ ] **useTagStore**: 标签列表、标签操作
- [ ] **useUIStore**: 视图模式、侧边栏状态

---

### 阶段 5: 核心功能实现

#### 5.1 资源管理
- [ ] 添加资源（支持多种类型）
- [ ] 编辑资源
- [ ] 删除资源
- [ ] 资源详情查看

#### 5.2 标签系统
- [ ] 创建/编辑/删除标签
- [ ] 标签层级管理
- [ ] 拖拽资源到标签进行分类
- [ ] 多标签筛选

#### 5.3 颜色标记
- [ ] 颜色选择与标记
- [ ] 按颜色筛选

#### 5.4 搜索与筛选
- [ ] 全文搜索
- [ ] 组合筛选（标签 + 颜色 + 类型）
- [ ] 智能分类（All Items、Starred）

#### 5.5 视图切换
- [ ] 卡片视图
- [ ] 表格/列表视图
- [ ] 排序功能

---

### 阶段 6: 国际化支持

#### 6.1 vue-i18n 配置
- [ ] 安装配置 vue-i18n
- [ ] 创建中文语言包 (zh-CN.ts)
- [ ] 创建英文语言包 (en-US.ts)
- [ ] 语言切换功能

#### 6.2 界面文本国际化
- [ ] 侧边栏菜单文本
- [ ] 按钮和操作提示
- [ ] 表单标签和占位符
- [ ] 系统消息和通知

---

### 阶段 7: 浏览器插件开发

#### 7.1 Chrome 扩展基础
- [ ] manifest.json (Manifest V3)
- [ ] popup 界面（快速保存）
- [ ] content script（页面信息提取）
- [ ] background service worker

#### 7.2 桌面端 WebSocket 服务
- [ ] 在 Electron 主进程启动 WebSocket 服务器
- [ ] 定义通信协议（保存资源、同步状态）
- [ ] 连接状态管理

#### 7.3 插件功能
- [ ] 一键保存当前页面
- [ ] 选择文本/图片保存
- [ ] 标签快速选择
- [ ] 与桌面端实时同步

---

### 阶段 8: 进阶功能

#### 8.1 文件处理
- [ ] 本地文件路径链接
- [ ] 文件预览（PDF、图片）
- [ ] 拖拽导入文件

#### 8.2 云端同步（Pro 功能预留）
- [ ] 同步状态标识
- [ ] 数据导出/导入

---

## 关键文件清单

| 文件路径 | 描述 |
|---------|------|
| `electron-vite.config.ts` | 构建配置 |
| `tailwind.config.js` | TailwindCSS 主题配置 |
| `electron/main/index.ts` | Electron 主进程 |
| `electron/main/websocket.ts` | WebSocket 服务（插件通信） |
| `electron/preload/index.ts` | 预加载脚本 |
| `src/App.vue` | 根组件 |
| `src/views/MainView.vue` | 主视图 |
| `src/components/layout/AppHeader.vue` | 顶部栏 |
| `src/components/layout/Sidebar.vue` | 侧边栏 |
| `src/components/resource/ResourceCard.vue` | 资源卡片 |
| `src/components/resource/ResourceRow.vue` | 资源表格行 |
| `src/stores/resource.ts` | 资源状态管理 |
| `src/stores/tag.ts` | 标签状态管理 |
| `src/services/database.ts` | 数据库服务 |
| `src/locales/zh-CN.ts` | 中文语言包 |
| `src/locales/en-US.ts` | 英文语言包 |
| `src/types/index.ts` | 类型定义 |
| `browser-extension/manifest.json` | 插件配置 |
| `browser-extension/popup/index.html` | 插件弹出界面 |
| `browser-extension/background/service-worker.js` | 后台服务 |

---

## 样式规范（参考 example-style）

### 颜色配置
```js
colors: {
  primary: "#2b8cee",
  "background-dark": "#1e1e1e",
  "mac-sidebar": "rgba(255, 255, 255, 0.05)",
  "word-blue": "#2b579a",
  "pdf-red": "#f40f02",
  "epub-purple": "#9c27b0",
  "tag-blue": "#007aff",
  "tag-green": "#34c759",
  "tag-orange": "#ff9500",
  "tag-red": "#ff3b30",
  "tag-yellow": "#ffcc00"
}
```

### UI 特性
- macOS 风格毛玻璃效果 (`backdrop-filter: blur(25px)`)
- 圆角设计
- 深色主题
- Material Symbols 图标

---

## 验证方案

1. **开发环境验证**
   ```bash
   npm run dev
   ```
   - 确认 Electron 窗口正常启动
   - 确认 Vue 热重载正常

2. **UI 验证**
   - 对比 example-style HTML 检查样式一致性
   - 测试卡片/列表视图切换
   - 测试侧边栏交互

3. **功能验证**
   - 添加/编辑/删除资源
   - 标签创建与分配
   - 搜索与筛选
   - 数据持久化（重启后数据保留）

4. **构建验证**
   ```bash
   npm run build
   npm run package
   ```
   - 确认打包成功

---

## 预计产出

完成后将交付一个功能完整的桌面资料收藏应用，具备：
- 优雅的 macOS 风格深色界面
- 多类型资源收藏支持
- 灵活的标签分类系统
- 便捷的搜索与筛选
- 卡片/列表双视图模式
- 本地 SQLite 数据持久化
- 中英文双语界面
- Chrome 浏览器插件联动

---

## 浏览器插件通信协议

### WebSocket 消息格式

```typescript
interface Message {
  type: 'SAVE_RESOURCE' | 'GET_TAGS' | 'SYNC_STATUS' | 'PING';
  payload: any;
  requestId: string;
}

// 保存资源
interface SaveResourcePayload {
  title: string;
  url: string;
  type: 'website' | 'article';
  content?: string;
  thumbnail?: string;
  tags?: string[];
}

// 响应格式
interface Response {
  requestId: string;
  success: boolean;
  data?: any;
  error?: string;
}
```

### 端口配置
- 默认端口: 23789
- 协议: ws://localhost:23789
