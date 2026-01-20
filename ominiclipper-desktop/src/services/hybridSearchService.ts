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

    const [vectorResults, bm25Results] = await Promise.all([
      this.vectorSearch(query, limit * 2),
      this.bm25Search(query, limit * 2),
    ]);

    return this.fuseResults(vectorResults, bm25Results, vectorWeight, bm25Weight, limit);
  }

  private async vectorSearch(query: string, limit: number): Promise<SearchResult[]> {
    // TODO: 集成 LanceDB 向量搜索
    // return window.electron?.vectorStore.search(query, limit) || [];
    return [];
  }

  private async bm25Search(query: string, limit: number): Promise<SearchResult[]> {
    // TODO: 集成现有 FTS5 搜索
    return [];
  }

  private fuseResults(
    vector: SearchResult[],
    bm25: SearchResult[],
    vWeight: number,
    bWeight: number,
    limit: number
  ): SearchResult[] {
    const scoreMap = new Map<string, number>();
    const sourceMap = new Map<string, SearchResult>();

    vector.forEach((r, i) => {
      const score = (1 - i / vector.length) * vWeight;
      scoreMap.set(r.id, (scoreMap.get(r.id) || 0) + score);
      sourceMap.set(r.id, r);
    });

    bm25.forEach((r, i) => {
      const score = (1 - i / bm25.length) * bWeight;
      scoreMap.set(r.id, (scoreMap.get(r.id) || 0) + score);
      sourceMap.set(r.id, r);
    });

    return Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => sourceMap.get(id)!)
      .filter(Boolean);
  }
}

export const hybridSearchService = new HybridSearchService();
