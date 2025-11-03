// XML body highlighting
export function highlightXmlToken(stream: any): string | null {
    // XML tags
    if (stream.match(/<\/?[^>]+>/)) {
        return 'keyword';
    }

    return null;
}

