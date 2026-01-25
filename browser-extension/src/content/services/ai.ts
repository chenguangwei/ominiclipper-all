const AI_CONFIG = {
    provider: 'gemini',
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    maxContentLength: 8000,
};

async function getApiKey() {
    return new Promise<string>((resolve) => {
        chrome.storage.local.get(['geminiApiKey'], (result) => {
            resolve(result.geminiApiKey || '');
        });
    });
}

export async function generateSummary(content: string) {
    if (!content || content.trim().length < 50) {
        return { success: false, error: 'Content too short for summarization' };
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
        return { success: false, error: 'API key not configured' };
    }

    const truncatedContent = content.substring(0, AI_CONFIG.maxContentLength);

    const prompt = `Please provide a concise summary of the following content in about 200-300 words. Focus on the main points and key information:\n\n${truncatedContent}\n\nSummary:`;

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
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
