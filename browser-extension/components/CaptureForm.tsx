import React, { useState, useEffect } from 'react';
import { ItemType, SavedItem, TAG_OPTIONS, AppSettings } from '../types';
import { Link, FileText, Save, Loader2, CheckCircle, Tag, Wand2, Plus } from 'lucide-react';
import { StorageService } from '../services/storageService';
import { FeishuService } from '../services/feishuService';
import { SupabaseService } from '../services/supabaseService';

interface CaptureFormProps {
  settings: AppSettings;
  onSaved: () => void;
}

const CaptureForm: React.FC<CaptureFormProps> = ({ settings, onSaved }) => {
  const [activeTab, setActiveTab] = useState<ItemType>('link');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Simulating getting current tab info in an extension
  useEffect(() => {
    if (activeTab === 'link' && !url) {
      // In a real WXT extension: browser.tabs.query({active: true})...
      // We trigger the auto-fill initially
      handleAutoFill(true);
    }
  }, [activeTab]);

  const handleAutoFill = (silent: boolean = false) => {
    if (!silent) setIsFetching(true);
    
    // Simulate async scraping of the page
    setTimeout(() => {
      // Mock Data representing a real website scrape
      const pageTitle = "WXT - The Next Gen Web Extension Framework";
      const pageUrl = "https://wxt.dev/guide/introduction";
      const pageDesc = "WXT provides the best developer experience for building browser extensions. It supports HMR, manifest validation, and works with React, Vue, Svelte, and more.";
      
      setTitle(pageTitle);
      setUrl(pageUrl);
      setContent(pageDesc);
      
      // Smart tagging simulation
      if (!selectedTags.includes('Dev') && !selectedTags.includes('Tool')) {
        setSelectedTags(prev => {
           const newTags = [...prev];
           if (!newTags.includes('Dev')) newTags.push('Dev');
           if (!newTags.includes('Tool')) newTags.push('Tool');
           return newTags;
        });
      }
      
      if (!silent) setIsFetching(false);
    }, silent ? 0 : 600); // Instant on mount, delayed on button click for effect
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const addCustomTag = () => {
    const tag = customTag.trim();
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
      setCustomTag('');
    }
  };

  const handleCustomTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomTag();
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    setIsSaving(true);

    const newItem: SavedItem = {
      id: crypto.randomUUID(),
      type: activeTab,
      title,
      content,
      url: activeTab === 'link' ? url : undefined,
      tags: selectedTags,
      createdAt: Date.now(),
      synced: false
    };

    // 1. Always save locally first (offline first approach)
    StorageService.saveItem(newItem);

    // 2. Sync Logic
    let syncSuccess = false;

    if (settings.storageMode === 'feishu') {
      syncSuccess = await FeishuService.createRecord(settings.feishuConfig, newItem);
    } else if (settings.storageMode === 'supabase' && settings.subscription.isActive) {
      syncSuccess = await SupabaseService.createRecord(settings.supabaseConfig, newItem, settings.userSession);
    }

    if (syncSuccess) {
      StorageService.updateItemSyncStatus(newItem.id, true);
    }

    setIsSaving(false);
    setSuccessMsg('Saved successfully!');
    
    // Reset form partially
    setTitle('');
    setContent('');
    if (activeTab === 'note') setUrl('');
    setSelectedTags([]);
    setCustomTag('');
    
    setTimeout(() => {
      setSuccessMsg('');
      onSaved();
    }, 1500);
  };

  // Combine default options with any currently selected custom tags for display
  const displayedTags = Array.from(new Set([...TAG_OPTIONS, ...selectedTags]));

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setActiveTab('link')}
          className={`flex-1 flex items-center justify-center py-3 text-sm font-medium transition-colors ${
            activeTab === 'link'
              ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Link className="w-4 h-4 mr-2" />
          Save Link
        </button>
        <button
          onClick={() => setActiveTab('note')}
          className={`flex-1 flex items-center justify-center py-3 text-sm font-medium transition-colors ${
            activeTab === 'note'
              ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4 mr-2" />
          Note
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Title Input */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={activeTab === 'link' ? "Page title..." : "Note title..."}
            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-sm"
          />
        </div>

        {/* URL Input (Only for Link) */}
        {activeTab === 'link' && (
          <div className="space-y-1">
            <div className="flex justify-between items-end mb-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">URL</label>
                <button 
                    onClick={() => handleAutoFill(false)}
                    disabled={isFetching}
                    className="text-[10px] flex items-center gap-1.5 text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-md transition-colors font-medium border border-brand-100"
                    title="Refresh page info"
                >
                    {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    {isFetching ? "Fetching..." : "Auto-Fill Info"}
                </button>
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-sm font-mono text-gray-600"
            />
          </div>
        )}

        {/* Content/Description Input */}
        <div className="space-y-1 flex-1 flex flex-col">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex justify-between">
            <span>{activeTab === 'link' ? "Page Description" : "Markdown Content"}</span>
            <span className="text-gray-400 text-[10px] font-normal normal-case">Supports Markdown</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={activeTab === 'link' ? "Page meta description will appear here..." : "Write your thoughts here... \n# Heading\n- List item"}
            className="w-full flex-1 min-h-[120px] p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all text-sm resize-none"
          />
        </div>

        {/* Tags */}
        <div className="space-y-2">
           <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center">
             <Tag className="w-3 h-3 mr-1" />
             Tags
           </label>
           
           {/* Custom Tag Input */}
           <div className="flex gap-2">
               <input
                 type="text"
                 value={customTag}
                 onChange={(e) => setCustomTag(e.target.value)}
                 onKeyDown={handleCustomTagKeyDown}
                 placeholder="Add custom tag..."
                 className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-md focus:ring-1 focus:ring-brand-500 outline-none transition-shadow"
               />
               <button
                 onClick={addCustomTag}
                 disabled={!customTag.trim()}
                 className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md text-xs font-medium disabled:opacity-50 transition-colors border border-gray-200"
               >
                 <Plus className="w-3.5 h-3.5" />
               </button>
           </div>

           <div className="flex flex-wrap gap-2 pt-1">
             {displayedTags.map(tag => (
               <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-brand-100 text-brand-700 border-brand-200'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
                }`}
               >
                 {tag}
               </button>
             ))}
           </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-100 bg-gray-50">
        <button
          onClick={handleSave}
          disabled={isSaving || !title}
          className={`w-full flex items-center justify-center py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition-all ${
            isSaving || !title ? 'bg-brand-400 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-700 active:scale-[0.98]'
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : successMsg ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              {successMsg}
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Item
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CaptureForm;