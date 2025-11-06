import { describe, expect, it } from 'vitest';
import { extractRequest } from './requestExtractor';
import type { ParsedHttpFile } from './httpParser';

describe('extractRequest', () => {
	describe('section finding by line number', () => {
		it('should find section when line number is at section start', () => {
			const parsed: ParsedHttpFile = {
				preamble: { startLineNumber: 1, endLineNumber: 1 },
				sections: [
					{
						name: 'Get Users',
						startLineNumber: 1,
						endLineNumber: 3,
						verb: 'GET',
						verbLine: 2,
						url: 'https://api.example.com/users',
						isDivider: false
					}
				],
				lines: ['### Get Users', 'GET https://api.example.com/users']
			};

			const result = extractRequest(parsed, 1);

			expect(result).not.toBeNull();
			expect(result?.verb).toBe('GET');
			expect(result?.url).toBe('https://api.example.com/users');
		});

		it('should find section when line number is within section', () => {
			const parsed: ParsedHttpFile = {
				preamble: { startLineNumber: 1, endLineNumber: 1 },
				sections: [
					{
						name: 'Get Users',
						startLineNumber: 1,
						endLineNumber: 4,
						verb: 'GET',
						verbLine: 2,
						url: 'https://api.example.com/users',
						isDivider: false,
						headers: {
							startLineNumber: 3,
							endLineNumber: 4,
							headers: { 'Authorization': 'Bearer token' }
						}
					}
				],
				lines: ['### Get Users', 'GET https://api.example.com/users', 'Authorization: Bearer token']
			};

			const result = extractRequest(parsed, 2);

			expect(result).not.toBeNull();
			expect(result?.verb).toBe('GET');
		});

		it('should find correct section in multi-section file', () => {
			const parsed: ParsedHttpFile = {
				preamble: { startLineNumber: 1, endLineNumber: 1 },
				sections: [
					{
						name: 'First Request',
						startLineNumber: 1,
						endLineNumber: 4,
						verb: 'GET',
						verbLine: 2,
						url: 'https://api.example.com/first',
						isDivider: false
					},
					{
						name: 'Second Request',
						startLineNumber: 4,
						endLineNumber: 6,
						verb: 'POST',
						verbLine: 5,
						url: 'https://api.example.com/second',
						isDivider: false
					}
				],
				lines: ['### First Request', 'GET https://api.example.com/first', '', '### Second Request', 'POST https://api.example.com/second']
			};

			const firstResult = extractRequest(parsed, 1);
			const secondResult = extractRequest(parsed, 4);

			expect(firstResult?.verb).toBe('GET');
			expect(firstResult?.url).toBe('https://api.example.com/first');
			expect(secondResult?.verb).toBe('POST');
			expect(secondResult?.url).toBe('https://api.example.com/second');
		});

		it('should return null when line number is before any section', () => {
			const parsed: ParsedHttpFile = {
				preamble: { startLineNumber: 1, endLineNumber: 3 },
				sections: [
					{
						name: 'First Request',
						startLineNumber: 3,
						endLineNumber: 5,
						verb: 'GET',
						verbLine: 4,
						url: 'https://api.example.com',
						isDivider: false
					}
				],
				lines: ['# Preamble comment', '', '### First Request', 'GET https://api.example.com']
			};

			const result = extractRequest(parsed, 1);

			expect(result).toBeNull();
		});
	});

	describe('request extraction', () => {
		it('should return null for section without verb', () => {
			const parsed: ParsedHttpFile = {
				preamble: { startLineNumber: 1, endLineNumber: 1 },
				sections: [
					{
						name: 'Divider',
						startLineNumber: 1,
						endLineNumber: 3,
						isDivider: true
					}
				],
				lines: ['### Divider', 'Just some text']
			};

			const result = extractRequest(parsed, 1);

			expect(result).toBeNull();
		});

		it('should extract verb and url from section', () => {
			const parsed: ParsedHttpFile = {
				preamble: { startLineNumber: 1, endLineNumber: 1 },
				sections: [
					{
						name: 'Test',
						startLineNumber: 1,
						endLineNumber: 3,
						verb: 'POST',
						verbLine: 2,
						url: 'https://api.example.com/test',
						isDivider: false
					}
				],
				lines: ['### Test', 'POST https://api.example.com/test']
			};

			const result = extractRequest(parsed, 1);

			expect(result?.verb).toBe('POST');
			expect(result?.url).toBe('https://api.example.com/test');
		});

		it('should extract headers when present', () => {
			const parsed: ParsedHttpFile = {
				preamble: { startLineNumber: 1, endLineNumber: 1 },
				sections: [
					{
						name: 'Request',
						startLineNumber: 1,
						endLineNumber: 5,
						verb: 'GET',
						verbLine: 2,
						url: 'https://api.example.com',
						isDivider: false,
						headers: {
							startLineNumber: 3,
							endLineNumber: 5,
							headers: {
								'Content-Type': 'application/json',
								'Authorization': 'Bearer token'
							}
						}
					}
				],
				lines: ['### Request', 'GET https://api.example.com', 'Content-Type: application/json', 'Authorization: Bearer token']
			};

			const result = extractRequest(parsed, 1);

			expect(result?.headers).toEqual({
				'Content-Type': 'application/json',
				'Authorization': 'Bearer token'
			});
		});

		it('should return empty headers object when no headers', () => {
			const parsed: ParsedHttpFile = {
				preamble: { startLineNumber: 1, endLineNumber: 1 },
				sections: [
					{
						name: 'Request',
						startLineNumber: 1,
						endLineNumber: 3,
						verb: 'GET',
						verbLine: 2,
						url: 'https://api.example.com',
						isDivider: false
					}
				],
				lines: ['### Request', 'GET https://api.example.com']
			};

			const result = extractRequest(parsed, 1);

			expect(result?.headers).toEqual({});
		});
	});

	describe('body extraction', () => {
		it('should return null when section has no body', () => {
			const parsed: ParsedHttpFile = {
				preamble: { startLineNumber: 1, endLineNumber: 1 },
				sections: [
					{
						name: 'Request',
						startLineNumber: 1,
						endLineNumber: 3,
						verb: 'GET',
						verbLine: 2,
						url: 'https://api.example.com',
						isDivider: false
					}
				],
				lines: ['### Request', 'GET https://api.example.com']
			};

			const result = extractRequest(parsed, 1);

			expect(result?.body).toBeNull();
		});

		it('should extract single line body', () => {
			const parsed: ParsedHttpFile = {
				preamble: { startLineNumber: 1, endLineNumber: 1 },
				sections: [
					{
						name: 'Request',
						startLineNumber: 1,
						endLineNumber: 5,
						verb: 'POST',
						verbLine: 2,
						url: 'https://api.example.com',
						isDivider: false,
						body: {
							startLineNumber: 4,
							endLineNumber: 5
						}
					}
				],
				lines: ['### Request', 'POST https://api.example.com', '', '{"test": true}']
			};

			const result = extractRequest(parsed, 1);

			expect(result?.body).toBe('{"test": true}');
		});

		it('should extract multi-line body', () => {
			const parsed: ParsedHttpFile = {
				preamble: { startLineNumber: 1, endLineNumber: 1 },
				sections: [
					{
						name: 'Request',
						startLineNumber: 1,
						endLineNumber: 8,
						verb: 'POST',
						verbLine: 2,
						url: 'https://api.example.com',
						isDivider: false,
						body: {
							startLineNumber: 4,
							endLineNumber: 8
						}
					}
				],
				lines: ['### Request', 'POST https://api.example.com', '', '{', '  "name": "John",', '  "email": "test@example.com"', '}', '']
			};

			const result = extractRequest(parsed, 1);

			expect(result?.body).toBe('{\n  "name": "John",\n  "email": "test@example.com"\n}');
		});

		it('should extract body after headers', () => {
			const parsed: ParsedHttpFile = {
				preamble: { startLineNumber: 1, endLineNumber: 1 },
				sections: [
					{
						name: 'Request',
						startLineNumber: 1,
						endLineNumber: 6,
						verb: 'POST',
						verbLine: 2,
						url: 'https://api.example.com',
						isDivider: false,
						headers: {
							startLineNumber: 3,
							endLineNumber: 4,
							headers: {
								'Content-Type': 'application/json'
							}
						},
						body: {
							startLineNumber: 5,
							endLineNumber: 6
						}
					}
				],
				lines: ['### Request', 'POST https://api.example.com', 'Content-Type: application/json', '', '{"data": "test"}']
			};

			const result = extractRequest(parsed, 1);

			expect(result?.body).toBe('{"data": "test"}');
		});

		it('should extract XML body', () => {
			const parsed: ParsedHttpFile = {
				preamble: { startLineNumber: 1, endLineNumber: 1 },
				sections: [
					{
						name: 'Request',
						startLineNumber: 1,
						endLineNumber: 7,
						verb: 'POST',
						verbLine: 2,
						url: 'https://api.example.com',
						isDivider: false,
						body: {
							startLineNumber: 4,
							endLineNumber: 7
						}
					}
				],
				lines: ['### Request', 'POST https://api.example.com', '', '<xml>', '    <foo>1</foo>', '</xml>']
			};

			const result = extractRequest(parsed, 1);

			expect(result?.body).toBe('<xml>\n    <foo>1</foo>\n</xml>');
		});

		it('should extract body only up to body section end', () => {
			const parsed: ParsedHttpFile = {
				preamble: { startLineNumber: 1, endLineNumber: 1 },
				sections: [
					{
						name: 'First',
						startLineNumber: 1,
						endLineNumber: 6,
						verb: 'POST',
						verbLine: 2,
						url: 'https://api.example.com',
						isDivider: false,
						body: {
							startLineNumber: 4,
							endLineNumber: 5
						}
					},
					{
						name: 'Second',
						startLineNumber: 6,
						endLineNumber: 8,
						verb: 'GET',
						verbLine: 7,
						url: 'https://api.example.com',
						isDivider: false
					}
				],
				lines: ['### First', 'POST https://api.example.com', '', '{"first": true}', '', '### Second', 'GET https://api.example.com']
			};

			const result = extractRequest(parsed, 1);

			expect(result?.body).toBe('{"first": true}');
		});
	});
});
