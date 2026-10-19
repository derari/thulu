/** Case-insensitive HTTP header lookup. */
export function getHeader(headers: Record<string, string> | undefined, name: string): string | undefined {
    if (!headers) {
        return undefined;
    }
    const lowerName = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === lowerName) {
            return value;
        }
    }
    return undefined;
}
