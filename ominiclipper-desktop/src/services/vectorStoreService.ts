/**
 * Vector Store Service - Hybrid Search for OmniClipper
 *
 * This service provides hybrid semantic + keyword search using:
 * - Transformers.js for local embedding (all-MiniLM-L6-v2)
 * - LanceDB for vector storage and similarity search
 * - SQLite FTS5 for BM25 full-text search
 * - Reciprocal Rank Fusion (RRF) for combining results
 *
 * The actual implementation runs in Electron main process.
 * This file provides the renderer-side API wrapper.
 */

export interface VectorSearchResult {
  id: string;
  text: string;
  score: number;
  vectorRank?: number;
  bm25Rank?: number;
  metadata: {
    title: string;
    type: string;
    tags: string[];
    createdAt?: string;
  };
}

export interface VectorStoreStats {
  totalDocs: number;
  lastUpdated: string;
  modelLoaded: boolean;
  dbPath: string;
}

export interface VectorIndexDocument {
  id: string;
  text: string;
  metadata: {
    title: string;
    type: string;
    tags: string[];
    createdAt: string;
  };
}

// Check if running in Electron environment
const isElectron = typeof window !== 'undefined' && window.electronAPI;

/**
 * Vector Store Service
 *
 * Provides semantic search capabilities through Electron IPC.
 * Falls back gracefully when running in web environment.
 */
class VectorStoreService {
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the vector store (load model and connect to database)
   */
  async initialize(): Promise<{ success: boolean; error?: string }> {
    if (this.initialized) {
      return { success: true };
    }

    if (this.initPromise) {
      await this.initPromise;
      return { success: this.initialized };
    }

    if (!isElectron || !window.electronAPI?.vectorAPI) {
      console.warn('[VectorStore] Not running in Electron, vector search disabled');
      return { success: false, error: 'Not running in Electron environment' };
    }

    this.initPromise = (async () => {
      try {
        const result = await window.electronAPI.vectorAPI.initialize();
        this.initialized = result.success;
        if (!result.success) {
          console.error('[VectorStore] Initialization failed:', result.error);
        } else {
          console.log('[VectorStore] Initialized successfully');
        }
      } catch (error) {
        console.error('[VectorStore] Initialization error:', error);
        this.initialized = false;
      }
    })();

    await this.initPromise;
    return { success: this.initialized };
  }

  /**
   * Index a document for both semantic and keyword search
   * Indexes into both LanceDB (vector) and SQLite FTS5 (BM25)
   */
  async indexDocument(doc: VectorIndexDocument): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) {
      return { success: false, error: 'Not in Electron environment' };
    }

    const errors: string[] = [];

    try {
      // Ensure initialized
      if (!this.initialized) {
        await this.initialize();
      }

      // Index in Vector Store (LanceDB)
      if (window.electronAPI?.vectorAPI) {
        try {
          const vectorResult = await window.electronAPI.vectorAPI.index(doc.id, doc.text, doc.metadata);
          if (!vectorResult.success) {
            errors.push(`Vector: ${vectorResult.error}`);
          } else {
            console.log('[VectorStore] Vector index success for:', doc.id);
          }
        } catch (e) {
          errors.push(`Vector: ${String(e)}`);
        }
      }

      // Index in BM25 Store (SQLite FTS5)
      if (window.electronAPI?.searchAPI) {
        try {
          const bm25Result = await window.electronAPI.searchAPI.index(doc.id, doc.text, doc.metadata);
          if (!bm25Result.success) {
            errors.push(`BM25: ${bm25Result.error}`);
          } else {
            console.log('[VectorStore] BM25 index success for:', doc.id);
          }
        } catch (e) {
          errors.push(`BM25: ${String(e)}`);
        }
      }

      if (errors.length > 0) {
        console.warn('[VectorStore] Index partial errors:', errors);
      }

      return { success: errors.length === 0, error: errors.join('; ') || undefined };
    } catch (error) {
      console.error('[VectorStore] Index error:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Batch index multiple documents
   */
  async indexBatch(docs: VectorIndexDocument[]): Promise<{ success: boolean; indexed: number; errors: string[] }> {
    if (!isElectron || !window.electronAPI?.vectorAPI) {
      return { success: false, indexed: 0, errors: ['Vector API not available'] };
    }

    const errors: string[] = [];
    let indexed = 0;

    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

    for (const doc of docs) {
      try {
        const result = await window.electronAPI.vectorAPI.index(doc.id, doc.text, doc.metadata);
        if (result.success) {
          indexed++;
        } else {
          errors.push(`${doc.id}: ${result.error}`);
        }
      } catch (error) {
        errors.push(`${doc.id}: ${String(error)}`);
      }
    }

    return { success: errors.length === 0, indexed, errors };
  }

  /**
   * Perform semantic search (vector only)
   */
  async search(query: string, limit = 10): Promise<VectorSearchResult[]> {
    if (!isElectron || !window.electronAPI?.vectorAPI) {
      console.warn('[VectorStore] Search unavailable: not in Electron');
      return [];
    }

    try {
      // Ensure initialized
      if (!this.initialized) {
        await this.initialize();
      }

      console.log('[VectorStore] Vector search for:', query);
      const results = await window.electronAPI.vectorAPI.search(query, limit);
      console.log('[VectorStore] Vector results:', results?.length || 0);
      return results || [];
    } catch (error) {
      console.error('[VectorStore] Search error:', error);
      return [];
    }
  }

  /**
   * Perform hybrid search (Vector + BM25 with RRF)
   * This is the recommended search method for best results
   */
  async hybridSearch(
    query: string,
    limit = 10,
    vectorWeight = 0.7,
    bm25Weight = 0.3
  ): Promise<VectorSearchResult[]> {
    if (!isElectron || !window.electronAPI?.searchAPI) {
      console.warn('[VectorStore] Hybrid search unavailable: not in Electron');
      return this.search(query, limit); // Fallback to vector-only
    }

    try {
      console.log('[VectorStore] Hybrid search for:', query);
      const results = await window.electronAPI.searchAPI.hybridSearch(
        query,
        limit,
        vectorWeight,
        bm25Weight
      );
      console.log('[VectorStore] Hybrid results:', results?.length || 0);
      return results || [];
    } catch (error) {
      console.error('[VectorStore] Hybrid search error:', error);
      // Fallback to vector-only search
      return this.search(query, limit);
    }
  }

  /**
   * Perform BM25 keyword search only
   */
  async bm25Search(query: string, limit = 10): Promise<VectorSearchResult[]> {
    if (!isElectron || !window.electronAPI?.searchAPI) {
      console.warn('[VectorStore] BM25 search unavailable: not in Electron');
      return [];
    }

    try {
      console.log('[VectorStore] BM25 search for:', query);
      const results = await window.electronAPI.searchAPI.bm25Search(query, limit);
      console.log('[VectorStore] BM25 results:', results?.length || 0);
      return results || [];
    } catch (error) {
      console.error('[VectorStore] BM25 search error:', error);
      return [];
    }
  }

  /**
   * Delete a document from both indexes
   */
  async deleteDocument(id: string): Promise<{ success: boolean; error?: string }> {
    if (!isElectron) {
      return { success: false, error: 'Not in Electron environment' };
    }

    const errors: string[] = [];

    // Delete from Vector Store
    if (window.electronAPI?.vectorAPI) {
      try {
        const result = await window.electronAPI.vectorAPI.delete(id);
        if (!result.success) {
          errors.push(`Vector: ${result.error}`);
        }
      } catch (e) {
        errors.push(`Vector: ${String(e)}`);
      }
    }

    // Delete from BM25 Store
    if (window.electronAPI?.searchAPI) {
      try {
        const result = await window.electronAPI.searchAPI.delete(id);
        if (!result.success) {
          errors.push(`BM25: ${result.error}`);
        }
      } catch (e) {
        errors.push(`BM25: ${String(e)}`);
      }
    }

    return { success: errors.length === 0, error: errors.join('; ') || undefined };
  }

  /**
   * Get vector store statistics
   */
  async getStats(): Promise<VectorStoreStats | null> {
    if (!isElectron || !window.electronAPI?.vectorAPI) {
      return null;
    }

    try {
      const stats = await window.electronAPI.vectorAPI.getStats();
      return stats;
    } catch (error) {
      console.error('[VectorStore] Get stats error:', error);
      return null;
    }
  }

  /**
   * Check for missing indexes
   */
  async checkMissing(ids: string[]): Promise<string[]> {
    if (!isElectron || !window.electronAPI?.vectorAPI?.checkMissing) {
      console.warn('[VectorStore] checkMissing unavailable');
      return ids; // Assume all missing if not available
    }

    try {
      // Ensure initialized
      if (!this.initialized) {
        await this.initialize();
      }
      return await window.electronAPI.vectorAPI.checkMissing(ids);
    } catch (error) {
      console.error('[VectorStore] checkMissing error:', error);
      return ids;
    }
  }

  /**
   * Check if vector search is available
   */
  isAvailable(): boolean {
    return isElectron && !!window.electronAPI?.vectorAPI;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
export const vectorStoreService = new VectorStoreService();

// Note: Window.electronAPI type is defined in storageService.ts
