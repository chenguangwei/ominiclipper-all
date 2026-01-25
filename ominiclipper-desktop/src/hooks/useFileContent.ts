import { useState, useEffect, useCallback } from 'react';
import { ResourceItem } from '../types';
import { getFileData } from '../utils/fileHelpers';

export const useFileContent = (item: ResourceItem | null, activeTab: 'details' | 'preview') => {
  const [content, setContent] = useState<ArrayBuffer | null>(null);
  // 【关键修复】追踪当前内容属于哪个 Item ID，防止旧数据污染
  const [contentItemId, setContentItemId] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContent = useCallback(async (currentItem: ResourceItem) => {
    setLoading(true);
    setError(null);
    // 注意：这里不立即清空 content，防止 UI 闪烁。
    // 我们通过下方的 isContentStale 来控制是否显示。

    try {
      const data = await getFileData(currentItem);
      setContent(data);
      setContentItemId(currentItem.id); // 标记这份数据归属的 ID

      // For images, also create a blob URL
      if (currentItem.type === 'IMAGE') {
        const blob = new Blob([data], { type: currentItem.mimeType || 'image/png' });
        const blobUrl = URL.createObjectURL(blob);
        setUrl(blobUrl);
      } else {
        setUrl(null);
      }
    } catch (err: any) {
      console.error('[useFileContent] Load error:', err);
      setError(err.message || 'Failed to load file content');
      setContent(null);
      // 【关键修复】即使出错，也要标记当前 ID 已处理完毕
      setContentItemId(currentItem.id);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'preview' || !item) {
      return;
    }
    loadContent(item);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [activeTab, item, loadContent]);

  const reload = useCallback(() => {
    if (item && activeTab === 'preview') {
      loadContent(item);
    }
  }, [item, activeTab, loadContent]);

  // 【关键修复】如果当前 Item ID 与内容的 ID 不匹配，说明数据是陈旧的
  const isContentStale = item && contentItemId !== item.id;

  return {
    // 只有当 ID 匹配时才返回 content
    content: isContentStale ? null : content,
    url: isContentStale ? null : url,
    // 【关键修复】如果数据陈旧，也视为 loading 状态，但如果已有错误则不显示 loading
    loading: loading || (!!item && activeTab === 'preview' && isContentStale && !error),
    error: isContentStale ? null : error,
    reload,
  };
};
