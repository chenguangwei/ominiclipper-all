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

const { getModelConfig, DEFAULT_MODEL_ID } = require('./embeddingModels.cjs');

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
// Track current model
let currentModelConfig = null;

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
 * @param {string} modelId - ID of the embedding model to use
 */
async function initialize(userDataPath, modelId = DEFAULT_MODEL_ID) {
  // If already initialized with valid table and same model, return
  if (isInitialized && currentModelConfig && currentModelConfig.id === modelId) {
    return { success: true };
  }

  if (isInitializing) {
    // Wait for existing initialization
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // Check if the result matches what we wanted
    if (currentModelConfig && currentModelConfig.id === modelId) {
      return { success: isInitialized };
    }
    // If different model initialized, we proceed to re-initialize below
  }

  isInitializing = true;
  console.log(`[VectorService] Initializing with model: ${modelId}...`);

  try {
    // Load ES modules
    await loadModules();

    // Get model configuration
    const config = getModelConfig(modelId);
    currentModelConfig = config;

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

    console.log('[VectorService] Loading embedding model:', config.name);
    console.log('[VectorService] Models cache:', modelsPath);

    // Check if local model exists
    // Note: transformers.js stores 'Xenova/model-name' as 'models--Xenova--model-name' usually in cache,
    // or 'Xenova/model-name' in localModelPath if downloaded manually.
    // Let's rely on standard check or simple directory presence.
    // Xenova/bge-m3 -> Xenova/bge-m3
    const modelParts = config.name.split('/');
    const localModelDir = path.join(modelsPath, ...modelParts);
    const isModelPresent = fs.existsSync(path.join(localModelDir, 'config.json')) ||
      fs.existsSync(path.join(modelsPath, 'models--' + modelParts.join('--'))); // HF cache style

    console.log('[VectorService] Checking model path (estimated):', localModelDir);

    // We allow remote if not found locally
    if (!isModelPresent) {
      console.warn(`[VectorService] ${config.name} not found locally. Enabling remote download.`);
      env.allowRemoteModels = true;
    }

    // Load embedding model with retry mechanism
    console.log('[VectorService] Attempting to load embedding model:', config.name);
    let modelLoadAttempts = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000;

    // Reset embedder for new model
    embedder = null;

    while (modelLoadAttempts < MAX_RETRIES) {
      try {
        embedder = await pipeline('feature-extraction', config.name, {
          quantized: config.quantized,
          timeout: 60000, // Increase timeout for larger models
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

    // Open/Create Table for this model
    const tableName = config.tableName;
    console.log('[VectorService] Using table:', tableName);

    const tables = await db.tableNames();
    if (tables.includes(tableName)) {
      table = await db.openTable(tableName);
      const count = await table.countRows();
      console.log('[VectorService] Opened existing table with', count, 'documents');

      // Basic schema check could go here if needed
    } else {
      console.log('[VectorService] Table does not exist, will create on first insert');
      table = null;
    }

    isInitialized = true;
    isInitializing = false;

    console.log('[VectorService] Initialization complete with model:', config.id);
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
      console.log('[VectorService] Creating table with explicit schema for model:', currentModelConfig.name);

      const vectorDim = currentModelConfig.dim;
      const tableName = currentModelConfig.tableName;

      const schema = new arrow.Schema([
        new arrow.Field('id', new arrow.Utf8()),
        new arrow.Field('doc_id', new arrow.Utf8()),
        new arrow.Field('text', new arrow.Utf8()),
        new arrow.Field('chunk_index', new arrow.Int32()),
        new arrow.Field('vector', new arrow.FixedSizeList(vectorDim, new arrow.Field('item', new arrow.Float32()))),
        new arrow.Field('title', new arrow.Utf8(), true),
        new arrow.Field('type', new arrow.Utf8(), true),
        new arrow.Field('tags', new arrow.Utf8(), true),
        new arrow.Field('createdAt', new arrow.Utf8(), true),
      ]);
      table = await db.createTable(tableName, records, { schema });
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
 * @param {number} threshold - Min similarity threshold (0-1, lower distance is better)
 * @param {boolean} groupByDoc - If true, return best chunk per document. If false, return all matching chunks.
 */
async function search(query, limit = 5, threshold = 0.8, groupByDoc = true) {
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

    // Optimization: If not grouping by doc, we can return directly (after filtering)
    if (!groupByDoc) {
      const filteredResults = rawResults.filter(r => r._distance <= threshold);
      console.log(`[VectorService] Raw results (no grouping): ${filteredResults.length} chunks`);

      return filteredResults.slice(0, limit).map(r => ({
        id: r.doc_id, // For RAG, we might want doc_id as main ID but need chunk context. 
        // Actually, let's keep consistent interface: id = doc_id
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
      }));
    }

    // Aggregate results by doc_id, keeping best chunk per document
    const docMap = new Map();

    if (Array.isArray(rawResults)) {
      for (const r of rawResults) {
        // Filter by threshold (LanceDB returns distance, we want small distance)
        // distance 0 = perfect match. threshold 0.5 means accept distance <= 0.5
        // effectively similarity >= 0.5
        if (r._distance > threshold) {
          continue;
        }

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

      console.log('[VectorService] Search found', results.length, 'documents_chunks from', rawResults.length, 'total_chunks (threshold:', threshold, ')');
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
/**
 * Check which IDs are missing from the index
 * @param {string[]} ids - List of IDs to check
 * @returns {Promise<string[]>} - List of missing IDs
 */
async function checkMissing(ids) {
  if (!isInitialized || !table) {
    return ids; // All missing if service not ready
  }

  try {
    // Optimization: query all unique doc_ids
    // Note: limit is arbitrary high number, might need pagination for huge libraries
    const results = await table
      .query()
      .select(['doc_id'])
      .limit(1000000)
      .toArray();

    const presentIds = new Set(results.map(r => r.doc_id));
    return ids.filter(id => !presentIds.has(id));
  } catch (error) {
    console.error('[VectorService] Check missing error:', error);
    return ids; // Assume all missing on error to be safe (or empty?) 
    // Safest is to return ids so we re-try, but that might cause loops.
    // Better to log and return empty to avoid infinite re-indexing.
    // Actually, if we return ids, the app will try to index them.
    // Let's return ids for now.
    return ids;
  }
}

function isServiceInitialized() {
  return isInitialized;
}

module.exports = {
  initialize,
  indexDocument,
  search,
  deleteDocument,
  getStats,
  checkMissing,
  isServiceInitialized,
};
