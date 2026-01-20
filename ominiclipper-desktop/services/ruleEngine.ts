/**
 * OmniCollector - Rule Engine Service
 * 规则引擎 - 用于基于规则的文件分类
 */

import {
  ClassificationRule,
  RuleCondition,
  ClassificationResult,
  ResourceItem,
  RuleOperator
} from '../types/classification';

// 预置规则
const PRESET_RULES: ClassificationRule[] = [
  {
    id: 'pdf-documents',
    name: 'PDF 文档',
    description: '自动将 PDF 文件分类到 Documents/PDF 文件夹',
    priority: 1,
    enabled: true,
    mode: 'rule',
    conditions: [
      { type: 'extension', operator: 'equals', value: 'pdf' }
    ],
    action: {
      type: 'move',
      targetFolder: 'Documents/PDF',
      createFolder: true
    }
  },
  {
    id: 'images',
    name: '图片文件',
    description: '将图片文件分类到 Images 文件夹',
    priority: 2,
    enabled: true,
    mode: 'rule',
    conditions: [
      { type: 'extension', operator: 'in', value: 'jpg,jpeg,png,gif,webp,svg,heic,avif' }
    ],
    action: {
      type: 'move',
      targetFolder: 'Images',
      createFolder: true
    }
  },
  {
    id: 'office-documents',
    name: 'Office 文档',
    description: '将 Word、Excel、PPT 等 Office 文档分类',
    priority: 3,
    enabled: true,
    mode: 'rule',
    conditions: [
      { type: 'extension', operator: 'in', value: 'doc,docx,xls,xlsx,ppt,pptx,odt,ods,odp' }
    ],
    action: {
      type: 'move',
      targetFolder: 'Documents/Office',
      createFolder: true
    }
  },
  {
    id: 'code-files',
    name: '代码文件',
    description: '将源代码文件分类到 Code 文件夹',
    priority: 4,
    enabled: true,
    mode: 'rule',
    conditions: [
      { type: 'extension', operator: 'in', value: 'js,ts,jsx,tsx,py,java,c,cpp,h,hpp,cs,go,rs,rb,php,swift,kotlin,vue,angular,svelte,html,css,scss,less,json,yaml,yml,md,sql,sh,bash,zsh' }
    ],
    action: {
      type: 'move',
      targetFolder: 'Code',
      createFolder: true
    }
  },
  {
    id: 'design-files',
    name: '设计文件',
    description: '将设计相关文件分类到 Design 文件夹',
    priority: 5,
    enabled: true,
    mode: 'rule',
    conditions: [
      { type: 'extension', operator: 'in', value: 'psd,sketch,fig,ai,xd,prd,ae,pr,mp4,mov,avi,mkv' }
    ],
    action: {
      type: 'move',
      targetFolder: 'Design',
      createFolder: true
    }
  },
  {
    id: 'archives',
    name: '压缩文件',
    description: '将压缩文件分类到 Archives 文件夹',
    priority: 6,
    enabled: true,
    mode: 'rule',
    conditions: [
      { type: 'extension', operator: 'in', value: 'zip,7z,rar,tar,gz,bz2,xz,zst' }
    ],
    action: {
      type: 'move',
      targetFolder: 'Archives',
      createFolder: true
    }
  },
  {
    id: 'audio-files',
    name: '音频文件',
    description: '将音频文件分类到 Audio 文件夹',
    priority: 7,
    enabled: true,
    mode: 'rule',
    conditions: [
      { type: 'extension', operator: 'in', value: 'mp3,wav,flac,aac,ogg,m4a,wma,aiff' }
    ],
    action: {
      type: 'move',
      targetFolder: 'Audio',
      createFolder: true
    }
  },
  {
    id: 'ebooks',
    name: '电子书',
    description: '将电子书文件分类到 Books 文件夹',
    priority: 8,
    enabled: true,
    mode: 'rule',
    conditions: [
      { type: 'extension', operator: 'in', value: 'epub,mobi,azw3,fb2,chm,txt' }
    ],
    action: {
      type: 'move',
      targetFolder: 'Books',
      createFolder: true
    }
  }
];

class RuleEngine {
  private rules: ClassificationRule[] = [];

  constructor() {
    // 初始化加载预置规则
    this.rules = [...PRESET_RULES];
  }

  /**
   * 获取所有规则（按优先级排序）
   */
  getRules(): ClassificationRule[] {
    return [...this.rules].sort((a, b) => {
      // 先按 enabled 排序（启用的在前）
      if (a.enabled !== b.enabled) {
        return a.enabled ? -1 : 1;
      }
      // 再按 priority 排序
      return a.priority - b.priority;
    });
  }

  /**
   * 获取启用的规则
   */
  getEnabledRules(): ClassificationRule[] {
    return this.getRules().filter(rule => rule.enabled);
  }

  /**
   * 添加规则
   */
  addRule(rule: ClassificationRule): void {
    this.rules.push(rule);
  }

  /**
   * 更新规则
   */
  updateRule(ruleId: string, updates: Partial<ClassificationRule>): boolean {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.rules[index] = { ...this.rules[index], ...updates, updatedAt: new Date().toISOString() };
      return true;
    }
    return false;
  }

  /**
   * 删除规则
   */
  deleteRule(ruleId: string): boolean {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      // 预置规则不能删除，只能禁用
      if (PRESET_RULES.some(r => r.id === ruleId)) {
        this.rules[index].enabled = false;
        return true;
      }
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 重置为默认规则
   */
  resetToDefault(): void {
    this.rules = [...PRESET_RULES];
  }

  /**
   * 批量分类
   */
  classify(items: ResourceItem[]): ClassificationResult[] {
    const enabledRules = this.getEnabledRules();
    return items.map(item => {
      for (const rule of enabledRules) {
        if (this.evaluateRule(item, rule)) {
          return {
            item,
            rule,
            confidence: 1.0,
            suggestedTags: rule.action.tags
          };
        }
      }
      // 没有匹配的规则
      return { item, confidence: 0 };
    });
  }

  /**
   * 评估单个规则
   */
  evaluateRule(item: ResourceItem, rule: ClassificationRule): boolean {
    if (!rule.enabled || rule.conditions.length === 0) {
      return false;
    }

    // 所有条件都满足（AND 关系）
    return rule.conditions.every(condition =>
      this.evaluateCondition(item, condition)
    );
  }

  /**
   * 评估单个条件
   */
  evaluateCondition(item: ResourceItem, condition: RuleCondition): boolean {
    let result = false;
    const value = condition.value;

    switch (condition.type) {
      case 'filename':
        result = this.matchString(item.title, condition.operator, value);
        break;

      case 'extension':
        result = this.matchExtension(item, condition.operator, value);
        break;

      case 'path':
        result = this.matchString(item.path || '', condition.operator, value);
        break;

      case 'keyword':
        result = this.matchKeyword(item, condition.operator, value);
        break;

      case 'content':
        result = this.matchString(item.contentSnippet || '', condition.operator, value);
        break;

      case 'size':
        result = this.matchSize(item.fileSize, condition.operator, value);
        break;

      case 'date':
        result = this.matchDate(item.createdAt, condition.operator, value);
        break;
    }

    // 取反
    return condition.negate ? !result : result;
  }

  /**
   * 字符串匹配
   */
  private matchString(
    text: string,
    operator: RuleOperator,
    pattern: string
  ): boolean {
    const lowerText = text.toLowerCase();
    const lowerPattern = pattern.toLowerCase();

    switch (operator) {
      case 'contains':
        return lowerText.includes(lowerPattern);
      case 'equals':
        return lowerText === lowerPattern;
      case 'startsWith':
        return lowerText.startsWith(lowerPattern);
      case 'endsWith':
        return lowerText.endsWith(lowerPattern);
      case 'matches':
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(text);
        } catch {
          return false;
        }
      case 'in':
        return lowerPattern.split(',').map(s => s.trim()).includes(lowerText);
      default:
        return false;
    }
  }

  /**
   * 扩展名匹配
   */
  private matchExtension(
    item: ResourceItem,
    operator: RuleOperator,
    pattern: string
  ): boolean {
    const ext = this.getExtension(item);
    return this.matchString(ext, operator, pattern);
  }

  /**
   * 关键词匹配（搜索文件名、标签、内容）
   */
  private matchKeyword(
    item: ResourceItem,
    operator: RuleOperator,
    pattern: string
  ): boolean {
    // 搜索多个字段
    const searchText = [
      item.title,
      item.contentSnippet || '',
      item.tags.join(' '),
      item.aiSummary || ''
    ].join(' ').toLowerCase();

    const patterns = pattern.toLowerCase().split(',').map(s => s.trim());

    switch (operator) {
      case 'contains':
        return patterns.some(p => searchText.includes(p));
      case 'in':
        return patterns.some(p => searchText.includes(p));
      case 'matches':
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(searchText);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  /**
   * 文件大小匹配
   */
  private matchSize(
    size: number | undefined,
    operator: RuleOperator,
    value: string
  ): boolean {
    if (size === undefined) return false;

    // 解析大小值 (支持 K, M, G 后缀)
    const parsedSize = this.parseSize(value);
    if (isNaN(parsedSize)) return false;

    switch (operator) {
      case 'gt':
        return size > parsedSize;
      case 'lt':
        return size < parsedSize;
      case 'gte':
        return size >= parsedSize;
      case 'lte':
        return size <= parsedSize;
      case 'equals':
        return size === parsedSize;
      default:
        return false;
    }
  }

  /**
   * 日期匹配
   */
  private matchDate(
    dateStr: string | undefined,
    operator: RuleOperator,
    value: string
  ): boolean {
    if (!dateStr) return false;

    const itemDate = new Date(dateStr);
    if (isNaN(itemDate.getTime())) return false;

    const patternDate = new Date(value);
    if (isNaN(patternDate.getTime())) {
      // 尝试解析相对日期
      const relativeDate = this.parseRelativeDate(value);
      if (!relativeDate) return false;
      return itemDate >= relativeDate;
    }

    const itemTime = itemDate.getTime();
    const patternTime = patternDate.getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    switch (operator) {
      case 'gt':
        return itemTime > patternTime;
      case 'lt':
        return itemTime < patternTime;
      case 'gte':
        return itemTime >= patternTime;
      case 'lte':
        return itemTime <= patternTime;
      case 'equals':
        return Math.abs(itemTime - patternTime) < oneDay;
      default:
        return false;
    }
  }

  /**
   * 获取文件扩展名
   */
  private getExtension(item: ResourceItem): string {
    const path = item.path || item.originalPath || '';
    const ext = path.split('.').pop()?.toLowerCase() || '';
    return ext;
  }

  /**
   * 解析文件大小字符串
   */
  private parseSize(value: string): number {
    const match = value.toUpperCase().match(/^(\d+(?:\.\d+)?)\s*(K|M|G|B)?$/);
    if (!match) return NaN;

    const num = parseFloat(match[1]);
    const unit = match[2] || 'B';

    const multipliers: Record<string, number> = {
      B: 1,
      K: 1024,
      M: 1024 ** 2,
      G: 1024 ** 3
    };

    return num * (multipliers[unit] || 1);
  }

  /**
   * 解析相对日期
   */
  private parseRelativeDate(value: string): Date | null {
    const now = new Date();
    const match = value.toLowerCase().match(/^(\d+)\s*(d|w|m|y|day|week|month|year)s?$/);

    if (!match) return null;

    const num = parseInt(match[1], 10);
    const unit = match[2][0]; // 取首字母

    switch (unit) {
      case 'd':
        return new Date(now.getTime() - num * 24 * 60 * 60 * 1000);
      case 'w':
        return new Date(now.getTime() - num * 7 * 24 * 60 * 60 * 1000);
      case 'm':
        return new Date(now.getTime() - num * 30 * 24 * 60 * 60 * 1000);
      case 'y':
        return new Date(now.getTime() - num * 365 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  }

  /**
   * 创建新规则
   */
  createRule(
    name: string,
    conditions: RuleCondition[],
    action: ClassificationRule['action'],
    options?: Partial<ClassificationRule>
  ): ClassificationRule {
    const id = `rule-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const maxPriority = Math.max(0, ...this.rules.map(r => r.priority));

    return {
      id,
      name,
      priority: maxPriority + 1,
      enabled: true,
      mode: 'rule',
      conditions,
      action,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...options
    };
  }

  /**
   * 导入规则
   */
  importRules(rules: ClassificationRule[]): void {
    const newRules = rules.filter(
      r => !this.rules.some(existing => existing.id === r.id)
    );
    this.rules.push(...newRules);
  }

  /**
   * 导出规则
   */
  exportRules(): ClassificationRule[] {
    return this.rules.map(rule => ({ ...rule }));
  }

  /**
   * 获取规则统计
   */
  getStats(): { total: number; enabled: number; preset: number; custom: number } {
    const presetIds = new Set(PRESET_RULES.map(r => r.id));
    return {
      total: this.rules.length,
      enabled: this.rules.filter(r => r.enabled).length,
      preset: this.rules.filter(r => presetIds.has(r.id)).length,
      custom: this.rules.filter(r => !presetIds.has(r.id)).length
    };
  }
}

// 导出单例
export const ruleEngine = new RuleEngine();

/**
 * 对单个文件进行规则分类
 * @param fileName 文件名
 * @param filePath 文件路径
 * @param type 资源类型
 * @returns 分类结果或 null
 */
export const classifyFile = async (
  fileName: string,
  filePath: string,
  type: string
): Promise<{
  category: string;
  subfolder: string;
  confidence: number;
  reasoning: string;
  suggestedTags: string[];
} | null> => {
  // 创建一个临时 ResourceItem 对象用于规则匹配
  const tempItem: ResourceItem = {
    id: 'temp-classify',
    title: fileName.replace(/\.[^/.]+$/, ''),
    type: type as any,
    tags: [],
    folderId: undefined,
    color: 'tag-blue',
    path: filePath,
    localPath: filePath,
    originalPath: filePath,
    storageMode: 'reference',
    fileSize: 0,
    mimeType: '',
    isCloud: false,
    isStarred: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 使用规则引擎分类
  const results = ruleEngine.classify([tempItem]);
  const result = results[0];

  if (result && result.rule) {
    return {
      category: result.rule.name,
      subfolder: result.rule.action.targetFolder || '',
      confidence: result.confidence || 1.0,
      reasoning: result.rule.description || `Matched rule: ${result.rule.name}`,
      suggestedTags: result.suggestedTags || result.rule.action.tags || [],
    };
  }

  return null;
};

export default ruleEngine;
