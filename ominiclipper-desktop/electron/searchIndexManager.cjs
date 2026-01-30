/**
 * Search Index Manager - BM25 Full-Text Search using SQLite FTS5
 *
 * Provides full-text search capability for the RAG assistant
 * using SQLite's built-in FTS5 extension.
 */

const path = require('path');
const fs = require('fs');
const { splitIntoChunks } = require('./textChunker.cjs');
const { tokenize } = require('./tokenizer.cjs');

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

// Weight configuration for BM25 boosting
const WEIGHTS = {
  folderName: 10,   // Highest - user organized folders
  category: 8,      // Document category
  tags: 5,          // User tags
  title: 3,         // Document title
  h1: 3,            // Heading level 1
  h2: 2,            // Heading level 2
  h3: 1,            // Heading level 3
  content: 1,       // Normal content
};

/**
 * Extract headings from markdown text
 * @param {string} text - Markdown text
 * @returns {Object} - Object with h1, h2, h3 arrays
 */
function extractHeadings(text) {
  const headings = { h1: [], h2: [], h3: [] };
  const h1Regex = /^#\s+(.+)$/gm;
  const h2Regex = /^##\s+(.+)$/gm;
  const h3Regex = /^###\s+(.+)$/gm;

  let match;
  while ((match = h1Regex.exec(text)) !== null) {
    headings.h1.push(match[1].trim());
  }
  while ((match = h2Regex.exec(text)) !== null) {
    headings.h2.push(match[1].trim());
  }
  while ((match = h3Regex.exec(text)) !== null) {
    headings.h3.push(match[1].trim());
  }

  return headings;
}

/**
 * Convert text to markdown format (simple formatting for now)
 * @param {string} text - Raw text
 * @param {string} type - Document type
 * @returns {string} - Markdown formatted text
 */
function convertToMarkdown(text, type) {
  // For now, just return text as-is with basic formatting
  // In the future, could add more sophisticated conversion based on type
  return text;
}

/**
 * Prepare document content for BM25 indexing with weighted boosting
 *
 * Strategy: Repeat important keywords multiple times to increase their BM25 score
 * Priority: folderName > category > tags > title > headings > content
 *
 * @param {string} text - Original document text
 * @param {Object} metadata - Document metadata
 * @returns {string} - Prepared text for indexing
 */
function prepareForIndexing(text, metadata) {
  let indexedContent = '';

  // 1. Folder name (10x) - Highest weight, user organized folders
  if (metadata.folderName) {
    indexedContent += (metadata.folderName + ' ').repeat(WEIGHTS.folderName);
    console.log(`[SearchIndex] Added folderName "${metadata.folderName}" (${WEIGHTS.folderName}x)`);
  }

  // 2. Category (8x)
  if (metadata.category) {
    indexedContent += (metadata.category + ' ').repeat(WEIGHTS.category);
    console.log(`[SearchIndex] Added category "${metadata.category}" (${WEIGHTS.category}x)`);
  }

  // 3. Tags (5x each)
  if (metadata.tags && metadata.tags.length > 0) {
    for (const tag of metadata.tags) {
      indexedContent += (tag + ' ').repeat(WEIGHTS.tags);
    }
    console.log(`[SearchIndex] Added tags [${metadata.tags.join(', ')}] (${WEIGHTS.tags}x each)`);
  }

  // 4. Document title (3x)
  if (metadata.title) {
    indexedContent += (metadata.title + ' ').repeat(WEIGHTS.title);
    console.log(`[SearchIndex] Added title "${metadata.title}" (${WEIGHTS.title}x)`);
  }

  // 5. Convert to markdown and extract headings
  const markdown = convertToMarkdown(text, metadata.type);
  const headings = extractHeadings(markdown);

  // 6. H1 headings (3x)
  for (const h1 of headings.h1) {
    indexedContent += (h1 + ' ').repeat(WEIGHTS.h1);
  }

  // 7. H2 headings (2x)
  for (const h2 of headings.h2) {
    indexedContent += (h2 + ' ').repeat(WEIGHTS.h2);
  }

  // 8. H3 headings (1x)
  for (const h3 of headings.h3) {
    indexedContent += (h3 + ' ').repeat(WEIGHTS.h3);
  }

  // 9. Original content (1x)
  indexedContent += markdown;

  // TOKENIZATION STEP:
  // Apply the tokenizer to the entire prepared content to ensure Chinese segments are space-separated
  // This is crucial for SQLite FTS5 'unicode61' or 'simple' tokenizer to work with CJK.
  return tokenize(indexedContent);
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

    // Create FTS5 virtual table with Unicode tokenization for Chinese support
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS ${TABLE_NAME} USING fts5(
        id,
        doc_id,
        title,
        text,
        type,
        tags,
        chunk_index,
        tokenize='unicode61'
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
    // Log indexing details
    console.log(`[SearchIndex] Indexing doc: ${docId}, text length: ${text?.length || 0}, title: ${metadata.title}`);

    if (!text || text.trim().length < 10) {
      console.warn(`[SearchIndex] WARNING: Empty or too short text for ${docId}`);
      return { success: false, error: 'Text too short or empty' };
    }

    // Prepare content with weighted boosting for BM25
    const indexedContent = prepareForIndexing(text, metadata);
    console.log(`[SearchIndex] Prepared content length: ${indexedContent.length} chars`);

    // Split prepared content into chunks for better search granularity
    const chunks = splitIntoChunks(indexedContent, { chunkSize: 800, chunkOverlap: 100 });

    if (chunks.length === 0) {
      return { success: false, error: 'No content to index' };
    }

    // Log first chunk preview
    console.log(`[SearchIndex] First chunk preview: "${chunks[0]?.text?.substring(0, 100)}..."`);

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
 * @param {boolean} groupByDoc - Unused for BM25 (always per-doc currently), keeping interface compatible
 */
async function search(query, limit = 5, groupByDoc = true) {
  if (!db) {
    console.log('[SearchIndex] Search skipped: not initialized');
    return [];
  }

  try {
    // FTS5 search with BM25 ranking
    // 1. Tokenize query using the same logic as indexing (for Chinese segmentation)
    const tokenizedQuery = tokenize(query);

    // 2. Clean up for search query syntax
    const searchQuery = tokenizedQuery.trim().split(/\s+/).join(' '); // AND implicit in FTS5 standard query?
    // Actually FTS standard query implies phrase if quoted, or AND/OR if keywords. 
    // Ideally we want OR or AND depending on user intent. default FTS5 is implicit AND?
    // Let's stick to simple space-separated which acts as implicit AND in most FTS5 usages (check docs, actually it is phrase search if "..." or implicit AND for terms).
    // Wait, simple 'term1 term2' is implicit AND.

    console.log(`[SearchIndex] Raw query: "${query}"`);
    console.log(`[SearchIndex] Tokenized query: "${searchQuery}"`);

    // First check what's in the database
    const totalCount = db.prepare(`SELECT count(*) as count FROM ${TABLE_NAME}`).get();
    console.log(`[SearchIndex] Total chunks in DB: ${totalCount.count}`);

    // Check sample data
    const sampleData = db.prepare(`SELECT doc_id, substr(text, 1, 50) as text_preview FROM ${TABLE_NAME} LIMIT 3`).all();
    console.log(`[SearchIndex] Sample data:`);
    sampleData.forEach((row, i) => {
      console.log(`  [${i + 1}] doc_id: ${row.doc_id?.substring(0, 20)}..., text: "${row.text_preview}..."`);
    });

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
    console.log(`[SearchIndex] Raw BM25 results: ${rawResults.length}`);

    // Optimization: If NOT grouping by doc, return raw chunks directly
    if (!groupByDoc) {
      console.log(`[SearchIndex] Raw results (no grouping): ${rawResults.length} chunks`);
      return rawResults.slice(0, limit).map(r => ({
        id: r.doc_id, // Keep consistent with vector service (id=docId) but logically it's a chunk match
        chunk_id: r.id,
        title: r.title || 'Untitled',
        text: r.text || '',
        type: r.type || 'document',
        score: Math.max(0, 1 - (r.score || 0) / 100), // Normalize score roughly
      }));
    }

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
