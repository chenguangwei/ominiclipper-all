/**
 * OmniClipper Content Script
 * Enhanced content extraction with article parsing and screenshot capabilities
 */

(function() {
  'use strict';

  // Prevent multiple injections
  if (window.__omniclipper_injected) return;
  window.__omniclipper_injected = true;

  // AI Service configuration
  const AI_CONFIG = {
    provider: 'gemini',
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    maxContentLength: 8000,
    retryAttempts: 2,
    retryDelay: 1000
  };

  // Screenshot selection state
  let selectionOverlay = null;
  let selectionBox = null;
  let isSelecting = false;
  let startX = 0, startY = 0;

  /**
   * Extract favicon from page
   */
  function extractFavicon() {
    // Try various favicon sources in order of preference
    const iconSelectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="apple-touch-icon-precomposed"]',
      'link[rel="mask-icon"]'
    ];

    for (const selector of iconSelectors) {
      const icon = document.querySelector(selector);
      if (icon && icon.href) {
        return icon.href;
      }
    }

    // Try Open Graph image as fallback
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage && ogImage.content) {
      return ogImage.content;
    }

    // Default favicon.ico
    return `${window.location.origin}/favicon.ico`;
  }

  /**
   * Extract site name
   */
  function extractSiteName() {
    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName && ogSiteName.content) {
      return ogSiteName.content;
    }
    return window.location.hostname.replace('www.', '');
  }

  /**
   * Extract metadata from page
   */
  function extractMetadata() {
    const getMeta = (selector) => {
      const el = document.querySelector(selector);
      return el ? el.getAttribute('content') || el.textContent.trim() : '';
    };

    return {
      title: document.title || getMeta('h1'),
      description: getMeta('meta[name="description"]') || getMeta('meta[property="og:description"]'),
      url: window.location.href,
      hostname: window.location.hostname,
      favicon: extractFavicon(),
      siteName: extractSiteName(),
      ogImage: getMeta('meta[property="og:image"]'),
      author: getMeta('meta[name="author"]') || getMeta('meta[property="article:author"]'),
      publishedTime: getMeta('meta[property="article:published_time"]')
    };
  }

  /**
   * Extract article content using Readability-like algorithm
   */
  function extractArticleContent() {
    // Clone the document for manipulation
    const clone = document.cloneNode(true);

    // Remove unwanted elements
    const removeSelectors = [
      'script', 'style', 'nav', 'header', 'footer', 'aside',
      '.ad', '.ads', '.advertisement', '.social-share', '.comments',
      '.sidebar', '.menu', '.navigation', '.nav', '.header', '.footer',
      '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
      '.related-posts', '.author-box', '.newsletter', '.popup', '.modal'
    ];

    removeSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Try to find main content
    const contentSelectors = [
      'article',
      '[role="main"]',
      'main',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content',
      '#content',
      '.post-body',
      '.article-body'
    ];

    let mainContent = null;
    for (const selector of contentSelectors) {
      const element = clone.querySelector(selector);
      if (element && element.textContent.trim().length > 500) {
        mainContent = element;
        break;
      }
    }

    if (!mainContent) {
      mainContent = clone.body;
    }

    return mainContent;
  }

  /**
   * Convert HTML to Markdown
   */
  function htmlToMarkdown(element) {
    if (!element) return '';

    let markdown = '';

    function processNode(node, depth = 0) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const tagName = node.tagName.toLowerCase();
      const children = Array.from(node.childNodes).map(n => processNode(n, depth)).join('');

      switch (tagName) {
        case 'h1':
          return `\n# ${children.trim()}\n\n`;
        case 'h2':
          return `\n## ${children.trim()}\n\n`;
        case 'h3':
          return `\n### ${children.trim()}\n\n`;
        case 'h4':
          return `\n#### ${children.trim()}\n\n`;
        case 'h5':
          return `\n##### ${children.trim()}\n\n`;
        case 'h6':
          return `\n###### ${children.trim()}\n\n`;
        case 'p':
          return `\n${children.trim()}\n\n`;
        case 'br':
          return '\n';
        case 'hr':
          return '\n---\n\n';
        case 'strong':
        case 'b':
          return `**${children}**`;
        case 'em':
        case 'i':
          return `*${children}*`;
        case 'code':
          return `\`${children}\``;
        case 'pre':
          return `\n\`\`\`\n${children}\n\`\`\`\n\n`;
        case 'blockquote':
          return `\n> ${children.replace(/\n/g, '\n> ')}\n\n`;
        case 'a':
          const href = node.getAttribute('href');
          if (href && !href.startsWith('javascript:')) {
            const absoluteHref = href.startsWith('http') ? href : new URL(href, window.location.origin).href;
            return `[${children}](${absoluteHref})`;
          }
          return children;
        case 'img':
          const src = node.getAttribute('src');
          const alt = node.getAttribute('alt') || 'image';
          if (src) {
            const absoluteSrc = src.startsWith('http') ? src : new URL(src, window.location.origin).href;
            return `![${alt}](${absoluteSrc})`;
          }
          return '';
        case 'ul':
          return '\n' + Array.from(node.children).map(li => `- ${processNode(li, depth + 1).trim()}`).join('\n') + '\n\n';
        case 'ol':
          return '\n' + Array.from(node.children).map((li, i) => `${i + 1}. ${processNode(li, depth + 1).trim()}`).join('\n') + '\n\n';
        case 'li':
          return children;
        case 'table':
          return processTable(node);
        case 'div':
        case 'section':
        case 'article':
        case 'main':
        case 'span':
          return children;
        case 'script':
        case 'style':
        case 'nav':
        case 'header':
        case 'footer':
        case 'aside':
          return '';
        default:
          return children;
      }
    }

    function processTable(table) {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length === 0) return '';

      let result = '\n';
      rows.forEach((row, i) => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        const cellTexts = cells.map(cell => cell.textContent.trim());
        result += `| ${cellTexts.join(' | ')} |\n`;
        if (i === 0) {
          result += `| ${cells.map(() => '---').join(' | ')} |\n`;
        }
      });
      return result + '\n';
    }

    markdown = processNode(element);

    // Clean up extra whitespace
    markdown = markdown
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+|\s+$/g, '')
      .trim();

    return markdown;
  }

  /**
   * Extract article as Markdown
   */
  function extractArticle() {
    const metadata = extractMetadata();
    const contentElement = extractArticleContent();
    const markdown = htmlToMarkdown(contentElement);

    // Calculate reading time (average 200 words per minute)
    const wordCount = markdown.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

    return {
      title: metadata.title,
      url: metadata.url,
      author: metadata.author || '',
      markdown: markdown,
      readingTime: readingTime,
      wordCount: wordCount,
      favicon: metadata.favicon,
      siteName: metadata.siteName,
      publishedTime: metadata.publishedTime
    };
  }

  /**
   * Create screenshot selection overlay
   */
  function createSelectionOverlay() {
    // Create overlay
    selectionOverlay = document.createElement('div');
    selectionOverlay.id = 'omniclipper-selection-overlay';
    selectionOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.3);
      z-index: 2147483647;
      cursor: crosshair;
    `;

    // Create selection box
    selectionBox = document.createElement('div');
    selectionBox.id = 'omniclipper-selection-box';
    selectionBox.style.cssText = `
      position: fixed;
      border: 2px dashed #667eea;
      background: rgba(102, 126, 234, 0.1);
      pointer-events: none;
      display: none;
      z-index: 2147483648;
    `;

    // Create instruction text
    const instruction = document.createElement('div');
    instruction.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      z-index: 2147483649;
    `;
    instruction.textContent = 'Drag to select area • Press ESC to cancel';
    selectionOverlay.appendChild(instruction);

    document.body.appendChild(selectionOverlay);
    document.body.appendChild(selectionBox);

    // Event handlers
    selectionOverlay.addEventListener('mousedown', startSelection);
    selectionOverlay.addEventListener('mousemove', updateSelection);
    selectionOverlay.addEventListener('mouseup', endSelection);
    document.addEventListener('keydown', handleKeydown);
  }

  function startSelection(e) {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.display = 'block';
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
  }

  function updateSelection(e) {
    if (!isSelecting) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
  }

  function endSelection(e) {
    if (!isSelecting) return;
    isSelecting = false;

    const rect = {
      x: parseInt(selectionBox.style.left),
      y: parseInt(selectionBox.style.top),
      width: parseInt(selectionBox.style.width),
      height: parseInt(selectionBox.style.height)
    };

    cleanupSelection();

    if (rect.width > 10 && rect.height > 10) {
      captureArea(rect);
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      cleanupSelection();
    }
  }

  function cleanupSelection() {
    if (selectionOverlay) {
      selectionOverlay.remove();
      selectionOverlay = null;
    }
    if (selectionBox) {
      selectionBox.remove();
      selectionBox = null;
    }
    document.removeEventListener('keydown', handleKeydown);
    isSelecting = false;
  }

  /**
   * Capture specific area of the page
   */
  async function captureArea(rect) {
    // Send message to background to capture using chrome.tabs API
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CAPTURE_VISIBLE_TAB',
        rect: rect
      });

      if (response && response.success) {
        // Crop the captured image to the selected area
        const img = new Image();
        img.src = response.dataUrl;

        await new Promise(resolve => {
          img.onload = resolve;
        });

        // Account for device pixel ratio
        const dpr = window.devicePixelRatio || 1;

        const canvas = document.createElement('canvas');
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(
          img,
          rect.x * dpr, rect.y * dpr,
          rect.width * dpr, rect.height * dpr,
          0, 0,
          rect.width * dpr, rect.height * dpr
        );

        const croppedDataUrl = canvas.toDataURL('image/png');

        // Send to popup
        chrome.runtime.sendMessage({
          type: 'SCREENSHOT_CAPTURED',
          data: {
            imageData: croppedDataUrl,
            width: rect.width,
            height: rect.height,
            sourceUrl: window.location.href,
            title: document.title
          }
        });
      }
    } catch (error) {
      console.error('OmniClipper: Screenshot capture failed', error);
    }
  }

  /**
   * Capture visible area
   */
  async function captureVisible() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CAPTURE_VISIBLE_TAB'
      });

      if (response && response.success) {
        chrome.runtime.sendMessage({
          type: 'SCREENSHOT_CAPTURED',
          data: {
            imageData: response.dataUrl,
            width: window.innerWidth,
            height: window.innerHeight,
            sourceUrl: window.location.href,
            title: document.title
          }
        });
      }
    } catch (error) {
      console.error('OmniClipper: Visible capture failed', error);
    }
  }

  /**
   * Capture full page (scrolling screenshot)
   */
  async function captureFullPage() {
    // For full page, we'll capture visible and let background handle the rest
    // This is a simplified version - full implementation would require scrolling
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CAPTURE_FULL_PAGE'
      });

      if (response && response.success) {
        chrome.runtime.sendMessage({
          type: 'SCREENSHOT_CAPTURED',
          data: {
            imageData: response.dataUrl,
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight,
            sourceUrl: window.location.href,
            title: document.title
          }
        });
      }
    } catch (error) {
      console.error('OmniClipper: Full page capture failed', error);
    }
  }

  /**
   * Extract selected text
   */
  function extractSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return '';

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;

    let text = selection.toString().trim();

    if (container.parentElement) {
      const parentText = container.parentElement.textContent;
      const idx = parentText.indexOf(text);
      if (idx > 0) {
        const start = Math.max(0, idx - 100);
        const context = parentText.substring(start, idx).trim();
        if (context) {
          text = `...${context}\n\n${text}`;
        }
      }
    }

    return text;
  }

  /**
   * Extract links from page
   */
  function extractLinks() {
    const links = [];
    const anchorTags = document.querySelectorAll('a[href]');

    anchorTags.forEach(a => {
      const href = a.href;
      if (href && href.startsWith('http') && !href.includes(window.location.hostname)) {
        if (!links.some(l => l.url === href)) {
          links.push({
            url: href,
            title: a.textContent.trim() || a.getAttribute('title') || 'Untitled Link'
          });
        }
      }
    });

    return links.slice(0, 20);
  }

  /**
   * Extract images from page
   */
  function extractImages() {
    const images = [];
    const imgTags = document.querySelectorAll('img[src]');

    imgTags.forEach(img => {
      const src = img.src;
      if (src && src.startsWith('http')) {
        images.push({
          url: src,
          alt: img.alt || '',
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height
        });
      }
    });

    return images.slice(0, 10);
  }

  /**
   * Get API key from storage
   */
  async function getApiKey() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['geminiApiKey'], (result) => {
        resolve(result.geminiApiKey || '');
      });
    });
  }

  /**
   * Generate AI summary
   */
  async function generateSummary(content) {
    if (!content || content.trim().length < 50) {
      return { success: false, error: 'Content too short for summarization' };
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      return { success: false, error: 'API key not configured' };
    }

    const truncatedContent = content.substring(0, AI_CONFIG.maxContentLength);

    const prompt = `Please provide a concise summary of the following content in about 200-300 words. Focus on the main points and key information:

${truncatedContent}

Summary:`;

    try {
      const response = await fetch(`${AI_CONFIG.apiEndpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 500, temperature: 0.3 }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error?.message || 'API request failed' };
      }

      const data = await response.json();

      if (data.candidates && data.candidates.length > 0) {
        const summary = data.candidates[0].content?.parts[0]?.text || '';
        return { success: true, summary: summary.trim() };
      }
      return { success: false, error: 'No response from AI' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Main capture function
   */
  function capturePage(options = {}) {
    const {
      includeContent = true,
      includeLinks = true,
      includeImages = false
    } = options;

    const metadata = extractMetadata();
    const selection = extractSelection();
    const links = includeLinks ? extractLinks() : [];
    const images = includeImages ? extractImages() : [];

    return {
      ...metadata,
      selection,
      links,
      images,
      capturedAt: Date.now()
    };
  }

  /**
   * Listen for messages from popup/background
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'PING':
        // Used to check if content script is loaded
        sendResponse({ success: true, pong: true });
        break;

      case 'CAPTURE_PAGE':
        sendResponse({ success: true, data: capturePage(message.options || {}) });
        break;

      case 'CAPTURE_SELECTION':
        const selection = extractSelection();
        sendResponse({
          success: true,
          data: {
            ...extractMetadata(),
            content: selection,
            capturedAt: Date.now()
          }
        });
        break;

      case 'GET_METADATA':
        sendResponse({ success: true, data: extractMetadata() });
        break;

      case 'EXTRACT_ARTICLE':
        const article = extractArticle();
        sendResponse({ success: true, data: article });
        break;

      case 'START_AREA_SELECTION':
        createSelectionOverlay();
        sendResponse({ success: true });
        break;

      case 'CAPTURE_VISIBLE':
        captureVisible();
        sendResponse({ success: true });
        break;

      case 'CAPTURE_FULL_PAGE':
        captureFullPage();
        sendResponse({ success: true });
        break;

      case 'GENERATE_SUMMARY':
        const content = message.content || extractArticle().markdown;
        generateSummary(content)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'EXTRACT_CONTENT':
        sendResponse({ success: true, data: capturePage(message.options || {}) });
        break;
    }
    return true;
  });

  /**
   * Inject capture button into page
   */
  function injectCaptureButton() {
    if (document.getElementById('omniclipper-capture-btn')) return;

    const button = document.createElement('button');
    button.id = 'omniclipper-capture-btn';
    button.innerHTML = '📌';
    button.title = 'Capture with OmniClipper';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      cursor: pointer;
      font-size: 20px;
      z-index: 999999;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      transition: all 0.3s ease;
    `;

    button.addEventListener('click', async () => {
      const data = capturePage();
      try {
        await chrome.runtime.sendMessage({ type: 'OPEN_POPUP_WITH_DATA', data });
      } catch (e) {
        console.log('OmniClipper: Could not open popup');
      }
    });

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
    });

    document.body.appendChild(button);
  }

  /**
   * Initialize content script
   */
  function init() {
    chrome.storage.local.get(['showCaptureButton'], (result) => {
      if (result.showCaptureButton !== false) {
        setTimeout(injectCaptureButton, 2000);
      }
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'CONTEXT_MENU_CLICK') {
        if (message.action === 'capturePage') {
          chrome.runtime.sendMessage({
            type: 'OPEN_POPUP_WITH_DATA',
            data: capturePage()
          });
        } else if (message.action === 'captureSelection') {
          chrome.runtime.sendMessage({
            type: 'OPEN_POPUP_WITH_DATA',
            data: {
              ...extractMetadata(),
              content: extractSelection(),
              capturedAt: Date.now()
            }
          });
        } else if (message.action === 'captureArticle') {
          chrome.runtime.sendMessage({
            type: 'OPEN_POPUP_WITH_DATA',
            data: {
              ...extractArticle(),
              capturedAt: Date.now()
            }
          });
        }
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
