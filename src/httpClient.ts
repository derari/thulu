import * as https from "https";
import * as http from "http";
import type {HttpRawResponse, HttpRequestOptions, HttpResponse, RedirectHop} from './shared/ipc.js';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 10;

function makeSingleHttpRequest(options: Omit<HttpRequestOptions, 'followRedirects'>): Promise<HttpRawResponse> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(options.url);
        const isHttps = urlObj.protocol === 'https:';
        const httpModule = isHttps ? https : http;

        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: options.method,
            headers: options.headers,
            rejectUnauthorized: options.rejectUnauthorized ?? false
        };

        const req = httpModule.request(requestOptions, (res) => {
            const chunks: Buffer[] = [];

            res.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });

            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('base64');
                const headers: Record<string, string> = {};

                if (res.headers) {
                    for (const [key, value] of Object.entries(res.headers)) {
                        if (value !== undefined) {
                            headers[key] = Array.isArray(value) ? value.join(', ') : value;
                        }
                    }
                }

                resolve({
                    ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode || 0,
                    statusText: res.statusMessage || '',
                    headers,
                    body
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

export async function makeHttpRequest(options: HttpRequestOptions): Promise<HttpResponse> {
    const followRedirects = options.followRedirects ?? true;
    const redirects: RedirectHop[] = [];

    let currentUrl = options.url;
    let currentMethod = options.method;
    let currentBody: string | undefined = options.body;

    for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt++) {
        const response = await makeSingleHttpRequest({
            url: currentUrl,
            method: currentMethod,
            headers: options.headers,
            body: currentBody,
            rejectUnauthorized: options.rejectUnauthorized
        });

        if (!followRedirects || !REDIRECT_STATUSES.has(response.status)) {
            return { ...response, redirects };
        }

        if (attempt === MAX_REDIRECTS) {
                const hopList = redirects.map(r => `  -> ${r.status} ${r.method}: ${r.url}`).join('\n');
                throw new Error(`Too many redirects (max ${MAX_REDIRECTS}):\n${hopList}`);
        }

        const location = response.headers['location'];
        if (!location) {
            return { ...response, redirects };
        }

        // Resolve relative redirects
        const nextUrl = new URL(location, currentUrl).toString();

        // Determine the method for the next request
        let nextMethod = currentMethod;
        if (response.status === 303 || ((response.status === 301 || response.status === 302) && currentMethod === 'POST')) {
            nextMethod = 'GET';
        }

        redirects.push({ status: response.status, method: nextMethod, url: nextUrl });

        currentUrl = nextUrl;
        currentMethod = nextMethod;
        // Body is dropped when switching to GET
        if (nextMethod === 'GET') {
            currentBody = undefined;
        }
    }

    throw new Error('Redirect loop');
}
