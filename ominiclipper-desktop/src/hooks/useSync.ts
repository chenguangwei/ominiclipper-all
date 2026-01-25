import { useState, useEffect } from 'react';
import { ResourceItem, ResourceType } from '@/types';
import * as storageService from '@/services/storageService';
import { getClient } from '@/supabaseClient';

export const useSync = (
    items: ResourceItem[],
    setItems: (items: ResourceItem[]) => void
) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [user, setUser] = useState<any>(null);

    // Check existing session
    useEffect(() => {
        const client = getClient();
        if (client) {
            client.auth.getUser().then(({ data }) => {
                if (data.user) {
                    setUser(data.user);
                    // Auto sync on load if user exists
                    syncItems();
                }
            });
        }
    }, []);

    // Sync items with Supabase
    const syncItems = async () => {
        const client = getClient();
        if (!client) return;

        setIsSyncing(true);
        try {
            const { data, error } = await client.from('resources').select('*');
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
                    createdAt: item.created_at,
                    updatedAt: item.updated_at,
                    path: item.path,
                    isCloud: true,
                    contentSnippet: item.content_snippet,
                }));

                const localItems = storageService.getItems();
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
            console.log('[App] Received sync from browser extension:', item.title);

            // Check if item already exists
            const existingIds = new Set(items.map(i => i.id));
            if (existingIds.has(item.id)) {
                console.log('[App] Item already exists, skipping:', item.id);
                return;
            }

            // Add item to state and storage
            const newItems = [item, ...items];
            storageService.saveItems(newItems);
            await storageService.flushPendingWrites();
            setItems([...storageService.getItems()]);
            console.log('[App] Synced item from browser extension:', item.title);
        };

        return () => {
            delete (window as any).handleBrowserExtensionSync;
        };
    }, [items, setItems]);

    return { isSyncing, syncItems, user };
};
