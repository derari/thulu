import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { globalVariables } from '../stores/globalVariables';
import { httpResponse } from '../stores/httpResponse';
import { runRequest } from './requestRunner';

vi.mock('../environmentParser', () => ({
    getEnvironmentVariablesMap: vi.fn().mockResolvedValue({})
}));

const collectionPath = '/collection';
const filePath = '/collection/api/users.http';
const content = [
    '### List users',
    'GET http://example.com/users',
    'Accept: application/json',
    '',
    '> {% client.global.set("token", "abc") %}'
].join('\n');

function rawResponse(overrides: Record<string, unknown> = {}) {
    return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: btoa('{"a":1}'),
        redirects: [],
        ...overrides
    };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('runRequest', () => {
    let electronAPI: Record<string, ReturnType<typeof vi.fn>>;

    beforeEach(() => {
        httpResponse.clear();
        globalVariables.clear(collectionPath);
        electronAPI = {
            httpRequest: vi.fn().mockResolvedValue(rawResponse()),
            executeScript: vi.fn().mockResolvedValue({
                success: true,
                logs: [],
                globalVariableChanges: { token: 'abc' }
            }),
            saveHistory: vi.fn().mockResolvedValue({
                success: true,
                entryPath: '/collection/.thulu/responses/entry',
                responseBodyFile: 'response-body.json'
            })
        };
        (global as any).window = { electronAPI };
    });

    it('sends the request and shows the response', async () => {
        await runRequest({ content, sectionLineNumber: 2, selectedEnvironment: '', filePath, collectionPath });

        expect(electronAPI.httpRequest).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'GET', url: 'http://example.com/users' })
        );
        const response = get(httpResponse);
        expect(response?.statusLine).toBe('HTTP/1.1 200 OK');
        expect(atob(response!.bodyBytes)).toBe('{"a":1}');
    });

    it('stores global variables set by post-scripts', async () => {
        await runRequest({ content, sectionLineNumber: 2, selectedEnvironment: '', filePath, collectionPath });

        expect(globalVariables.get(collectionPath)).toEqual({ token: 'abc' });
    });

    it('saves a history entry and attaches the saved body path to the response', async () => {
        await runRequest({ content, sectionLineNumber: 2, selectedEnvironment: 'dev', filePath, collectionPath });
        await flush();

        expect(electronAPI.saveHistory).toHaveBeenCalledWith(
            expect.objectContaining({
                collectionPath,
                requestFile: 'api/users.http',
                sectionName: 'List users',
                environment: 'dev',
                verb: 'GET',
                url: 'http://example.com/users',
                statusCode: 200
            })
        );
        expect(get(httpResponse)?.responseBodyFilePath).toBe(
            '/collection/.thulu/responses/entry/response-body.json'
        );
    });

    it('shows an error response when the request cannot be built', async () => {
        await runRequest({ content, sectionLineNumber: 99, selectedEnvironment: '', filePath, collectionPath });

        const response = get(httpResponse);
        expect(response?.statusLine).toBe('Error');
        expect(atob(response!.bodyBytes)).toContain('Failed to extract request');
        expect(electronAPI.saveHistory).not.toHaveBeenCalled();
    });

    it('still shows the response when saving the history fails', async () => {
        electronAPI.saveHistory.mockRejectedValue(new Error('disk full'));

        await runRequest({ content, sectionLineNumber: 2, selectedEnvironment: '', filePath, collectionPath });
        await flush();

        expect(get(httpResponse)?.statusLine).toBe('HTTP/1.1 200 OK');
    });
});
