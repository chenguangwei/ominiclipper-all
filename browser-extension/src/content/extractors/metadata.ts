/**
 * Extract favicon from page
 */
export function extractFavicon() {
    const iconSelectors = [
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
        'link[rel="apple-touch-icon"]',
        'link[rel="apple-touch-icon-precomposed"]',
        'link[rel="mask-icon"]'
    ];

    for (const selector of iconSelectors) {
        const icon = document.querySelector(selector) as HTMLLinkElement;
        if (icon && icon.href) {
            return icon.href;
        }
    }

    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage && (ogImage as any).content) {
        return (ogImage as any).content;
    }

    return `${window.location.origin}/favicon.ico`;
}

/**
 * Extract site name
 */
export function extractSiteName() {
    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName && (ogSiteName as any).content) {
        return (ogSiteName as any).content;
    }
    return window.location.hostname.replace('www.', '');
}

/**
 * Extract metadata from page
 */
export function extractMetadata() {
    const getMeta = (selector: string) => {
        const el = document.querySelector(selector);
        return el ? el.getAttribute('content') || el.textContent!.trim() : '';
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
 * Extract links from page
 */
export function extractLinks() {
    const links: any[] = [];
    const anchorTags = document.querySelectorAll('a[href]');

    anchorTags.forEach(a => {
        const href = (a as HTMLAnchorElement).href;
        if (href && href.startsWith('http') && !href.includes(window.location.hostname)) {
            if (!links.some(l => l.url === href)) {
                links.push({
                    url: href,
                    title: a.textContent!.trim() || a.getAttribute('title') || 'Untitled Link'
                });
            }
        }
    });

    return links.slice(0, 20);
}

/**
 * Extract images from page
 */
export function extractImages() {
    const images: any[] = [];
    const imgTags = document.querySelectorAll('img[src]');

    imgTags.forEach(img => {
        const src = (img as HTMLImageElement).src;
        if (src && src.startsWith('http')) {
            images.push({
                url: src,
                alt: (img as HTMLImageElement).alt || '',
                width: (img as HTMLImageElement).naturalWidth || (img as HTMLImageElement).width,
                height: (img as HTMLImageElement).naturalHeight || (img as HTMLImageElement).height
            });
        }
    });

    return images.slice(0, 10);
}

/**
 * Extract selected text
 */
export function extractSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return '';

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;

    let text = selection.toString().trim();

    if (container.parentElement) {
        const parentText = container.parentElement.textContent || '';
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
