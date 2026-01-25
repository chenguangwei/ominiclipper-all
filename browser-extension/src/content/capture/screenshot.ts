export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Capture specific area of the page
 */
export async function captureArea(rect: Rect) {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'CAPTURE_VISIBLE_TAB',
            rect: rect
        });

        if (response && response.success) {
            // Crop the captured image to the selected area
            const img = new Image();
            img.src = response.dataUrl;

            await new Promise((resolve) => {
                img.onload = resolve;
            });

            const dpr = window.devicePixelRatio || 1;
            const canvas = document.createElement('canvas');
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(
                    img,
                    rect.x * dpr, rect.y * dpr,
                    rect.width * dpr, rect.height * dpr,
                    0, 0,
                    rect.width * dpr, rect.height * dpr
                );

                const croppedDataUrl = canvas.toDataURL('image/png');

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
        }
    } catch (error) {
        console.error('OmniClipper: Screenshot capture failed', error);
    }
}

/**
 * Capture visible area
 */
export async function captureVisible() {
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
 * Capture full page
 */
export async function captureFullPage() {
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
