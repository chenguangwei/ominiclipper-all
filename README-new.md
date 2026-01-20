
## 第一部分：产品设计 (Product Strategy)
核心理念： 用户只管“丢进去”，AI 负责“理出来”。 消灭“整理”这个动作，重塑“调用”的体验。

| 痛点 | 传统方式 | AI Native 解决方案 |
| :--- | :--- | :--- |
| **存储焦虑** | 这个文件该放哪个文件夹？ | **无感归档**：建立一个“黑洞”入口（悬浮窗/监控文件夹），用户只管往里拖，AI 根据内容自动打标签、分类。 |
| **检索困难** | 忘记文件名，只记得“大概内容” | **语义检索**：搜“上周那个红色背景的PPT”或“关于Q3财报的数据”，而不是搜文件名。 |
| **信息孤岛** | 网页在收藏夹，文档在硬盘，图片在相册 | **全模态统一**：打破格式壁垒，网页、PDF、图片中的文字都被拉平为“知识切片”，统一管理。 |
| **难以利用** | 文档是死的，无法交互 | **Chat with Data**：基于你的私人库进行问答。例如：“基于我收集的所有竞品分析报告，帮我写一个总结。” |



以下是将您提供的内容转换整理后的 Markdown 表格：

| 核心模块 | 当前代码实现 (Status: Current) | 理想设计目标 (Goal: Ideal) | 评价 & 风险 |
| :--- | :--- | :--- | :--- |
| **数据存储** | **JSON 文件流 (Eagle 模式)**<br>`itemMetadataService.ts` 读写 json 文件 | **向量数据库 + 关系型数据库**<br>(LanceDB + SQLite) | **高风险**。纯 JSON 文件无法进行向量搜索（语义搜索），且文件多了 IO 会卡死。 |
| **AI 能力** | **纯云端 API 调用**<br>`aiClassifier.ts` 调用 OpenAI/DeepSeek | **本地 + 云端混合 (Hybrid)**<br>(本地 Embedding + 本地 LLM + 云端 GPT) | **功能缺失**。目前没有 Embedding 过程，无法实现 "Chat with Data"（与数据对话）。 |
| **通信安全** | **无鉴权 HTTP 服务**<br>`httpServer.cjs` 允许任何来源 | **基于 Token 的安全通信** | **安全隐患**。任何本地网页都能向你的应用发请求。 |
| **搜索能力** | **仅标签/文件名匹配** | **语义搜索 (RAG)** | 目前只能搜 "合同"，搜不到 "关于赔偿的条款"。 |
| **文件解析** | **基础文本提取**<br>(依赖 `pdfjs-dist` 等) | **多模态 ETL**<br>(OCR, 表格还原, 布局分析) | 目前对 PDF/图片的解析能力较弱，AI 读不懂复杂文档。 |


"SaaS 核心 (OpenRouter/后端) + 隐形本地化 (Transformers.js/LanceDB)" 混合分层架构，以下是为你整理的
## 完整最终落地计划列表 (Master Plan)。

Phase 1: 构建 "潜意识" (The Local Subconscious)
目标：不依赖网络，实现文件的 "秒级语义搜索" 和 "智能关联"。这是用户体验的基石，也是降低 SaaS 成本的关键（高频操作本地化）。

1.1 引入核心依赖

[ ] 在 ominiclipper-desktop 安装向量数据库：npm install @lancedb/lancedb apache-arrow

[ ] 安装本地推理引擎：npm install @xenova/transformers

[ ] 配置 Electron 构建脚本 (electron-builder)，确保 native 模块正确打包（Unpack .node files）。

1.2 开发 VectorStoreService (Electron 主进程)

[ ] 初始化：服务启动时检测并下载 Embedding 模型 (Xenova/all-MiniLM-L6-v2 )。

[ ] 向量化管道：实现 generateEmbedding(text) 函数。

[ ] CRUD 接口：实现 upsertDocument(id, text, metadata) 和 deleteDocument(id)。

[ ] 搜索接口：实现 search(query, limit)，返回相关文档 ID 和相似度分数。

1.3 接入数据流水线 (Data Pipeline)

[ ] 挂载 IPC：在 main.ts 中暴露 vector-index 和 vector-search 给渲染进程。

[ ] 自动索引：修改 fileManager 或 storageService，在文件导入/保存时，自动提取 contentSnippet 并调用 vector-index。

[ ] 存量扫描：编写一个 Migration 脚本，启动时扫描所有旧文件并建立索引。

1.4 升级搜索体验 (UI)

[ ] 修改 TopBar 的搜索框逻辑。

[ ] 当用户输入时，同时触发 关键词匹配 (现有的) 和 向量搜索 (新增的)，混合排序展示结果。

☁️ Phase 2: 构建 "云大脑" (The Cloud Conscious)
目标：建立 SaaS 商业闭环，处理深度思考任务（Chat with Data），并管控 Token 成本。

2.1 数据库与鉴权 (Supabase)

[ ] Schema 部署：在 Supabase 执行我们设计的 SQL（profiles, resources 表及 RLS 策略）。

[ ] 客户端改造：

在 .env 中配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_KEY。

重构 supabaseClient.ts，移除 localStorage 读取逻辑，使用环境变量。

重构 AuthDialog.tsx，移除 "Connection" 设置页，仅保留 登录/注册 UI。

2.2 订阅与权限系统

[ ] 状态同步：升级 subscriptionManager.ts，启动时从 profiles 表拉取 is_pro 和 usage 字段。

[ ] 权限门禁：在 UI 层实现功能锁定（例如：免费用户只能存 100 个文件，Pro 用户无限）。

2.3 API 网关 (后端服务)

[ ] 选型：使用 Supabase Edge Functions (Deno) 或 独立的 Node.js 服务。

[ ] 开发 /chat 接口：

验证 Supabase User Token。

检查用户 Token 余额。

代理转发请求到 OpenRouter (调用 GPT-4o 或 Claude 3.5)。

扣除用户 Token 额度。

🔗 Phase 3: 端云联动 (The Link)
目标：将 "本地潜意识" 检索到的信息，喂给 "云大脑" 进行思考，完成 RAG (检索增强生成) 闭环。

3.1 实现 RAG 问答链路

[ ] UI 新增：在侧边栏或底部增加 "AI 助手" 对话框。

[ ] 流程实现：

用户提问 "我的保险合同里免赔额是多少？"

调用本地 VectorStoreService 搜索 Top 3 相关文档片段。

将片段 + 问题组装成 Prompt。

发送给云端 API 网关。

流式展示回答。

3.2 智能辅助分类 (本地化)

[ ] 利用向量距离实现 "猜你喜欢" 的文件夹归类（如果新文件向量接近 "发票" 文件夹的中心向量，自动推荐）。

3.3 隐私与设置优化

[ ] 清理设置页面，移除复杂的模型配置。

[ ] 增加 "隐私模式" 开关（开启后仅使用本地能力，禁用云端问答）。

✅ Immediate Action Items (立即执行项)
这是你现在打开编辑器需要做的第一批任务：

Supabase 部署：登录 Supabase 后台，运行 SQL Schema 脚本。

代码清理：

配置项目根目录 .env。

替换 supabaseClient.ts 为自动读取环境变量的版本。

修改 AuthDialog.tsx，删除配置输入界面，只留登录注册。

本地 AI 验证：

安装 lancedb 和 transformers。

创建 electron/services/vectorStoreService.ts 并跑通 "文本 -> 向量" 的 Hello World 测试。