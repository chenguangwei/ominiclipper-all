/**
 * OmniCollector - File Classification Types
 */

// 分类方式
export type ClassificationMode = 'rule' | 'ai' | 'hybrid';

// 规则条件类型
export type RuleConditionType =
  | 'filename'      // 文件名
  | 'extension'     // 扩展名
  | 'path'          // 路径
  | 'size'          // 文件大小
  | 'date'          // 日期
  | 'keyword'       // 关键词
  | 'content';      // 内容摘要

// 条件操作符
export type RuleOperator =
  | 'contains'      // 包含
  | 'equals'        // 等于
  | 'startsWith'    // 开头匹配
  | 'endsWith'      // 结尾匹配
  | 'matches'       // 正则匹配
  | 'in'            // 在列表中
  | 'gt'            // 大于
  | 'lt'            // 小于
  | 'gte'           // 大于等于
  | 'lte';          // 小于等于

// 规则动作类型
export type RuleActionType = 'move' | 'copy' | 'tag' | 'setColor';

// 分类规则条件
export interface RuleCondition {
  type: RuleConditionType;
  operator: RuleOperator;
  value: string;
  negate?: boolean;  // 取反
}

// 分类规则动作
export interface RuleAction {
  type: RuleActionType;
  targetFolder?: string;  // 目标文件夹路径
  tags?: string[];        // 标签
  color?: string;         // 颜色
  createFolder?: boolean; // 是否创建文件夹
}

// 分类规则
export interface ClassificationRule {
  id: string;
  name: string;              // 规则名称
  description?: string;      // 规则描述
  priority: number;          // 执行优先级 (越小越先执行)
  enabled: boolean;
  mode: ClassificationMode;  // 适用模式: rule/ai/both
  conditions: RuleCondition[];  // 条件组合 (AND 关系)
  action: RuleAction;        // 执行动作
  createdAt?: string;
  updatedAt?: string;
}

// 规则配置
export interface RuleConfig {
  rules: ClassificationRule[];
  defaultFolder?: string;    // 默认文件夹
  autoCreateFolder?: boolean; // 自动创建文件夹
}

// 分类结果
export interface ClassificationResult {
  item: ResourceItem;
  rule?: ClassificationRule;
  category?: string;         // AI 分类类别
  subfolder?: string;        // 子文件夹
  confidence?: number;       // 置信度 (0-1)
  reasoning?: string;        // 分类理由
  suggestedTags?: string[];  // 建议标签
  priority?: 'high' | 'medium' | 'low';
  error?: string;
}

// AI 分类器配置
export interface AIClassifierConfig {
  provider: LLMProviderType;
  model: string;
  apiKey: string;
  apiBaseUrl?: string;
  temperature?: number;       // 0-1, 越低越确定性
  maxTokens?: number;
}

// LLM 提供商类型
export type LLMProviderType = 'openai' | 'anthropic' | 'deepseek' | 'siliconflow' | 'custom';

// LLM 提供商配置
export interface LLMProvider {
  id: LLMProviderType;
  name: string;
  apiBaseUrl: string;
  models: string[];
  pricingPer1kTokens: {
    input: number;
    output: number;
  };
  supportsStreaming: boolean;
}

// 订阅计划
export interface SubscriptionPlan {
  id: string;
  name: string;
  monthlyQuota: number;  // token 限额
  price: number;         // 月费
  currency?: string;
  features: string[];
  isPopular?: boolean;
}

// 用户订阅
export interface UserSubscription {
  planId: string;
  status: 'active' | 'expired' | 'cancelled';
  startDate: string;
  endDate: string;
  monthlyQuota: number;
  usedQuota: number;
  tokensUsed: number;
}

// 用量追踪
export interface UsageRecord {
  date: string;
  provider: LLMProviderType;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

// 文件整理配置
export interface FileOrganizerConfig {
  baseFolder: string;                    // 基础文件夹
  createSubfolders: boolean;             // 是否创建子文件夹
  handleDuplicates: 'rename' | 'skip' | 'overwrite' | 'version';
  preserveOriginalPath: boolean;
  confidenceThreshold?: number;          // 置信度阈值
}

// 整理报告
export interface OrganizeReport {
  success: number;
  failed: number;
  skipped: number;
  createdFolders: string[];
  details: Array<{
    item: ResourceItem;
    error?: string;
  }>;
}

// 分类设置
export interface ClassificationSettings {
  mode: ClassificationMode;
  enabled: boolean;
  autoClassifyOnImport: boolean;  // 导入时自动分类
  confidenceThreshold: number;    // 置信度阈值 (0.6-1.0)
  autoOrganizeHighConfidence: boolean;  // 高置信度自动整理
  aiConfig?: AIClassifierConfig;
  ruleConfig?: RuleConfig;
}

// 资源项接口 (复用以避免循环依赖，使用简化的接口)
export interface ResourceItem {
  id: string;
  title: string;
  type: string;
  tags: string[];
  folderId?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
  path?: string;
  localPath?: string;
  fileSize?: number;
  mimeType?: string;
  isCloud: boolean;
  isStarred: boolean;
  contentSnippet?: string;
  aiSummary?: string;
  storageMode?: string;
  embeddedData?: string;
  originalPath?: string;
  source?: string;
}
