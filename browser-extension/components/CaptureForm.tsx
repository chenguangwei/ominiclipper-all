import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ResourceType, ResourceItem, CaptureTab, TAG_OPTIONS, AppSettings } from '../types';
import { Globe, FileText, Image, Save, Loader2, CheckCircle, Tag, Wand2, Plus, AlertCircle, Camera, Scissors, Monitor, Upload, X, Cloud } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { SupabaseService } from '../services/supabaseService';

// Declare chrome types for extension context
declare const chrome: any;

interface CaptureFormProps {
  settings: AppSettings;
  onSaved: () => void;
}

interface PageInfo {
  title: string;
  url: string;
  description: string;
  favicon: string;
  siteName: string;
  selectedText?: string;
}

interface ArticleInfo {
  title: string;
  url: string;
  markdown: string;
  author: string;
  readingTime: number;
  favicon: string;
  siteName: string;
}

// Check if content script is available
const isContentScriptAvailable = async (tabId: number): Promise<boolean> => {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true;
  } catch {
    return false;
  }
};

// Inject content script if not available
const ensureContentScript = async (tabId: number): Promise<boolean> => {
  try {
    const isAvailable = await isContentScriptAvailable(tabId);
    if (isAvailable) return true;

    // Try to inject content script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });

    // Wait a bit for script to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    return true;
  } catch (error) {
    console.error('Failed to inject content script:', error);
    return false;
  }
};

// Get current tab info
const getCurrentTabInfo = async (): Promise<PageInfo | null> => {
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];

      if (tab && tab.id) {
        // Ensure content script is loaded
        const scriptReady = await ensureContentScript(tab.id);

        if (scriptReady) {
          try {
            const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_METADATA' });
            if (response && response.success) {
              return response.data;
            }
          } catch (e) {
            console.log('Content script not responding, using tab info');
          }
        }

        // Fallback to basic tab info
        const hostname = tab.url ? new URL(tab.url).hostname : '';
        return {
          title: tab.title || '',
          url: tab.url || '',
          description: '',
          favicon: tab.favIconUrl || `https://${hostname}/favicon.ico`,
          siteName: hostname.replace('www.', '')
        };
      }
    }

    // Development mode fallback
    return {
      title: document.title,
      url: window.location.href,
      description: '',
      favicon: '/favicon.ico',
      siteName: window.location.hostname
    };
  } catch (error) {
    console.error('Failed to get tab info:', error);
    return null;
  }
};

// Extract article from current page
const extractArticle = async (): Promise<ArticleInfo | null> => {
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];

      if (tab && tab.id) {
        // Ensure content script is loaded
        const scriptReady = await ensureContentScript(tab.id);

        if (!scriptReady) {
          throw new Error('Content script not available. Please refresh the page and try again.');
        }

        const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_ARTICLE' });
        if (response && response.success) {
          return response.data;
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to extract article:', error);
    throw error;
  }
};

// Smart tag suggestions
const suggestTags = (title: string, url: string, content: string): string[] => {
  const text = `${title} ${url} ${content}`.toLowerCase();
  const suggestedTags: string[] = [];

  const tagKeywords: Record<string, string[]> = {
    'Dev': ['developer', 'development', 'programming', 'code', 'github', 'npm', 'api', 'react', 'vue', 'javascript', 'typescript', 'python'],
    'Tool': ['tool', 'utility', 'extension', 'plugin', 'app', 'software'],
    'Design': ['design', 'figma', 'sketch', 'dribbble', 'ui', 'ux', 'css'],
    'Reading': ['article', 'blog', 'post', 'news', 'medium', 'tutorial', 'guide'],
    'Work': ['work', 'project', 'task', 'meeting', 'document'],
    'Inspiration': ['inspiration', 'creative', 'idea', 'portfolio']
  };

  for (const [tag, keywords] of Object.entries(tagKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      suggestedTags.push(tag);
    }
  }

  return suggestedTags.slice(0, 3);
};

const CaptureForm: React.FC<CaptureFormProps> = ({ settings, onSaved }) => {
  const [activeTab, setActiveTab] = useState<CaptureTab>('website');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [favicon, setFavicon] = useState('');
  const [siteName, setSiteName] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [author, setAuthor] = useState('');
  const [readingTime, setReadingTime] = useState(0);
  const [imageData, setImageData] = useState('');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [folderId] = useState<string | undefined>(undefined);

  const [isSaving, setIsSaving] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saveToCloud, setSaveToCloud] = useState(settings.storageMode === 'supabase');

  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-fill on mount and tab change
  useEffect(() => {
    if ((activeTab === 'website' || activeTab === 'image') && !url) {
      handleAutoFill(true);
    }
  }, [activeTab]);

  // Listen for screenshot messages from background
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'SCREENSHOT_RESULT' && message.data) {
        setActiveTab('image');
        setImageData(message.data.imageData);
        if (message.data.width && message.data.height) {
          setImageSize({ width: message.data.width, height: message.data.height });
        }
        // Auto-fill with page info
        if (message.data.sourceUrl) setUrl(message.data.sourceUrl);
        if (message.data.title) setTitle(message.data.title || 'Screenshot');
        if (message.data.description) setDescription(message.data.description);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener(handleMessage);
      return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }
  }, []);

  // Check for pending capture data from background
  useEffect(() => {
    const checkCaptureData = async () => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get('omniclipper_capture_data');
        if (result.omniclipper_capture_data) {
          try {
            const data = JSON.parse(result.omniclipper_capture_data);
            // Only use if recent (within 5 seconds)
            if (Date.now() - data.timestamp < 5000) {
              if (data.type === 'IMAGE' || data.imageData) {
                setActiveTab('image');
                if (data.imageData) setImageData(data.imageData);
                if (data.title) setTitle(data.title);
                if (data.url) setUrl(data.url);
                if (data.description) setDescription(data.description);
              } else if (data.type === 'ARTICLE' || data.markdown) {
                setActiveTab('article');
                if (data.title) setTitle(data.title);
                if (data.url) setUrl(data.url);
                if (data.markdown) setMarkdown(data.markdown);
                if (data.author) setAuthor(data.author);
              } else {
                if (data.title) setTitle(data.title);
                if (data.url) setUrl(data.url);
                if (data.description) setDescription(data.description);
                if (data.favicon) setFavicon(data.favicon);
                if (data.siteName) setSiteName(data.siteName);
              }
            }
            // Clear the capture data
            await chrome.storage.local.remove('omniclipper_capture_data');
          } catch (e) {
            console.error('Failed to parse capture data:', e);
          }
        }
      }
    };
    checkCaptureData();
  }, []);

  const handleAutoFill = async (silent: boolean = false) => {
    if (!silent) setIsFetching(true);
    setErrorMsg('');

    try {
      const pageInfo = await getCurrentTabInfo();
      if (pageInfo) {
        setTitle(pageInfo.title);
        setUrl(pageInfo.url);
        setDescription(pageInfo.description || '');
        setFavicon(pageInfo.favicon);
        setSiteName(pageInfo.siteName);

        const suggested = suggestTags(pageInfo.title, pageInfo.url, pageInfo.description || '');
        if (suggested.length > 0) {
          setSelectedTags(prev => [...new Set([...prev, ...suggested])]);
        }
      } else if (!silent) {
        setErrorMsg('Could not fetch page info');
      }
    } catch (error) {
      if (!silent) setErrorMsg('Failed to fetch page info');
    } finally {
      if (!silent) setIsFetching(false);
    }
  };

  const handleExtractArticle = async () => {
    setIsExtracting(true);
    setErrorMsg('');

    try {
      const article = await extractArticle();
      if (article) {
        setTitle(article.title);
        setUrl(article.url);
        setMarkdown(article.markdown);
        setAuthor(article.author);
        setReadingTime(article.readingTime);
        setFavicon(article.favicon);
        setSiteName(article.siteName);

        const suggested = suggestTags(article.title, article.url, article.markdown);
        setSelectedTags(prev => [...new Set([...prev, ...suggested, 'Reading'])]);
      } else {
        setErrorMsg('Could not extract article content. Please refresh the page and try again.');
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Failed to extract article. Please refresh the page.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleScreenshot = async (mode: 'area' | 'visible' | 'full') => {
    setErrorMsg('');

    try {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];

        if (tab && tab.id) {
          // For visible area, use chrome.tabs.captureVisibleTab directly from background
          if (mode === 'visible') {
            const response = await chrome.runtime.sendMessage({
              type: 'CAPTURE_VISIBLE_TAB_REQUEST',
              tabId: tab.id
            });

            if (response && response.success && response.dataUrl) {
              setImageData(response.dataUrl);
              // Get image dimensions
              const img = new window.Image();
              img.onload = () => {
                setImageSize({ width: img.width, height: img.height });
              };
              img.src = response.dataUrl;

              // Set page info
              setTitle(tab.title || 'Screenshot');
              setUrl(tab.url || '');
            } else {
              setErrorMsg(response?.error || 'Failed to capture screenshot');
            }
            return;
          }

          // For area selection, need content script
          const scriptReady = await ensureContentScript(tab.id);

          if (!scriptReady) {
            setErrorMsg('Cannot capture on this page. Please refresh and try again.');
            return;
          }

          const messageType = mode === 'area' ? 'START_AREA_SELECTION' : 'CAPTURE_FULL_PAGE';

          try {
            await chrome.tabs.sendMessage(tab.id, { type: messageType });

            // Close popup for area selection to show the overlay
            if (mode === 'area') {
              window.close();
            }
          } catch (e) {
            setErrorMsg('Failed to start screenshot. Please refresh the page.');
          }
        }
      }
    } catch (error) {
      setErrorMsg('Failed to capture screenshot');
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleImageFile(files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        setImageData(dataUrl);
        setImageSize({ width: img.width, height: img.height });
        // Use filename as title if not already set
        if (!title) {
          setTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);

    // Auto-fill page info if not already filled
    if (!url) {
      await handleAutoFill(true);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    const tag = customTag.trim();
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
      setCustomTag('');
    }
  };

  const getResourceType = (): ResourceType => {
    switch (activeTab) {
      case 'website': return ResourceType.WEB;
      case 'article': return ResourceType.ARTICLE;
      case 'image': return ResourceType.IMAGE;
      default: return ResourceType.WEB;
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setErrorMsg('Title is required');
      return;
    }

    if (activeTab === 'image' && !imageData) {
      setErrorMsg('Please capture or upload an image');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    const now = new Date().toISOString();
    const newItem: ResourceItem = {
      id: StorageService.generateId(),
      type: getResourceType(),
      title: title.trim(),
      tags: selectedTags,
      folderId: folderId,
      createdAt: now,
      updatedAt: now,
      isCloud: saveToCloud,
      isStarred: false,
      syncStatus: saveToCloud ? 'pending' : 'synced',

      // Common fields
      url: url || undefined,
      content: description,

      // Website specific
      favicon: activeTab === 'website' ? favicon : undefined,
      siteName: activeTab === 'website' ? siteName : undefined,
      description: activeTab === 'website' ? description : undefined,

      // Article specific
      markdown: activeTab === 'article' ? markdown : undefined,
      author: activeTab === 'article' ? author : undefined,
      readingTime: activeTab === 'article' ? readingTime : undefined,

      // Image specific
      imageData: activeTab === 'image' ? imageData : undefined,
      imageMimeType: activeTab === 'image' ? 'image/png' : undefined,
      imageSize: activeTab === 'image' ? imageSize : undefined,
      sourceUrl: activeTab === 'image' ? url : undefined,

      // Desktop compatibility
      contentSnippet: (description || markdown || '').substring(0, 200)
    };

    try {
      // Save to local storage
      StorageService.saveItem(newItem);

      // Sync to cloud if enabled
      if (saveToCloud && settings.storageMode === 'supabase') {
        const { url: supabaseUrl, anonKey, tableName } = settings.supabaseConfig;
        if (supabaseUrl && anonKey && tableName) {
          const syncSuccess = await SupabaseService.createRecord(
            settings.supabaseConfig,
            newItem,
            settings.userSession
          );
          if (syncSuccess) {
            StorageService.updateItemSyncStatus(newItem.id, 'synced');
          }
        }
      }

      setSuccessMsg('Saved!');

      // Reset form
      setTimeout(() => {
        setTitle('');
        setUrl('');
        setDescription('');
        setMarkdown('');
        setImageData('');
        setSelectedTags([]);
        setSuccessMsg('');
        onSaved();
      }, 1000);
    } catch (error) {
      console.error('Save failed:', error);
      setErrorMsg('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const displayedTags = Array.from(new Set([...TAG_OPTIONS, ...selectedTags]));

  // Only 3 tabs now: Website, Article, Image
  const tabs = [
    { id: 'website' as CaptureTab, icon: Globe, label: 'Website' },
    { id: 'article' as CaptureTab, icon: FileText, label: 'Article' },
    { id: 'image' as CaptureTab, icon: Image, label: 'Image' }
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4 mb-1" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Error Message */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="ml-auto">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Website Tab */}
        {activeTab === 'website' && (
          <>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              {favicon && (
                <img src={favicon} alt="" className="w-8 h-8 rounded" onError={(e) => (e.currentTarget.style.display = 'none')} />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-500 truncate">{siteName || 'Website'}</div>
                <div className="text-sm font-medium truncate">{title || 'Untitled'}</div>
              </div>
              <button
                onClick={() => handleAutoFill(false)}
                disabled={isFetching}
                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
              >
                {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              </button>
            </div>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />

            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL"
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
            />

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={3}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </>
        )}

        {/* Article Tab */}
        {activeTab === 'article' && (
          <>
            <button
              onClick={handleExtractArticle}
              disabled={isExtracting}
              className="w-full flex items-center justify-center gap-2 p-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors border border-blue-200"
            >
              {isExtracting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Extracting...</>
              ) : (
                <><FileText className="w-4 h-4" /> Extract Article Content</>
              )}
            </button>

            {markdown && (
              <div className="text-xs text-gray-500 flex items-center gap-3">
                {author && <span>By {author}</span>}
                {readingTime > 0 && <span>{readingTime} min read</span>}
              </div>
            )}

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Article Title"
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />

            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="Article content in Markdown format..."
              rows={8}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </>
        )}

        {/* Image Tab */}
        {activeTab === 'image' && (
          <>
            {/* Page info display */}
            {url && (
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-xs text-gray-600">
                <Globe className="w-3 h-3" />
                <span className="truncate">{url}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleScreenshot('area')}
                className="flex-1 flex flex-col items-center gap-1 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs text-gray-700 transition-colors border border-gray-200"
              >
                <Scissors className="w-5 h-5" />
                Area
              </button>
              <button
                onClick={() => handleScreenshot('visible')}
                className="flex-1 flex flex-col items-center gap-1 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs text-gray-700 transition-colors border border-gray-200"
              >
                <Monitor className="w-5 h-5" />
                Visible
              </button>
              <button
                onClick={() => handleScreenshot('full')}
                className="flex-1 flex flex-col items-center gap-1 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs text-gray-700 transition-colors border border-gray-200"
              >
                <Camera className="w-5 h-5" />
                Full Page
              </button>
            </div>

            <div
              ref={dropZoneRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg p-6 text-center cursor-pointer transition-colors bg-gray-50"
            >
              {imageData ? (
                <div className="relative">
                  <img src={imageData} alt="Preview" className="max-h-40 mx-auto rounded" />
                  <div className="text-xs text-gray-500 mt-2">{imageSize.width} x {imageSize.height}</div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setImageData(''); setImageSize({ width: 0, height: 0 }); }}
                    className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <div className="text-sm text-gray-600">Drop image or click to upload</div>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0])}
            />

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Image name (auto-filled from page title)"
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (auto-filled from page)"
              rows={2}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </>
        )}

        {/* Tags */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
            <Tag className="w-3 h-3" />
            Tags
          </label>

          <div className="flex gap-2">
            <input
              type="text"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
              placeholder="Add tag..."
              className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <button
              onClick={addCustomTag}
              disabled={!customTag.trim()}
              className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {displayedTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200 hover:border-blue-300'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 bg-gray-50 space-y-2">
        {/* Cloud sync toggle */}
        {settings.storageMode === 'supabase' && (
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={saveToCloud}
              onChange={(e) => setSaveToCloud(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <Cloud className="w-3.5 h-3.5" />
            Sync to cloud
          </label>
        )}

        <button
          onClick={handleSave}
          disabled={isSaving || !title}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-all ${
            isSaving || !title ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
          }`}
        >
          {isSaving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
          ) : successMsg ? (
            <><CheckCircle className="w-4 h-4" /> {successMsg}</>
          ) : (
            <><Save className="w-4 h-4" /> Save</>
          )}
        </button>
      </div>
    </div>
  );
};

export default CaptureForm;
