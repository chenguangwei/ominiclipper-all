/**
 * OmniClipper Content Script Entry Point
 */
import { extractMetadata, extractLinks, extractImages, extractSelection } from './extractors/metadata';
import { extractArticle } from './extractors/article';
import { createSelectionOverlay } from './ui/selectionOverlay';
import { captureVisible, captureFullPage } from './capture/screenshot';
import { generateSummary } from './services/ai';

(function () {
  // Prevent multiple injections
  if ((window as any).__omniclipper_injected) return;
  (window as any).__omniclipper_injected = true;

  function capturePage(options: any = {}) {
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

  // Define message handler type
  interface MessageRequest {
    type: string;
    options?: any;
    content?: string;
    action?: string;
  }

  chrome.runtime.onMessage.addListener((message: MessageRequest, sender, sendResponse) => {
    switch (message.type) {
      case 'PING':
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
          .catch(error => sendResponse({ success: false, error: (error as any).message }));
        return true;

      case 'EXTRACT_CONTENT':
        sendResponse({ success: true, data: capturePage(message.options || {}) });
        break;

      case 'CONTEXT_MENU_CLICK':
        // Legacy handling for direct messages from background (if any)
        if (message.action === 'capturePage') {
          capturePage(); // Just trigger local capture, result usually via message passing
        }
        break;
    }
    return true;
  });

  // Init logic for context menu indirect handling via messages
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'CONTEXT_MENU_CLICK') {
      // This logic was in original init(), duplicating somewhat but keeping for safety
      if (message.action === 'capturePage') {
        chrome.runtime.sendMessage({
          type: 'OPEN_POPUP_WITH_DATA',
          data: capturePage()
        });
      } // ... other actions handled by specific message types usually
    }
  });

})();
