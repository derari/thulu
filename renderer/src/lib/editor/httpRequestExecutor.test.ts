import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeHttpRequest } from './httpRequestExecutor';
import type { ParsedHttpFile } from './httpParser';

vi.mock('../environmentParser', () => ({
	getEnvironmentVariablesMap: vi.fn().mockResolvedValue({})
}));

describe('executeHttpRequest', () => {
	beforeEach(() => {
		(global as any).window = {
			electronAPI: {
				httpRequest: vi.fn(),
				executeScript: vi.fn()
			}
		};
	});

	describe('Basic Authentication encoding', () => {
		const createParsedFile = (headers: Record<string, string>): ParsedHttpFile => ({
			lines: ['GET http://example.com', ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`)],
			preamble: {
				startLineNumber: 1,
				endLineNumber: 1,
				variables: {}
			},
			sections: [{
				name: 'Test Request',
				startLineNumber: 1,
				endLineNumber: 10,
				verb: 'GET',
				url: 'http://example.com',
				isDivider: false,
				headers: {
					startLineNumber: 2,
					endLineNumber: 3,
					headers
				},
				postScripts: []
			}]
		});

		const createMockResponse = () => ({
			ok: true,
			status: 200,
			statusText: 'OK',
			headers: {},
			body: ''
		});

		it('should encode Authorization header with Basic username:password to base64', async () => {
			const parsedFile = createParsedFile({
				'Authorization': 'Basic user:pass'
			});

			vi.mocked(window.electronAPI.httpRequest).mockResolvedValue(createMockResponse());

			await executeHttpRequest({
				parsedFile,
				sectionLineNumber: 1,
				selectedEnvironment: '',
				fileDirectory: '/test',
				collectionPath: '/test'
			});

			expect(window.electronAPI.httpRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: expect.objectContaining({
						'Authorization': 'Basic dXNlcjpwYXNz'
					})
				})
			);
		});

		it('should handle case insensitive Authorization header', async () => {
			const parsedFile = createParsedFile({
				'authorization': 'basic user:pass'
			});

			vi.mocked(window.electronAPI.httpRequest).mockResolvedValue(createMockResponse());

			await executeHttpRequest({
				parsedFile,
				sectionLineNumber: 1,
				selectedEnvironment: '',
				fileDirectory: '/test',
				collectionPath: '/test'
			});

			expect(window.electronAPI.httpRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: expect.objectContaining({
						'authorization': 'basic dXNlcjpwYXNz'
					})
				})
			);
		});

		it('should handle mixed case BASIC keyword', async () => {
			const parsedFile = createParsedFile({
				'Authorization': 'BaSiC user:pass'
			});

			vi.mocked(window.electronAPI.httpRequest).mockResolvedValue(createMockResponse());

			await executeHttpRequest({
				parsedFile,
				sectionLineNumber: 1,
				selectedEnvironment: '',
				fileDirectory: '/test',
				collectionPath: '/test'
			});

			expect(window.electronAPI.httpRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: expect.objectContaining({
						'Authorization': 'BaSiC dXNlcjpwYXNz'
					})
				})
			);
		});

		it('should not encode if no colon in credentials', async () => {
			const parsedFile = createParsedFile({
				'Authorization': 'Basic useronly'
			});

			vi.mocked(window.electronAPI.httpRequest).mockResolvedValue(createMockResponse());

			await executeHttpRequest({
				parsedFile,
				sectionLineNumber: 1,
				selectedEnvironment: '',
				fileDirectory: '/test',
				collectionPath: '/test'
			});

			expect(window.electronAPI.httpRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: expect.objectContaining({
						'Authorization': 'Basic useronly'
					})
				})
			);
		});

		it('should not modify already encoded Basic auth', async () => {
			const parsedFile = createParsedFile({
				'Authorization': 'Basic dXNlcjpwYXNz'
			});

			vi.mocked(window.electronAPI.httpRequest).mockResolvedValue(createMockResponse());

			await executeHttpRequest({
				parsedFile,
				sectionLineNumber: 1,
				selectedEnvironment: '',
				fileDirectory: '/test',
				collectionPath: '/test'
			});

			expect(window.electronAPI.httpRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: expect.objectContaining({
						'Authorization': 'Basic dXNlcjpwYXNz'
					})
				})
			);
		});

		it('should handle credentials with multiple colons', async () => {
			const parsedFile = createParsedFile({
				'Authorization': 'Basic user:pass:word'
			});

			vi.mocked(window.electronAPI.httpRequest).mockResolvedValue(createMockResponse());

			await executeHttpRequest({
				parsedFile,
				sectionLineNumber: 1,
				selectedEnvironment: '',
				fileDirectory: '/test',
				collectionPath: '/test'
			});

			expect(window.electronAPI.httpRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: expect.objectContaining({
						'Authorization': 'Basic dXNlcjpwYXNzOndvcmQ='
					})
				})
			);
		});

		it('should not affect other authorization schemes', async () => {
			const parsedFile = createParsedFile({
				'Authorization': 'Bearer some-token'
			});

			vi.mocked(window.electronAPI.httpRequest).mockResolvedValue(createMockResponse());

			await executeHttpRequest({
				parsedFile,
				sectionLineNumber: 1,
				selectedEnvironment: '',
				fileDirectory: '/test',
				collectionPath: '/test'
			});

			expect(window.electronAPI.httpRequest).toHaveBeenCalledWith(
				expect.objectContaining({
					headers: expect.objectContaining({
						'Authorization': 'Bearer some-token'
					})
				})
			);
		});
	});
});

