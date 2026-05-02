import { writable } from 'svelte/store';
import type { ResolvedRequest } from '../editor/httpRequestExecutor.js';

export interface HttpResponse {
    statusLine: string;
    headers: Record<string, string>;
    body: string;
    timeMs: number;
    redirects?: { status: number; method: string; url: string }[];
    resolvedRequest?: ResolvedRequest;
}

function createHttpResponseStore() {
    const { subscribe, set } = writable<HttpResponse | null>(null);

    return {
        subscribe,
        setResponse(response: HttpResponse) {
            set(response);
        },
        clear() {
            set(null);
        }
    };
}

export const httpResponse = createHttpResponseStore();
