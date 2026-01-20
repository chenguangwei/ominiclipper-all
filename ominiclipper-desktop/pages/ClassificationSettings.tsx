/**
 * OmniCollector - Classification Settings Page
 * 分类设置页面 - 配置规则引擎和 AI 分类器
 */

import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon';
import {
  ClassificationMode,
  ClassificationRule,
  AIClassifierConfig,
  LLMProviderType
} from '../types/classification';
import ruleConfigService from '../services/ruleConfig';
import aiClassifier from '../services/aiClassifier';
import llmProviderService, { LLM_PROVIDERS, SUBSCRIPTION_PLANS } from '../services/llmProvider';
import subscriptionManager from '../services/subscriptionManager';

interface ClassificationSettingsProps {
  onClose: () => void;
}

const ClassificationSettings: React.FC<ClassificationSettingsProps> = ({ onClose }) => {
  // 分类模式
  const [mode, setMode] = useState<ClassificationMode>('hybrid');

  // AI 配置
  const [aiProvider, setAiProvider] = useState<LLMProviderType>('openai');
  const [aiModel, setAiModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // 规则列表
  const [rules, setRules] = useState<ClassificationRule[]>([]);
  const [editingRule, setEditingRule] = useState<ClassificationRule | null>(null);

  // 导入设置
  const [autoClassify, setAutoClassify] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.6);
  const [autoOrganize, setAutoOrganize] = useState(false);

  // 订阅信息
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);

  // 加载配置
  useEffect(() => {
    loadConfig();
    loadSubscription();
  }, []);

  const loadConfig = () => {
    setRules(ruleConfigService.getRules());

    // 加载 AI 配置
    const aiConfig = aiClassifier.getConfig();
    if (aiConfig) {
      setAiProvider(aiConfig.provider);
      setAiModel(aiConfig.model);
      setApiKey(llmProviderService.getApiKey(aiConfig.provider));
    } else {
      // 默认选择第一个提供商
      const defaultProvider = LLM_PROVIDERS[0];
      setAiProvider(defaultProvider.id as LLMProviderType);
      setAiModel(llmProviderService.getDefaultModel(defaultProvider.id as LLMProviderType));
    }

    // 加载导入设置
    const config = ruleConfigService.getConfig();
    setAutoClassify(config.autoCreateFolder ?? true);
  };

  const loadSubscription = () => {
    setSubscriptionStatus(subscriptionManager.getStatus());
  };

  // 测试 API 连接
  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await llmProviderService.testConnection(aiProvider, apiKey, aiModel);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed'
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 保存 API Key
  const saveApiKey = () => {
    llmProviderService.saveApiKey(aiProvider, apiKey);

    // 保存 AI 配置
    if (apiKey) {
      aiClassifier.configure({
        provider: aiProvider,
        model: aiModel,
        apiKey
      });
    }

    setTestResult({ success: true, message: 'API key saved' });
  };

  // 切换规则启用状态
  const toggleRule = (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      ruleConfigService.toggleRule(ruleId, !rule.enabled);
      setRules(ruleConfigService.getRules());
    }
  };

  // 删除规则
  const deleteRule = (ruleId: string) => {
    if (confirm('确定要删除此规则吗？')) {
      ruleConfigService.deleteRule(ruleId);
      setRules(ruleConfigService.getRules());
    }
  };

  // 重置规则
  const resetRules = () => {
    if (confirm('确定要重置为默认规则吗？此操作不可撤销。')) {
      ruleConfigService.resetToDefault();
      setRules(ruleConfigService.getRules());
    }
  };

  // 订阅计划
  const currentPlan = SUBSCRIPTION_PLANS.find(p => p.id === subscriptionStatus?.plan?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-surface rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Icon name="category" className="text-primary text-2xl" />
            <div>
              <h2 className="text-lg font-semibold text-content">文件分类设置</h2>
              <p className="text-sm text-content-secondary">
                配置规则引擎和 AI 智能分类
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-secondary rounded-lg transition-colors"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* 分类模式选择 */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'rule', name: '规则引擎', icon: 'tune', desc: '基于预定义规则分类' },
                { id: 'ai', name: 'AI 智能', icon: 'auto_awesome', desc: '使用 AI 分析文件内容' },
                { id: 'hybrid', name: '两者结合', icon: 'psychology', desc: '规则优先，不匹配时使用 AI' }
              ].map((option) => (
                <button
                  key={option.id}
                  onClick={() => setMode(option.id as ClassificationMode)}
                  className={`p-4 rounded-xl border transition-all ${
                    mode === option.id
                      ? 'bg-primary/10 border-primary'
                      : 'bg-surface-secondary/50 border-transparent hover:border-white/10'
                  }`}
                >
                  <Icon name={option.icon} className={`text-2xl mb-2 ${mode === option.id ? 'text-primary' : 'text-content-secondary'}`} />
                  <h3 className={`font-medium ${mode === option.id ? 'text-primary' : 'text-content'}`}>
                    {option.name}
                  </h3>
                  <p className="text-sm text-content-secondary mt-1">{option.desc}</p>
                </button>
              ))}
            </div>

            {/* AI 设置 */}
            <div className="bg-surface-secondary/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Icon name="smart_toy" className="text-primary" />
                <h3 className="font-medium text-content">AI 智能分类设置</h3>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* 选择提供商 */}
                <div>
                  <label className="block text-sm text-content-secondary mb-1.5">
                    LLM 提供商
                  </label>
                  <select
                    value={aiProvider}
                    onChange={(e) => {
                      setAiProvider(e.target.value as LLMProviderType);
                      setAiModel(llmProviderService.getDefaultModel(e.target.value as LLMProviderType));
                    }}
                    className="w-full px-3 py-2 bg-surface rounded-lg border border-white/10 focus:outline-none focus:border-primary text-content"
                  >
                    {LLM_PROVIDERS.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 选择模型 */}
                <div>
                  <label className="block text-sm text-content-secondary mb-1.5">
                    模型
                  </label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full px-3 py-2 bg-surface rounded-lg border border-white/10 focus:outline-none focus:border-primary text-content"
                  >
                    {llmProviderService.getModels(aiProvider).map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* API Key */}
              <div className="mb-4">
                <label className="block text-sm text-content-secondary mb-1.5">
                  API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="输入 API Key"
                    className="flex-1 px-3 py-2 bg-surface rounded-lg border border-white/10 focus:outline-none focus:border-primary text-content"
                  />
                  <button
                    onClick={saveApiKey}
                    className="px-4 py-2 bg-surface-secondary hover:bg-surface-tertiary rounded-lg transition-colors text-sm"
                  >
                    保存
                  </button>
                </div>
              </div>

              {/* 测试连接 */}
              <div className="flex items-center gap-3">
                <button
                  onClick={testConnection}
                  disabled={isTesting || !apiKey}
                  className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors text-sm disabled:opacity-50"
                >
                  {isTesting ? (
                    <span className="flex items-center gap-2">
                      <Icon name="sync" className="animate-spin text-sm" />
                      测试中...
                    </span>
                  ) : (
                    '测试连接'
                  )}
                </button>

                {testResult && (
                  <span className={`text-sm ${testResult.success ? 'text-green-500' : 'text-red-500'}`}>
                    {testResult.message}
                  </span>
                )}
              </div>

              {/* 订阅信息 */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-content-secondary">
                      当前计划: <span className="text-content font-medium">{currentPlan?.name || '免费版'}</span>
                    </p>
                    <p className="text-xs text-content-secondary mt-1">
                      本月已使用: {((subscriptionStatus?.usage || 0) / 1000).toFixed(1)}K tokens
                      · 限额: {((subscriptionStatus?.limit || 100000) / 1000).toFixed(0)}K tokens
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(100, subscriptionStatus?.percentage || 0)}%` }}
                      />
                    </div>
                    <span className="text-xs text-content-secondary">
                      {Math.round(subscriptionStatus?.percentage || 0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 预设规则 */}
            <div className="bg-surface-secondary/30 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon name="rule" className="text-primary" />
                  <h3 className="font-medium text-content">分类规则</h3>
                </div>
                <button
                  onClick={resetRules}
                  className="text-sm text-content-secondary hover:text-content transition-colors"
                >
                  重置为默认
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      rule.enabled ? 'bg-surface' : 'bg-surface opacity-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => toggleRule(rule.id)}
                      className="w-4 h-4 rounded border-white/30 bg-surface-secondary text-primary focus:ring-primary"
                    />

                    <div className="flex-1">
                      <p className="text-sm font-medium text-content">{rule.name}</p>
                      <p className="text-xs text-content-secondary">
                        {rule.conditions.length} 个条件 → {rule.action.targetFolder || '标签'}
                      </p>
                    </div>

                    {!rule.id.startsWith('preset-') && !rule.id.startsWith('pdf-') &&
                     !rule.id.startsWith('images-') && !rule.id.startsWith('office-') &&
                     !rule.id.startsWith('code-') && (
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="p-1 hover:bg-surface-secondary rounded transition-colors"
                      >
                        <Icon name="delete" className="text-sm text-content-secondary" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* 添加规则按钮 */}
              <button className="w-full mt-3 py-2 border border-dashed border-white/20 rounded-lg text-sm text-content-secondary hover:text-content hover:border-white/40 transition-all">
                + 添加自定义规则
              </button>
            </div>

            {/* 导入设置 */}
            <div className="bg-surface-secondary/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Icon name="download" className="text-primary" />
                <h3 className="font-medium text-content">导入时自动分类</h3>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoClassify}
                    onChange={(e) => setAutoClassify(e.target.checked)}
                    className="w-4 h-4 rounded border-white/30 bg-surface-secondary text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-content">批量导入时自动触发分类</span>
                </label>

                <div className="pl-7 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoOrganize}
                      onChange={(e) => setAutoOrganize(e.target.checked)}
                      className="w-4 h-4 rounded border-white/30 bg-surface-secondary text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-content">高置信度结果自动整理文件</span>
                  </label>

                  <div className="flex items-center gap-3">
                    <span className="text-sm text-content-secondary">置信度阈值:</span>
                    <input
                      type="range"
                      min="0.5"
                      max="0.95"
                      step="0.05"
                      value={confidenceThreshold}
                      onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                      className="flex-1 accent-primary"
                    />
                    <span className="text-sm text-content w-12 text-right">
                      {Math.round(confidenceThreshold * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-surface-secondary/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-content-secondary hover:text-content transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => {
              // 保存配置
              saveApiKey();
              ruleConfigService.saveConfig({
                rules: [],
                autoCreateFolder: autoClassify
              });
              onClose();
            }}
            className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassificationSettings;
