import * as fs from "fs";
import * as path from "path";
import {app} from "electron";
import {getExtensionForContentType, isBinaryContentType} from './contentTypeUtils.js';

const preferencesFileName = 'preferences.json';

function getPreferencesFilePath() {
    return path.join(app.getPath('userData'), preferencesFileName);
}

export function loadPreferences(): Preferences {
    const filePath = getPreferencesFilePath();
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        const prefs = JSON.parse(data) as Preferences;
        const windowWidth = prefs.windowWidth && prefs.windowWidth >= 50 ? prefs.windowWidth : 800;
        const windowHeight = prefs.windowHeight && prefs.windowHeight >= 50 ? prefs.windowHeight : 600;
        const sidebarWidth = prefs.sidebarWidth && prefs.sidebarWidth >= 50 ? prefs.sidebarWidth : 100;
        return {...prefs, windowWidth, windowHeight, sidebarWidth};
    }
    return {appearance: 'system', windowWidth: 800, windowHeight: 600, sidebarWidth: 100};
}

export function savePreferences(partial: Partial<Preferences>) {
    const filePath = getPreferencesFilePath();
    const current = loadPreferences();
    const updated = {...current, ...partial};
    fs.writeFileSync(filePath, JSON.stringify(updated));
}

export function readFile(filePath: string): string | null {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    return fs.readFileSync(filePath, 'utf-8');
}

export function readFileBinary(filePath: string): string | null {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const buffer = fs.readFileSync(filePath);
    return buffer.toString('base64');
}

export function writeFile(filePath: string, content: string): { success: boolean; error?: string } {
    try {
        fs.writeFileSync(filePath, content, 'utf-8');
        return {success: true};
    } catch (error) {
        console.error('Error writing file:', error);
        return {success: false, error: String(error)};
    }
}

export function listDirectory(dirPath: string): Array<{ name: string; isDirectory: boolean; isFile: boolean }> {
    if (!fs.existsSync(dirPath)) {
        return [];
    }
    const entries = fs.readdirSync(dirPath, {withFileTypes: true});
    return entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile()
    }));
}

export function fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
}

export function deletePath(targetPath: string): { success: boolean; error?: string } {
    try {
        if (!fs.existsSync(targetPath)) {
            return { success: false, error: 'Path does not exist' };
        }

        const stats = fs.statSync(targetPath);

        if (stats.isDirectory()) {
            fs.rmSync(targetPath, { recursive: true, force: true });
        }
        if (stats.isFile()) {
            fs.unlinkSync(targetPath);
        }

        return { success: true };
    } catch (error) {
        console.error('Error deleting path:', error);
        return { success: false, error: String(error) };
    }
}

export function renamePath(oldPath: string, newPath: string): { success: boolean; error?: string } {
    try {
        if (!fs.existsSync(oldPath)) {
            return { success: false, error: 'Path does not exist' };
        }

        if (fs.existsSync(newPath)) {
            return { success: false, error: 'Target path already exists' };
        }

        fs.renameSync(oldPath, newPath);

        return { success: true };
    } catch (error) {
        console.error('Error renaming path:', error);
        return { success: false, error: String(error) };
    }
}

export function createFolder(folderPath: string): { success: boolean; error?: string } {
    try {
        if (fs.existsSync(folderPath)) {
            return { success: false, error: 'Folder already exists' };
        }

        fs.mkdirSync(folderPath, { recursive: true });

        return { success: true };
    } catch (error) {
        console.error('Error creating folder:', error);
        return { success: false, error: String(error) };
    }
}

export function createFile(filePath: string, content: string): { success: boolean; error?: string } {
    try {
        if (fs.existsSync(filePath)) {
            return { success: false, error: 'File already exists' };
        }

        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, content, 'utf-8');

        return { success: true };
    } catch (error) {
        console.error('Error creating file:', error);
        return { success: false, error: String(error) };
    }
}

export function updateCollectionName(collectionPath: string, newName: string): { success: boolean; error?: string } {
    try {
        const thuluJsonPath = path.join(collectionPath, '.thulu.json');

        let config: { collectionName: string } = { collectionName: newName };

        if (fs.existsSync(thuluJsonPath)) {
            const data = fs.readFileSync(thuluJsonPath, 'utf-8');
            config = JSON.parse(data);
            config.collectionName = newName;
        }

        fs.writeFileSync(thuluJsonPath, JSON.stringify(config, null, 2), 'utf-8');

        // Update the collection name in preferences
        const prefs = loadPreferences();
        const collections = prefs.collections || [];
        const collectionIndex = collections.findIndex(c => c.path === collectionPath);

        if (collectionIndex >= 0) {
            collections[collectionIndex].name = newName;
            savePreferences({ collections });
        }

        return { success: true };
    } catch (error) {
        console.error('Error updating collection name:', error);
        return { success: false, error: String(error) };
    }
}

export interface SaveHistoryParams {
    collectionPath: string;
    timestamp: string;
    requestFile: string;
    sectionName: string;
    verb: string;
    url: string;
    requestHeaders: Record<string, string>;
    requestBody?: string;
    statusCode: number;
    statusLine: string;
    responseHeaders: Record<string, string>;
    responseBody?: string;
    timeMs: number;
    redirects?: { status: number; method: string; url: string }[];
}

function getContentTypeHeader(headers: Record<string, string>): string | null {
    return headers['content-type'] || headers['Content-Type'] || null;
}

/** Reserved filenames that must not be overwritten in the entry directory */
const RESERVED_NAMES = new Set(['meta.json']);

export function parseContentDispositionFilename(headers: Record<string, string>): string | null {
    const cd = headers['content-disposition'] || headers['Content-Disposition'] || '';
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

export function listHistoryEntries(collectionPath: string, limit = 200): Array<Record<string, unknown>> {
    const responsesDir = path.join(collectionPath, '.thulu', 'responses');
    if (!fs.existsSync(responsesDir)) {
        return [];
    }

    const entries: Array<{ id: string; timestamp: string; meta: Record<string, unknown> }> = [];

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

export function saveHistoryEntry(params: SaveHistoryParams): { success: boolean; error?: string; entryPath?: string; responseBodyFile?: string; requestBodyFile?: string } {
    try {
        const {
            collectionPath, timestamp, requestFile, sectionName,
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
        const responseContentType = getContentTypeHeader(responseHeaders);
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

        const requestContentType = getContentTypeHeader(requestHeaders);
        const requestExt = getExtensionForContentType(requestContentType);
        let requestBodyFile: string | undefined;
        let requestBodySize: number | undefined;

        if (requestBody !== undefined && requestBody !== null && requestBody !== '') {
            requestBodyFile = `request-body${requestExt}`;
            const requestBuffer = Buffer.from(requestBody, 'utf-8');
            fs.writeFileSync(path.join(entryDir, requestBodyFile), requestBuffer);
            requestBodySize = requestBuffer.length;
        }

        const meta = {
            timestamp,
            requestFile,
            sectionName,
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
