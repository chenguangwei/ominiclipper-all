/**
 * OmniCollector - Auto Classify Dialog
 * 自动分类对话框 - 显示分类预览并允许用户确认或修改
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ClassificationResult, ClassificationRule, ResourceItem } from '../types/classification';
import { ColorMode } from '../types';
import Icon from './Icon';
import * as ruleConfigService from '../services/ruleConfig';

interface AutoClassifyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  items: ResourceItem[];
  results: ClassificationResult[];
  mode: 'rule' | 'ai' | 'hybrid';
  onConfirm: (results: ClassificationResult[]) => Promise<void>;
  colorMode?: ColorMode;
}

type GroupedResults = {
  [key: string]: ClassificationResult[];
};

const AutoClassifyDialog: React.FC<AutoClassifyDialogProps> = ({
  isOpen,
  onClose,
  items,
  results,
  mode,
  onConfirm,
  colorMode = 'dark'
}) => {
  const isLight = colorMode === 'light';

  // 浅色模式样式变量
  const dialogClass = isLight
    ? 'relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden'
    : 'relative bg-surface rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden';

  const headerClass = isLight
    ? 'flex items-center justify-between px-6 py-4 border-b border-gray-100'
    : 'flex items-center justify-between px-6 py-4 border-b border-white/10';

  const headerTitleClass = isLight ? 'text-lg font-semibold text-gray-900' : 'text-lg font-semibold text-content';

  const headerDescClass = isLight ? 'text-sm text-gray-500' : 'text-sm text-content-secondary';

  const selectClass = isLight
    ? 'bg-gray-50 px-3 py-1.5 rounded-lg text-sm border border-gray-200 focus:outline-none focus:border-primary'
    : 'bg-surface-secondary px-3 py-1.5 rounded-lg text-sm border border-white/10 focus:outline-none focus:border-primary';

  const closeBtnClass = isLight ? 'p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500' : 'p-2 hover:bg-surface-secondary rounded-lg transition-colors';

  const contentClass = isLight ? 'text-center py-12 text-gray-500' : 'text-center py-12 text-content-secondary';

  const itemBgClass = isLight ? 'bg-gray-50 border-gray-100' : 'bg-surface-secondary/50 border-transparent';

  const checkboxClass = isLight
    ? 'w-4 h-4 rounded border-gray-300 bg-white text-primary focus:ring-primary'
    : 'w-4 h-4 rounded border-white/30 bg-surface text-primary focus:ring-primary';

  const itemIconBgClass = isLight ? 'bg-gray-100' : 'bg-surface';

  const editBtnClass = isLight ? 'p-1.5 hover:bg-gray-100 rounded transition-colors' : 'p-1.5 hover:bg-surface rounded transition-colors';

  const footerClass = isLight
    ? 'flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50'
    : 'flex items-center justify-between px-6 py-4 border-t border-white/10 bg-surface-secondary/30';

  const statItemClass = isLight ? 'flex items-center gap-1 text-sm text-gray-500' : 'flex items-center gap-4 text-sm text-content-secondary';

  const cancelBtnClass = isLight ? 'px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors' : 'px-4 py-2 text-sm text-content-secondary hover:text-content transition-colors';

  const confirmBtnClass = isLight
    ? (isProcessing: boolean, hasSelection: boolean) => `px-6 py-2 rounded-lg text-sm font-medium transition-all ${isProcessing || !hasSelection ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#007aff] text-white hover:bg-[#0066d6]'}`
    : (isProcessing: boolean, hasSelection: boolean) => `px-6 py-2 rounded-lg text-sm font-medium transition-all ${isProcessing || !hasSelection ? 'bg-surface-secondary text-content-secondary cursor-not-allowed' : 'bg-primary text-white hover:bg-primary/90'}`;

  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [modifiedResults, setModifiedResults] = useState<Map<string, ClassificationResult>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // 初始化选中状态
  useEffect(() => {
    if (isOpen && results.length > 0) {
      const highConfidence = results.filter(
        r => (r.confidence ?? 0) >= 0.8 || r.rule
      );
      setSelectedResults(new Set(highConfidence.map(r => r.item.id)));
    }
  }, [isOpen, results]);

  // 按分类分组结果
  const groupedResults = useMemo(() => {
    const groups: GroupedResults = {};

    for (const result of results) {
      const key = result.category || result.rule?.name || '未分类';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(result);
    }

    return groups;
  }, [results]);

  // 按置信度筛选
  const filteredGroups = useMemo(() => {
    const filtered: GroupedResults = {};

    for (const [category, items] of Object.entries(groupedResults)) {
      const filteredItems = items.filter(r => {
        if (filter === 'all') return true;
        const conf = r.confidence ?? (r.rule ? 1 : 0);
        if (filter === 'high') return conf >= 0.8;
        if (filter === 'medium') return conf >= 0.6 && conf < 0.8;
        if (filter === 'low') return conf < 0.6;
        return true;
      });

      if (filteredItems.length > 0) {
        filtered[category] = filteredItems;
      }
    }

    return filtered;
  }, [groupedResults, filter]);

  // 获取置信度等级
  const getConfidenceLevel = (result: ClassificationResult): 'high' | 'medium' | 'low' => {
    const conf = result.confidence ?? (result.rule ? 1 : 0);
    if (conf >= 0.8) return 'high';
    if (conf >= 0.6) return 'medium';
    return 'low';
  };

  // 获取置信度颜色
  const getConfidenceColor = (level: 'high' | 'medium' | 'low'): string => {
    switch (level) {
      case 'high': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-red-500';
    }
  };

  // 获取置信度背景色
  const getConfidenceBgColor = (level: 'high' | 'medium' | 'low'): string => {
    switch (level) {
      case 'high': return 'bg-green-500/20 border-green-500/30';
      case 'medium': return 'bg-yellow-500/20 border-yellow-500/30';
      case 'low': return 'bg-red-500/20 border-red-500/30';
    }
  };

  // 切换选择
  const toggleSelect = (itemId: string) => {
    const newSelected = new Set(selectedResults);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedResults(newSelected);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedResults.size === results.length) {
      setSelectedResults(new Set());
    } else {
      setSelectedResults(new Set(results.map(r => r.item.id)));
    }
  };

  // 修改分类结果
  const modifyResult = (itemId: string, updates: Partial<ClassificationResult>) => {
    const newModified = new Map(modifiedResults);

    const existing = results.find(r => r.item.id === itemId);
    if (existing) {
      newModified.set(itemId, { ...existing, ...updates });
    }

    setModifiedResults(newModified);
  };

  // 获取最终结果（包含修改）
  const getFinalResults = (): ClassificationResult[] => {
    return results.map(result => {
      const modified = modifiedResults.get(result.item.id);
      return modified || result;
    }).filter(r => selectedResults.has(r.item.id));
  };

  // 处理确认
  const handleConfirm = async () => {
    setIsProcessing(true);
    setProgress({ current: 0, total: selectedResults.size });

    try {
      const finalResults = getFinalResults();
      await onConfirm(finalResults);

      // 模拟进度
      for (let i = 0; i < finalResults.length; i++) {
        setProgress({ current: i + 1, total: finalResults.length });
        await new Promise(r => setTimeout(r, 100));
      }
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  // 获取图标
  const getTypeIcon = (type: string): string => {
    const icons: Record<string, string> = {
      'PDF': 'picture_as_pdf',
      'IMAGE': 'image',
      'WORD': 'description',
      'WEB': 'link',
      'EPUB': 'menu_book',
      'default': 'insert_drive_file'
    };
    return icons[type] || icons.default;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className={dialogClass}>
        {/* Header */}
        <div className={headerClass}>
          <div className="flex items-center gap-3">
            <Icon name="auto_awesome" className="text-primary text-2xl" />
            <div>
              <h2 className={headerTitleClass}>分类预览</h2>
              <p className={headerDescClass}>
                共 {results.length} 个文件 · 已选择 {selectedResults.size} 个
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 筛选器 */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className={selectClass}
            >
              <option value="all">全部</option>
              <option value="high">高置信度 (≥80%)</option>
              <option value="medium">中置信度 (60-80%)</option>
              <option value="low">低置信度 (&lt;60%)</option>
            </select>

            <button
              onClick={onClose}
              className={closeBtnClass}
            >
              <Icon name="close" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {Object.keys(filteredGroups).length === 0 ? (
            <div className={contentClass}>
              <Icon name="folder_off" className="text-4xl mb-4 opacity-50" />
              <p>没有找到匹配的分类结果</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(filteredGroups).map(([category, items]) => (
                <div key={category} className="space-y-2">
                  {/* 分类标题 */}
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      checked={items.every(r => selectedResults.has(r.item.id))}
                      onChange={() => {
                        const categorySelected = items.every(r => selectedResults.has(r.item.id));
                        const newSelected = new Set(selectedResults);
                        items.forEach(r => {
                          if (categorySelected) {
                            newSelected.delete(r.item.id);
                          } else {
                            newSelected.add(r.item.id);
                          }
                        });
                        setSelectedResults(newSelected);
                      }}
                      className={checkboxClass}
                    />
                    <h3 className="font-medium text-content">{category}</h3>
                    <span className="text-sm text-content-secondary">({items.length})</span>
                  </div>

                  {/* 文件列表 */}
                  <div className="grid grid-cols-1 gap-2">
                    {items.map((result) => {
                      const level = getConfidenceLevel(result);
                      const isSelected = selectedResults.has(result.item.id);

                      return (
                        <div
                          key={result.item.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                            isSelected
                              ? getConfidenceBgColor(level)
                              : itemBgClass
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(result.item.id)}
                            className={checkboxClass}
                          />

                          {/* 文件图标 */}
                          <div className={`p-2 rounded-lg ${itemIconBgClass}`}>
                            <Icon name={getTypeIcon(result.item.type)} className="text-content-secondary" />
                          </div>

                          {/* 文件信息 */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-content truncate">
                              {result.item.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {/* 置信度 */}
                              {result.confidence !== undefined && (
                                <span className={`text-xs ${getConfidenceColor(level)}`}>
                                  {mode === 'ai' ? `🤖 ${Math.round(result.confidence * 100)}%` : '⚙️ 规则匹配'}
                                </span>
                              )}

                              {/* 目标文件夹 */}
                              {(result.subfolder || result.rule?.action.targetFolder) && (
                                <span className="text-xs text-content-secondary">
                                  → {result.subfolder || result.rule?.action.targetFolder}
                                </span>
                              )}

                              {/* 建议标签 */}
                              {result.suggestedTags && result.suggestedTags.length > 0 && (
                                <span className="text-xs text-primary">
                                  {result.suggestedTags.join(', ')}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                const newFolder = prompt('输入目标文件夹路径:', result.subfolder || result.rule?.action.targetFolder || '');
                                if (newFolder !== null) {
                                  modifyResult(result.item.id, { subfolder: newFolder });
                                }
                              }}
                              className={editBtnClass}
                              title="修改目标文件夹"
                            >
                              <Icon name="edit" className="text-sm" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={footerClass}>
          <div className="flex items-center gap-4">
            {/* 全选按钮 */}
            <button
              onClick={toggleSelectAll}
              className="text-sm text-content-secondary hover:text-content transition-colors"
            >
              {selectedResults.size === results.length ? '取消全选' : '全选'}
            </button>

            {/* 统计信息 */}
            <div className={statItemClass}>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                高置信度: {results.filter(r => getConfidenceLevel(r) === 'high').length}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                中置信度: {results.filter(r => getConfidenceLevel(r) === 'medium').length}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                低置信度: {results.filter(r => getConfidenceLevel(r) === 'low').length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className={cancelBtnClass}
            >
              取消
            </button>

            {/* 确认按钮 */}
            <button
              onClick={handleConfirm}
              disabled={isProcessing || selectedResults.size === 0}
              className={confirmBtnClass(isProcessing, selectedResults.size > 0)}
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <Icon name="sync" className="animate-spin text-sm" />
                  处理中 {progress.current}/{progress.total}
                </span>
              ) : (
                `确认分类 (${selectedResults.size})`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoClassifyDialog;
