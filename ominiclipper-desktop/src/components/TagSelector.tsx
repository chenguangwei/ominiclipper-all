/**
 * TagSelector Component
 * Inline dropdown for adding tags to items
 * Supports search and quick creation of new tags
 */

import React, { useState, useRef, useEffect } from 'react';
import { Tag, ColorMode } from '../types';
import Icon from './Icon';

interface TagSelectorProps {
  availableTags: Tag[];
  selectedTags: string[];
  onAddTag: (tagId: string) => void;
  onCreateTag?: (name: string) => Promise<string | null>;
  colorMode?: ColorMode;
  getTagName?: (tag: Tag) => string;
}

const TagSelector: React.FC<TagSelectorProps> = ({
  availableTags,
  selectedTags,
  onAddTag,
  onCreateTag,
  colorMode = 'dark',
  getTagName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isLight = colorMode === 'light';

  // Filter tags that are not already selected and match search query
  const filteredTags = availableTags.filter(
    t => !selectedTags.includes(t.id) &&
      t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if we can create a new tag (search query doesn't match any existing tag)
  const canCreateNew = searchQuery.trim() &&
    !availableTags.some(t => t.name.toLowerCase() === searchQuery.toLowerCase().trim());

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleAddTag = (tagId: string) => {
    onAddTag(tagId);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleCreateTag = async () => {
    if (!onCreateTag || !searchQuery.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const newTagId = await onCreateTag(searchQuery.trim());
      if (newTagId) {
        onAddTag(newTagId);
      }
      setSearchQuery('');
      setIsOpen(false);
    } catch (error) {
      console.error('[TagSelector] Failed to create tag:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (canCreateNew && onCreateTag) {
        handleCreateTag();
      } else if (filteredTags.length === 1) {
        handleAddTag(filteredTags[0].id);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  // Styles
  const buttonClass = isLight
    ? 'flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors'
    : 'flex items-center justify-center w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 text-content-secondary hover:text-content transition-colors';

  const dropdownClass = isLight
    ? 'absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[200px] max-h-[280px] overflow-hidden'
    : 'absolute top-full left-0 mt-1 z-50 bg-surface-secondary border border-[rgb(var(--color-border)/0.1)] rounded-lg shadow-xl py-1 min-w-[200px] max-h-[280px] overflow-hidden';

  const inputClass = isLight
    ? 'w-full px-3 py-2 text-sm bg-gray-50 border-b border-gray-200 outline-none focus:bg-white placeholder:text-gray-400'
    : 'w-full px-3 py-2 text-sm bg-surface-tertiary border-b border-[rgb(var(--color-border)/0.1)] outline-none focus:bg-surface placeholder:text-content-secondary text-content';

  const tagItemClass = isLight
    ? 'flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors'
    : 'flex items-center gap-2 w-full px-3 py-1.5 text-sm text-content hover:bg-surface-tertiary cursor-pointer transition-colors';

  const createItemClass = isLight
    ? 'flex items-center gap-2 w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors border-t border-gray-100'
    : 'flex items-center gap-2 w-full px-3 py-2 text-sm text-primary hover:bg-primary/10 cursor-pointer transition-colors border-t border-[rgb(var(--color-border)/0.1)]';

  const emptyClass = isLight
    ? 'px-3 py-4 text-sm text-gray-400 text-center'
    : 'px-3 py-4 text-sm text-content-secondary text-center';

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClass}
        title="Add tag"
      >
        <Icon name="add" className="text-[14px]" />
      </button>

      {isOpen && (
        <div className={dropdownClass}>
          {/* Search Input */}
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or create tag..."
            className={inputClass}
          />

          {/* Tag List */}
          <div className="max-h-[180px] overflow-y-auto">
            {filteredTags.length > 0 ? (
              filteredTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => handleAddTag(tag.id)}
                  className={tagItemClass}
                >
                  <Icon
                    name="label"
                    className={`text-[16px] ${tag.color ? `text-${tag.color}` : isLight ? 'text-gray-400' : 'text-content-secondary'}`}
                  />
                  <span className="flex-1 text-left truncate">
                    {getTagName ? getTagName(tag) : tag.name}
                  </span>
                  {tag.count !== undefined && (
                    <span className={`text-[10px] ${isLight ? 'text-gray-400' : 'text-content-secondary'}`}>
                      {tag.count}
                    </span>
                  )}
                </button>
              ))
            ) : !canCreateNew ? (
              <div className={emptyClass}>
                {searchQuery ? 'No matching tags' : 'No available tags'}
              </div>
            ) : null}
          </div>

          {/* Create New Tag Option */}
          {canCreateNew && onCreateTag && (
            <button
              onClick={handleCreateTag}
              disabled={isCreating}
              className={createItemClass}
            >
              <Icon name={isCreating ? 'sync' : 'add_circle'} className={`text-[16px] ${isCreating ? 'animate-spin' : ''}`} />
              <span>Create "{searchQuery.trim()}"</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TagSelector;
