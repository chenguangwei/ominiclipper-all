import { useMemo, useCallback } from 'react';
import { ResourceItem, Tag, Folder, FilterState } from '@/types';

type SortType = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';

export const useFiltering = (
    items: ResourceItem[],
    tags: Tag[],
    folders: Folder[],
    filterState: FilterState,
    sortType: SortType,
    semanticSearchResults: string[],
    isSemanticSearchEnabled: boolean
) => {

    // Get descendant folder IDs
    const getDescendantFolderIds = useCallback((folderId: string): string[] => {
        const children = folders.filter(f => f.parentId === folderId);
        let ids = children.map(c => c.id);
        children.forEach(c => {
            ids = [...ids, ...getDescendantFolderIds(c.id)];
        });
        return ids;
    }, [folders]);

    // Filter logic with semantic search support
    const filteredItems = useMemo(() => {
        // Build semantic search set for fast lookup
        const semanticSet = new Set(semanticSearchResults);
        const hasSemanticResults = isSemanticSearchEnabled && semanticSearchResults.length > 0;

        let result = items.filter(item => {
            // Soft Delete / Trash Logic
            const isTrashView = filterState.folderId === 'trash';
            const isDeleted = !!item.deletedAt;

            // If in trash view, ONLY show deleted items
            if (isTrashView) {
                return isDeleted;
            }

            // If NOT in trash view, hide deleted items
            if (isDeleted) {
                return false;
            }

            // Standard Filtering (only for non-deleted items)

            // Search filter - use hybrid approach (semantic + keyword)
            if (filterState.search) {
                const keywordMatch = item.title.toLowerCase().includes(filterState.search.toLowerCase()) ||
                    item.tags.some(tagId => {
                        const tag = tags.find(t => t.id === tagId);
                        return tag?.name.toLowerCase().includes(filterState.search.toLowerCase());
                    }) ||
                    (item.contentSnippet?.toLowerCase().includes(filterState.search.toLowerCase()));

                const semanticMatch = hasSemanticResults && semanticSet.has(item.id);

                // Include if either keyword or semantic matches
                if (!keywordMatch && !semanticMatch) {
                    return false;
                }
            }

            // Type filter
            if (filterState.typeFilter && item.type !== filterState.typeFilter) {
                return false;
            }

            // Tag filter
            if (filterState.tagId) {
                if (!item.tags.includes(filterState.tagId)) {
                    const selectedTag = tags.find(t => t.id === filterState.tagId);
                    const childrenTags = tags.filter(t => t.parentId === selectedTag?.id).map(t => t.id);
                    const hasChildTag = item.tags.some(t => childrenTags.includes(t));
                    if (!hasChildTag) return false;
                }
            }

            // Color filter
            if (filterState.color && item.color !== filterState.color) {
                return false;
            }

            // Folder logic
            if (filterState.folderId === 'all') {
                return true;
            } else if (filterState.folderId === 'uncategorized') {
                return !item.folderId;
            } else if (filterState.folderId === 'untagged') {
                return item.tags.length === 0;
            } else if (filterState.folderId === 'recent') {
                const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                return new Date(item.updatedAt).getTime() > oneWeekAgo;
            } else if (filterState.folderId === 'starred') {
                return item.isStarred;
            } else {
                const relevantFolderIds = [filterState.folderId, ...getDescendantFolderIds(filterState.folderId)];
                return item.folderId && relevantFolderIds.includes(item.folderId);
            }
        });

        // Sort - prioritize semantic matches when searching
        result = [...result].sort((a, b) => {
            // When searching with semantic results, prioritize semantic matches
            if (filterState.search && hasSemanticResults) {
                const aIsSemantic = semanticSet.has(a.id);
                const bIsSemantic = semanticSet.has(b.id);

                if (aIsSemantic && !bIsSemantic) return -1;
                if (!aIsSemantic && bIsSemantic) return 1;

                // If both are semantic matches, sort by their order in results (relevance)
                if (aIsSemantic && bIsSemantic) {
                    const aIndex = semanticSearchResults.indexOf(a.id);
                    const bIndex = semanticSearchResults.indexOf(b.id);
                    return aIndex - bIndex;
                }
            }

            // Default sorting
            switch (sortType) {
                case 'date-desc':
                    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                case 'date-asc':
                    return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
                case 'name-asc':
                    return a.title.localeCompare(b.title);
                case 'name-desc':
                    return b.title.localeCompare(a.title);
                default:
                    return 0;
            }
        });

        return result;
    }, [filterState, items, tags, sortType, getDescendantFolderIds, semanticSearchResults, isSemanticSearchEnabled]);

    return filteredItems;
};
