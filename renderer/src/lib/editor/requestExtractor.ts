const HTTP_VERBS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'];
const SECTION_MARKER = '###';

export interface HttpRequest {
    verb: string;
    url: string;
    headers: Record<string, string>;
    body: string;
}

export function extractRequestFromSection(content: string, sectionLineNumber: number): HttpRequest | null {
    const lines = content.split('\n');
    const sectionIndex = sectionLineNumber - 1;

    if (sectionIndex < 0 || sectionIndex >= lines.length) {
        return null;
    }

    const endIndex = findNextSectionIndex(lines, sectionIndex);
    const sectionLines = lines.slice(sectionIndex, endIndex);

    return parseRequestLines(sectionLines);
}

function findNextSectionIndex(lines: string[], startIndex: number): number {
    for (let i = startIndex + 1; i < lines.length; i++) {
        if (lines[i].startsWith(SECTION_MARKER)) {
            return i;
        }
    }
    return lines.length;
}

function parseRequestLines(lines: string[]): HttpRequest | null {
    const requestLineIndex = findRequestLine(lines);

    if (requestLineIndex === -1) {
        return null;
    }

    const requestLine = lines[requestLineIndex];
    const { verb, url } = parseRequestLine(requestLine);

    if (!verb || !url) {
        return null;
    }

    const headers = extractHeaders(lines, requestLineIndex);
    const body = extractBody(lines, requestLineIndex, headers.headerEndIndex);

    return {
        verb,
        url,
        headers: headers.headers,
        body
    };
}

function findRequestLine(lines: string[]): number {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line === '' || line.startsWith('#')) {
            continue;
        }

        for (const verb of HTTP_VERBS) {
            if (line.startsWith(verb + ' ')) {
                return i;
            }
        }

        break;
    }

    return -1;
}

function parseRequestLine(line: string): { verb: string; url: string } {
    const trimmed = line.trim();

    for (const verb of HTTP_VERBS) {
        if (trimmed.startsWith(verb + ' ')) {
            const url = trimmed.substring(verb.length + 1).trim();
            return { verb, url };
        }
    }

    return { verb: '', url: '' };
}

function extractHeaders(lines: string[], requestLineIndex: number): { headers: Record<string, string>; headerEndIndex: number } {
    const headers: Record<string, string> = {};
    let headerEndIndex = requestLineIndex + 1;

    for (let i = requestLineIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line === '') {
            headerEndIndex = i;
            break;
        }

        if (!isHeaderLine(line)) {
            headerEndIndex = i;
            break;
        }

        const { key, value } = parseHeaderLine(line);
        if (key) {
            headers[key] = value;
        }

        headerEndIndex = i + 1;
    }

    return { headers, headerEndIndex };
}

function isHeaderLine(line: string): boolean {
    const colonIndex = line.indexOf(':');
    return colonIndex > 0 && colonIndex < line.length - 1;
}

function parseHeaderLine(line: string): { key: string; value: string } {
    const colonIndex = line.indexOf(':');

    if (colonIndex === -1) {
        return { key: '', value: '' };
    }

    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();

    return { key, value };
}

function extractBody(lines: string[], requestLineIndex: number, headerEndIndex: number): string {
    const bodyLines: string[] = [];
    let bodyStarted = false;

    for (let i = headerEndIndex; i < lines.length; i++) {
        const line = lines[i];

        if (!bodyStarted && line.trim() === '') {
            continue;
        }

        bodyStarted = true;
        bodyLines.push(line);
    }

    return bodyLines.join('\n').trimEnd();
}

