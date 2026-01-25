/**
 * OmniCollector - LLM Provider Service
 * LLM 提供商管理 - 支持多种 LLM API
 */

import {
  LLMProvider,
  LLMProviderType,
  SubscriptionPlan,
  UsageRecord
} from '../types/classification';

// LLM 提供商配置
export const LLM_PROVIDERS: LLMProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    apiBaseUrl: 'https://api.openai.com/v1',
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo'
    ],
    pricingPer1kTokens: {
      input: 0.005,   // $0.005/1K tokens (gpt-4o-mini is cheaper)
      output: 0.015   // $0.015/1K tokens
    },
    supportsStreaming: true
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    apiBaseUrl: 'https://api.anthropic.com/v1',
    models: [
      'claude-sonnet-4-20250514',
      'claude-haiku-3-20250507',
      'claude-opus-4-20250514'
    ],
    pricingPer1kTokens: {
      input: 0.003,   // $0.003/1K tokens
      output: 0.015   // $0.015/1K tokens
    },
    supportsStreaming: true
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    apiBaseUrl: 'https://api.deepseek.com/v1',
    models: [
      'deepseek-chat',
      'deepseek-reasoner'
    ],
    pricingPer1kTokens: {
      input: 0.00014,  // ¥0.001/1K tokens
      output: 0.00028  // ¥0.002/1K tokens
    },
    supportsStreaming: true
  },
  {
    id: 'siliconflow',
    name: '硅基流动 (SiliconFlow)',
    apiBaseUrl: 'https://api.siliconflow.com/v1',
    models: [
      'Pro/deepseek-ai/DeepSeek-V2.5',
      'Qwen/Qwen2.5-72B-Instruct',
      'meta-llama/Llama-3.3-70B-Instruct',
      'THUDM/GLM-4-Plus'
    ],
    pricingPer1kTokens: {
      input: 0.00014,
      output: 0.00028
    },
    supportsStreaming: true
  },
  {
    id: 'custom',
    name: '自定义 (OpenAI 兼容)',
    apiBaseUrl: '',
    models: ['*'],
    pricingPer1kTokens: {
      input: 0,
      output: 0
    },
    supportsStreaming: true
  }
];

// 订阅计划
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: '免费版',
    monthlyQuota: 100000,  // 10万 tokens
    price: 0,
    currency: 'USD',
    features: [
      '规则引擎分类',
      '5 条自定义规则',
      '基础文件整理',
      '社区支持'
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyQuota: 1000000,  // 100万 tokens
    price: 9.9,
    currency: 'USD',
    isPopular: true,
    features: [
      'AI 智能分类 (所有模型)',
      '无限自定义规则',
      '批量文件整理',
      '高置信度自动整理',
      '邮件支持'
    ]
  },
  {
    id: 'team',
    name: 'Team',
    monthlyQuota: 5000000,  // 500万 tokens
    price: 29.9,
    currency: 'USD',
    features: [
      'AI 智能分类 (所有模型)',
      '团队协作',
      'API 访问',
      '自定义分类模型',
      '优先级支持',
      '专属客服'
    ]
  }
];

class LLMProviderService {
  private usageRecords: UsageRecord[] = [];
  private readonly STORAGE_KEY_USAGE = 'OMNICLIPPER_LLM_USAGE';
  private readonly STORAGE_KEY_API_KEY = 'OMNICLIPPER_API_KEYS';

  constructor() {
    this.loadUsageRecords();
  }

  /**
   * 获取所有提供商
   */
  getProviders(): LLMProvider[] {
    return LLM_PROVIDERS;
  }

  /**
   * 根据 ID 获取提供商
   */
  getProviderById(id: LLMProviderType): LLMProvider | undefined {
    return LLM_PROVIDERS.find(p => p.id === id);
  }

  /**
   * 获取提供商的所有模型
   */
  getModels(providerId: LLMProviderType): string[] {
    const provider = this.getProviderById(providerId);
    return provider?.models || [];
  }

  /**
   * 获取默认模型
   */
  getDefaultModel(providerId: LLMProviderType): string {
    const models = this.getModels(providerId);
    if (models.length === 0) return '';

    // 返回第一个可用的模型
    return models[0];
  }

  /**
   * 计算 API 成本
   */
  calculateCost(
    providerId: LLMProviderType,
    inputTokens: number,
    outputTokens: number
  ): number {
    const provider = this.getProviderById(providerId);
    if (!provider) return 0;

    const { input, output } = provider.pricingPer1kTokens;
    const cost = (inputTokens / 1000) * input + (outputTokens / 1000) * output;
    return Math.round(cost * 10000) / 10000; // 保留4位小数
  }

  /**
   * 保存 API Key
   */
  saveApiKey(providerId: LLMProviderType, apiKey: string): void {
    try {
      const keys = this.getApiKeys();
      keys[providerId] = apiKey;
      localStorage.setItem(this.STORAGE_KEY_API_KEY, JSON.stringify(keys));
    } catch (error) {
      console.error('Failed to save API key:', error);
    }
  }

  /**
   * 获取 API Key
   */
  getApiKey(providerId: LLMProviderType): string {
    try {
      const keys = this.getApiKeys();
      return keys[providerId] || '';
    } catch {
      return '';
    }
  }

  /**
   * 获取所有 API Keys
   */
  private getApiKeys(): Record<string, string> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_API_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * 删除 API Key
   */
  deleteApiKey(providerId: LLMProviderType): void {
    const keys = this.getApiKeys();
    delete keys[providerId];
    localStorage.setItem(this.STORAGE_KEY_API_KEY, JSON.stringify(keys));
  }

  /**
   * 检查 API Key 是否已配置
   */
  isApiKeyConfigured(providerId: LLMProviderType): boolean {
    return !!this.getApiKey(providerId);
  }

  /**
   * 获取所有订阅计划
   */
  getSubscriptionPlans(): SubscriptionPlan[] {
    return SUBSCRIPTION_PLANS;
  }

  /**
   * 根据 ID 获取订阅计划
   */
  getPlanById(planId: string): SubscriptionPlan | undefined {
    return SUBSCRIPTION_PLANS.find(p => p.id === planId);
  }

  /**
   * 记录用量
   */
  recordUsage(record: UsageRecord): void {
    this.usageRecords.push(record);
    this.saveUsageRecords();
  }

  /**
   * 获取当前月份的用量
   */
  getCurrentMonthUsage(providerId?: LLMProviderType): {
    inputTokens: number;
    outputTokens: number;
    cost: number;
    requests: number;
  } {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let records = this.usageRecords.filter(
      r => new Date(r.date) >= startOfMonth
    );

    if (providerId) {
      records = records.filter(r => r.provider === providerId);
    }

    return {
      inputTokens: records.reduce((sum, r) => sum + r.inputTokens, 0),
      outputTokens: records.reduce((sum, r) => sum + r.outputTokens, 0),
      cost: records.reduce((sum, r) => sum + r.cost, 0),
      requests: records.length
    };
  }

  /**
   * 获取今日用量
   */
  getTodayUsage(): {
    inputTokens: number;
    outputTokens: number;
    cost: number;
    requests: number;
  } {
    const today = new Date().toISOString().split('T')[0];

    const records = this.usageRecords.filter(r => r.date.startsWith(today));

    return {
      inputTokens: records.reduce((sum, r) => sum + r.inputTokens, 0),
      outputTokens: records.reduce((sum, r) => sum + r.outputTokens, 0),
      cost: records.reduce((sum, r) => sum + r.cost, 0),
      requests: records.length
    };
  }

  /**
   * 获取历史用量记录
   */
  getUsageHistory(
    startDate: string,
    endDate: string,
    providerId?: LLMProviderType
  ): UsageRecord[] {
    let records = this.usageRecords.filter(
      r => r.date >= startDate && r.date <= endDate
    );

    if (providerId) {
      records = records.filter(r => r.provider === providerId);
    }

    return records;
  }

  /**
   * 加载用量记录
   */
  private loadUsageRecords(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_USAGE);
      if (stored) {
        this.usageRecords = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load usage records:', error);
      this.usageRecords = [];
    }
  }

  /**
   * 保存用量记录
   */
  private saveUsageRecords(): void {
    try {
      // 只保留最近30天的记录
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      this.usageRecords = this.usageRecords.filter(
        r => new Date(r.date) >= thirtyDaysAgo
      );

      localStorage.setItem(
        this.STORAGE_KEY_USAGE,
        JSON.stringify(this.usageRecords)
      );
    } catch (error) {
      console.error('Failed to save usage records:', error);
    }
  }

  /**
   * 流式聊天方法
   */
  async chatStream(
    prompt: string,
    onToken: (token: string) => void
  ): Promise<string> {
    // 目前返回简单实现，实际项目中会连接真实 LLM API
    const response = "这是模拟的流式响应。在实际项目中，这里会调用真实的 LLM API 并实现流式输出。";

    // 模拟流式输出效果
    for (let i = 0; i < response.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      onToken(response[i]);
    }

    return response;
  }

  /**
   * 带上下文的聊天方法
   */
  async chatWithContext(
    context: string,
    question: string,
    chatHistory: string,
    onToken?: (token: string) => void
  ): Promise<string> {
    const systemPrompt = `你是 OmniClipper 知识助手。基于以下资料回答用户问题。

## 规则
1. 基于提供的资料回答，不要编造信息
2. 如果资料不足以回答，明确说明
3. 用中文回答，除非用户用英文提问
4. 回答要简洁，条理清晰

## 格式
- 使用编号列表呈现多个要点
- 重要信息加粗强调
- 引用来源使用 [编号] 标注`;

    const fullPrompt = `${systemPrompt}

## 资料
${context}

## 对话历史
${chatHistory}

## 问题
${question}`;

    if (onToken) {
      return this.chatStream(fullPrompt, onToken);
    }

    // 目前返回简单实现，实际项目中会连接真实 LLM API
    return `根据提供的资料，关于"${question}"的信息：

这是模拟的 AI 响应。在实际实现中，将调用真实的 LLM 提供商（如 OpenAI、Anthropic 等）的 API 来获取答案。

**当前上下文：**
${context.slice(0, 200)}...`;
  }

  /**
   * 测试 API 连接
   */
  async testConnection(
    providerId: LLMProviderType,
    apiKey: string,
    model?: string
  ): Promise<{ success: boolean; message: string; latency?: number }> {
    const provider = this.getProviderById(providerId);
    if (!provider) {
      return { success: false, message: 'Provider not found' };
    }

    const apiBaseUrl = providerId === 'custom'
      ? localStorage.getItem('OMNICLIPPER_CUSTOM_API_URL') || ''
      : provider.apiBaseUrl;

    if (!apiBaseUrl) {
      return { success: false, message: 'API base URL not configured' };
    }

    const selectedModel = model || this.getDefaultModel(providerId);

    const startTime = Date.now();

    try {
      const response = await fetch(`${apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          ...(providerId === 'anthropic' ? {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          } : {})
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5
        })
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        return { success: true, message: 'Connection successful', latency };
      } else {
        const error = await response.json().catch(() => ({}));
        return {
          success: false,
          message: error.error?.message || `HTTP ${response.status}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }

  /**
   * 获取使用统计
   */
  getStats(): {
    totalUsage: number;
    monthlyUsage: number;
    providersUsed: LLMProviderType[];
    topModel: string;
  } {
    const monthly = this.getCurrentMonthUsage();
    const providerUsage: Record<string, number> = {};

    this.usageRecords.forEach(r => {
      providerUsage[r.provider] = (providerUsage[r.provider] || 0) + r.inputTokens + r.outputTokens;
    });

    const topProvider = Object.entries(providerUsage).sort((a, b) => b[1] - a[1])[0];

    return {
      totalUsage: this.usageRecords.reduce(
        (sum, r) => sum + r.inputTokens + r.outputTokens,
        0
      ),
      monthlyUsage: monthly.inputTokens + monthly.outputTokens,
      providersUsed: Object.keys(providerUsage) as LLMProviderType[],
      topModel: this.usageRecords.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0]?.model || ''
    };
  }
}

// 导出单例
export const llmProviderService = new LLMProviderService();
export default llmProviderService;
