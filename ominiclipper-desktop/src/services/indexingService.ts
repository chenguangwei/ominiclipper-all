/**
 * Indexing Service
 * Coordinates the extraction of content and indexing into Vector Store
 */

import { ResourceItem, ResourceType } from '../types';
import { extractFullContent } from './contentExtractionService';
import { vectorStoreService } from './vectorStoreService';

/**
 * Index a resource item
 * Extracts full content and sends to vector store
 */
export async function indexResourceItem(
    item: ResourceItem,
    filePath?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        console.log(`[IndexingService] Starting index for item: ${item.id} (${item.title})`);

        // 1. Get file path (prefer provided path, fallback to item path)
        const targetPath = filePath || item.path;

        if (!targetPath) {
            return { success: false, error: 'No file path available for indexing' };
        }

        // 2. Extract full content
        // Use a large limit for indexing (e.g. 50k chars)
        const text = await extractFullContent(item.type, targetPath, 50000);

        if (!text || text.length < 10) {
            console.warn(`[IndexingService] No extractable text found for ${item.id}`);
            return { success: false, error: 'No text extracted' };
        }

        console.log(`[IndexingService] Extracted ${text.length} chars. Sending to VectorStore...`);

        // 3. Index into Vector Store (and BM25 via hybrid service backend)
        const result = await vectorStoreService.indexDocument({
            id: item.id,
            text: text,
            metadata: {
                title: item.title,
                type: item.type,
                tags: item.tags || [],
                createdAt: item.createdAt
            }
        });

        if (result.success) {
            console.log(`[IndexingService] Successfully indexed ${item.id}`);
        } else {
            console.error(`[IndexingService] Indexing failed for ${item.id}:`, result.error);
        }

        return result;

    } catch (error) {
        console.error(`[IndexingService] Error indexing item ${item.id}:`, error);
        return { success: false, error: String(error) };
    }
}

/**
 * Batch index items
 */
export async function indexBatch(
    items: ResourceItem[]
): Promise<{ success: boolean; indexed: number; errors: string[] }> {
    let indexed = 0;
    const errors: string[] = [];

    for (const item of items) {
        const result = await indexResourceItem(item);
        if (result.success) {
            indexed++;
        } else {
            errors.push(`${item.id}: ${result.error}`);
        }
    }

    return { success: errors.length === 0, indexed, errors };
}
