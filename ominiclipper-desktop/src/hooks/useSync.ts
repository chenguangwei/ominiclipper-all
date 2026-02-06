import { useState, useEffect } from 'react';
import { ResourceItem, ResourceType } from '@/types';
import * as storageService from '@/services/storageService';
import { getClient } from '@/supabaseClient';

export const useSync = (
    items: ResourceItem[],
    setItems: (items: ResourceItem[]) => void,
    isStorageReady: boolean = true  // Add flag to wait for storage initialization
) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [user, setUser] = useState<any>(null);

    // Check existing session - only after storage is ready
    useEffect(() => {
        console.log('[useSync] useEffect triggered, isStorageReady:', isStorageReady);
        if (!isStorageReady) {
            console.log('[useSync] Waiting for storage to be ready...');
            return;
        }

        console.log('[useSync] Storage is ready, checking auth...');
        const client = getClient();
        if (client) {
            client.auth.getUser().then(({ data }) => {
                console.log('[useSync] Auth check complete, user:', data.user ? 'logged in' : 'not logged in');
                if (data.user) {
                    setUser(data.user);
                    // Auto sync on load if user exists
                    syncItems();
                }
            });
        } else {
            console.log('[useSync] No Supabase client, skipping sync');
        }
    }, [isStorageReady]);

    // Sync items with Supabase
    const syncItems = async () => {
        console.log('[useSync] syncItems called');
        const client = getClient();
        if (!client) {
            console.log('[useSync] No client, aborting sync');
            return;
        }

        setIsSyncing(true);
        try {
            const { data, error } = await client.from('resources').select('*');
            console.log('[useSync] Supabase query result - data:', data?.length || 0, 'error:', error ? error.message : 'none');
            if (error) {
                console.error('Sync error:', error);
            } else if (data && data.length > 0) {
                const cloudItems: ResourceItem[] = data.map((item: any) => ({
                    id: item.id,
                    title: item.title,
                    type: item.type as ResourceType,
                    tags: item.tags || [],
                    folderId: item.folder_id,
                    color: item.color || 'tag-blue',
                    isStarred: false,
                    createdAt: item.created_at,
                    updatedAt: item.updated_at,
                    path: item.path,
                    isCloud: true,
                    contentSnippet: item.content_snippet,
                }));

                const localItems = storageService.getItemsAsResourceItems();
                const mergedItems = [...cloudItems];

                localItems.forEach(localItem => {
                    if (!mergedItems.find(i => i.id === localItem.id)) {
                        mergedItems.push(localItem);
                    }
                });

                setItems(mergedItems);
                storageService.saveItems(mergedItems);
                console.log('Synced items:', cloudItems.length);
            }
        } catch (e) {
            console.error('Sync error:', e);
        } finally {
            setIsSyncing(false);
        }
    };

    // Handle browser extension sync
    useEffect(() => {
        // Expose sync handler to window for Electron IPC callbacks
        (window as any).handleBrowserExtensionSync = async (item: ResourceItem) => {
            console.log('[App] Received sync from browser extension:', item.title, 'type:', item.type);
            console.log('[App] Item has markdown:', !!item.markdown, 'length:', item.markdown?.length || 0);

            // Check if item already exists
            const existingIds = new Set(items.map(i => i.id));
            if (existingIds.has(item.id)) {
                console.log('[App] Item already exists, skipping:', item.id);
                return;
            }

            // Use addItem to save full metadata (including markdown) to files/{id}/metadata.json
            // This is important for ARTICLE type items from browser extension
            try {
                const savedItem = await storageService.addItem(item);
                console.log('[App] Synced item from browser extension:', savedItem.title, 'id:', savedItem.id);

                // Refresh items list
                setItems([...storageService.getItemsAsResourceItems()]);
            } catch (error) {
                console.error('[App] Failed to save item from browser extension:', error);
            }
        };

        return () => {
            delete (window as any).handleBrowserExtensionSync;
        };
    }, [items, setItems]);

    return { isSyncing, syncItems, user };
};
