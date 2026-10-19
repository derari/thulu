import * as fs from "fs";
import * as path from "path";
import {getExtensionForContentType, isBinaryContentType} from './shared/contentTypeUtils.js';
import {getHeader} from './shared/headers.js';
import type {HistoryMeta, SaveHistoryParams, SaveHistoryResult} from './shared/ipc.js';

/** Reserved filenames that must not be overwritten in the entry directory */
const RESERVED_NAMES = new Set(['meta.json']);

export function parseContentDispositionFilename(headers: Record<string, string>): string | null {
    const cd = getHeader(headers, 'content-disposition') || '';
    if (!cd) return null;

    // Prefer RFC 5987 filename* over filename
    const rfc5987Match = cd.match(/filename\*\s*=\s*([^']*)'[^']*'([^;,\s]+)/i);
    if (rfc5987Match) {
        try {
            return decodeURIComponent(rfc5987Match[2]);
        } catch {
            // fall through
        }
    }

    const plainMatch = cd.match(/filename\s*=\s*(?:"([^"\\]*)"|([^;,\s]+))/i);
    if (plainMatch) {
        return plainMatch[1] ?? plainMatch[2] ?? null;
    }

    return null;
}

export function sanitizeBodyFileName(raw: string, fallback: string): string {
    // Strip directory separators and null bytes — keep only the basename
    let name = raw.replace(/[/\\]/g, '').replace(/\x00/g, '').trim();

    // Strip leading dots (avoid hidden/system files like ".htaccess")
    name = name.replace(/^\.+/, '');

    if (!name) return fallback;

    // Must not collide with reserved entry-directory files
    if (RESERVED_NAMES.has(name.toLowerCase())) return fallback;

    // Must not start with "request-body" (reserved prefix)
    if (name.toLowerCase().startsWith('request-body')) return fallback;

    return name;
}

function safeFolderSegment(value: string, maxLen = 40): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').substring(0, maxLen);
}

export function listHistoryEntries(collectionPath: string, limit = 200): HistoryMeta[] {
    const responsesDir = path.join(collectionPath, '.thulu', 'responses');
    if (!fs.existsSync(responsesDir)) {
        return [];
    }

    const entries: Array<{ id: string; timestamp: string; meta: Omit<HistoryMeta, 'id'> }> = [];

    let dirs: string[];
    try {
        dirs = fs.readdirSync(responsesDir);
    } catch {
        return [];
    }

    for (const dir of dirs) {
        const metaPath = path.join(responsesDir, dir, 'meta.json');
        if (!fs.existsSync(metaPath)) continue;
        try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            entries.push({ id: dir, timestamp: meta.timestamp ?? '', meta });
        } catch {
            // skip corrupt entries
        }
    }

    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return entries.slice(0, limit).map(e => ({ ...e.meta, id: e.id }));
}

export function saveHistoryEntry(params: SaveHistoryParams): SaveHistoryResult {
    try {
        const {
            collectionPath, timestamp, requestFile, sectionName, environment,
            verb, url, requestHeaders, requestBody,
            statusCode, statusLine, responseHeaders, responseBody,
            timeMs, redirects
        } = params;

        // Build a human-readable folder name: 2026-05-03T14-22-01_GET_api-users_200
        const safeTimestamp = timestamp.replace(/:/g, '-').replace(/\.\d+Z$/, 'Z').replace('Z', '');
        const safeVerb = safeFolderSegment(verb, 10);
        const safeUrl = safeFolderSegment(url.replace(/^https?:\/\/[^/]+/, ''), 40);
        const folderName = `${safeTimestamp}_${safeVerb}_${safeUrl}_${statusCode}`;

        const entryDir = path.join(collectionPath, '.thulu', 'responses', folderName);
        fs.mkdirSync(entryDir, { recursive: true });

        // Determine body encoding and write body files using content-type for extension
        const responseContentType = getHeader(responseHeaders, 'content-type') ?? null;
        const responseIsBinary = isBinaryContentType(responseContentType);
        const responseExt = getExtensionForContentType(responseContentType);
        let responseBodyFile: string | undefined;
        let responseBodyEncoding: 'utf8' | 'base64' | undefined;
        let responseBodySize: number | undefined;

        if (responseBody !== undefined && responseBody !== null && responseBody !== '') {
            const defaultName = `response-body${responseExt}`;
            const dispositionName = parseContentDispositionFilename(responseHeaders);
            responseBodyFile = dispositionName
                ? sanitizeBodyFileName(dispositionName, defaultName)
                : defaultName;
            responseBodyEncoding = responseIsBinary ? 'base64' : 'utf8';
            const responseBuffer = Buffer.from(responseBody, 'base64');
            fs.writeFileSync(path.join(entryDir, responseBodyFile), responseBuffer);
            responseBodySize = responseBuffer.length;
        }

        const requestContentType = getHeader(requestHeaders, 'content-type') ?? null;
        const requestExt = getExtensionForContentType(requestContentType);
        let requestBodyFile: string | undefined;
        let requestBodySize: number | undefined;

        if (requestBody !== undefined && requestBody !== null && requestBody !== '') {
            requestBodyFile = `request-body${requestExt}`;
            const requestBuffer = Buffer.from(requestBody, 'utf-8');
            fs.writeFileSync(path.join(entryDir, requestBodyFile), requestBuffer);
            requestBodySize = requestBuffer.length;
        }

        const meta: Omit<HistoryMeta, 'id'> = {
            timestamp,
            requestFile,
            sectionName,
            environment,
            verb,
            url,
            requestHeaders,
            requestBodyFile,
            requestBodySize,
            statusCode,
            statusLine,
            responseHeaders,
            responseBodyFile,
            responseBodyEncoding,
            responseBodySize,
            timeMs,
            redirects
        };

        fs.writeFileSync(path.join(entryDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

        return { success: true, entryPath: entryDir, responseBodyFile, requestBodyFile };
    } catch (error) {
        console.error('Error saving history entry:', error);
        return { success: false, error: String(error) };
    }
}
