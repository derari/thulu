// HTML body highlighting
export function highlightHtmlToken(stream: any): string | null {
    // HTML tags
    if (stream.match(/<\/?[^>]+>/)) {
        return 'keyword';
    }

    return null;
}

