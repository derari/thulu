import type { HttpSection } from '../collection';

export interface ParsedHttpFile {
    sections: HttpSection[];
    content: string;
}

const SECTION_MARKER = '###';
const HTTP_VERBS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'];

function extractSectionName(line: string): string {
    const afterMarker = line.substring(SECTION_MARKER.length).trim();
    return afterMarker || '';
}

function extractVerbAndUrl(lines: string[], startIndex: number, nextSectionIndex?: number): { verb?: string; url?: string; verbLine?: number } {
    const endIndex = nextSectionIndex !== undefined ? nextSectionIndex : lines.length;

    for (let i = startIndex + 1; i < endIndex; i++) {
        const line = lines[i].trim();

        if (line === '' || line.startsWith('#')) {
            continue;
        }

        for (const verb of HTTP_VERBS) {
            if (line.startsWith(verb + ' ')) {
                const url = line.substring(verb.length + 1).trim();
                return { verb, url, verbLine: i + 1 };
            }
        }

        break;
    }

    return {};
}

export function parseHttpFile(content: string): ParsedHttpFile {
    const sections: HttpSection[] = [];
    const lines = content.split('\n');
    const sectionIndices: number[] = [];

    // First pass: find all section markers
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith(SECTION_MARKER)) {
            sectionIndices.push(i);
        }
    }

    // Second pass: process sections
    for (let idx = 0; idx < sectionIndices.length; idx++) {
        const i = sectionIndices[idx];
        const line = lines[i];
        const nextSectionIndex = idx + 1 < sectionIndices.length ? sectionIndices[idx + 1] : undefined;

        const name = extractSectionName(line);
        const { verb, url, verbLine } = extractVerbAndUrl(lines, i, nextSectionIndex);

        const isDivider = !verb && !url;

        // Skip dividers that are first or last
        const isFirst = idx === 0;
        const isLast = idx === sectionIndices.length - 1;

        if (isDivider && (isFirst || isLast)) {
            continue;
        }

        // Use URL as title if untitled
        const title = name || url || 'Untitled';

        sections.push({
            name: title,
            lineNumber: i + 1,
            verb,
            verbLine,
            url,
            isDivider
        });
    }

    return {
        sections,
        content
    };
}

