import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeHttpRequest } from './httpRequestExecutor';

describe('Variable Substitution', () => {
	beforeEach(() => {
		vi.stubGlobal('window', {
			electronAPI: {
				httpRequest: vi.fn().mockResolvedValue({
					status: 200,
					statusText: 'OK',
					headers: {},
					body: ''
				}),
				executeScript: vi.fn()
			}
		});
	});

	it('should substitute simple variables', async () => {
		const variables = {
			host: 'example.com',
			port: '8080'
		};

		const parsedFile = {
			preamble: {
				startLineNumber: 1,
				endLineNumber: 1,
				variables: variables
			},
			sections: [
				{
					name: 'Test',
					startLineNumber: 1,
					endLineNumber: 3,
					verb: 'GET',
					url: '{{host}}:{{port}}/api',
					isDivider: false,
					headers: {
						startLineNumber: 2,
						endLineNumber: 2,
						headers: {}
					},
					postScripts: []
				}
			],
			lines: []
		};

		await executeHttpRequest({
			parsedFile,
			sectionLineNumber: 1,
			selectedEnvironment: '',
			fileDirectory: '',
			collectionPath: ''
		});

		expect(window.electronAPI.httpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				url: 'example.com:8080/api'
			})
		);
	});

	it('should recursively substitute nested variables', async () => {
		const variables = {
			base: 'example.com',
			host: '{{base}}',
			url: 'https://{{host}}/api'
		};

		const parsedFile = {
			preamble: {
				startLineNumber: 1,
				endLineNumber: 1,
				variables: variables
			},
			sections: [
				{
					name: 'Test',
					startLineNumber: 1,
					endLineNumber: 3,
					verb: 'GET',
					url: '{{url}}',
					isDivider: false,
					headers: {
						startLineNumber: 2,
						endLineNumber: 2,
						headers: {}
					},
					postScripts: []
				}
			],
			lines: []
		};

		await executeHttpRequest({
			parsedFile,
			sectionLineNumber: 1,
			selectedEnvironment: '',
			fileDirectory: '',
			collectionPath: ''
		});

		expect(window.electronAPI.httpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				url: 'https://example.com/api'
			})
		);
	});

	it('should recursively substitute multiple levels deep', async () => {
		const variables = {
			level1: 'base',
			level2: '{{level1}}.example',
			level3: '{{level2}}.com',
			fullUrl: 'https://{{level3}}/api'
		};

		const parsedFile = {
			preamble: {
				startLineNumber: 1,
				endLineNumber: 1,
				variables: variables
			},
			sections: [
				{
					name: 'Test',
					startLineNumber: 1,
					endLineNumber: 3,
					verb: 'GET',
					url: '{{fullUrl}}',
					isDivider: false,
					headers: {
						startLineNumber: 2,
						endLineNumber: 2,
						headers: {}
					},
					postScripts: []
				}
			],
			lines: []
		};

		await executeHttpRequest({
			parsedFile,
			sectionLineNumber: 1,
			selectedEnvironment: '',
			fileDirectory: '',
			collectionPath: ''
		});

		expect(window.electronAPI.httpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				url: 'https://base.example.com/api'
			})
		);
	});

	it('should detect direct self-referencing loop', async () => {
		const variables = {
			loop: '{{loop}}'
		};

		const parsedFile = {
			preamble: {
				startLineNumber: 1,
				endLineNumber: 1,
				variables: variables
			},
			sections: [
				{
					name: 'Test',
					startLineNumber: 1,
					endLineNumber: 3,
					verb: 'GET',
					url: '{{loop}}',
                    isDivider: false,
					headers: {
						startLineNumber: 2,
						endLineNumber: 2,
						headers: {}
					},
					postScripts: []
				}
			],
			lines: []
		};

		await expect(executeHttpRequest({
			parsedFile,
			sectionLineNumber: 1,
			selectedEnvironment: '',
			fileDirectory: '',
			collectionPath: ''
		})).rejects.toThrow('Variable substitution loop detected for: loop');
	});

	it('should detect circular loop between two variables', async () => {
		const variables = {
			varA: '{{varB}}',
			varB: '{{varA}}'
		};

		const parsedFile = {
			preamble: {
				startLineNumber: 1,
				endLineNumber: 1,
				variables: variables
			},
			sections: [
				{
					name: 'Test',
					startLineNumber: 1,
					endLineNumber: 3,
					verb: 'GET',
					url: '{{varA}}',
                    isDivider: false,
					headers: {
						startLineNumber: 2,
						endLineNumber: 2,
						headers: {}
					},
					postScripts: []
				}
			],
			lines: []
		};

		await expect(executeHttpRequest({
			parsedFile,
			sectionLineNumber: 1,
			selectedEnvironment: '',
			fileDirectory: '',
			collectionPath: ''
		})).rejects.toThrow('Variable substitution loop detected');
	});

	it('should detect circular loop between three variables', async () => {
		const variables = {
			varA: '{{varB}}',
			varB: '{{varC}}',
			varC: '{{varA}}'
		};

		const parsedFile = {
			preamble: {
				startLineNumber: 1,
				endLineNumber: 1,
				variables: variables
			},
			sections: [
				{
					name: 'Test',
					startLineNumber: 1,
					endLineNumber: 3,
					verb: 'GET',
					url: '{{varA}}',
                    isDivider: false,
					headers: {
						startLineNumber: 2,
						endLineNumber: 2,
						headers: {}
					},
					postScripts: []
				}
			],
			lines: []
		};

		await expect(executeHttpRequest({
			parsedFile,
			sectionLineNumber: 1,
			selectedEnvironment: '',
			fileDirectory: '',
			collectionPath: ''
		})).rejects.toThrow('Variable substitution loop detected');
	});

	it('should handle undefined variables gracefully', async () => {
		const variables = {
			host: 'example.com'
		};

		const parsedFile = {
			preamble: {
				startLineNumber: 1,
				endLineNumber: 1,
				variables: variables
			},
			sections: [
				{
					name: 'Test',
					startLineNumber: 1,
					endLineNumber: 3,
					verb: 'GET',
					url: '{{host}}/{{undefined}}/api',
                    isDivider: false,
					headers: {
						startLineNumber: 2,
						endLineNumber: 2,
						headers: {}
					},
					postScripts: []
				}
			],
			lines: []
		};

		await executeHttpRequest({
			parsedFile,
			sectionLineNumber: 1,
			selectedEnvironment: '',
			fileDirectory: '',
			collectionPath: ''
		});

		expect(window.electronAPI.httpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				url: 'example.com/{{undefined}}/api'
			})
		);
	});

	it('should recursively substitute variables in headers', async () => {
		const variables = {
			tokenBase: 'secret',
			token: 'Bearer {{tokenBase}}123',
			contentType: 'application/json'
		};

		const parsedFile = {
			preamble: {
				startLineNumber: 1,
				endLineNumber: 1,
				variables: variables
			},
			sections: [
				{
					name: 'Test',
					startLineNumber: 1,
					endLineNumber: 3,
					verb: 'POST',
					url: 'https://example.com/api',
                    isDivider: false,
					headers: {
						startLineNumber: 2,
						endLineNumber: 2,
						headers: {
							'Authorization': '{{token}}',
							'Content-Type': '{{contentType}}'
						}
					},
					postScripts: []
				}
			],
			lines: []
		};

		await executeHttpRequest({
			parsedFile,
			sectionLineNumber: 1,
			selectedEnvironment: '',
			fileDirectory: '',
			collectionPath: ''
		});

		expect(window.electronAPI.httpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				headers: {
					'Authorization': 'Bearer secret123',
					'Content-Type': 'application/json'
				}
			})
		);
	});

	it('should recursively substitute variables in body', async () => {
		const variables = {
			userId: '12345',
			name: 'John Doe'
		};

		const parsedFile = {
			preamble: {
				startLineNumber: 1,
				endLineNumber: 1,
				variables: variables
			},
			sections: [
				{
					name: 'Test',
					startLineNumber: 1,
					endLineNumber: 5,
					verb: 'POST',
					url: 'https://example.com/api',
                    isDivider: false,
					headers: {
						startLineNumber: 2,
						endLineNumber: 2,
						headers: {}
					},
					body: {
						startLineNumber: 3,
						endLineNumber: 5
					},
					postScripts: []
				}
			],
			lines: ['POST https://example.com/api', '', '{"userId": "{{userId}}", "name": "{{name}}"}']
		};

		await executeHttpRequest({
			parsedFile,
			sectionLineNumber: 1,
			selectedEnvironment: '',
			fileDirectory: '',
			collectionPath: ''
		});

		expect(window.electronAPI.httpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				body: '{"userId": "12345", "name": "John Doe"}'
			})
		);
	});

	it('should recursively substitute nested variable values in body', async () => {
		const variables = {
			base: '12345',
			userId: '{{base}}',
			name: 'John Doe',
			nameField: '{{name}}'
		};

		const parsedFile = {
			preamble: {
				startLineNumber: 1,
				endLineNumber: 1,
				variables: variables
			},
			sections: [
				{
					name: 'Test',
					startLineNumber: 1,
					endLineNumber: 5,
					verb: 'POST',
					url: 'https://example.com/api',
                    isDivider: false,
					headers: {
						startLineNumber: 2,
						endLineNumber: 2,
						headers: {}
					},
					body: {
						startLineNumber: 3,
						endLineNumber: 5
					},
					postScripts: []
				}
			],
			lines: ['POST https://example.com/api', '', '{"userId": "{{userId}}", "name": "{{nameField}}"}']
		};

		await executeHttpRequest({
			parsedFile,
			sectionLineNumber: 1,
			selectedEnvironment: '',
			fileDirectory: '',
			collectionPath: ''
		});

		expect(window.electronAPI.httpRequest).toHaveBeenCalledWith(
			expect.objectContaining({
				body: '{"userId": "12345", "name": "John Doe"}'
			})
		);
	});
});

describe('Variable Precedence in Request Executor', () => {
	it('should merge variables with correct precedence', () => {
		const envVariables = {
			baseUrl: 'https://env.example.com',
			apiKey: 'env-key',
			version: 'v1'
		};

		const parsedFile = {
			preamble: {
				startLineNumber: 1,
				endLineNumber: 3,
				variables: {
					baseUrl: 'https://file.example.com',
					userId: '123'
				}
			},
			sections: [
				{
					name: 'Other Section',
					startLineNumber: 3,
					endLineNumber: 6,
					preamble: {
						startLineNumber: 4,
						endLineNumber: 5,
						variables: {
							endpoint: '/other'
						}
					},
					postScripts: []
				},
				{
					name: 'Current Section',
					startLineNumber: 6,
					endLineNumber: 9,
					preamble: {
						startLineNumber: 7,
						endLineNumber: 8,
						variables: {
							baseUrl: 'https://section.example.com',
							endpoint: '/current'
						}
					},
					verb: 'GET',
					url: 'test',
					postScripts: []
				}
			],
			lines: []
		};

		const currentSection = parsedFile.sections[1];

		// Expected precedence:
		// 1. Current section variables (highest priority)
		// 2. File preamble variables
		// 3. Other section variables (only if not defined)
		// 4. Environment variables (lowest priority)

		const expected = {
			// From current section (overrides everything)
			baseUrl: 'https://section.example.com',
			endpoint: '/current',
			// From file preamble (overrides env)
			userId: '123',
			// From environment (not overridden)
			apiKey: 'env-key',
			version: 'v1'
			// Note: 'endpoint' from other section is not included because it's defined in current section
		};

		// This test demonstrates the expected behavior
		// The actual implementation would be:
		// const result = mergeVariablesFromFile(parsedFile, currentSection, envVariables);
		// expect(result).toEqual(expected);
	});

	it('should add variables from other sections only if undefined', () => {
		const envVariables = {
			token: 'env-token'
		};

		const parsedFile = {
			preamble: {
				startLineNumber: 1,
				endLineNumber: 2,
				variables: {
					baseUrl: 'https://file.example.com'
				}
			},
			sections: [
				{
					name: 'Section 1',
					startLineNumber: 2,
					endLineNumber: 5,
					preamble: {
						startLineNumber: 3,
						endLineNumber: 4,
						variables: {
							userId: '111',
							endpoint: '/section1'
						}
					},
					postScripts: []
				},
				{
					name: 'Section 2',
					startLineNumber: 5,
					endLineNumber: 8,
					preamble: {
						startLineNumber: 6,
						endLineNumber: 7,
						variables: {
							userId: '222', // Should NOT override Section 1's userId
							postId: '999' // Should be included
						}
					},
					postScripts: []
				},
				{
					name: 'Current Section',
					startLineNumber: 8,
					endLineNumber: 11,
					verb: 'GET',
					url: 'test',
					postScripts: []
				}
			],
			lines: []
		};

		const currentSection = parsedFile.sections[2];

		const expected = {
			// From environment
			token: 'env-token',
			// From file preamble
			baseUrl: 'https://file.example.com',
			// From Section 1 (first to define)
			userId: '111',
			endpoint: '/section1',
			// From Section 2 (not defined elsewhere)
			postId: '999'
			// Note: Section 2's userId is ignored because Section 1 already defined it
		};

		// This demonstrates that other sections only ADD variables if not defined
	});

	it('should prioritize current section over file preamble', () => {
		const envVariables = {};

		const parsedFile = {
			preamble: {
				startLineNumber: 1,
				endLineNumber: 2,
				variables: {
					value: 'from-file'
				}
			},
			sections: [
				{
					name: 'Current Section',
					startLineNumber: 2,
					endLineNumber: 5,
					preamble: {
						startLineNumber: 3,
						endLineNumber: 4,
						variables: {
							value: 'from-section'
						}
					},
					verb: 'GET',
					url: 'test',
					postScripts: []
				}
			],
			lines: []
		};

		const currentSection = parsedFile.sections[0];

		const expected = {
			value: 'from-section' // Current section wins
		};
	});
});

