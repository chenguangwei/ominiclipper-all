# OmniClipper 文件智能分类方案

## 概述

为 OmniClipper 桌面应用添加智能文件分类功能，支持 **AI 智能分类** 和 **规则引擎分类** 两种方式，实现批量导入时自动整理文件到对应文件夹。

## 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    OmniClipper Desktop App                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │  规则引擎    │    │  AI 分类器   │    │   文件管理服务       │ │
│  │ Classifier  │    │  AIClassifier│   │  FileManager        │ │
│  └──────┬──────┘    └──────┬──────┘    └──────────┬──────────┘ │
│         │                  │                       │            │
│         ▼                  ▼                       ▼            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   分类决策引擎 (ClassifierEngine)        │   │
│  │  优先级: 规则引擎 → AI分类 (规则不匹配时触发)              │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   文件整理服务 (FileOrganizer)           │   │
│  │  - 自动创建文件夹                                         │   │
│  │  - 移动/复制文件                                          │   │
│  │  - 更新数据库记录                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 分类维度

| 维度 | AI 方式 | 规则方式 |
|------|---------|----------|
| **内容主题** | 分析文件内容，提取主题关键词 | 关键词匹配文件名 |
| **文件类型** | 自动识别 MIME 类型 | 扩展名匹配 |
| **日期/时间** | 提取日期元信息 | 格式正则匹配 |
| **来源** | 推断文件来源（下载/邮件/截图） | URL/路径模式匹配 |

## 方案一：规则引擎（非 AI）

### 规则配置结构

```typescript
interface ClassificationRule {
  id: string;
  name: string;              // 规则名称
  priority: number;          // 执行优先级 (越小越先执行)
  enabled: boolean;
  conditions: RuleCondition[]; // 条件组合 (AND/OR)
  action: RuleAction;        // 执行动作
}

interface RuleCondition {
  type: 'filename' | 'extension' | 'path' | 'size' | 'date' | 'keyword' | 'content';
  operator: 'contains' | 'matches' | 'startsWith' | 'endsWith' | 'regex' | 'gt' | 'lt';
  value: string;
  negate?: boolean;          // 取反
}

interface RuleAction {
  type: 'move' | 'copy' | 'tag' | 'setColor';
  targetFolder?: string;     // 目标文件夹路径
  tags?: string[];           // 标签
  color?: string;            // 颜色
  createFolder?: boolean;    // 是否创建文件夹
}
```

### 预置规则模板

```typescript
const PRESET_RULES: ClassificationRule[] = [
  {
    id: 'pdf-documents',
    name: 'PDF 文档',
    priority: 1,
    enabled: true,
    conditions: [{ type: 'extension', operator: 'equals', value: 'pdf' }],
    action: { type: 'move', targetFolder: 'Documents/PDF', createFolder: true }
  },
  {
    id: 'images',
    name: '图片文件',
    priority: 2,
    enabled: true,
    conditions: [{ type: 'extension', operator: 'in', value: 'jpg,jpeg,png,gif,webp,svg' }],
    action: { type: 'move', targetFolder: 'Images', createFolder: true }
  },
  {
    id: 'documents',
    name: 'Word/Excel 文档',
    priority: 3,
    enabled: true,
    conditions: [{ type: 'extension', operator: 'in', value: 'doc,docx,xls,xlsx,ppt,pptx' }],
    action: { type: 'move', targetFolder: 'Documents/Office', createFolder: true }
  },
  {
    id: 'code-files',
    name: '代码文件',
    priority: 4,
    enabled: true,
    conditions: [{ type: 'extension', operator: 'in', value: 'js,ts,py,java,go,rust,html,css' }],
    action: { type: 'move', targetFolder: 'Code', createFolder: true }
  },
  {
    id: 'design-files',
    name: '设计文件',
    priority: 5,
    enabled: true,
    conditions: [{ type: 'extension', operator: 'in', value: 'psd,sketch,fig,ai,xd' }],
    action: { type: 'move', targetFolder: 'Design', createFolder: true }
  },
];
```

### 规则匹配算法

```typescript
class RuleEngine {
  evaluateCondition(item: ResourceItem, condition: RuleCondition): boolean {
    switch (condition.type) {
      case 'filename':
        return this.matchString(item.title, condition);
      case 'extension':
        return this.matchExtension(item, condition);
      case 'keyword':
        return this.matchKeyword(item, condition);
      // ... 其他类型
    }
  }

  // 批量处理规则
  classify(items: ResourceItem[]): ClassificationResult[] {
    return items.map(item => {
      for (const rule of this.getSortedRules()) {
        if (this.evaluateRule(item, rule)) {
          return { item, action: rule.action, matchedRule: rule };
        }
      }
      return { item, action: null, matchedRule: null };
    });
  }
}
```

## 方案二：AI 智能分类

### 支持的 LLM 提供商

```typescript
interface LLMProvider {
  name: string;
  apiBaseUrl: string;
  models: string[];
  supportsStreaming: boolean;
  pricingPer1kTokens: { input: number; output: number };
}

const LLM_PROVIDERS: LLMProvider[] = [
  {
    name: 'OpenAI',
    apiBaseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    supportsStreaming: true,
    pricingPer1kTokens: { input: 0.005, output: 0.015 }
  },
  {
    name: 'Anthropic',
    apiBaseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-4-20250514', 'claude-haiku-3-20250507'],
    supportsStreaming: true,
    pricingPer1kTokens: { input: 0.003, output: 0.015 }
  },
  {
    name: 'DeepSeek',
    apiBaseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat'],
    supportsStreaming: true,
    pricingPer1kTokens: { input: 0.00014, output: 0.00028 }
  },
  {
    name: '硅基流动 (SiliconFlow)',
    apiBaseUrl: 'https://api.siliconflow.com/v1',
    models: ['Pro/deepseek-ai/DeepSeek-V2.5', 'Qwen/Qwen2.5-72B-Instruct'],
    supportsStreaming: true,
    pricingPer1kTokens: { input: 0.00014, output: 0.00028 }
  },
];
```

### 订阅模式支持

```typescript
interface SubscriptionPlan {
  id: string;
  name: string;
  monthlyQuota: number;      // 每月 token 限额
  price: number;             // 月费
  features: string[];
}

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: '免费版',
    monthlyQuota: 100000,    // 10万 tokens
    price: 0,
    features: ['基础分类', '5条自定义规则']
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyQuota: 1000000,   // 100万 tokens
    price: 9.9,
    features: ['AI 智能分类', '无限规则', '批量处理', '优先级支持']
  },
  {
    id: 'team',
    name: 'Team',
    monthlyQuota: 5000000,   // 500万 tokens
    price: 29.9,
    features: ['团队协作', 'API 访问', '自定义分类模型']
  }
];
```

### AI 分类 Prompt 设计

```typescript
const CLASSIFICATION_PROMPT = `你是一个智能文件分类助手。请分析以下文件信息并进行分类。

文件信息：
- 名称：{{filename}}
- 类型：{{fileType}}
- 大小：{{fileSize}}
- 内容摘要：{{contentSnippet}}
- 标签：{{tags}}

请返回 JSON 格式的分类结果：
{
  "category": "分类名称（如：技术文档、财务报表、设计素材）",
  "subfolder": "子文件夹名称（如：2024年、技术/React）",
  "confidence": 0.95,  // 置信度 0-1
  "reasoning": "分类理由简短说明",
  "suggestedTags": ["标签1", "标签2"],
  "priority": "high"  // high/medium/low
}

注意事项：
1. 只返回 JSON，不要有其他内容
2. 如果信息不足，confidence 设低一些
3. 文件夹名称使用中文
4. 保持分类体系一致性`;
```

### 批量分类优化

```typescript
class AIBatchClassifier {
  private batchSize = 20;  // 每批处理数量
  private concurrency = 3; // 并发数

  // 批量分类，带进度回调
  async classifyBatch(
    items: ResourceItem[],
    onProgress: (processed: number, total: number) => void
  ): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];

    // 分批处理
    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize);
      const batchResults = await Promise.all(
        batch.map(item => this.classifyWithRetry(item))
      );
      results.push(...batchResults);

      onProgress(i + batch.length, items.length);

      // 避免速率限制
      await this.delay(1000);
    }

    return results;
  }

  // 带重试的分类
  private async classifyWithRetry(item: ResourceItem, maxRetries = 3): Promise<ClassificationResult> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.callLLM(item);
      } catch (error) {
        if (attempt === maxRetries - 1) {
          return { item, action: null, error: error.message };
        }
        await this.delay(Math.pow(2, attempt) * 1000); // 指数退避
      }
    }
  }
}
```

## 文件整理服务

```typescript
interface FileOrganizerConfig {
  baseFolder: string;        // 基础文件夹
  createSubfolders: boolean; // 是否创建子文件夹
  handleDuplicates: 'rename' | 'skip' | 'overwrite' | 'version';
  preserveOriginalPath: boolean;
}

class FileOrganizer {
  async organize(
    items: ResourceItem[],
    results: ClassificationResult[],
    config: FileOrganizerConfig
  ): Promise<OrganizeReport> {
    const report: OrganizeReport = {
      success: 0,
      failed: 0,
      skipped: 0,
      createdFolders: [],
      details: []
    };

    for (const result of results) {
      if (!result.action || result.confidence < 0.6) {
        report.skipped++;
        continue;
      }

      try {
        const targetPath = await this.ensureFolder(result.action.targetFolder, config);

        if (result.action.type === 'move') {
          await this.moveFile(result.item, targetPath);
        } else if (result.action.type === 'copy') {
          await this.copyFile(result.item, targetPath);
        }

        // 更新数据库
        await this.updateItemInStorage(result.item, {
          folderId: result.action.targetFolder,
          tags: result.suggestedTags || result.item.tags
        });

        report.success++;
        report.createdFolders.push(result.action.targetFolder);
      } catch (error) {
        report.failed++;
        report.details.push({ item: result.item, error: error.message });
      }
    }

    return report;
  }
}
```

## 用户界面设计

### 分类设置页面

```
┌─────────────────────────────────────────────────────────────┐
│  📁 文件分类设置                                    [保存]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────────────────────┐   │
│  │  分类方式        │  │  AI 设置                        │   │
│  │                 │  │                                 │   │
│  │  ○ 规则引擎      │  │  提供商: [OpenAI ▼]            │   │
│  │  ○ AI 智能分类  │  │  模型:   [gpt-4o ▼]            │   │
│  │  ● 两者结合     │  │                                 │   │
│  │                 │  │  API Key: [••••••••••••••••]  │   │
│  │                 │  │                                 │   │
│  │  [管理规则...]   │  │  订阅计划: [Pro ▼] ($9.9/月)   │   │
│  └─────────────────┘  │  剩余配额: 850,000 tokens       │   │
│                       │                                 │   │
│                       │  [测试连接]  [查看使用记录]       │   │
│                       └─────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  预设规则                                              │ │
│  │  ☑ PDF 文档 → Documents/PDF                         │ │
│  │  ☑ 图片文件 → Images                                 │ │
│  │  ☑ Office 文档 → Documents/Office                   │ │
│  │  ☑ 代码文件 → Code                                  │ │
│  │  [添加自定义规则]                                     │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  导入时自动分类                                        │ │
│  │  ☑ 批量导入时自动触发分类                              │ │
│  │  ☑ 置信度 > 80% 时自动整理文件                         │ │
│  │  ☑ 低置信度结果让我确认                                │ │
│  │                                                         │ │
│  │  目标文件夹: [~/Documents/OmniClipper ▼]              │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 分类预览对话框

```
┌─────────────────────────────────────────────────────────────┐
│  📋 分类预览                                    共 25 个文件 │
├─────────────────────────────────────────────────────────────┤
│  [全选]  [确认全部]  [取消全部]                           │
│                                                             │
│  ☑ 技术文档 (15)    🤖 AI 置信度: 95%                   │
│     ├── 项目计划.pdf                                    │
│     ├── API 文档.md                                      │
│     └── 代码规范.docx                                    │
│     [移到: Documents/技术]  [修改]                        │
│                                                             │
│  ☑ 财务报告 (5)      🤖 AI 置信度: 88%                   │
│     ├── Q4财务报表.xlsx                                 │
│     └── ...                                              │
│     [移到: Documents/财务]  [修改]                        │
│                                                             │
│  ⚠ 未分类 (5)       需要手动处理                         │
│     ├── unknown_file_001                                │
│     └── ...                                              │
│     [手动分类 ▼]                                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                     [取消]  [确认执行分类]   │
└─────────────────────────────────────────────────────────────┘
```

## 实现步骤

### Phase 1: 规则引擎基础

| 文件 | 操作 |
|-----|------|
| `services/ruleEngine.ts` | **新建** - 规则引擎核心 |
| `services/ruleConfig.ts` | **新建** - 规则配置管理 |
| `types/classification.ts` | **新建** - 类型定义 |

### Phase 2: AI 分类器

| 文件 | 操作 |
|-----|------|
| `services/aiClassifier.ts` | **新建** - AI 分类核心 |
| `services/llmProvider.ts` | **新建** - LLM 提供商管理 |
| `services/subscriptionManager.ts` | **新建** - 订阅管理 |

### Phase 3: 文件整理服务

| 文件 | 操作 |
|-----|------|
| `services/fileOrganizer.ts` | **新建** - 文件整理服务 |
| `components/AutoClassifyDialog.tsx` | **新建** - 分类预览对话框 |
| `pages/ClassificationSettings.tsx` | **新建** - 分类设置页面 |

### Phase 4: 集成到现有流程

| 文件 | 修改 |
|-----|------|
| `App.tsx` | 集成分类设置入口 |
| `ImportExportDialog.tsx` | 添加批量导入分类选项 |
| `services/storageService.ts` | 添加分类相关方法 |

### Phase 5: 订阅计费系统

| 文件 | 操作 |
|-----|------|
| `services/usageTracker.ts` | **新建** - 用量追踪 |
| `services/billingService.ts` | **新建** - 计费服务 |

## 关键文件

| 文件 | 操作 |
|-----|------|
| `services/ruleEngine.ts` | **新建** |
| `services/aiClassifier.ts` | **新建** |
| `services/llmProvider.ts` | **新建** |
| `services/subscriptionManager.ts` | **新建** |
| `services/fileOrganizer.ts` | **新建** |
| `services/usageTracker.ts` | **新建** |
| `types/classification.ts` | **新建** |
| `components/AutoClassifyDialog.tsx` | **新建** |
| `pages/ClassificationSettings.tsx` | **新建** |
| `App.tsx` | 修改 - 添加分类设置入口 |
| `services/storageService.ts` | 修改 - 添加分类方法 |

## 技术要点

1. **准确率优化**
   - Prompt 工程优化
   - Few-shot learning（提供示例）
   - 结果校验和人工确认

2. **成本控制**
   - Token 使用追踪
   - 批量处理优化
   - 缓存已分类文件

3. **性能优化**
   - 并发控制
   - 进度反馈
   - 断点续传

4. **离线支持**
   - 规则引擎离线可用
   - AI 分类需网络
   - 本地缓存分类结果
