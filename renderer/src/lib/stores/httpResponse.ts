import { writable } from 'svelte/store';

export interface HttpResponse {
    statusLine: string;
    headers: Record<string, string>;
    body: string;
    timeMs: number;
    redirects?: { status: number; method: string; url: string }[];
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
