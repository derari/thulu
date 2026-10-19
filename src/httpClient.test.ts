import * as http from 'http';
import type {AddressInfo} from 'net';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {makeHttpRequest} from './httpClient.js';

let server: http.Server;
let baseUrl: string;
let lastRequest: { method?: string; url?: string; body: string; headers: http.IncomingHttpHeaders };

function readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    });
}

beforeAll(async () => {
    server = http.createServer(async (req, res) => {
        lastRequest = {method: req.method, url: req.url, body: await readBody(req), headers: req.headers};
        const url = new URL(req.url!, 'http://localhost');

        switch (url.pathname) {
            case '/ok':
                res.writeHead(200, {'Content-Type': 'text/plain', 'Set-Cookie': ['a=1', 'b=2']});
                res.end('hello');
                return;
            case '/created':
                res.writeHead(201, 'Made It');
                res.end();
                return;
            case '/redirect':
                res.writeHead(302, {Location: '/ok'});
                res.end();
                return;
            case '/redirect-post':
                res.writeHead(307, {Location: '/ok'});
                res.end();
                return;
            case '/see-other':
                res.writeHead(303, {Location: '/ok'});
                res.end();
                return;
            case '/no-location':
                res.writeHead(302);
                res.end('stay');
                return;
            case '/loop':
                res.writeHead(302, {Location: '/loop'});
                res.end();
                return;
            default:
                res.writeHead(404);
                res.end();
        }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
    server.close();
});

describe('makeHttpRequest', () => {
    it('returns status, headers and a base64 body', async () => {
        const response = await makeHttpRequest({url: `${baseUrl}/ok`, method: 'GET', headers: {}});

        expect(response.ok).toBe(true);
        expect(response.status).toBe(200);
        expect(response.statusText).toBe('OK');
        expect(response.headers['content-type']).toBe('text/plain');
        expect(response.headers['set-cookie']).toBe('a=1, b=2');
        expect(Buffer.from(response.body, 'base64').toString()).toBe('hello');
        expect(response.redirects).toEqual([]);
    });

    it('reports non-2xx responses as not ok', async () => {
        const response = await makeHttpRequest({url: `${baseUrl}/missing`, method: 'GET', headers: {}});

        expect(response.ok).toBe(false);
        expect(response.status).toBe(404);
    });

    it('sends the method, headers, query string and body', async () => {
        await makeHttpRequest({
            url: `${baseUrl}/ok?x=1`,
            method: 'POST',
            headers: {'X-Test': 'yes'},
            body: 'payload'
        });

        expect(lastRequest.method).toBe('POST');
        expect(lastRequest.url).toBe('/ok?x=1');
        expect(lastRequest.headers['x-test']).toBe('yes');
        expect(lastRequest.body).toBe('payload');
    });

    it('follows redirects and records each hop', async () => {
        const response = await makeHttpRequest({url: `${baseUrl}/redirect`, method: 'GET', headers: {}});

        expect(response.status).toBe(200);
        expect(response.redirects).toEqual([{status: 302, method: 'GET', url: `${baseUrl}/ok`}]);
    });

    it('switches POST to GET and drops the body on 302 and 303', async () => {
        const response = await makeHttpRequest({
            url: `${baseUrl}/see-other`,
            method: 'POST',
            headers: {},
            body: 'payload'
        });

        expect(response.redirects[0].method).toBe('GET');
        expect(lastRequest.method).toBe('GET');
        expect(lastRequest.body).toBe('');
    });

    it('keeps method and body on 307', async () => {
        const response = await makeHttpRequest({
            url: `${baseUrl}/redirect-post`,
            method: 'POST',
            headers: {},
            body: 'payload'
        });

        expect(response.redirects[0].method).toBe('POST');
        expect(lastRequest.method).toBe('POST');
        expect(lastRequest.body).toBe('payload');
    });

    it('returns the redirect response when followRedirects is false', async () => {
        const response = await makeHttpRequest({
            url: `${baseUrl}/redirect`,
            method: 'GET',
            headers: {},
            followRedirects: false
        });

        expect(response.status).toBe(302);
        expect(response.redirects).toEqual([]);
    });

    it('returns a redirect without a Location header as is', async () => {
        const response = await makeHttpRequest({url: `${baseUrl}/no-location`, method: 'GET', headers: {}});

        expect(response.status).toBe(302);
        expect(Buffer.from(response.body, 'base64').toString()).toBe('stay');
    });

    it('fails after too many redirects and lists the hops', async () => {
        await expect(
            makeHttpRequest({url: `${baseUrl}/loop`, method: 'GET', headers: {}})
        ).rejects.toThrow(/Too many redirects \(max 10\)[\s\S]*302 GET/);
    });

    it('rejects when the connection fails', async () => {
        await expect(
            makeHttpRequest({url: 'http://127.0.0.1:1/', method: 'GET', headers: {}})
        ).rejects.toThrow();
    });
});
