import { captureFromBackground, openPopupWithData, ResourceType } from '../services/capture';
import * as syncQueue from '../services/syncQueue';
import { FeishuService, validateConfig, clearTokenCache } from '../../services/feishuService';

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
                title: message.data?.title || 'Screenshot - ' + new Date().toLocaleString(),
                imageData: message.data?.imageData,
                imageMimeType: 'image/png',
                url: sender.tab?.url || message.data?.sourceUrl,
                sourceUrl: message.data?.sourceUrl || sender.tab?.url,
                width: message.data?.width,
                height: message.data?.height
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

        case 'CAPTURE_FULL_PAGE':
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab.id) {
                    return { success: false, error: 'No active tab' };
                }

                // Get page dimensions
                const [dimensionsResult] = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => ({
                        scrollWidth: document.documentElement.scrollWidth,
                        scrollHeight: document.documentElement.scrollHeight,
                        viewportWidth: window.innerWidth,
                        viewportHeight: window.innerHeight,
                        originalScrollX: window.scrollX,
                        originalScrollY: window.scrollY,
                        devicePixelRatio: window.devicePixelRatio || 1
                    })
                });

                const dimensions = dimensionsResult.result;
                if (!dimensions) {
                    return { success: false, error: 'Failed to get page dimensions' };
                }

                const { scrollWidth, scrollHeight, viewportWidth, viewportHeight, originalScrollX, originalScrollY, devicePixelRatio } = dimensions;

                // Calculate number of captures needed
                const cols = Math.ceil(scrollWidth / viewportWidth);
                const rows = Math.ceil(scrollHeight / viewportHeight);
                const captures: { x: number; y: number; dataUrl: string }[] = [];

                // Capture each viewport section (with rate limiting - Chrome allows ~2 captures/second)
                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        const scrollX = col * viewportWidth;
                        const scrollY = row * viewportHeight;

                        // Scroll to position
                        await chrome.scripting.executeScript({
                            target: { tabId: tab.id! },
                            func: (x: number, y: number) => window.scrollTo(x, y),
                            args: [scrollX, scrollY]
                        });

                        // Wait for scroll to complete, render, and respect rate limit
                        await new Promise(resolve => setTimeout(resolve, 600));

                        // Capture visible area
                        const dataUrl = await chrome.tabs.captureVisibleTab(null as any, { format: 'png' });
                        captures.push({ x: scrollX, y: scrollY, dataUrl });
                    }
                }

                // Restore original scroll position
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (x: number, y: number) => window.scrollTo(x, y),
                    args: [originalScrollX, originalScrollY]
                });

                // Stitch images together using OffscreenCanvas
                const canvas = new OffscreenCanvas(
                    scrollWidth * devicePixelRatio,
                    scrollHeight * devicePixelRatio
                );
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return { success: false, error: 'Failed to create canvas context' };
                }

                // Load and draw all captured images
                for (const capture of captures) {
                    const response = await fetch(capture.dataUrl);
                    const blob = await response.blob();
                    const bitmap = await createImageBitmap(blob);

                    ctx.drawImage(
                        bitmap,
                        capture.x * devicePixelRatio,
                        capture.y * devicePixelRatio
                    );
                }

                // Convert to data URL
                const fullPageBlob = await canvas.convertToBlob({ type: 'image/png' });
                const reader = new FileReader();
                const fullPageDataUrl = await new Promise<string>((resolve) => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(fullPageBlob);
                });

                return { success: true, dataUrl: fullPageDataUrl };
            } catch (error: any) {
                console.error('Failed to capture full page:', error);
                return { success: false, error: error.message };
            }

        // ==================== Feishu API Handlers ====================
        // These handlers allow popup/content scripts to call Feishu API
        // through the background script, avoiding CORS issues

        case 'FEISHU_VALIDATE_CONFIG':
            try {
                const result = await validateConfig(message.config);
                return result;
            } catch (error: any) {
                return { valid: false, error: error.message };
            }

        case 'FEISHU_CREATE_RECORD':
            try {
                const result = await FeishuService.createRecord(message.config, message.item);
                return result;
            } catch (error: any) {
                return { success: false, error: error.message };
            }

        case 'FEISHU_GET_RECORD':
            try {
                const result = await FeishuService.getRecord(message.config, message.recordId);
                return result;
            } catch (error: any) {
                return { success: false, error: error.message };
            }

        case 'FEISHU_UPDATE_RECORD':
            try {
                const result = await FeishuService.updateRecord(message.config, message.recordId, message.updates);
                return result;
            } catch (error: any) {
                return { success: false, error: error.message };
            }

        case 'FEISHU_DELETE_RECORD':
            try {
                const result = await FeishuService.deleteRecord(message.config, message.recordId);
                return result;
            } catch (error: any) {
                return { success: false, error: error.message };
            }

        case 'FEISHU_LIST_RECORDS':
            try {
                const result = await FeishuService.listRecords(message.config, message.options);
                return result;
            } catch (error: any) {
                return { success: false, error: error.message };
            }

        case 'FEISHU_BATCH_CREATE':
            try {
                const result = await FeishuService.batchCreateRecords(message.config, message.items);
                return result;
            } catch (error: any) {
                return { success: false, created: 0, failed: message.items?.length || 0, error: error.message };
            }

        case 'FEISHU_GET_SCHEMA':
            try {
                const result = await FeishuService.getTableSchema(message.config);
                return result;
            } catch (error: any) {
                return { success: false, error: error.message };
            }

        case 'FEISHU_GET_CONFIG_HELP':
            try {
                const result = await FeishuService.getConfigurationHelp(message.config);
                return result;
            } catch (error: any) {
                return { valid: false, message: error.message };
            }

        case 'FEISHU_CLEAR_TOKEN_CACHE':
            clearTokenCache();
            return { success: true };

        default:
            return { success: false, error: 'Unknown message type' };
    }
}
