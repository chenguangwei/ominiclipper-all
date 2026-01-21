/**
 * Search Index Manager - BM25 Full-Text Search using SQLite FTS5
 *
 * Provides full-text search capability for the RAG assistant
 * using SQLite's built-in FTS5 extension.
 */

const path = require('path');
const fs = require('fs');
const { splitIntoChunks } = require('./textChunker.cjs');

// Use require for native module (more stable in Electron)
let Database = null;

// Service state
let db = null;
let dbPath = null;
const TABLE_NAME = 'documents_fts';

/**
 * Load better-sqlite3 using require (stable for native modules)
 */
function loadModules() {
  if (!Database) {
    try {
      Database = require('better-sqlite3');
      console.log('[SearchIndex] better-sqlite3 loaded successfully');
    } catch (e) {
      console.error('[SearchIndex] Failed to load better-sqlite3:', e);
      throw e;
    }
  }
}

/**
 * Initialize the search index service
 * @param {string} userDataPath - Electron app.getPath('userData')
 */
async function initialize(userDataPath) {
  try {
    console.log('[SearchIndex] Initializing...');
    loadModules(); // Now synchronous

    // Set up database path
    const basePath = path.join(userDataPath, 'OmniCollector');
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }
    dbPath = path.join(basePath, 'search-index.db');

    // Connect to database
    console.log('[SearchIndex] Connecting to database:', dbPath);
    db = new Database(dbPath);

    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');

    // Create FTS5 virtual table with doc_id for chunking
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS ${TABLE_NAME} USING fts5(
        id,
        doc_id,
        title,
        text,
        type,
        tags,
        chunk_index,
        content='',
        content_rowid='id',
        tokenize='porter unicode61'
      );
    `);

    console.log('[SearchIndex] Initialized successfully');
    console.log('[SearchIndex] Database:', dbPath);

    return { success: true };
  } catch (error) {
    console.error('[SearchIndex] Initialization failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Index a document for full-text search (with automatic text chunking)
 * @param {string} docId - Document ID
 * @param {string} text - Document text content
 * @param {object} metadata - Document metadata (title, type, tags)
 */
async function indexDocument(docId, text, metadata) {
  if (!db) {
    return { success: false, error: 'Service not initialized' };
  }

  try {
    // Split text into chunks for better search granularity
    const chunks = splitIntoChunks(text, { chunkSize: 800, chunkOverlap: 100 });

    if (chunks.length === 0) {
      return { success: false, error: 'No content to index' };
    }

    // Delete existing chunks for this document
    const deleteStmt = db.prepare(`DELETE FROM ${TABLE_NAME} WHERE doc_id = ?`);
    deleteStmt.run(docId);

    // Insert all chunks
    const insertStmt = db.prepare(`
      INSERT INTO ${TABLE_NAME} (id, doc_id, title, text, type, tags, chunk_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((chunks) => {
      for (const chunk of chunks) {
        insertStmt.run(
          chunk.id,
          docId,
          metadata.title || '',
          chunk.text,
          metadata.type || 'document',
          JSON.stringify(metadata.tags || []),
          chunk.index
        );
      }
    });

    insertMany(chunks);

    console.log('[SearchIndex] Indexed document:', docId, '- chunks:', chunks.length);
    return { success: true, chunksIndexed: chunks.length };
  } catch (error) {
    console.error('[SearchIndex] Index error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a document from the index (all its chunks)
 * @param {string} docId - Document ID
 */
async function deleteDocument(docId) {
  if (!db) {
    return { success: false, error: 'Service not initialized' };
  }

  try {
    const stmt = db.prepare(`DELETE FROM ${TABLE_NAME} WHERE doc_id = ?`);
    stmt.run(docId);
    console.log('[SearchIndex] Deleted document:', docId);
    return { success: true };
  } catch (error) {
    console.error('[SearchIndex] Delete error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Search documents using BM25 full-text search
 * @param {string} query - Search query
 * @param {number} limit - Max results (per document)
 */
async function search(query, limit = 5) {
  if (!db) {
    console.log('[SearchIndex] Search skipped: not initialized');
    return [];
  }

  try {
    // FTS5 search with BM25 ranking
    // Use query + '*' to enable prefix matching
    const searchQuery = query.trim().split(/\s+/).join(' ') + '*';

    // Search for matching chunks, then aggregate by doc_id
    const rawStmt = db.prepare(`
      SELECT
        rowid as id,
        doc_id,
        title,
        text,
        type,
        tags,
        bm25(${TABLE_NAME}) as score
      FROM ${TABLE_NAME}
      WHERE ${TABLE_NAME} MATCH ?
      ORDER BY score
      LIMIT ?
    `);

    const rawResults = rawStmt.all(searchQuery, limit * 3);

    // Aggregate results by doc_id, keeping best chunk per document
    const docMap = new Map();

    for (const r of rawResults) {
      const docId = r.doc_id;
      if (!docMap.has(docId) || r.score < docMap.get(docId).score) {
        docMap.set(docId, {
          id: docId,
          chunk_id: r.id,
          title: r.title || 'Untitled',
          text: r.text || '',
          type: r.type || 'document',
          score: Math.max(0, 1 - (r.score || 0) / 100),
        });
      }
    }

    const results = Array.from(docMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log('[SearchIndex] Search query:', query, '- Found:', results.length, 'documents from', rawResults.length, 'chunks');

    return results;
  } catch (error) {
    console.error('[SearchIndex] Search error:', error);
    return [];
  }
}

/**
 * Get index statistics
 */
async function getStats() {
  if (!db) {
    return { totalDocs: 0, dbPath: '' };
  }

  try {
    const countStmt = db.prepare(`SELECT count(*) as count FROM ${TABLE_NAME}`);
    const result = countStmt.get();
    return {
      totalDocs: result.count,
      dbPath: dbPath || '',
    };
  } catch (error) {
    console.error('[SearchIndex] GetStats error:', error);
    return { totalDocs: 0, dbPath: '' };
  }
}

/**
 * Check if service is initialized
 */
function isInitialized() {
  return db !== null;
}

/**
 * Close database connection
 */
function close() {
  if (db) {
    db.close();
    db = null;
    console.log('[SearchIndex] Database closed');
  }
}

module.exports = {
  initialize,
  indexDocument,
  deleteDocument,
  search,
  getStats,
  isInitialized,
  close,
};
