import { setupContextMenuListeners, createContextMenu } from './handlers/contextMenus';
import { handleMessage } from './handlers/messages';
import { openPopupWithData } from './services/capture';

// Initialize
function init() {
  createContextMenu();
  setupContextMenuListeners(openPopupWithData);

  // Message listeners
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  });

  console.log('OmniClipper Background Service Worker initialized');
}

init();
