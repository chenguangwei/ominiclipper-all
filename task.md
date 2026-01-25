# OmniClipper 实现状态 Review 任务清单

## 基础功能实现状态核查

### 桌面客户端核心功能
- [x] 文件管理（文件夹、标签、颜色分类）
- [x] 多视图支持（列表、网格、表格）
- [x] 文档预览（PDF、DOCX、Markdown、图片、Web）
- [x] 文件存储服务（Eagle 风格）
- [x] 本地数据持久化（JSON）
- [x] 文件备份与恢复
- [x] 导入导出功能（JSON/CSV）
- [x] 批量导入服务
- [x] 国际化支持（中英文）

### 浏览器插件核心功能
- [x] 内容脚本注入
- [x] 网页元数据提取
- [x] 文章内容提取（类似 Readability）
- [x] 选区文本捕获
- [x] 图片捕获（截图功能）
- [x] 与桌面客户端同步（syncToDesktopAsync）
- [ ] 浏览器插件 UI 完善（popup 界面）
- [ ] 右键菜单功能集成
- [ ] 拖拽图片保存功能
- [ ] 区域截图功能完善
- [ ] 整页截图功能完善

## AI 功能实现状态核查

### 本地 AI 能力
- [x] 向量搜索服务（LanceDB + Transformers.js）
- [x] Embedding 模型集成（all-MiniLM-L6-v2）
- [x] 向量数据库（LanceDB）
- [x] BM25 全文搜索（SQLite FTS5）
- [x] 文本分块服务
- [x] 混合搜索服务（向量 + BM25）
- [ ] 自动索引已有文档
- [ ] 文档导入时自动建立索引
- [ ] 向量搜索 UI 集成到搜索框

### AI 助手功能
- [x] AI 聊天服务框架
- [x] AI 助手 UI 组件
- [x] LLM 集成（OpenAI、Anthropic、DeepSeek、SiliconFlow）
- [x] Chat with Data 基础架构
- [ ] RAG 问答链路完整实现
- [ ] 基于私人库的上下文问答
- [ ] 智能文档分类建议

### AI 分类功能
- [x] AI 分类器服务
- [x] 规则引擎
- [x] 规则配置管理
- [ ] 基于向量距离的智能推荐
- [ ] 自动分类批量处理

## 云端功能实现状态核查

### Supabase 集成
- [x] Supabase 客户端配置
- [x] 环境变量读取（.env）
- [x] 用户认证（登录、注册、登出）
- [x] 用户配置文件（profiles 表）
- [x] 订阅管理服务
- [x] Token 配额追踪
- [ ] 云端数据库 Schema 部署
- [ ] RLS（Row Level Security）策略
- [ ] 资源云端同步
- [ ] 云端备份功能

### 订阅与权限系统
- [x] 免费/Pro 用户区分
- [x] Token 使用量追踪
- [x] 配额检查
- [ ] Stripe 支付集成
- [ ] 订阅续费逻辑
- [ ] 功能门禁 UI 实现

## 待优化和完善事项

### 功能完善
- [ ] 文档拖拽导入优化（embed/reference 模式选择）
- [ ] 文件夹迁移功能测试
- [ ] 缩略图生成优化
- [ ] 内容提取服务增强（OCR、表格还原）
- [ ] 多模态文档解析

### 架构优化
- [ ] 清理 AuthDialog 配置输入界面
- [ ] 统一错误处理机制
- [ ] 性能优化（大量文件场景）
- [ ] 内存管理优化
- [ ] 日志系统完善

### 安全性
- [ ] httpServer 添加 Token 鉴权
- [ ] IPC 通信安全加固
- [ ] 用户数据加密存储

### 测试与文档
- [ ] 单元测试覆盖
- [ ] 集成测试
- [ ] E2E 测试
- [ ] API 文档完善
- [ ] 用户使用文档

## README-new.md 目标对照

### Phase 1: 构建"潜意识"（本地能力）
- [x] 安装 @lancedb/lancedb 和 apache-arrow
- [x] 安装 @xenova/transformers
- [x] Investigate and fix "View" button regression in Preview Pane <!-- id: 1 -->
- [x] Fix data persistence/reset issue on reload <!-- id: 2 -->
- [x] VectorStoreService 实现
- [x] generateEmbedding 函数
- [x] CRUD 接口（upsert、delete）
- [x] 搜索接口
- [x] IPC 暴露（vector-index、vector-search）
- [ ] 自动索引（文件导入时）
- [ ] 存量数据扫描脚本
- [ ] UI 层混合搜索集成

### Phase 2: 构建"云大脑"（SaaS）
- [x] Supabase Schema 设计
- [/] Supabase 客户端配置（环境变量）
- [ ] Supabase Schema 部署
- [x] 订阅与权限系统
- [ ] API 网关（Edge Functions）
- [ ] /chat 接口实现
- [ ] Token 扣费逻辑
- [ ] Stripe 集成

### Phase 3: 端云联动
- [/] RAG 问答链路（部分实现）
- [ ] AI 助手对话框优化
- [ ] 基于向量的智能分类
- [ ] 隐私模式开关

## 立即执行项（按优先级排序）

### P0 - 关键功能
1. [ ] 部署 Supabase Schema
2. [ ] 实现文档自动索引（导入时触发）
3. [ ] 完善 RAG 问答链路
4. [ ] 集成混合搜索到 UI

### P1 - 重要优化
5. [ ] 浏览器插件 UI 完善
6. [ ] 清理 AuthDialog 配置界面
7. [ ] httpServer 安全加固
8. [ ] 缩略图生成优化

### P2 - 体验优化
9. [ ] 智能分类推荐
10. [ ] 批量处理优化
11. [ ] 性能优化（大量文件）
12. [ ] 错误处理完善

## 未实现功能清单

### README.md 原始目标对照
1. [ ] 浏览器插件完整 UI（popup）
2. [ ] 右键菜单完整功能
3. [ ] 拖拽图片保存
4. [ ] 区域截图/整页截图优化
5. [ ] Excel、PPT 文档预览
6. [ ] 文档 OCR 功能
7. [ ] 表格还原功能
8. [ ] Pro 会员云端存储
9. [ ] Stripe 支付集成
10. [ ] 自动文件夹创建和归类
