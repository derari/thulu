import { writable } from 'svelte/store';
import type { ResolvedRequest } from '../editor/httpRequestExecutor.js';

export interface HttpResponse {
    statusLine: string;
    headers: Record<string, string>;
    /** Base64-encoded raw response bytes */
    bodyBytes: string;
    timeMs: number;
    redirects?: { status: number; method: string; url: string }[];
    resolvedRequest?: ResolvedRequest;
    responseBodyFilePath?: string;
    responseBodySize?: number;
    requestBodyFilePath?: string;
    requestBodySize?: number;
}

function createHttpResponseStore() {
    const { subscribe, set, update } = writable<HttpResponse | null>(null);

    return {
        subscribe,
        setResponse(response: HttpResponse) {
            set(response);
        },
        patchFilePaths(paths: {
            responseBodyFilePath?: string;
            responseBodySize?: number;
            requestBodyFilePath?: string;
            requestBodySize?: number;
        }) {
            update((current) => (current ? { ...current, ...paths } : current));
        },
        clear() {
            set(null);
        }
    };
}

export const httpResponse = createHttpResponseStore();
