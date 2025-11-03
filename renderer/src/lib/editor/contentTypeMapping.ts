import { highlightJsonToken } from '$lib/editor/languages/jsonHighlighting.js';
import { highlightXmlToken } from '$lib/editor/languages/xmlHighlighting.js';
import { highlightHtmlToken } from '$lib/editor/languages/htmlHighlighting.js';
import { highlightPlainToken } from '$lib/editor/languages/plainHighlighting.js';

type HighlightFunction = (stream: any) => string | null;

interface ContentTypeMapping {
    pattern: RegExp;
    key: string;
    highlighter: HighlightFunction;
}

// Content-Type patterns tested in order (specific first, general last)
export const CONTENT_TYPE_MAPPINGS: ContentTypeMapping[] = [
    // Specific JSON types
    { pattern: /^application\/json\b/i, key: 'json', highlighter: highlightJsonToken },
    { pattern: /^text\/json\b/i, key: 'json', highlighter: highlightJsonToken },

    // Specific XML types
    { pattern: /^application\/xml\b/i, key: 'xml', highlighter: highlightXmlToken },
    { pattern: /^text\/xml\b/i, key: 'xml', highlighter: highlightXmlToken },

    // Specific HTML types
    { pattern: /^text\/html\b/i, key: 'html', highlighter: highlightHtmlToken },
    { pattern: /^application\/xhtml\+xml\b/i, key: 'html', highlighter: highlightHtmlToken },

    // General patterns (more permissive)
    { pattern: /\bjson\b/i, key: 'json', highlighter: highlightJsonToken },
    { pattern: /\bxml\b/i, key: 'xml', highlighter: highlightXmlToken },
    { pattern: /\bhtml\b/i, key: 'html', highlighter: highlightHtmlToken }
];

export function getHighlighterForContentType(contentType: string | null): HighlightFunction {
    if (!contentType) {
        return highlightPlainToken;
    }

    // Extract just the MIME type (before semicolon for charset, etc.)
    const mimeType = contentType.split(';')[0].trim();

    // Test patterns in order
    for (const mapping of CONTENT_TYPE_MAPPINGS) {
        if (mapping.pattern.test(mimeType)) {
            return mapping.highlighter;
        }
    }

    // Default to plain text
    return highlightPlainToken;
}

