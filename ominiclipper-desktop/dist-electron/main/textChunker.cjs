/**
 * Text Chunking Service
 *
 * Splits long text into smaller chunks for RAG indexing.
 * Uses Recursive Character Splitting strategy.
 */

const crypto = require('crypto');

/**
 * Chunking options
 */
const DEFAULT_OPTIONS = {
  chunkSize: 500,      // Target size in characters
  chunkOverlap: 50,    // Overlap between chunks
  minChunkSize: 100,   // Minimum chunk size
  separators: [        // Split by these characters in order
    '\n\n\n',          // Triple newline (paragraphs)
    '\n\n',            // Double newline
    '\n',              // Single newline
    '. ',              // Sentence end
    '。',              // Chinese period
    '! ',              // Exclamation
    '? ',              // Question
    ';',               // Semicolon
    ',',               // Comma
    ' ',               // Space
    '',                // Character level as last resort
  ],
};

/**
 * Split text into chunks
 * @param {string} text - Text to split
 * @param {object} options - Chunking options
 * @returns {Array<{id: string, text: string, index: number}>}
 */
/**
 * Split text into chunks
 * @param {string} text - Text to split
 * @param {object} options - Chunking options
 * @returns {Array<{id: string, text: string, index: number}>}
 */
function splitIntoChunks(text, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { chunkSize, chunkOverlap } = opts;

  if (!text || typeof text !== 'string') {
    return [];
  }

  // Clean text
  const cleanText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '')
    .trim();

  if (cleanText.length <= chunkSize) {
    return [{
      id: crypto.randomUUID(),
      text: cleanText,
      index: 0,
    }];
  }

  // Use Intl.Segmenter for word-aware splitting (crucial for Chinese)
  let segmenter;
  try {
    segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
  } catch (e) {
    // Fallback if not available
  }

  const chunks = [];
  let currentChunk = '';
  let currentLength = 0;

  // If segmenter exists, split by words first
  if (segmenter) {
    const segments = segmenter.segment(cleanText);
    const words = [];
    for (const seg of segments) {
      words.push(seg.segment);
    }

    // Accumulate words into chunks
    let currentWords = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (currentLength + word.length > chunkSize && currentWords.length > 0) {
        // Chunk is full
        const chunkText = currentWords.join('');
        chunks.push({
          id: crypto.randomUUID(),
          text: chunkText,
          index: chunks.length
        });

        // Handle overlap: keep last N chars of content (approx)
        // For simplicity with word array, we keep last K words that fit in overlap
        // But converting overlap chars to words is hard. 
        // Simpler strategy: Just start new chunk with empty. 
        // Better strategy for overlap: sliding window.

        // Sliding window implementation:
        // Backtrack 'overlap' characters worth of words
        let overlapBuffer = '';
        let backtrackIndex = i - 1;
        let overlapWords = [];

        while (backtrackIndex >= 0) {
          const w = words[backtrackIndex];
          if (overlapBuffer.length + w.length > chunkOverlap) break;
          overlapBuffer = w + overlapBuffer;
          overlapWords.unshift(w);
          backtrackIndex--;
        }

        currentWords = [...overlapWords];
        currentLength = overlapBuffer.length;
      }

      currentWords.push(word);
      currentLength += word.length;
    }

    // Add final chunk
    if (currentWords.length > 0) {
      chunks.push({
        id: crypto.randomUUID(),
        text: currentWords.join(''),
        index: chunks.length
      });
    }

  } else {
    // Fallback to original regex logic (omitted here for brevity, assuming V8 always has Intl)
    // Actually, let's keep a simplified character slicer as fallback
    let startIndex = 0;
    while (startIndex < cleanText.length) {
      let endIndex = Math.min(startIndex + chunkSize, cleanText.length);
      chunks.push({
        id: crypto.randomUUID(),
        text: cleanText.slice(startIndex, endIndex),
        index: chunks.length
      });
      startIndex += (chunkSize - chunkOverlap);
    }
  }

  console.log(`[TextChunker] Split text into ${chunks.length} chunks`);
  return chunks;
}

/**
 * Estimate token count (approximate)
 * @param {string} text - Text to estimate
 * @returns {number}
 */
function estimateTokens(text) {
  // Rough estimate: 4 characters per token on average
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit token limit
 * @param {string} text - Text to truncate
 * @param {number} maxTokens - Maximum tokens
 * @returns {string}
 */
function truncateByTokens(text, maxTokens) {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(0, maxChars).trim();
}

module.exports = {
  splitIntoChunks,
  estimateTokens,
  truncateByTokens,
  DEFAULT_OPTIONS,
};
