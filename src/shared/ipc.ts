/** Types of the data exchanged between the main process and the renderer over IPC. */

export interface FileOperationResult {
    success: boolean;
    error?: string;
}

export interface DirectoryEntry {
    name: string;
    isDirectory: boolean;
    isFile: boolean;
}

export interface RedirectHop {
    status: number;
    method: string;
    url: string;
}

export interface HttpRequestOptions {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    rejectUnauthorized?: boolean;
    followRedirects?: boolean;
}

export interface HttpRawResponse {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    /** Base64-encoded response body bytes */
    body: string;
}

export interface HttpResponse extends HttpRawResponse {
    redirects: RedirectHop[];
}

export interface ScriptExecutionParams {
    code: string;
    timeout: number;
    collectionPath?: string;
    responseBody?: string;
    responseContentType?: string;
}

export interface ScriptExecutionResult {
    success: boolean;
    error?: string;
    logs: string[];
    globalVariableChanges?: Record<string, string>;
}

export interface SaveHistoryParams {
    collectionPath: string;
    timestamp: string;
    requestFile: string;
    sectionName: string;
    environment?: string;
    verb: string;
    url: string;
    requestHeaders: Record<string, string>;
    /** Request body as text */
    requestBody?: string;
    statusCode: number;
    statusLine: string;
    responseHeaders: Record<string, string>;
    /** Base64-encoded response body bytes */
    responseBody?: string;
    timeMs: number;
    redirects?: RedirectHop[];
}

export interface SaveHistoryResult extends FileOperationResult {
    entryPath?: string;
    responseBodyFile?: string;
    requestBodyFile?: string;
}

/** The `meta.json` of a history entry, plus the entry's folder name as `id`. */
export interface HistoryMeta {
    /** Folder name, used to construct body file paths */
    id: string;
    /** ISO 8601 */
    timestamp: string;
    /** Relative path from the collection root */
    requestFile: string;
    sectionName: string;
    environment?: string;
    verb: string;
    url: string;
    requestHeaders: Record<string, string>;
    /** 'request-body.*' if present */
    requestBodyFile?: string;
    /** On-disk file size in bytes */
    requestBodySize?: number;
    statusCode: number;
    statusLine: string;
    responseHeaders: Record<string, string>;
    /** 'response-body.*' if present */
    responseBodyFile?: string;
    responseBodyEncoding?: 'utf8' | 'base64';
    /** On-disk file size in bytes */
    responseBodySize?: number;
    timeMs: number;
    redirects?: RedirectHop[];
}
