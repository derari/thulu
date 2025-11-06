import { describe, it, expect } from 'vitest';
import { executeScript } from './scriptExecutor';

describe('Script Executor', () => {
	it('should execute simple console.log', () => {
		const result = executeScript({
			code: 'console.log("Hello, World!");',
			timeout: 1000
		});

		expect(result.success).toBe(true);
		expect(result.logs).toEqual(['Hello, World!']);
		expect(result.error).toBeUndefined();
	});

	it('should execute multiple console.logs', () => {
		const result = executeScript({
			code: `
				console.log("First");
				console.log("Second");
				console.log("Third");
			`,
			timeout: 1000
		});

		expect(result.success).toBe(true);
		expect(result.logs).toEqual(['First', 'Second', 'Third']);
	});

	it('should handle arithmetic operations', () => {
		const result = executeScript({
			code: `
				const a = 10;
				const b = 20;
				const sum = a + b;
				console.log(sum);
			`,
			timeout: 1000
		});

		expect(result.success).toBe(true);
		expect(result.logs).toEqual(['30']);
	});

	it('should handle syntax errors', () => {
		const result = executeScript({
			code: 'const x = ;',
			timeout: 1000
		});

		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
		expect(result.logs).toEqual([]);
	});

	it('should handle runtime errors', () => {
		const result = executeScript({
			code: 'throw new Error("Runtime error");',
			timeout: 1000
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain('Runtime error');
	});

	it('should timeout on infinite loops', () => {
		const result = executeScript({
			code: 'while(true) {}',
			timeout: 100
		});

		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it('should not have access to require', () => {
		const result = executeScript({
			code: 'const fs = require("fs");',
			timeout: 1000
		});

		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it('should not have access to process', () => {
		const result = executeScript({
			code: 'console.log(process.cwd());',
			timeout: 1000
		});

		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it('should not have access to global Node.js objects', () => {
		const result = executeScript({
			code: 'console.log(__dirname);',
			timeout: 1000
		});

		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it('should handle empty code', () => {
		const result = executeScript({
			code: '',
			timeout: 1000
		});

		expect(result.success).toBe(true);
		expect(result.logs).toEqual([]);
	});

	it('should handle console.log with multiple arguments', () => {
		const result = executeScript({
			code: 'console.log("Number:", 42, "Boolean:", true);',
			timeout: 1000
		});

		expect(result.success).toBe(true);
		expect(result.logs).toEqual(['Number: 42 Boolean: true']);
	});

	describe('client.global.set', () => {
		it('should set global variables', () => {
			const result = executeScript({
				code: 'client.global.set("token", "abc123");',
				timeout: 1000,
				collectionPath: '/test/collection'
			});

			expect(result.success).toBe(true);
			expect(result.globalVariableChanges).toEqual({ token: 'abc123' });
		});

		it('should set multiple global variables', () => {
			const result = executeScript({
				code: `
					client.global.set("token", "abc123");
					client.global.set("userId", "456");
					client.global.set("endpoint", "/api/v2");
				`,
				timeout: 1000,
				collectionPath: '/test/collection'
			});

			expect(result.success).toBe(true);
			expect(result.globalVariableChanges).toEqual({
				token: 'abc123',
				userId: '456',
				endpoint: '/api/v2'
			});
		});

		it('should handle setting empty string value', () => {
			const result = executeScript({
				code: 'client.global.set("token", "");',
				timeout: 1000,
				collectionPath: '/test/collection'
			});

			expect(result.success).toBe(true);
			expect(result.globalVariableChanges).toEqual({ token: '' });
		});

		it('should not set global variable without collection path', () => {
			const result = executeScript({
				code: 'client.global.set("token", "abc123");',
				timeout: 1000
			});

			expect(result.success).toBe(true);
			expect(result.globalVariableChanges).toBeUndefined();
			expect(result.logs).toContain('Warning: Cannot set global variable - no collection path provided');
		});

		it('should override global variable value', () => {
			const result = executeScript({
				code: `
					client.global.set("key", "value1");
					client.global.set("key", "value2");
				`,
				timeout: 1000,
				collectionPath: '/test/collection'
			});

			expect(result.success).toBe(true);
			expect(result.globalVariableChanges).toEqual({ key: 'value2' });
		});

		it('should work with console.log', () => {
			const result = executeScript({
				code: `
					console.log("Setting token");
					client.global.set("token", "abc123");
					console.log("Token set");
				`,
				timeout: 1000,
				collectionPath: '/test/collection'
			});

			expect(result.success).toBe(true);
			expect(result.logs).toEqual(['Setting token', 'Token set']);
			expect(result.globalVariableChanges).toEqual({ token: 'abc123' });
		});
	});

	describe('response.body', () => {
		it('should provide response body as string for plain text', () => {
			const result = executeScript({
				code: `
					console.log(typeof response.body);
					console.log(response.body);
				`,
				timeout: 1000,
				responseBody: 'Hello, World!',
				responseContentType: 'text/plain'
			});

			expect(result.success).toBe(true);
			expect(result.logs).toEqual(['string', 'Hello, World!']);
		});

		it('should parse JSON response body when content type is application/json', () => {
			const result = executeScript({
				code: `
					console.log(typeof response.body);
					console.log(response.body.name);
					console.log(response.body.age);
				`,
				timeout: 1000,
				responseBody: '{"name":"John","age":30}',
				responseContentType: 'application/json'
			});

			expect(result.success).toBe(true);
			expect(result.logs).toEqual(['object', 'John', '30']);
		});

		it('should parse JSON with charset in content type', () => {
			const result = executeScript({
				code: `
					console.log(response.body.status);
				`,
				timeout: 1000,
				responseBody: '{"status":"success"}',
				responseContentType: 'application/json; charset=utf-8'
			});

			expect(result.success).toBe(true);
			expect(result.logs).toEqual(['success']);
		});

		it('should parse JSON for +json content types', () => {
			const result = executeScript({
				code: `
					console.log(response.body.data);
				`,
				timeout: 1000,
				responseBody: '{"data":"test"}',
				responseContentType: 'application/vnd.api+json'
			});

			expect(result.success).toBe(true);
			expect(result.logs).toEqual(['test']);
		});

		it('should handle JSON arrays', () => {
			const result = executeScript({
				code: `
					console.log(Array.isArray(response.body));
					console.log(response.body.length);
					console.log(response.body[0]);
				`,
				timeout: 1000,
				responseBody: '[1,2,3]',
				responseContentType: 'application/json'
			});

			expect(result.success).toBe(true);
			expect(result.logs).toEqual(['true', '3', '1']);
		});

		it('should fallback to string if JSON parsing fails', () => {
			const result = executeScript({
				code: `
					console.log(typeof response.body);
					console.log(response.body);
				`,
				timeout: 1000,
				responseBody: 'not valid json{',
				responseContentType: 'application/json'
			});

			expect(result.success).toBe(true);
			expect(result.logs).toEqual(['string', 'not valid json{']);
		});

		it('should allow extracting values and setting as global variables', () => {
			const result = executeScript({
				code: `
					const token = response.body.token;
					const userId = response.body.user.id;
					client.global.set("authToken", token);
					client.global.set("userId", userId);
					console.log("Stored:", token, userId);
				`,
				timeout: 1000,
				responseBody: '{"token":"jwt-abc","user":{"id":"123","name":"John"}}',
				responseContentType: 'application/json',
				collectionPath: '/test/collection'
			});

			expect(result.success).toBe(true);
			expect(result.logs).toEqual(['Stored: jwt-abc 123']);
			expect(result.globalVariableChanges).toEqual({
				authToken: 'jwt-abc',
				userId: '123'
			});
		});

		it('should handle undefined response body', () => {
			const result = executeScript({
				code: `
					console.log(response.body);
				`,
				timeout: 1000
			});

			expect(result.success).toBe(true);
			expect(result.logs).toEqual(['undefined']);
		});

		it('should handle empty response body', () => {
			const result = executeScript({
				code: `
					console.log(response.body);
					console.log(typeof response.body);
				`,
				timeout: 1000,
				responseBody: '',
				responseContentType: 'text/plain'
			});

			expect(result.success).toBe(true);
			expect(result.logs).toEqual(['', 'string']);
		});
	});
});

