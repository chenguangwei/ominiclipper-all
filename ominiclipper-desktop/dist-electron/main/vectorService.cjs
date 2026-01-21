/**
 * Vector Service for Electron Main Process
 *
 * Provides local semantic search using:
 * - Transformers.js (all-MiniLM-L6-v2) for embedding
 * - LanceDB for vector storage
 * - Apache Arrow for schema definition
 */

const path = require('path');
const fs = require('fs');
const arrow = require('apache-arrow');
const { splitIntoChunks } = require('./textChunker.cjs');

// Dynamic imports for ES modules
let pipeline = null;
let env = null;
let lancedb = null;

// Service state
let embedder = null;
let db = null;
let table = null;
let isInitializing = false;
let isInitialized = false;
let dbPath = null;
let modelsPath = null;

// Model configuration
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const VECTOR_DIM = 384;
const TABLE_NAME = 'documents';

/**
 * Load ES modules dynamically
 */
async function loadModules() {
  if (!pipeline) {
    const transformers = await import('@xenova/transformers');
    pipeline = transformers.pipeline;
    env = transformers.env;
  }
  if (!lancedb) {
    lancedb = await import('@lancedb/lancedb');
  }
}

/**
 * Initialize the vector service
 * @param {string} userDataPath - Electron app.getPath('userData')
 */
async function initialize(userDataPath) {
  if (isInitialized) {
    return { success: true };
  }

  if (isInitializing) {
    // Wait for existing initialization
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return { success: isInitialized };
  }

  isInitializing = true;
  console.log('[VectorService] Initializing...');

  try {
    // Load ES modules
    await loadModules();

    // Set up paths
    const basePath = path.join(userDataPath, 'OmniCollector');
    dbPath = path.join(basePath, 'vector.lance');
    modelsPath = path.join(basePath, 'models');

    // Ensure directories exist
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }
    if (!fs.existsSync(modelsPath)) {
      fs.mkdirSync(modelsPath, { recursive: true });
    }

    // Configure Transformers.js to use local models only
    env.cacheDir = modelsPath;
    env.localModelPath = modelsPath;
    env.allowLocalModels = true;
    env.allowRemoteModels = false; // Disable network fetching

    console.log('[VectorService] Loading embedding model:', MODEL_NAME);
    console.log('[VectorService] Models cache:', modelsPath);

    // Check if local model exists
    const localModelDir = path.join(modelsPath, 'Xenova', 'all-MiniLM-L6-v2');
    const configPath = path.join(localModelDir, 'config.json');
    console.log('[VectorService] Local model path:', localModelDir);
    console.log('[VectorService] Model exists locally:', fs.existsSync(configPath));

    if (!fs.existsSync(configPath)) {
      console.warn('[VectorService] Local model not found. Please download the model first.');
      console.warn('[VectorService] Expected path:', localModelDir);
      // Allow remote fetch as fallback
      env.allowRemoteModels = true;
    }

    // Load embedding model with retry mechanism
    console.log('[VectorService] Attempting to load embedding model:', MODEL_NAME);
    let modelLoadAttempts = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000;

    while (modelLoadAttempts < MAX_RETRIES) {
      try {
        embedder = await pipeline('feature-extraction', MODEL_NAME, {
          quantized: true, // Use quantized model for smaller size
          timeout: 30000, // Increase timeout to 30 seconds
        });
        console.log('[VectorService] Model loaded successfully');
        break; // Success, exit loop
      } catch (modelError) {
        modelLoadAttempts++;
        console.warn(`[VectorService] Model load attempt ${modelLoadAttempts} failed:`, modelError.message);

        if (modelLoadAttempts < MAX_RETRIES) {
          console.log(`[VectorService] Retrying in ${RETRY_DELAY}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        } else {
          console.error('[VectorService] All retry attempts failed');
          throw new Error(`Failed to load embedding model after ${MAX_RETRIES} attempts: ${modelError.message}`);
        }
      }
    }

    // Connect to LanceDB
    console.log('[VectorService] Connecting to LanceDB:', dbPath);
    db = await lancedb.connect(dbPath);

    // Check if table exists and has correct schema
    const tables = await db.tableNames();
    if (tables.includes(TABLE_NAME)) {
      table = await db.openTable(TABLE_NAME);
      const count = await table.countRows();
      console.log('[VectorService] Opened existing table with', count, 'documents');

      // Check if schema has doc_id field, if not, recreate table
      try {
        const schema = await table.schema();
        const fields = schema.fields.map(f => f.name);
        if (!fields.includes('doc_id')) {
          console.log('[VectorService] Old schema detected without doc_id, recreating table...');
          await db.dropTable(TABLE_NAME);
          table = null;
        }
      } catch (e) {
        console.log('[VectorService] Could not check schema, recreating table...');
        await db.dropTable(TABLE_NAME);
        table = null;
      }
    } else {
      console.log('[VectorService] Table will be created on first insert');
      table = null;
    }

    isInitialized = true;
    isInitializing = false;

    console.log('[VectorService] Initialization complete');
    return { success: true };
  } catch (error) {
    console.error('[VectorService] Initialization failed:', error);
    isInitializing = false;
    return { success: false, error: error.message };
  }
}

/**
 * Generate embedding for text
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - Embedding vector
 */
async function embed(text) {
  if (!embedder) {
    throw new Error('Embedder not initialized');
  }

  // Truncate text if too long (model max is ~512 tokens)
  const truncatedText = text.slice(0, 2000);

  const output = await embedder(truncatedText, {
    pooling: 'mean',
    normalize: true,
  });

  // Convert to regular array
  return Array.from(output.data);
}

/**
 * Index a document (with automatic text chunking)
 * @param {string} docId - Document ID
 * @param {string} text - Document text
 * @param {object} metadata - Document metadata
 */
async function indexDocument(docId, text, metadata) {
  if (!isInitialized) {
    return { success: false, error: 'Service not initialized' };
  }

  try {
    // Split text into chunks for better RAG retrieval
    const chunks = splitIntoChunks(text, { chunkSize: 800, chunkOverlap: 100 });

    if (chunks.length === 0) {
      return { success: false, error: 'No content to index' };
    }

    // Delete existing chunks for this document
    if (table) {
      try {
        await table.delete(`doc_id = '${docId}'`);
        console.log('[VectorService] Deleted existing chunks for document:', docId);
      } catch (e) {
        // Ignore - document may not exist
      }
    }

    // Generate embeddings and create records for all chunks
    const records = [];
    for (const chunk of chunks) {
      const vector = await embed(chunk.text);

      records.push({
        id: chunk.id,              // Unique chunk ID
        doc_id: docId,             // Original document ID
        text: chunk.text,          // Full chunk text (no truncation)
        chunk_index: chunk.index,  // Position in document
        vector: vector,
        title: metadata.title || '',
        type: metadata.type || '',
        tags: JSON.stringify(metadata.tags || []),
        createdAt: metadata.createdAt || new Date().toISOString(),
      });
    }

    if (!table) {
      // Create table with explicit schema using Apache Arrow
      console.log('[VectorService] Creating table with explicit schema');
      const schema = new arrow.Schema([
        new arrow.Field('id', new arrow.Utf8()),
        new arrow.Field('doc_id', new arrow.Utf8()),
        new arrow.Field('text', new arrow.Utf8()),
        new arrow.Field('chunk_index', new arrow.Int32()),
        new arrow.Field('vector', new arrow.FixedSizeList(VECTOR_DIM, new arrow.Field('item', new arrow.Float32()))),
        new arrow.Field('title', new arrow.Utf8(), true),
        new arrow.Field('type', new arrow.Utf8(), true),
        new arrow.Field('tags', new arrow.Utf8(), true),
        new arrow.Field('createdAt', new arrow.Utf8(), true),
      ]);
      table = await db.createTable(TABLE_NAME, records, { schema });
    } else {
      await table.add(records);
    }

    console.log('[VectorService] Indexed document:', docId, '- chunks:', records.length);
    return { success: true, chunksIndexed: records.length };
  } catch (error) {
    console.error('[VectorService] Index error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Search for similar documents
 * @param {string} query - Search query
 * @param {number} limit - Max results (per document)
 */
async function search(query, limit = 5) {
  if (!isInitialized || !table) {
    console.log('[VectorService] Search skipped: not initialized or no data');
    return [];
  }

  try {
    const queryVector = await embed(query);

    // Search for similar chunks
    // 🔴 修复点：将 .execute() 改为 .toArray()
    const rawResults = await table
      .search(queryVector)
      .limit(limit * 3)  // Get more chunks, then deduplicate
      .toArray();

    console.log('[VectorService] Search rawResults type:', typeof rawResults, 'value:', rawResults);

    // Aggregate results by doc_id, keeping best chunk per document
    const docMap = new Map();

    if (Array.isArray(rawResults)) {
      for (const r of rawResults) {
        const docId = r.doc_id;
        if (!docMap.has(docId) || r._distance < docMap.get(docId).score) {
          docMap.set(docId, {
            id: docId,
            chunk_id: r.id,
            text: r.text,
            score: r._distance,
            chunk_index: r.chunk_index,
            metadata: {
              title: r.title,
              type: r.type,
              tags: JSON.parse(r.tags || '[]'),
              createdAt: r.createdAt,
            },
          });
        }
      }

      // Convert to array and sort by score
      const results = Array.from(docMap.values())
        .sort((a, b) => a.score - b.score)
        .slice(0, limit);

      console.log('[VectorService] Search found', results.length, 'documents from', rawResults.length, 'chunks');
      return results;
    } else {
      console.error('[VectorService] Search results not iterable:', typeof rawResults, rawResults);
      return [];
    }
  } catch (error) {
    console.error('[VectorService] Search error:', error);
    return [];
  }
}

/**
 * Delete a document from the index (all its chunks)
 * @param {string} docId - Document ID
 */
async function deleteDocument(docId) {
  if (!isInitialized || !table) {
    return { success: false, error: 'Service not initialized' };
  }

  try {
    const result = await table.delete(`doc_id = '${docId}'`);
    console.log('[VectorService] Deleted document:', docId);
    return { success: true };
  } catch (error) {
    console.error('[VectorService] Delete error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get service statistics
 */
async function getStats() {
  const stats = {
    totalDocs: 0,
    lastUpdated: new Date().toISOString(),
    modelLoaded: !!embedder,
    dbPath: dbPath || '',
  };

  if (table) {
    try {
      stats.totalDocs = await table.countRows();
    } catch (e) {
      // Ignore count errors
    }
  }

  return stats;
}

/**
 * Check if service is initialized
 */
function isServiceInitialized() {
  return isInitialized;
}

module.exports = {
  initialize,
  indexDocument,
  search,
  deleteDocument,
  getStats,
  isServiceInitialized,
};
