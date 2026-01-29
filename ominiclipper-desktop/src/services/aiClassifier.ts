/**
 * OmniCollector - AI Classifier Service
 * AI 智能分类器 - 使用 LLM 进行智能文件分类
 */

import {
  ClassificationResult,
  ResourceItem,
  AIClassifierConfig,
  LLMProviderType
} from '../types/classification';
import { getFolders } from './storage/tags_folders';
import i18next from 'i18next';
import llmProviderService from './llmProvider';

// 分类 Prompt 模板
// 分类 Prompt 模板
const CLASSIFICATION_PROMPT = `You are an intelligent file classification assistant. Analyze the file info and classify it.

File Info:
- Name: {{filename}}
- Type: {{fileType}}
- Size: {{fileSize}}
- Snippet: {{contentSnippet}}
- Tags: {{tags}}

Output Language: {{language}}

Return JSON strictly:
{
  "category": "Category Name (MUST be one of: {{categories}})",
  "subfolder": "Subfolder Name (e.g., 2024, Tech/React, Work/Projects)",
  "confidence": 0.95,
  "reasoning": "Short justification in {{language}}",
  "suggestedTags": ["Tag1", "Tag2"],
  "priority": "high"
}

IMPORTANT:
1. Return JSON ONLY.
2. "category" MUST be one of the keys listed above in {{language}}.
3. "subfolder" should use forward slashes / for depth.
4. "suggestedTags" MUST be in {{language}}.
5. "reasoning" MUST be in {{language}}.
6. If info is insufficient, lower confidence.`;

interface ParsedClassificationResult {
  category: string;
  folderId?: string;
  subfolder: string;
  confidence: number;
  reasoning: string;
  suggestedTags: string[];
  priority: 'high' | 'medium' | 'low';
}

class AIClassifier {
  private config: AIClassifierConfig | null = null;
  private cache: Map<string, ParsedClassificationResult> = new Map();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时缓存

  /**
   * 配置 AI 分类器
   */
  configure(config: AIClassifierConfig): void {
    this.config = config;
  }

  /**
   * 获取当前配置
   */
  getConfig(): AIClassifierConfig | null {
    return this.config;
  }

  /**
   * 检查是否已配置
   */
  isConfigured(): boolean {
    return !!(
      this.config?.apiKey &&
      llmProviderService.isApiKeyConfigured(this.config.provider)
    );
  }

  /**
   * 生成缓存 key
   */
  private getCacheKey(item: ResourceItem): string {
    // Generate signature for current folder structure to ensure cache invalidation on folder changes
    const folders = getFolders();
    const folderSignature = folders
      .map(f => `${f.id}:${f.name}`)
      .sort()
      .join('|');

    // Hash the folder signature (simple adler32 or just use length/substring if performance matters, 
    // but full string is safer for correctness. Given < 100 folders usually, it's fine.)

    // Base key on item properties AND folder structure
    const key = `${item.title}-${item.type}-${item.contentSnippet?.substring(0, 100) || ''}-${folderSignature}`;

    // Fix: Encode Unicode characters to UTF-8 bytes before converting to base64
    const binaryString = Array.from(new TextEncoder().encode(key))
      .map(byte => String.fromCharCode(byte))
      .join('');
    return `ai:${Date.now() - (Date.now() % this.CACHE_TTL)}:${btoa(binaryString)}`;
  }

  /**
   * 检查缓存
   */
  private getCachedResult(key: string): ParsedClassificationResult | null {
    const cached = this.cache.get(key);
    if (cached) return cached;

    // 尝试从 localStorage 获取
    try {
      const storageKey = `OMNICLIPPER_AI_CACHE_${key}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expires > Date.now()) {
          this.cache.set(key, parsed.result);
          return parsed.result;
        }
        localStorage.removeItem(storageKey);
      }
    } catch {
      // 忽略缓存读取错误
    }

    return null;
  }

  /**
   * 保存到缓存
   */
  private saveToCache(key: string, result: ParsedClassificationResult): void {
    this.cache.set(key, result);

    try {
      const storageKey = `OMNICLIPPER_AI_CACHE_${key}`;
      localStorage.setItem(storageKey, JSON.stringify({
        result,
        expires: Date.now() + this.CACHE_TTL
      }));
    } catch {
      // 忽略缓存保存错误
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
    try {
      Object.keys(localStorage)
        .filter(key => key.startsWith('OMNICLIPPER_AI_CACHE_'))
        .forEach(key => localStorage.removeItem(key));
    } catch {
      // 忽略错误
    }
  }

  /**
   * 分类单个文件
   */
  async classify(item: ResourceItem): Promise<ClassificationResult> {
    // 检查缓存
    const cacheKey = this.getCacheKey(item);
    const cached = this.getCachedResult(cacheKey);
    console.log('Classification cached result:', cached);
    if (cached) {
      return {
        item,
        category: cached.category,
        folderId: cached.folderId,
        subfolder: cached.subfolder,
        confidence: cached.confidence,
        reasoning: cached.reasoning,
        suggestedTags: cached.suggestedTags,
        priority: cached.priority
      };
    }

    // 检查配置
    if (!this.isConfigured()) {
      return {
        item,
        error: 'AI classifier not configured. Please set up API key in settings.'
      };
    }

    try {
      const result = await this.callLLM(item);
      console.log('Classification result:', result);
      this.saveToCache(cacheKey, result);

      // Resolve folder ID from category name (Localized -> ID)
      let resolvedFolderId: string | undefined;
      if (result.category) {
        const folders = getFolders();
        const matched = folders.find(f =>
          f.name === result.category ||
          i18next.t(`initial_folders.${f.id}`, { defaultValue: f.name }) === result.category
        );
        if (matched) resolvedFolderId = matched.id;
      }

      return {
        item,
        category: result.category,
        folderId: resolvedFolderId,
        subfolder: result.subfolder,
        confidence: result.confidence,
        reasoning: result.reasoning,
        suggestedTags: result.suggestedTags,
        priority: result.priority
      };
    } catch (error) {
      return {
        item,
        error: error instanceof Error ? error.message : 'Classification failed'
      };
    }
  }

  /**
   * 批量分类
   */
  async classifyBatch(
    items: ResourceItem[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    const batchSize = 5; // 避免速率限制

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => this.classifyWithRetry(item))
      );
      results.push(...batchResults);

      onProgress?.(Math.min(i + batchSize, items.length), items.length);

      // 避免速率限制
      await this.delay(1000);
    }

    return results;
  }

  /**
   * 带重试的分类
   */
  private async classifyWithRetry(
    item: ResourceItem,
    maxRetries = 2
  ): Promise<ClassificationResult> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.classify(item);
      } catch (error) {
        if (attempt === maxRetries - 1) {
          return {
            item,
            error: error instanceof Error ? error.message : 'Classification failed'
          };
        }
        // 指数退避
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    return { item, error: 'Unknown error' };
  }

  /**
   * 调用 LLM API
   */
  private async callLLM(item: ResourceItem): Promise<ParsedClassificationResult> {
    if (!this.config) {
      throw new Error('Classifier not configured');
    }

    const provider = llmProviderService.getProviderById(this.config.provider);
    if (!provider) {
      throw new Error('Provider not found');
    }

    const apiKey = llmProviderService.getApiKey(this.config.provider);
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    const prompt = this.buildPrompt(item);

    console.log('prompt', prompt);

    const response = await fetch(`${provider.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...(this.config.provider === 'anthropic' ? {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        } : {})
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful file classification assistant. Always respond with valid JSON only.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: this.config.temperature ?? 0.3,
        max_tokens: this.config.maxTokens ?? 500,
        stream: false
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from API');
    }

    // 解析 JSON
    const result = this.parseResponse(content);

    console.log

    // 记录用量
    llmProviderService.recordUsage({
      date: new Date().toISOString().split('T')[0],
      provider: this.config.provider,
      model: this.config.model,
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      cost: llmProviderService.calculateCost(
        this.config.provider,
        data.usage?.prompt_tokens || 0,
        data.usage?.completion_tokens || 0
      )
    });

    return result;
  }

  /**
   * 构建 Prompt
   */
  private buildPrompt(item: ResourceItem): string {
    let prompt = CLASSIFICATION_PROMPT;

    const fileSizeStr = item.fileSize
      ? this.formatFileSize(item.fileSize)
      : 'Unknown';

    const folders = getFolders();
    const categoryNames = folders.map(f =>
      i18next.t(`initial_folders.${f.id}`, { defaultValue: f.name })
    ).join(', ');

    const replacements: Record<string, string> = {
      '{{filename}}': item.title,
      '{{fileType}}': item.type,
      '{{fileSize}}': fileSizeStr,
      '{{contentSnippet}}': item.contentSnippet || '无内容摘要',
      '{{tags}}': item.tags.length > 0 ? item.tags.join(', ') : '无标签',
      '{{language}}': this.config?.language === 'zh_CN' ? 'Chinese (Simplified)' : 'English',
      '{{categories}}': categoryNames
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      prompt = prompt.replace(new RegExp(placeholder, 'g'), value);
    }

    return prompt;
  }

  /**
   * 解析 LLM 响应
   */
  private parseResponse(content: string): ParsedClassificationResult {
    // 提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        category: parsed.category || '未分类',
        folderId: undefined, // Will be resolved outside
        subfolder: parsed.subfolder || '',
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
        reasoning: parsed.reasoning || '',
        suggestedTags: Array.isArray(parsed.suggestedTags) ? parsed.suggestedTags : [],
        priority: ['high', 'medium', 'low'].includes(parsed.priority)
          ? parsed.priority
          : 'medium'
      };
    } catch (error) {
      throw new Error('Failed to parse classification result');
    }
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 预估成本
   */
  estimateCost(items: ResourceItem[]): { min: number; max: number } {
    const avgTokens = 500; // 预估每个文件约 500 tokens
    const avgCostPer1k = 0.005; // 预估 $0.005/1K

    const total = items.length * avgTokens * avgCostPer1k / 1000;

    return {
      min: total * 0.8,
      max: total * 1.5
    };
  }

  /**
   * 获取可用模型列表
   */
  getAvailableModels(providerId: LLMProviderType): string[] {
    return llmProviderService.getModels(providerId);
  }
}

// 导出单例
export const aiClassifier = new AIClassifier();
export default aiClassifier;
