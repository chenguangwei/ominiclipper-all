import { useState, useEffect, useCallback } from 'react';
import { ResourceItem } from '../types';
import { getFileData } from '../utils/fileHelpers';

export const useFileContent = (item: ResourceItem | null, activeTab: 'details' | 'preview') => {
  const [content, setContent] = useState<ArrayBuffer | null>(null);
  const [contentItemId, setContentItemId] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContent = useCallback(async (currentItem: ResourceItem) => {
    // Track which item we're loading content for
    const targetItemId = currentItem.id;
    setLoading(true);
    setError(null);
    setContent(null);
    setUrl(null);

    try {
      const data = await getFileData(currentItem);
      // Only set content if we're still loading for the same item
      if (targetItemId === currentItem.id) {
        setContent(data);
        setContentItemId(targetItemId);
      }

      // For images, also create a blob URL for direct img tag use
      if (currentItem.type === 'IMAGE') {
        const blob = new Blob([data], { type: currentItem.mimeType || 'image/png' });
        const blobUrl = URL.createObjectURL(blob);
        setUrl(blobUrl);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load file content');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load content when tab changes to preview and item exists
  useEffect(() => {
    if (activeTab !== 'preview' || !item) {
      return;
    }

    loadContent(item);

    // Cleanup URL object
    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [activeTab, item, loadContent]);

  const reload = useCallback(() => {
    if (item && activeTab === 'preview') {
      loadContent(item);
    }
  }, [item, activeTab, loadContent]);

  // Check if content is stale (belongs to a different item)
  const isContentStale = item && contentItemId !== item.id;

  return {
    content: isContentStale ? null : content,
    url: isContentStale ? null : url,
    loading: loading || (!!item && activeTab === 'preview' && isContentStale),
    error: isContentStale ? null : error,
    reload,
  };
};
