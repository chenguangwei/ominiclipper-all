/**
 * Vector Service for Electron Main Process
 *
 * Provides local semantic search using:
 * - Transformers.js (all-MiniLM-L6-v2) for embedding
 * - LanceDB for vector storage
 */

const path = require('path');
const fs = require('fs');

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

    // Configure Transformers.js cache
    env.cacheDir = modelsPath;
    env.allowLocalModels = true;

    console.log('[VectorService] Loading embedding model:', MODEL_NAME);
    console.log('[VectorService] Models cache:', modelsPath);

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

    // Check if table exists
    const tables = await db.tableNames();
    if (tables.includes(TABLE_NAME)) {
      table = await db.openTable(TABLE_NAME);
      const count = await table.countRows();
      console.log('[VectorService] Opened existing table with', count, 'documents');
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
 * Index a document
 * @param {string} id - Document ID
 * @param {string} text - Document text
 * @param {object} metadata - Document metadata
 */
async function indexDocument(id, text, metadata) {
  if (!isInitialized) {
    return { success: false, error: 'Service not initialized' };
  }

  try {
    const vector = await embed(text);

    const record = {
      id: id,
      text: text.slice(0, 1000), // Store truncated text
      vector: vector,
      title: metadata.title || '',
      type: metadata.type || '',
      tags: JSON.stringify(metadata.tags || []),
      createdAt: metadata.createdAt || new Date().toISOString(),
    };

    if (!table) {
      // Create table with first record
      console.log('[VectorService] Creating table with first document');
      table = await db.createTable(TABLE_NAME, [record]);
    } else {
      // Check if document exists and delete it first (upsert)
      try {
        await table.delete(`id = '${id}'`);
      } catch (e) {
        // Ignore delete errors (document may not exist)
      }
      await table.add([record]);
    }

    console.log('[VectorService] Indexed document:', id);
    return { success: true };
  } catch (error) {
    console.error('[VectorService] Index error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Search for similar documents
 * @param {string} query - Search query
 * @param {number} limit - Max results
 */
async function search(query, limit = 10) {
  if (!isInitialized || !table) {
    console.log('[VectorService] Search skipped: not initialized or no data');
    return [];
  }

  try {
    const queryVector = await embed(query);

    const results = await table
      .search(queryVector)
      .limit(limit)
      .execute();

    return results.map(r => ({
      id: r.id,
      text: r.text,
      score: r._distance,
      metadata: {
        title: r.title,
        type: r.type,
        tags: JSON.parse(r.tags || '[]'),
        createdAt: r.createdAt,
      },
    }));
  } catch (error) {
    console.error('[VectorService] Search error:', error);
    return [];
  }
}

/**
 * Delete a document from the index
 * @param {string} id - Document ID
 */
async function deleteDocument(id) {
  if (!isInitialized || !table) {
    return { success: false, error: 'Service not initialized' };
  }

  try {
    await table.delete(`id = '${id}'`);
    console.log('[VectorService] Deleted document:', id);
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
