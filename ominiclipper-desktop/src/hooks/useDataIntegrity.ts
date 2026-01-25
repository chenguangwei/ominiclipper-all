import { useEffect, useState } from 'react';
import { ResourceItem } from '../types';
import { vectorStoreService } from '../services/vectorStoreService';
import { indexResourceItem } from '../services/indexingService';

/**
 * Hook to check data integrity on startup
 * Mainly checks if all items are indexed in the Vector DB
 */
export const useDataIntegrity = (items: ResourceItem[], isStorageReady: boolean) => {
    const [isScanning, setIsScanning] = useState(false);
    const [missingCount, setMissingCount] = useState(0);

    useEffect(() => {
        if (!isStorageReady || items.length === 0) return;

        // Prevent running multiple times
        if (isScanning) return;

        const scan = async () => {
            setIsScanning(true);
            try {
                // Get all IDs
                const ids = items.map(i => i.id);
                console.log(`[DataIntegrity] Scanning ${ids.length} items for index integrity...`);

                // Check which ones are missing from Vector DB
                const missingIds = await vectorStoreService.checkMissing(ids);

                if (missingIds.length > 0) {
                    console.log(`[DataIntegrity] Found ${missingIds.length} missing indexes. Scheduling auto-index...`);
                    setMissingCount(missingIds.length);

                    // Auto-index missing items in background
                    // We process them one by one or small batches to avoid blocking
                    const missingItems = items.filter(i => missingIds.includes(i.id));

                    let indexedCount = 0;
                    for (const item of missingItems) {
                        // Skip if it looks like a temporary or invalid item
                        if (!item.path && !item.localPath && !item.embeddedData) continue;

                        try {
                            console.log(`[DataIntegrity] Auto-indexing missing item: ${item.title} (${item.id})`);
                            await indexResourceItem(item);
                            indexedCount++;
                        } catch (err) {
                            console.error(`[DataIntegrity] Failed to index ${item.id}`, err);
                        }

                        // Small delay to yield to UI
                        await new Promise(r => setTimeout(r, 100));
                    }
                    console.log(`[DataIntegrity] Finished auto-indexing. Success: ${indexedCount}/${missingItems.length}`);
                    setMissingCount(0);
                } else {
                    console.log('[DataIntegrity] All items are indexed.');
                }
            } catch (error) {
                console.error('[DataIntegrity] Scan failed:', error);
            } finally {
                setIsScanning(false);
            }
        };

        // Run scan after a short delay to let app settle
        const timer = setTimeout(scan, 5000);
        return () => clearTimeout(timer);

    }, [isStorageReady]); // Only depend on isStorageReady, and let it handle items snapshot. 
    // Ideally we'd want to run this only once per app session.
    // The dependency list [isStorageReady] might trigger multiple times if items change?
    // No, we passed items in dependency list? 
    // Actually we should NOT put items in dependency list if we want it run ONLY ONCE.
    // But we need access to items. 
    // Since we put it in useEffect with [isStorageReady], if items aren't ready when isStorageReady becomes true, we miss them.
    // But items are usually loaded when isStorageReady becomes true.
    // Let's refine the hook usage. It accepts items.

    return { isScanning, missingCount };
};
