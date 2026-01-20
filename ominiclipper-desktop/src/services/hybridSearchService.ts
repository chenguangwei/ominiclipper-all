// src/services/hybridSearchService.ts

import { SearchResult } from '../types/chat';

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
    // TODO: 集成 LanceDB 向量搜索
    // return window.electron?.vectorStore.search(query, limit) || [];
    return [];
  }

  protected async bm25Search(query: string, limit: number): Promise<SearchResult[]> {
    // TODO: 集成现有 FTS5 搜索
    return [];
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
