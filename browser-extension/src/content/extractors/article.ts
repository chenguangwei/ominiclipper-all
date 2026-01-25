import { extractMetadata } from './metadata';

/**
 * Extract article content using Readability-like algorithm
 */
function extractArticleContent() {
    // Clone the document for manipulation
    const clone = document.cloneNode(true) as Document;

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

    let mainContent: Element | null = null;
    for (const selector of contentSelectors) {
        const element = clone.querySelector(selector);
        if (element && (element.textContent?.trim().length || 0) > 500) {
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
function htmlToMarkdown(element: Element | null) {
    if (!element) return '';

    let markdown = '';

    function processNode(node: Node, depth = 0): string {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || '';
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const el = node as Element;
        const tagName = el.tagName.toLowerCase();
        const children = Array.from(node.childNodes).map(n => processNode(n, depth)).join('');

        switch (tagName) {
            case 'h1': return `\n# ${children.trim()}\n\n`;
            case 'h2': return `\n## ${children.trim()}\n\n`;
            case 'h3': return `\n### ${children.trim()}\n\n`;
            case 'h4': return `\n#### ${children.trim()}\n\n`;
            case 'h5': return `\n##### ${children.trim()}\n\n`;
            case 'h6': return `\n###### ${children.trim()}\n\n`;
            case 'p': return `\n${children.trim()}\n\n`;
            case 'br': return '\n';
            case 'hr': return '\n---\n\n';
            case 'strong': case 'b': return `**${children}**`;
            case 'em': case 'i': return `*${children}*`;
            case 'code': return `\`${children}\``;
            case 'pre': return `\n\`\`\`\n${children}\n\`\`\`\n\n`;
            case 'blockquote': return `\n> ${children.replace(/\n/g, '\n> ')}\n\n`;
            case 'a':
                const href = el.getAttribute('href');
                if (href && !href.startsWith('javascript:')) {
                    const absoluteHref = href.startsWith('http') ? href : new URL(href, window.location.origin).href;
                    return `[${children}](${absoluteHref})`;
                }
                return children;
            case 'img':
                const src = el.getAttribute('src');
                const alt = el.getAttribute('alt') || 'image';
                if (src) {
                    const absoluteSrc = src.startsWith('http') ? src : new URL(src, window.location.origin).href;
                    return `![${alt}](${absoluteSrc})`;
                }
                return '';
            case 'ul':
                return '\n' + Array.from(el.children).map(li => `- ${processNode(li, depth + 1).trim()}`).join('\n') + '\n\n';
            case 'ol':
                return '\n' + Array.from(el.children).map((li, i) => `${i + 1}. ${processNode(li, depth + 1).trim()}`).join('\n') + '\n\n';
            case 'li': return children;
            case 'table': return processTable(el as HTMLTableElement);
            case 'div': case 'section': case 'article': case 'main': case 'span': return children;
            case 'script': case 'style': case 'nav': case 'header': case 'footer': case 'aside': return '';
            default: return children;
        }
    }

    function processTable(table: HTMLTableElement) {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length === 0) return '';

        let result = '\n';
        rows.forEach((row, i) => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            const cellTexts = cells.map(cell => cell.textContent?.trim() || '');
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
export function extractArticle() {
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
