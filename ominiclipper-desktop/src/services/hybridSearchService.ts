// src/services/hybridSearchService.ts
//
// Hybrid Search Service - Combines Vector (semantic) + BM25 (keyword) search
// Uses vectorStoreService which handles IPC communication with Electron main process

import { vectorStoreService, VectorSearchResult } from './vectorStoreService';
import { SearchResult } from '../types/chat';

export interface HybridSearchOptions {
  query: string;
  limit?: number;
  vectorWeight?: number;
  bm25Weight?: number;
  minScore?: number;     // Minimum RRF score threshold (0.0 - 1.0)
                          // Note: For RRF scores, use lower values like 0.005
  groupByDoc?: boolean;  // Group results by document ID
}

export class HybridSearchService {
  /**
   * Perform hybrid search combining vector similarity and BM25 keyword matching
   *
   * @param opts Search options including query, limits, weights, and confidence threshold
   * @returns Search results filtered by confidence threshold
   */
  async search(opts: HybridSearchOptions): Promise<SearchResult[]> {
    const {
      query,
      limit = 5,
      vectorWeight = 0.6,
      bm25Weight = 0.4,
      minScore = 0.005,  // Lower threshold for RRF scores (0.6 * 1/61 ≈ 0.01 for rank 1)
      groupByDoc = true
    } = opts;

    if (!query.trim()) {
      return [];
    }

    try {
      console.log('[HybridSearch] Searching:', query, 'minScore:', minScore);

      // Use vectorStoreService which handles both Vector and BM25 search
      // Request more results than needed to allow for confidence filtering
      const results = await vectorStoreService.hybridSearch(
        query,
        limit * 2,  // Get extra results for filtering
        vectorWeight,
        bm25Weight,
        groupByDoc
      );

      console.log('[HybridSearch] Raw results:', results?.length || 0);

      if (!results || results.length === 0) {
        console.log('[HybridSearch] No results found');
        return [];
      }

      // Filter by confidence threshold and convert to SearchResult format
      const filtered = results
        .filter(r => {
          const passThreshold = r.score >= minScore;
          if (!passThreshold) {
            console.log(`[HybridSearch] Filtered out: "${r.metadata?.title}" (score: ${r.score.toFixed(3)} < ${minScore})`);
          }
          return passThreshold;
        })
        .slice(0, limit)
        .map(r => this.toSearchResult(r));

      console.log('[HybridSearch] After filtering:', filtered.length, 'results');
      return filtered;
    } catch (error) {
      console.error('[HybridSearch] Search failed:', error);
      return [];
    }
  }

  /**
   * Perform vector-only semantic search
   * Useful for testing or when keyword matching is not desired
   */
  async vectorSearch(query: string, limit: number, minScore = 0.1): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    try {
      console.log('[HybridSearch] Vector-only search:', query);
      const results = await vectorStoreService.search(query, limit * 2);

      return results
        .filter(r => r.score >= minScore)
        .slice(0, limit)
        .map(r => this.toSearchResult(r));
    } catch (error) {
      console.error('[HybridSearch] Vector search failed:', error);
      return [];
    }
  }

  /**
   * Perform BM25-only keyword search
   * Uses SQLite FTS5 full-text search via Electron main process
   */
  async bm25Search(query: string, limit: number): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    try {
      console.log('[HybridSearch] BM25-only search:', query);
      const results = await vectorStoreService.bm25Search(query, limit);

      console.log('[HybridSearch] BM25 results:', results?.length || 0);
      return results.map(r => this.toSearchResult(r));
    } catch (error) {
      console.error('[HybridSearch] BM25 search failed:', error);
      return [];
    }
  }

  /**
   * Convert VectorSearchResult to SearchResult format
   * Used by AIAssistant and other consumers
   */
  private toSearchResult(r: VectorSearchResult): SearchResult {
    return {
      id: r.id,
      title: r.metadata?.title || 'Untitled',
      type: r.metadata?.type || 'unknown',
      text: r.text || '',
      score: r.score,
    };
  }
}

// Singleton export
export const hybridSearchService = new HybridSearchService();
