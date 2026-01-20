# OmniClipper AI Native 产品升级 - 专业分析与落地计划

## 一、现状评估 (Status Assessment)

### 1.1 已完成的优秀基础 ✅

| 模块 | 实现情况 | 评价 |
|------|----------|------|
| **UI/UX** | React 19 + Tailwind，3种视图模式，完整的文件夹/标签系统 | 🟢 生产级 |
| **AI 分类** | 多 LLM 提供商支持 (OpenAI/Claude/DeepSeek/SiliconFlow) | 🟢 架构良好 |
| **内容提取** | PDF.js/EPUB.js/docx-preview，支持多格式 | 🟡 基础够用 |
| **存储架构** | Eagle 风格 JSON + localStorage 降级 | 🟡 需要升级 |
| **浏览器扩展** | Manifest v3，多端同步，离线队列 | 🟢 功能完整 |
| **云端集成** | Supabase Auth + RLS 策略 | 🟡 框架已搭建 |

### 1.2 核心差距分析 (Gap Analysis)

#### ❌ 致命缺失：语义搜索能力
- **现状**：只有关键词匹配 (`search` 字段 → 文件名/标签)
- **问题**：用户无法搜索"关于赔偿的条款"，只能搜"合同"
- **影响**：产品核心价值主张无法实现

#### ⚠️ 高风险：数据架构
- **现状**：纯 JSON 文件存储 (`library.json`)
- **问题**：无法存储向量、无法高效查询、大文件 IO 瓶颈
- **影响**：10,000+ 条目时性能悬崖

#### ⚠️ 功能缺失：Chat with Data
- **现状**：AI 只做分类，没有问答能力
- **问题**：无法"与数据对话"
- **影响**：丧失 AI Native 产品差异化

---

## 二、架构决策建议 (Architecture Decisions)

### 2.1 技术选型对比

| 方案 | 向量数据库 | Embedding | 优点 | 缺点 |
|------|-----------|-----------|------|------|
| **A. 纯本地** | LanceDB | Transformers.js (bge-m3) | 隐私好，无网络依赖 | 首次加载慢，模型 ~50MB |
| **B. 纯云端** | Supabase pgvector | OpenAI Embedding | 简单快速 | 成本高，隐私差 |
| **C. 混合架构 ⭐** | 本地 LanceDB + 云端备份 | 本地 bge-m3 + 云端 GPT-4o | 平衡隐私与能力 | 复杂度高 |

**已确认：方案 C - 混合架构 (本地优先 + 可选云同步)**

理由：
1. 高频搜索操作本地化 → 降低成本 80%+
2. 深度问答用云端 LLM → 保证质量
3. 离线可用 → 用户体验好
4. 数据本地优先 → 隐私友好
5. Pro 用户可选开启云端备份同步 → SaaS 收入来源

### 2.2 Embedding 模型选择 (已确定)

| 模型 | 维度 | 英语效果 | 大小 | 加载速度 |
|------|------|---------|------|---------|
| **all-MiniLM-L6-v2 ✅** | 384 | 🟢 顶级 | 23MB | <1秒 |
| bge-small-en-v1.5 | 384 | 🟢 优秀 | 33MB | ~1秒 |
| multilingual-e5-small | 384 | 🟢 良好 | 118MB | 2-3秒 |

**最终选择：all-MiniLM-L6-v2**
- ✅ 出海产品，英语优先
- ✅ 23MB 极小，加载秒级
- ✅ Sentence Transformers 标杆模型，生态成熟
- ⚠️ 中文效果一般，未来可通过多模型策略增强

---

## 三、分阶段实施计划 (Phased Implementation)

### Phase 1: 本地语义搜索 (The Foundation) - 关键路径

**目标**: 不依赖网络，实现秒级语义搜索

#### 1.1 安装依赖
```bash
# 在 ominiclipper-desktop 目录
npm install @lancedb/lancedb apache-arrow
npm install @xenova/transformers
```

#### 1.2 创建 VectorStoreService

**文件**: `electron/services/vectorStoreService.ts`

核心接口设计:
```typescript
interface VectorStoreService {
  // 初始化：加载模型和数据库
  initialize(): Promise<void>;

  // 向量化单条文本
  embed(text: string): Promise<Float32Array>;

  // 批量向量化
  embedBatch(texts: string[]): Promise<Float32Array[]>;

  // 添加/更新文档
  upsert(doc: { id: string; text: string; metadata: any }): Promise<void>;

  // 删除文档
  delete(id: string): Promise<void>;

  // 语义搜索
  search(query: string, limit?: number): Promise<SearchResult[]>;

  // 获取索引状态
  getStats(): Promise<{ totalDocs: number; lastUpdated: string }>;
}
```

#### 1.3 数据流水线改造

**关键文件修改清单**:

| 文件 | 改动 | 优先级 |
|------|------|--------|
| `electron/main.cjs` | 添加 IPC handlers: `vector-index`, `vector-search`, `vector-delete` | P0 |
| `services/storageService.ts` | 在 `saveItem()` 后调用向量索引 | P0 |
| `App.tsx` | 搜索逻辑改为混合模式 | P0 |
| `components/TopBar.tsx` | 添加"语义搜索"开关 UI | P1 |

#### 1.4 存量数据迁移

```typescript
// 启动时检查并索引旧数据
async function migrateExistingItems() {
  const items = await storageService.getAllItems();
  const unindexed = items.filter(item => !item.isVectorIndexed);

  for (const item of unindexed) {
    const text = `${item.title} ${item.contentSnippet || ''} ${item.tags.join(' ')}`;
    await vectorStore.upsert({ id: item.id, text, metadata: item });
    item.isVectorIndexed = true;
  }

  await storageService.batchSave(items);
}
```

---

### Phase 2: 云端智能 (The Brain)

**目标**: 建立 SaaS 商业闭环，提供 Chat with Data 能力

#### 2.1 Supabase 配置

**执行 SQL** (已在 `sql/user.sql` 中定义):
- `profiles` 表 - 用户档案 + 订阅状态
- `resources` 表 - 云端资源同步
- `folders` / `tags` 表 - 云端结构同步
- RLS 策略 - 行级安全

#### 2.2 代码改造清单

| 文件 | 改动 |
|------|------|
| `supabaseClient.ts` | 改为读取环境变量 `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY` |
| `components/AuthDialog.tsx` | 删除"连接设置"Tab，只保留登录/注册 |
| `services/subscriptionManager.ts` | 从 `profiles` 表同步 `is_pro` 和 `usage_tokens_this_month` |
| `.env` | 添加 Supabase 配置 |

#### 2.3 Token 用量管控

```typescript
// 每次 AI 调用前检查
async function checkQuota(estimatedTokens: number): boolean {
  const profile = await supabase.from('profiles').select('usage_tokens_this_month, is_pro');
  const limit = profile.is_pro ? 1_000_000 : 10_000; // Pro 100万, Free 1万
  return profile.usage_tokens_this_month + estimatedTokens <= limit;
}
```

---

### Phase 3: RAG 问答 (The Intelligence)

**目标**: 完成端云联动，实现"与数据对话"

#### 3.1 RAG 流程

```
用户提问 → 本地向量搜索 Top-K → 组装 Context → 云端 LLM → 流式返回
```

#### 3.2 关键组件

**新增文件**: `components/AIAssistant.tsx`

```typescript
// 核心交互流程
async function handleChat(question: string) {
  // 1. 本地语义搜索
  const relevantDocs = await vectorStore.search(question, 5);

  // 2. 构建 Prompt
  const context = relevantDocs.map(d => d.text).join('\n---\n');
  const prompt = `基于以下内容回答问题:\n${context}\n\n问题: ${question}`;

  // 3. 调用云端 LLM (流式)
  const response = await llmProvider.chat(prompt, { stream: true });

  // 4. 返回并展示
  return response;
}
```

#### 3.3 UI 集成位置

**推荐**: 在侧边栏底部添加"AI 助手"入口，点击展开对话面板

---

## 四、关键文件清单 (Critical Files)

### 需要新建的文件

| 路径 | 用途 |
|------|------|
| `electron/services/vectorStoreService.ts` | 向量数据库服务 |
| `electron/services/embeddingService.ts` | 本地 Embedding 服务 |
| `components/AIAssistant.tsx` | AI 对话组件 |
| `components/SemanticSearchToggle.tsx` | 搜索模式切换 |
| `.env.example` | 环境变量模板 |

### 需要修改的文件

| 路径 | 改动点 |
|------|--------|
| `electron/main.cjs` | 添加向量相关 IPC handlers |
| `electron/preload.js` | 暴露向量 API 到渲染进程 |
| `services/storageService.ts` | 保存时触发向量索引 |
| `App.tsx` | 搜索逻辑改为混合模式 |
| `components/TopBar.tsx` | 添加语义搜索 UI |
| `supabaseClient.ts` | 环境变量配置 |
| `components/AuthDialog.tsx` | 简化 UI |
| `services/subscriptionManager.ts` | 云端配额同步 |

---

## 五、风险与缓解 (Risks & Mitigation)

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Transformers.js 首次加载慢 | 用户体验差 | 启动时后台加载 + 进度提示 |
| LanceDB native 模块打包失败 | 无法构建 | 提前测试 electron-builder 配置 |
| 向量索引占用磁盘空间 | 存储膨胀 | 压缩 + 定期清理无效索引 |
| 云端 API 成本失控 | 亏损 | 严格配额 + 监控告警 |
| 本地模型精度不足 | 搜索质量差 | 保留关键词搜索作为补充 |

---

## 六、验证计划 (Verification)

### Phase 1 验收标准

1. **启动加载**: 应用启动时自动下载/加载 Embedding 模型，控制台显示进度
2. **索引测试**: 导入 10 个 PDF，检查向量数据库是否正确记录
3. **搜索测试**: 搜索"报销流程"，应返回内容相关但标题不含关键词的文件
4. **性能测试**: 1000 条目搜索 <100ms

### Phase 2 验收标准

1. **登录流程**: 用户可通过邮箱注册/登录
2. **配额显示**: 设置页显示本月已用 Token
3. **权限控制**: Free 用户触发 AI 功能时提示升级

### Phase 3 验收标准

1. **RAG 问答**: 提问"我的保险免赔额是多少"，正确返回相关文档内容
2. **流式输出**: AI 回复逐字显示，非阻塞等待
3. **引用标注**: 回答附带来源文档链接

---

## 七、产品建议 (Product Recommendations)

### 7.1 商业模式建议

| 层级 | 价格 | 功能 |
|------|------|------|
| **Free** | $0 | 本地存储 500 条目，语义搜索，基础 AI 分类 |
| **Pro** | $9.9/月 | 无限条目，100万 Token/月，云端同步，高级 AI 问答 |
| **Team** | $29/月/人 | Pro 全部 + 团队协作 + 管理后台 |

### 7.2 差异化定位

**核心 Slogan**: "丢进去就行，AI 帮你找"

**关键差异点**:
1. 🔒 **隐私优先**: 核心能力本地化，数据不出门
2. 🧠 **真正语义**: 不是关键词，是理解
3. 💬 **可对话**: 不只是存储，是私人知识助手

### 7.3 优先级建议

```
Phase 1 (语义搜索) > Phase 2 (云端订阅) > Phase 3 (RAG 问答)
```

理由：语义搜索是产品核心价值，没有它其他都是空中楼阁

---

## 八、立即行动项 (Immediate Actions)

开发者现在可以开始的任务：

### 第一步：环境验证 (30分钟)
```bash
cd ominiclipper-desktop
npm install @lancedb/lancedb apache-arrow @xenova/transformers
```

### 第二步：Hello World 测试 (1-2小时)
创建 `electron/services/vectorStoreService.ts`，实现：
1. 加载 `Xenova/all-MiniLM-L6-v2` 模型 (23MB，加载 <1秒)
2. 对一段英文文本生成 Embedding (384维向量)
3. 存入 LanceDB
4. 执行一次语义搜索测试

### 第三步：集成测试 (半天)
1. 挂载 IPC handlers
2. 在现有导入流程中调用向量索引
3. 修改搜索逻辑，混合关键词 + 语义结果

---

---

## 九、确定的技术决策总结

| 决策点 | 选择 | 理由 |
|--------|------|------|
| **功能优先级** | 语义搜索优先 | 产品核心价值基石 |
| **Embedding 模型** | all-MiniLM-L6-v2 | 出海产品英语优先，23MB 极小 |
| **数据存储策略** | 本地优先 + 可选云同步 | 隐私友好 + SaaS 收入 |
| **向量数据库** | LanceDB | 嵌入式、零配置、高性能 |
| **云端 LLM** | 复用现有多 Provider | OpenAI/Claude/DeepSeek |

---

## 十、Phase 1 详细实施步骤

### Step 1: 安装依赖 (5分钟)

```bash
cd ominiclipper-desktop
npm install @lancedb/lancedb apache-arrow @xenova/transformers
```

### Step 2: 创建 Embedding 服务 (30分钟)

**新建文件**: `electron/services/embeddingService.ts`

```typescript
import { pipeline, env } from '@xenova/transformers';

// 配置模型缓存路径
env.cacheDir = path.join(app.getPath('userData'), 'models');

class EmbeddingService {
  private embedder: any = null;
  private isLoading = false;

  async initialize(): Promise<void> {
    if (this.embedder || this.isLoading) return;
    this.isLoading = true;

    // 使用 all-MiniLM-L6-v2，23MB，加载 <1秒
    this.embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );

    this.isLoading = false;
  }

  async embed(text: string): Promise<Float32Array> {
    if (!this.embedder) await this.initialize();

    const output = await this.embedder(text, {
      pooling: 'mean',
      normalize: true
    });

    return output.data; // 384维向量
  }
}

export const embeddingService = new EmbeddingService();
```

### Step 3: 创建向量存储服务 (1小时)

**新建文件**: `electron/services/vectorStoreService.ts`

```typescript
import * as lancedb from '@lancedb/lancedb';
import { embeddingService } from './embeddingService';

interface VectorDocument {
  id: string;
  text: string;
  vector: Float32Array;
  metadata: {
    title: string;
    type: string;
    tags: string[];
    createdAt: string;
  };
}

class VectorStoreService {
  private db: any = null;
  private table: any = null;

  async initialize(dbPath: string): Promise<void> {
    this.db = await lancedb.connect(dbPath);

    // 检查或创建表
    const tables = await this.db.tableNames();
    if (tables.includes('documents')) {
      this.table = await this.db.openTable('documents');
    }
  }

  async upsert(doc: { id: string; text: string; metadata: any }): Promise<void> {
    const vector = await embeddingService.embed(doc.text);

    const record = {
      id: doc.id,
      text: doc.text,
      vector: Array.from(vector),
      metadata: JSON.stringify(doc.metadata)
    };

    if (!this.table) {
      this.table = await this.db.createTable('documents', [record]);
    } else {
      // LanceDB 支持 upsert 语义
      await this.table.add([record]);
    }
  }

  async search(query: string, limit = 10): Promise<any[]> {
    if (!this.table) return [];

    const queryVector = await embeddingService.embed(query);

    const results = await this.table
      .search(Array.from(queryVector))
      .limit(limit)
      .execute();

    return results.map(r => ({
      id: r.id,
      text: r.text,
      score: r._distance,
      metadata: JSON.parse(r.metadata)
    }));
  }

  async delete(id: string): Promise<void> {
    if (!this.table) return;
    await this.table.delete(`id = '${id}'`);
  }
}

export const vectorStoreService = new VectorStoreService();
```

### Step 4: 添加 IPC Handlers (30分钟)

**修改文件**: `electron/main.cjs`

```javascript
// 在现有 IPC handlers 下方添加

ipcMain.handle('vector-initialize', async () => {
  const dbPath = path.join(app.getPath('userData'), 'vector.lance');
  await vectorStoreService.initialize(dbPath);
  await embeddingService.initialize();
  return { success: true };
});

ipcMain.handle('vector-index', async (event, { id, text, metadata }) => {
  await vectorStoreService.upsert({ id, text, metadata });
  return { success: true };
});

ipcMain.handle('vector-search', async (event, { query, limit }) => {
  const results = await vectorStoreService.search(query, limit || 10);
  return results;
});

ipcMain.handle('vector-delete', async (event, { id }) => {
  await vectorStoreService.delete(id);
  return { success: true };
});
```

### Step 5: 暴露 API 到渲染进程 (10分钟)

**修改文件**: `electron/preload.js`

```javascript
// 在 contextBridge.exposeInMainWorld 中添加
vectorStore: {
  initialize: () => ipcRenderer.invoke('vector-initialize'),
  index: (id, text, metadata) => ipcRenderer.invoke('vector-index', { id, text, metadata }),
  search: (query, limit) => ipcRenderer.invoke('vector-search', { query, limit }),
  delete: (id) => ipcRenderer.invoke('vector-delete', { id })
}
```

### Step 6: 集成到存储流程 (30分钟)

**修改文件**: `services/storageService.ts`

在 `saveItem()` 方法末尾添加向量索引调用：

```typescript
// 保存后触发向量索引
if (window.electron?.vectorStore) {
  const text = `${item.title} ${item.contentSnippet || ''} ${item.tags.join(' ')}`;
  window.electron.vectorStore.index(item.id, text, {
    title: item.title,
    type: item.type,
    tags: item.tags,
    createdAt: item.createdAt
  }).catch(console.error); // 异步不阻塞
}
```

### Step 7: 改造搜索逻辑 (1小时)

**修改文件**: `App.tsx`

```typescript
// 在 filteredItems 计算逻辑中添加语义搜索分支
const [semanticResults, setSemanticResults] = useState<string[]>([]);
const [isSemanticSearch, setIsSemanticSearch] = useState(true);

useEffect(() => {
  if (!search || !isSemanticSearch) {
    setSemanticResults([]);
    return;
  }

  const doSearch = async () => {
    const results = await window.electron?.vectorStore.search(search, 20);
    setSemanticResults(results?.map(r => r.id) || []);
  };

  const debounce = setTimeout(doSearch, 300);
  return () => clearTimeout(debounce);
}, [search, isSemanticSearch]);

// 混合排序：语义匹配在前，关键词匹配在后
const filteredItems = useMemo(() => {
  let result = items;

  if (search) {
    if (isSemanticSearch && semanticResults.length > 0) {
      // 语义搜索结果优先
      const semanticSet = new Set(semanticResults);
      result = [
        ...result.filter(item => semanticSet.has(item.id)),
        ...result.filter(item =>
          !semanticSet.has(item.id) &&
          (item.title.toLowerCase().includes(search.toLowerCase()) ||
           item.tags.some(t => t.toLowerCase().includes(search.toLowerCase())))
        )
      ];
    } else {
      // 传统关键词搜索
      result = result.filter(item =>
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
      );
    }
  }

  // ...其他过滤逻辑保持不变
  return result;
}, [items, search, semanticResults, isSemanticSearch, /* other deps */]);
```

---

*计划版本: v1.1*
*最后更新: 2026-01-20*
*技术决策已确认: 语义搜索优先 + all-MiniLM-L6-v2 + 本地优先架构*
