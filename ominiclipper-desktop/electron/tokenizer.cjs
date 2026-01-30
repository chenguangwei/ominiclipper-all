/**
 * Tokenizer Service
 * 
 * Provides robust text segmentation for mixed English/Chinese content
 * using the native Intl.Segmenter API (available in Node.js 16+ / Electron).
 * 
 * This avoids the need for heavy external libraries like nodejieba or C++ extensions.
 */

let segmenter_zh = null;
let segmenter_en = null;

try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        segmenter_zh = new Intl.Segmenter('zh-CN', { granularity: 'word' });
        // English segmenter isn't strictly necessary if strict word splitting is handled by regex, 
        // but useful for consistent API.
        segmenter_en = new Intl.Segmenter('en', { granularity: 'word' });
        console.log('[Tokenizer] Intl.Segmenter initialized successfully');
    } else {
        console.warn('[Tokenizer] Intl.Segmenter not available, falling back to simple regex');
    }
} catch (e) {
    console.error('[Tokenizer] Failed to initialize Intl.Segmenter:', e);
}

/**
 * Segment text into space-separated tokens
 * @param {string} text - Input text
 * @returns {string} - Space-separated tokens
 */
function tokenize(text) {
    if (!text) return '';

    if (segmenter_zh) {
        // Use Intl.Segmenter for high-quality segmentation
        const segments = segmenter_zh.segment(text);
        const tokens = [];
        for (const seg of segments) {
            if (seg.isWordLike) {
                tokens.push(seg.segment);
            } else {
                // Keep punctuation/spaces as is or normalize?
                // FTS5 simple/unicode61 will split on spaces anyway.
                // We probably want to just keep "word-like" segments and meaningful chars.
                // But for "exact match" of weird chars, maybe keep them?
                // For search, usually we care about words.
                // Let's just push everything but trim excessive whitespace later.
                if (seg.segment.trim().length > 0) {
                    tokens.push(seg.segment);
                }
            }
        }
        return tokens.join(' ');
    } else {
        // Fallback: Add spaces between Chinese characters
        // Matches CJK ranges
        return text
            .replace(/([\u4e00-\u9fa5])/g, ' $1 ')
            .replace(/\s+/g, ' ')
            .trim();
    }
}

module.exports = {
    tokenize
};
