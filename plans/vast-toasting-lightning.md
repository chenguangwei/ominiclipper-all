# Ominiclipper Desktop 实现规划

## 项目概述

Ominiclipper 是一个资料收藏和管理桌面客户端，用于收藏和管理网站、文章、文档（Word、PDF）、图片和文件路径链接。

## 技术栈

- **框架**: Electron
- **构建工具**: Vite
- **脚手架**: electron-vite
- **UI 框架**: TailwindCSS
- **前端框架**: Vue 3
- **状态管理**: Pinia
- **存储**: 本地 SQLite + 云端同步 (Pro 会员)

## 核心功能模块

### 1. 资料收藏管理
- 网站收藏 (URL 书签)
- 文章收藏 (网页剪藏)
- 文档收藏 (Word、PDF、EPUB)
- 图片收藏
- 文件路径链接

### 2. 分类系统
- 标签系统 (支持层级标签)
- 颜色标记 (红、橙、黄、绿、蓝)
- 智能分类 (所有项目、已加星)
- 拖拽分类

### 3. 显示模式
- 卡片视图 (预览模式)
- 列表视图 (表格模式)
- 详情面板

### 4. 搜索与筛选
- 全局搜索
- 多条件筛选
- 标签筛选
- 颜色筛选

### 5. 浏览器扩展联动
- Chrome 扩展
- 数据同步协议

### 6. 存储系统
- 本地存储 (library 目录结构)
- 云端同步 (Pro 会员功能)

## UI 设计规范

基于参考样式文件分析：

### 视觉风格
- **暗色主题**: 背景色 `#1a1a1a` / `#1e1e1e` / `#252525`
- **macOS 风格**: 毛玻璃效果、圆角控件、红绿灯按钮
- **主色调**: `#2b8cee` (蓝色)

### 颜色系统
```
primary: #2b8cee
word-blue: #2b579a
pdf-red: #f40f02
epub-purple: #9c27b0
tag-blue: #007aff
tag-green: #34c759
tag-orange: #ff9500
tag-red: #ff3b30
tag-yellow: #ffcc00
```

### 布局结构
1. **顶部标题栏**: 搜索框、视图切换、添加按钮
2. **筛选条**: 当前活动筛选标签
3. **左侧边栏**: 智能分类、颜色标记、标签树
4. **主内容区**: 卡片/列表视图
5. **详情面板**: 选中项目详情
6. **底部状态栏**: 选中信息、操作按钮

### 字体
- Inter 字体族
- SF Pro Display (macOS 备选)

## 项目结构规划

```
ominiclipper-desktop/
├── electron/                 # Electron 主进程
│   ├── main/                # 主进程代码
│   │   ├── index.ts         # 入口
│   │   ├── ipc.ts           # IPC 通信
│   │   └── storage.ts       # 数据存储
│   ├── preload/             # 预加载脚本
│   └── utils/               # 工具函数
├── src/                     # 渲染进程 (前端)
│   ├── assets/              # 静态资源
│   ├── components/          # 通用组件
│   │   ├── common/          # 基础组件
│   │   ├── layout/          # 布局组件
│   │   └── items/           # 资料项组件
│   ├── views/               # 页面视图
│   ├── stores/              # 状态管理
│   ├── services/            # 业务服务
│   ├── types/               # TypeScript 类型
│   └── utils/               # 工具函数
├── library/                 # 本地资料库
│   ├── documents/           # 文档存储
│   ├── images/              # 图片存储
│   └── database.db          # SQLite 数据库
├── browser-extension/       # 浏览器扩展
└── resources/               # 应用资源
```

## 数据模型

### Item (收藏项)
```typescript
interface Item {
  id: string;
  type: 'website' | 'article' | 'document' | 'image' | 'file';
  title: string;
  url?: string;
  filePath?: string;
  thumbnail?: string;
  description?: string;
  tags: string[];
  color?: 'red' | 'orange' | 'yellow' | 'green' | 'blue';
  starred: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Tag (标签)
```typescript
interface Tag {
  id: string;
  name: string;
  parentId?: string;
  color?: string;
  itemCount: number;
}
```

## 实施阶段

### Phase 1: 项目搭建
1. 使用 electron-vite 初始化项目
2. 配置 TailwindCSS
3. 设置项目结构
4. 配置开发环境

### Phase 2: 核心 UI 实现
1. 实现主窗口布局
2. 实现侧边栏组件
3. 实现卡片视图
4. 实现列表视图
5. 实现详情面板

### Phase 3: 数据层
1. 设计数据库 schema
2. 实现 SQLite 存储
3. 实现 IPC 通信
4. 实现状态管理

### Phase 4: 核心功能
1. 实现资料添加
2. 实现标签管理
3. 实现搜索筛选
4. 实现拖拽分类

### Phase 5: 扩展功能
1. Chrome 扩展开发
2. 桌面端与扩展的数据同步协议
3. 云端同步 (Pro)

## 验证方法

1. 运行 `npm run dev` 启动开发环境
2. 验证 UI 与参考样式一致
3. 测试各类资料的添加和管理
4. 测试搜索和筛选功能
5. 测试卡片/列表视图切换

## 待确认事项

1. ~~前端框架选择~~ -> 已确认: Vue 3
2. ~~浏览器扩展支持~~ -> 已确认: 仅 Chrome
3. Chrome 扩展与桌面端的具体通信协议?
4. Pro 会员云端存储的后端方案?
