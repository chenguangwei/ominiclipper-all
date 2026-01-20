/**
 * Vector Store Service - Semantic Search for OmniClipper
 *
 * This service provides semantic search capabilities using:
 * - Transformers.js for local embedding (all-MiniLM-L6-v2)
 * - LanceDB for vector storage and search
 *
 * The actual implementation runs in Electron main process.
 * This file provides the renderer-side API wrapper.
 */

export interface VectorSearchResult {
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
   * Index a document for semantic search
   */
  async indexDocument(doc: VectorIndexDocument): Promise<{ success: boolean; error?: string }> {
    if (!isElectron || !window.electronAPI?.vectorAPI) {
      return { success: false, error: 'Vector API not available' };
    }

    try {
      // Ensure initialized
      if (!this.initialized) {
        await this.initialize();
      }

      const result = await window.electronAPI.vectorAPI.index(doc.id, doc.text, doc.metadata);
      return result;
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
   * Perform semantic search
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

      const results = await window.electronAPI.vectorAPI.search(query, limit);
      return results || [];
    } catch (error) {
      console.error('[VectorStore] Search error:', error);
      return [];
    }
  }

  /**
   * Delete a document from the index
   */
  async deleteDocument(id: string): Promise<{ success: boolean; error?: string }> {
    if (!isElectron || !window.electronAPI?.vectorAPI) {
      return { success: false, error: 'Vector API not available' };
    }

    try {
      const result = await window.electronAPI.vectorAPI.delete(id);
      return result;
    } catch (error) {
      console.error('[VectorStore] Delete error:', error);
      return { success: false, error: String(error) };
    }
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
