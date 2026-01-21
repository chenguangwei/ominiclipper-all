import { useState, useEffect, useCallback } from 'react';
import { ResourceItem } from '../types';
import { getFileData } from '../utils/fileHelpers';

export const useFileContent = (item: ResourceItem | null, activeTab: 'details' | 'preview') => {
  const [content, setContent] = useState<ArrayBuffer | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadContent = useCallback(async (currentItem: ResourceItem) => {
    setLoading(true);
    setError(null);
    setContent(null);
    setUrl(null);

    try {
      const data = await getFileData(currentItem);
      setContent(data);

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

  return {
    content,
    url,
    loading,
    error,
    reload,
  };
};
