import { writable } from 'svelte/store';

export interface HttpResponse {
	statusLine: string;
	headers: Record<string, string>;
	body: string;
	timeMs: number;
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
