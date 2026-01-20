/**
 * OmniCollector - Rule Configuration Service
 * 规则配置管理 - 负责规则的持久化和配置管理
 */

import { ClassificationRule, RuleConfig } from '../types/classification';
import ruleEngine from './ruleEngine';

// 存储键
const STORAGE_KEY_RULES = 'OMNICLIPPER_CLASSIFICATION_RULES';
const STORAGE_KEY_RULE_CONFIG = 'OMNICLIPPER_RULE_CONFIG';

class RuleConfigService {
  /**
   * 获取所有规则
   */
  getRules(): ClassificationRule[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_RULES);
      if (stored) {
        const parsedRules: ClassificationRule[] = JSON.parse(stored);
        // 合并预置规则和用户规则
        const presetIds = new Set(parsedRules.filter(r => r.id.startsWith('rule-') === false).map(r => r.id));
        const defaultRules = ruleEngine.getRules().filter(r => r.id.startsWith('rule-') === false);

        // 添加缺失的预置规则
        const allRules = [...parsedRules];
        for (const defaultRule of defaultRules) {
          if (!allRules.some(r => r.id === defaultRule.id)) {
            allRules.push(defaultRule);
          }
        }

        return allRules;
      }
    } catch (error) {
      console.error('Failed to load rules:', error);
    }

    // 返回默认规则
    return ruleEngine.getRules();
  }

  /**
   * 保存规则
   */
  saveRules(rules: ClassificationRule[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules));
      // 更新规则引擎
      ruleEngine.resetToDefault();
      rules.forEach(rule => {
        if (!rule.id.startsWith('preset-')) {
          ruleEngine.addRule(rule);
        }
      });
    } catch (error) {
      console.error('Failed to save rules:', error);
    }
  }

  /**
   * 获取规则配置
   */
  getConfig(): RuleConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_RULE_CONFIG);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load rule config:', error);
    }

    // 默认配置
    return {
      rules: [],
      defaultFolder: 'Documents/OmniCollector',
      autoCreateFolder: true
    };
  }

  /**
   * 保存规则配置
   */
  saveConfig(config: RuleConfig): void {
    try {
      localStorage.setItem(STORAGE_KEY_RULE_CONFIG, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save rule config:', error);
    }
  }

  /**
   * 添加规则
   */
  addRule(rule: ClassificationRule): void {
    const rules = this.getRules();
    rules.push(rule);
    this.saveRules(rules);
  }

  /**
   * 更新规则
   */
  updateRule(ruleId: string, updates: Partial<ClassificationRule>): boolean {
    const rules = this.getRules();
    const index = rules.findIndex(r => r.id === ruleId);

    if (index !== -1) {
      rules[index] = { ...rules[index], ...updates, updatedAt: new Date().toISOString() };
      this.saveRules(rules);
      return true;
    }

    return false;
  }

  /**
   * 删除规则
   */
  deleteRule(ruleId: string): boolean {
    const rules = this.getRules();
    const rule = rules.find(r => r.id === ruleId);

    if (!rule) return false;

    // 预置规则只能禁用，不能删除
    if (rule.id.startsWith('preset-') || rule.id.startsWith('pdf-') ||
        rule.id.startsWith('images-') || rule.id.startsWith('office-') ||
        rule.id.startsWith('code-') || rule.id.startsWith('design-') ||
        rule.id.startsWith('archives-') || rule.id.startsWith('audio-') ||
        rule.id.startsWith('ebooks-')) {
      // 禁用预置规则
      rule.enabled = false;
      this.saveRules(rules);
      return true;
    }

    const newRules = rules.filter(r => r.id !== ruleId);
    this.saveRules(newRules);
    return true;
  }

  /**
   * 启用/禁用规则
   */
  toggleRule(ruleId: string, enabled: boolean): boolean {
    return this.updateRule(ruleId, { enabled });
  }

  /**
   * 调整规则优先级
   */
  moveRule(ruleId: string, direction: 'up' | 'down'): boolean {
    const rules = this.getRules();
    const index = rules.findIndex(r => r.id === ruleId);

    if (index === -1) return false;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= rules.length) return false;

    // 交换优先级
    const tempPriority = rules[index].priority;
    rules[index].priority = rules[newIndex].priority;
    rules[newIndex].priority = tempPriority;

    // 交换位置
    [rules[index], rules[newIndex]] = [rules[newIndex], rules[index]];

    this.saveRules(rules);
    return true;
  }

  /**
   * 重置为默认规则
   */
  resetToDefault(): void {
    localStorage.removeItem(STORAGE_KEY_RULES);
    ruleEngine.resetToDefault();
  }

  /**
   * 导出规则
   */
  exportRules(): string {
    const rules = this.getRules();
    const config = this.getConfig();
    return JSON.stringify({ rules, config, exportedAt: new Date().toISOString() }, null, 2);
  }

  /**
   * 导入规则
   */
  importRules(jsonString: string): { success: boolean; message: string; count: number } {
    try {
      const data = JSON.parse(jsonString);

      if (!data.rules || !Array.isArray(data.rules)) {
        return { success: false, message: 'Invalid rules format', count: 0 };
      }

      const currentRules = this.getRules();
      const existingIds = new Set(currentRules.map(r => r.id));
      const importedRules = data.rules.filter((r: ClassificationRule) => !existingIds.has(r.id));

      const newRules = [...currentRules, ...importedRules];
      this.saveRules(newRules);

      return {
        success: true,
        message: `Successfully imported ${importedRules.length} rules`,
        count: importedRules.length
      };
    } catch (error) {
      return { success: false, message: 'Failed to parse rules file', count: 0 };
    }
  }

  /**
   * 获取规则统计
   */
  getStats(): { total: number; enabled: number; preset: number; custom: number } {
    return ruleEngine.getStats();
  }

  /**
   * 测试规则匹配
   */
  testRule(ruleId: string, item: any): { matched: boolean; details: string } {
    const rules = this.getRules();
    const rule = rules.find(r => r.id === ruleId);

    if (!rule) {
      return { matched: false, details: 'Rule not found' };
    }

    const matched = ruleEngine.evaluateRule(item, rule);
    const matchedConditions = rule.conditions.map(c => ({
      condition: c,
      result: ruleEngine.evaluateCondition(item, c)
    }));

    return {
      matched,
      details: JSON.stringify(matchedConditions, null, 2)
    };
  }

  /**
   * 获取规则模板
   */
  getRuleTemplates(): Array<{
    id: string;
    name: string;
    description: string;
    conditions: ClassificationRule['conditions'];
    action: ClassificationRule['action'];
  }> {
    return [
      {
        id: 'template-by-type',
        name: '按文件类型分类',
        description: '根据文件扩展名自动分类',
        conditions: [
          { type: 'extension', operator: 'in', value: 'pdf,doc,docx' }
        ],
        action: {
          type: 'move',
          targetFolder: 'Documents',
          createFolder: true
        }
      },
      {
        id: 'template-by-keyword',
        name: '按关键词分类',
        description: '根据文件名中的关键词分类',
        conditions: [
          { type: 'keyword', operator: 'contains', value: '工作,项目,任务' }
        ],
        action: {
          type: 'tag',
          tags: ['工作']
        }
      },
      {
        id: 'template-by-size',
        name: '按文件大小分类',
        description: '根据文件大小分类',
        conditions: [
          { type: 'size', operator: 'gt', value: '10M' }
        ],
        action: {
          type: 'setColor',
          color: 'tag-red'
        }
      },
      {
        id: 'template-by-date',
        name: '按日期分类',
        description: '根据创建日期分类',
        conditions: [
          { type: 'date', operator: 'gt', value: '2024-01-01' }
        ],
        action: {
          type: 'move',
          targetFolder: 'Documents/2024',
          createFolder: true
        }
      }
    ];
  }

  /**
   * 从模板创建规则
   */
  createRuleFromTemplate(
    templateId: string,
    name: string,
    customAction?: Partial<ClassificationRule['action']>
  ): ClassificationRule | null {
    const templates = this.getRuleTemplates();
    const template = templates.find(t => t.id === templateId);

    if (!template) return null;

    return ruleEngine.createRule(
      name,
      template.conditions,
      { ...template.action, ...customAction }
    );
  }
}

// 导出单例
export const ruleConfigService = new RuleConfigService();
export default ruleConfigService;
