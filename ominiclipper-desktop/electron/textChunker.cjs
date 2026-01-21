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
function splitIntoChunks(text, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { chunkSize, chunkOverlap, minChunkSize, separators } = opts;

  if (!text || typeof text !== 'string') {
    return [];
  }

  // Clean and normalize text
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

  const chunks = [];
  let startIndex = 0;

  while (startIndex < cleanText.length) {
    // Find the end of this chunk
    let endIndex = startIndex + chunkSize;

    // If we're not at the end, try to split at a good boundary
    if (endIndex < cleanText.length) {
      // Try each separator from most preferred to least
      let foundSeparator = false;
      for (const separator of separators) {
        if (!separator) break; // Empty separator means character level

        // Look for separator in the range (startIndex, endIndex]
        const searchRange = cleanText.slice(startIndex, endIndex);
        const lastSepIndex = searchRange.lastIndexOf(separator);

        if (lastSepIndex > minChunkSize - separator.length) {
          // Found a good split point
          endIndex = startIndex + lastSepIndex + separator.length;
          foundSeparator = true;
          break;
        }
      }

      // If no good separator found, try to split at a space near the end
      if (!foundSeparator) {
        const lastSpaceIndex = cleanText.lastIndexOf(' ', endIndex);
        if (lastSpaceIndex > startIndex + minChunkSize) {
          endIndex = lastSpaceIndex;
        }
      }
    }

    // Extract chunk
    let chunkText = cleanText.slice(startIndex, endIndex).trim();

    // If chunk is too small, try to extend it
    if (chunkText.length < minChunkSize && endIndex < cleanText.length) {
      const nextSpaceIndex = cleanText.indexOf(' ', endIndex);
      if (nextSpaceIndex !== -1 && nextSpaceIndex < endIndex + 100) {
        endIndex = nextSpaceIndex;
        chunkText = cleanText.slice(startIndex, endIndex).trim();
      }
    }

    // Ensure we always make progress
    if (chunkText.length === 0 && startIndex < cleanText.length) {
      endIndex = startIndex + chunkSize;
      chunkText = cleanText.slice(startIndex, endIndex).trim();
    }

    if (chunkText) {
      chunks.push({
        id: crypto.randomUUID(),
        text: chunkText,
        index: chunks.length,
      });
    }

    // Move start index, accounting for overlap
    startIndex = endIndex - chunkOverlap;

    // Ensure we don't get stuck in an infinite loop
    if (startIndex >= cleanText.length) {
      break;
    }

    // Move start index forward past any separator at the boundary
    while (startIndex < cleanText.length && separators.some(s => cleanText[startIndex] === s)) {
      startIndex++;
    }

    // Ensure we make progress
    if (chunks.length > 0 && startIndex <= chunks[chunks.length - 1].index * chunkSize) {
      startIndex = chunks[chunks.length - 1].index * chunkSize + chunkSize;
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
