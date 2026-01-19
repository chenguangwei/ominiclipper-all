# 浏览器插件 - 信息收集助手计划

## 项目概述
构建一个浏览器插件，方便用户收集记录信息，支持分类管理、数据持久化（本地 + 飞书多维表格）。

## 技术栈
- **Manifest V3** (Chrome 官方推荐)
- **原生 HTML/CSS/JavaScript** (无框架依赖)
- **IndexedDB** (本地数据存储)
- **飞书开放平台 API** (多维表格同步)

## 核心功能

### 1. 分类管理
- 用户可创建、编辑、删除分类
- 每个分类独立配置收集模板
- 预设分类：网址收集、内容收集

### 2. 收集功能
- **网址收集**：输入 URL + 标题 + 描述
- **内容收集**：Markdown 编辑器（支持实时预览）
- 自动获取当前页面标题和 URL

### 3. 数据存储
- **本地存储**：IndexedDB + JSON 导出/导入
- **飞书同步**：多维表格 API 集成

## 项目结构

```
record-something/
├── manifest.json          # 插件配置
├── popup/                 # 弹窗页面
│   ├── index.html
│   ├── styles.css
│   └── popup.js
├── options/               # 选项页面（设置）
│   ├── index.html
│   ├── styles.css
│   └── options.js
├── content/               # 内容脚本
│   └── content.js         # 右键菜单/页面选择
├── background/            # 后台服务
│   └── service-worker.js  # 处理同步、API 调用
├── libs/                  # 第三方库
│   ├── marked.min.js      # Markdown 渲染
│   └── feather-icons.min.js # 图标库
├── storage/               # 存储模块
│   └── db.js              # IndexedDB 操作
├── feishu/                # 飞书 API 模块
│   └── api.js             # 多维表格操作
└── styles/                # 全局样式
    └── common.css
```

## 实现步骤

### 步骤 1：项目初始化
- 创建 `manifest.json` (V3)
- 搭建基础目录结构

### 步骤 2：本地存储模块
- 实现 IndexedDB 封装
- 实现分类 CRUD 操作
- 实现记录 CRUD 操作
- 实现导出/导入功能

### 步骤 3：Popup 界面
- 分类选择器
- 动态表单渲染
- 记录列表查看

### 步骤 4：Markdown 编辑器
- 集成 marked.js
- 编辑 + 预览双栏布局

### 步骤 5：飞书多维表格集成
- 申请飞书应用
- 实现 OAuth 认证
- 实现多维表格 CRUD API 封装

### 步骤 6：内容脚本
- 右键菜单扩展
- 一键收集当前页面

### 步骤 7：选项页面
- 分类管理
- 飞书配置
- 数据导出/导入

## 关键文件

| 文件 | 作用 |
|------|------|
| `manifest.json` | 插件配置、权限声明 |
| `storage/db.js` | IndexedDB 本地存储 |
| `feishu/api.js` | 飞书 API 封装 |
| `popup/popup.js` | 弹窗主逻辑 |
| `options/options.js` | 设置页面逻辑 |

## 验证方式

1. **加载插件**：`chrome://extensions/` 开启开发者模式，点击"加载解压的扩展程序"
2. **测试收集**：点击插件图标，添加网址和内容记录
3. **测试存储**：刷新后数据应仍存在
4. **测试导出**：导出 JSON 文件，检查格式正确
5. **测试飞书**：配置飞书 Token 后，测试同步功能

## 待确认问题

1. [x] 飞书多维表格的字段结构是否需要指定？ → **用户自己创建**
2. [x] 是否需要支持多端同步（多个浏览器）？ → **需要，通过飞书同步**
3. [ ] ~~分类图标自定义~~ (延后实现)
