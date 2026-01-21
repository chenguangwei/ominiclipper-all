// src/services/hybridSearchService.ts

import { SearchResult } from '../types/chat';

// Extend window for Electron API
declare global {
  interface Window {
    electronAPI?: {
      vectorAPI?: {
        search: (query: string, limit: number) => Promise<VectorSearchResult[]>;
        initialize: () => Promise<{ success: boolean; error?: string }>;
        index: (id: string, text: string, metadata: any) => Promise<{ success: boolean }>;
        delete: (id: string) => Promise<{ success: boolean }>;
        getStats: () => Promise<{ totalDocs: number; lastUpdated: string; modelLoaded: boolean; dbPath: string }>;
      };
      searchAPI?: {
        index: (id: string, text: string, metadata: any) => Promise<{ success: boolean }>;
        delete: (id: string) => Promise<{ success: boolean }>;
        bm25Search: (query: string, limit: number) => Promise<BM25SearchResult[]>;
        getStats: () => Promise<{ totalDocs: number; dbPath: string }>;
      };
    };
  }
}

interface VectorSearchResult {
  id: string;
  text: string;
  score: number;
  metadata: {
    title: string;
    type: string;
    tags: string[];
    createdAt: string;
  };
}

interface BM25SearchResult {
  id: string;
  title: string;
  type: string;
  text: string;
  score: number;
}

export interface HybridSearchOptions {
  query: string;
  limit?: number;
  vectorWeight?: number;
  bm25Weight?: number;
}

export class HybridSearchService {
  async search(opts: HybridSearchOptions): Promise<SearchResult[]> {
    const { query, limit = 5, vectorWeight = 0.6, bm25Weight = 0.4 } = opts;

    // 权重归一化
    const totalWeight = vectorWeight + bm25Weight;
    const normalizedVWeight = totalWeight > 0 ? vectorWeight / totalWeight : 0.6;
    const normalizedBWeight = totalWeight > 0 ? bm25Weight / totalWeight : 0.4;

    try {
      const [vectorResults, bm25Results] = await Promise.all([
        this.vectorSearch(query, limit * 2),
        this.bm25Search(query, limit * 2),
      ]);

      return this.fuseResults(
        vectorResults,
        bm25Results,
        normalizedVWeight,
        normalizedBWeight,
        limit
      );
    } catch (error) {
      console.error('[HybridSearch] Search failed:', error);
      // 返回空数组而不是崩溃
      return [];
    }
  }

  protected async vectorSearch(query: string, limit: number): Promise<SearchResult[]> {
    try {
      // 调用 Electron 主进程的向量搜索
      const results = await window.electronAPI?.vectorAPI?.search(query, limit);
      if (!results || results.length === 0) {
        console.log('[HybridSearch] No vector results found');
        return [];
      }

      // 转换为 SearchResult 格式
      return results.map((r: VectorSearchResult) => ({
        id: r.id,
        title: r.metadata?.title || 'Untitled',
        type: r.metadata?.type || 'unknown',
        text: r.text || '',
        score: 1 - (r.score || 0), // LanceDB 返回的是距离，转换为相似度
      }));
    } catch (error) {
      console.error('[HybridSearch] Vector search failed:', error);
      return [];
    }
  }

  protected async bm25Search(query: string, limit: number): Promise<SearchResult[]> {
    try {
      // 调用 Electron 主进程的 BM25 全文搜索
      const results = await window.electronAPI?.searchAPI?.bm25Search(query, limit);
      if (!results || results.length === 0) {
        console.log('[HybridSearch] No BM25 results found');
        return [];
      }

      // 转换为 SearchResult 格式
      return results.map((r: BM25SearchResult) => ({
        id: r.id,
        title: r.title || 'Untitled',
        type: r.type || 'document',
        text: r.text || '',
        score: r.score || 0,
      }));
    } catch (error) {
      console.error('[HybridSearch] BM25 search failed:', error);
      return [];
    }
  }

  protected fuseResults(
    vector: SearchResult[],
    bm25: SearchResult[],
    vWeight: number,
    bWeight: number,
    limit: number
  ): SearchResult[] {
    const scoreMap = new Map<string, number>();
    const sourceMap = new Map<string, SearchResult>();

    // 处理向量结果
    vector.forEach((r, i) => {
      const score = vector.length > 0 ? (1 - i / vector.length) * vWeight : 0;
      scoreMap.set(r.id, (scoreMap.get(r.id) || 0) + score);
      sourceMap.set(r.id, r);
    });

    // 处理 BM25 结果
    bm25.forEach((r, i) => {
      const score = bm25.length > 0 ? (1 - i / bm25.length) * bWeight : 0;
      scoreMap.set(r.id, (scoreMap.get(r.id) || 0) + score);
      sourceMap.set(r.id, r);
    });

    // 排序并返回 Top-K，安全处理可能的 undefined
    return Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => sourceMap.get(id))
      .filter((r): r is SearchResult => r !== undefined);
  }
}

export const hybridSearchService = new HybridSearchService();
