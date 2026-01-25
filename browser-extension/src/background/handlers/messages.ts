import { captureFromBackground, openPopupWithData, ResourceType } from '../services/capture';
import * as syncQueue from '../services/syncQueue';

export async function handleMessage(message: any, sender: chrome.runtime.MessageSender) {
    switch (message.type) {
        case 'OPEN_POPUP_WITH_DATA':
            await openPopupWithData(message.data);
            return { success: true };

        case 'CAPTURE_FROM_BACKGROUND':
            return await captureFromBackground(message.options);

        case 'CLEAR_SYNC_QUEUE':
            await syncQueue.clearSyncQueue();
            return { success: true };

        case 'SCREENSHOT_CAPTURED':
            await openPopupWithData({
                type: ResourceType.IMAGE,
                title: 'Screenshot - ' + new Date().toLocaleString(),
                imageData: message.imageData,
                imageMimeType: 'image/png',
                url: sender.tab?.url,
                sourceUrl: sender.tab?.url
            });
            return { success: true };

        case 'CAPTURE_VISIBLE_TAB_REQUEST':
            try {
                const dataUrl = await chrome.tabs.captureVisibleTab(null as any, { format: 'png' });
                return { success: true, dataUrl };
            } catch (error: any) {
                console.error('Failed to capture visible tab:', error);
                return { success: false, error: error.message };
            }

        // ... Other cases (SYNC_ITEM, SAVE_ITEM would call sync service)

        default:
            return { success: false, error: 'Unknown message type' };
    }
}
