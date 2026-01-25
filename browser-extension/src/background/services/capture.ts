export const ResourceType = {
    WEB: 'WEB',
    ARTICLE: 'ARTICLE',
    IMAGE: 'IMAGE',
    NOTE: 'NOTE'
};

export async function openPopupWithData(data: any) {
    // Store data in localStorage for popup to read
    await chrome.storage.local.set({
        omniclipper_capture_data: JSON.stringify({
            ...data,
            timestamp: Date.now()
        })
    });

    // Open the extension popup
    if (chrome.action && chrome.action.openPopup) {
        try {
            await chrome.action.openPopup();
        } catch (error) {
            console.log('Could not open popup automatically:', error);
        }
    }
}

export async function captureFromBackground(options: any) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
        throw new Error('No active tab found');
    }

    try {
        const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'CAPTURE_PAGE',
            options
        });

        if (response && response.success) {
            await openPopupWithData(response.data);
            return { success: true, data: response.data };
        } else {
            throw new Error('Capture failed');
        }
    } catch (error) {
        // Fallback: get basic metadata only
        const metadata = {
            title: tab.title || '',
            url: tab.url || '',
            hostname: tab.url ? new URL(tab.url).hostname : '',
            favicon: tab.favIconUrl || ''
        };

        await openPopupWithData({
            ...metadata,
            type: ResourceType.WEB,
            capturedAt: Date.now()
        });
        return { success: true, data: metadata };
    }
}
