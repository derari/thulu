import {describe, expect, it} from 'vitest';
import {parseHttpFile, parseHttpResponse} from './httpParser';

describe('parseHttpFile', () => {
	describe('preamble parsing', () => {
		it('should parse preamble before first section', () => {
			const content = `# Comment line
// Another comment

### First Section
GET https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.preamble).toEqual({
				startLineNumber: 1,
				endLineNumber: 4,
                variables: {},
                options: {}
			});
		});

		it('should handle empty preamble when file starts with section', () => {
			const content = `### First Section
GET https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.preamble).toEqual({
				startLineNumber: 1,
				endLineNumber: 1,
                variables: {},
                options: {}
			});
		});

		it('should handle file with no sections', () => {
			const content = `# Just comments
// No sections here`;

			const result = parseHttpFile(content);

			expect(result.preamble.startLineNumber).toBe(1);
			expect(result.sections).toHaveLength(0);
		});

		it('should handle completely empty file', () => {
			const content = '';

			const result = parseHttpFile(content);

			expect(result.preamble).toEqual({
				startLineNumber: 1,
				endLineNumber: 2, // 1 line (from split of empty string) + 1
                variables: {},
                options: {}
			});
			expect(result.sections).toHaveLength(0);
			expect(result.lines).toEqual(['']);
		});

		it('should handle file with only empty lines', () => {
			const content = '\n\n\n';

			const result = parseHttpFile(content);

			expect(result.preamble).toEqual({
				startLineNumber: 1,
				endLineNumber: 5, // 4 lines (from split) + 1
                variables: {},
                options: {}
			});
			expect(result.sections).toHaveLength(0);
			expect(result.lines).toHaveLength(4); // 3 newlines create 4 lines
		});

		it('should handle file with only whitespace', () => {
			const content = '   \n\t\n  \t  \n';

			const result = parseHttpFile(content);

			expect(result.preamble).toEqual({
				startLineNumber: 1,
				endLineNumber: 5, // 4 lines (from split) + 1
                variables: {},
                options: {}
			});
			expect(result.sections).toHaveLength(0);
		});
	});

	describe('section parsing', () => {
		it('should parse section with name', () => {
			const content = `### Get Users
GET https://api.example.com/users`;

			const result = parseHttpFile(content);

			expect(result.sections).toHaveLength(1);
			expect(result.sections[0].name).toBe('Get Users');
			expect(result.sections[0].verb).toBe('GET');
			expect(result.sections[0].url).toBe('https://api.example.com/users');
			expect(result.sections[0].requestStartLineNumber).toBe(2);
		});

		it('should use URL as title when section has no name', () => {
			const content = `###
GET https://api.example.com/users`;

			const result = parseHttpFile(content);

			expect(result.sections[0].name).toBe('https://api.example.com/users');
		});

		it('should parse multiple sections', () => {
			const content = `### Get Users
GET https://api.example.com/users

### Create User
POST https://api.example.com/users

### Delete User
DELETE https://api.example.com/users/123`;

			const result = parseHttpFile(content);

			expect(result.sections).toHaveLength(3);
			expect(result.sections[0].name).toBe('Get Users');
			expect(result.sections[0].verb).toBe('GET');
			expect(result.sections[1].name).toBe('Create User');
			expect(result.sections[1].verb).toBe('POST');
			expect(result.sections[2].name).toBe('Delete User');
			expect(result.sections[2].verb).toBe('DELETE');
		});

		it('should parse all HTTP verbs', () => {
			const verbs = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'];
			const sections = verbs.map(verb => `### ${verb} Request\n${verb} https://example.com`).join('\n\n');

			const result = parseHttpFile(sections);

			expect(result.sections).toHaveLength(verbs.length);
			verbs.forEach((verb, idx) => {
				expect(result.sections[idx].verb).toBe(verb);
			});
		});
	});

	describe('multi-line request parsing', () => {
		it('should parse request with indented continuation lines', () => {
			const content = `### Get Users
GET https://api.example.com/users
  ?page=1
  &limit=10`;

			const result = parseHttpFile(content);

			expect(result.sections).toHaveLength(1);
			expect(result.sections[0].verb).toBe('GET');
			expect(result.sections[0].url).toBe('https://api.example.com/users?page=1&limit=10');
			expect(result.sections[0].requestStartLineNumber).toBe(2);
			expect(result.sections[0].requestEndLineNumber).toBe(5);
			expect(result.sections[0].headers).toBeUndefined();
		});

		it('should parse request with tab-indented continuation lines', () => {
			const content = `### Get Users
GET https://api.example.com/users
\t?page=1
\t&limit=10`;

			const result = parseHttpFile(content);

			expect(result.sections[0].url).toBe('https://api.example.com/users?page=1&limit=10');
			expect(result.sections[0].requestEndLineNumber).toBe(5);
			expect(result.sections[0].headers).toBeUndefined();
		});

		it('should stop at first non-indented line after request', () => {
			const content = `### Create User
POST https://api.example.com/users
  ?notify=true
Content-Type: application/json`;

			const result = parseHttpFile(content);

			expect(result.sections[0].url).toBe('https://api.example.com/users?notify=true');
			expect(result.sections[0].requestEndLineNumber).toBe(4);
			expect(result.sections[0].headers).toBeDefined();
			expect(result.sections[0].headers?.headers['Content-Type']).toBe('application/json');
			expect(result.sections[0].headers?.startLineNumber).toBe(4);
		});

		it('should stop at empty line after request and treat following content as body', () => {
			const content = `### Create User
POST https://api.example.com/users
  ?notify=true

{"name": "John"}`;

			const result = parseHttpFile(content);

			expect(result.sections[0].url).toBe('https://api.example.com/users?notify=true');
			expect(result.sections[0].requestEndLineNumber).toBe(4);
			expect(result.sections[0].headers).toBeUndefined();
			expect(result.sections[0].body).toBeDefined();
			expect(result.sections[0].body?.startLineNumber).toBe(5);
		});

		it('should handle single-line request without continuation', () => {
			const content = `### Get Users
GET https://api.example.com/users
Content-Type: application/json`;

			const result = parseHttpFile(content);

			expect(result.sections[0].url).toBe('https://api.example.com/users');
			expect(result.sections[0].requestStartLineNumber).toBe(2);
			expect(result.sections[0].requestEndLineNumber).toBe(3);
			expect(result.sections[0].headers).toBeDefined();
			expect(result.sections[0].headers?.headers['Content-Type']).toBe('application/json');
		});

		it('should handle request with only indented lines until next section', () => {
			const content = `### Get Users
GET https://api.example.com/users
  ?page=1
  &limit=10
### Create User
POST https://api.example.com/users`;

			const result = parseHttpFile(content);

			expect(result.sections).toHaveLength(2);
			expect(result.sections[0].url).toBe('https://api.example.com/users?page=1&limit=10');
			expect(result.sections[0].requestEndLineNumber).toBe(5);
			expect(result.sections[0].headers).toBeUndefined();
		});

		it('should handle mixed indentation levels', () => {
			const content = `### Get Users
GET https://api.example.com/users
  ?page=1
    &limit=10
  &sort=name`;

			const result = parseHttpFile(content);

			expect(result.sections[0].url).toBe('https://api.example.com/users?page=1&limit=10&sort=name');
			expect(result.sections[0].requestEndLineNumber).toBe(6);
			expect(result.sections[0].headers).toBeUndefined();
		});

		it('should parse headers after multi-line request', () => {
			const content = `### Create User
POST https://api.example.com/users
  ?notify=true
  &sendEmail=false
Content-Type: application/json
Authorization: Bearer token123

{"name": "John"}`;

			const result = parseHttpFile(content);

			expect(result.sections[0].url).toBe('https://api.example.com/users?notify=true&sendEmail=false');
			expect(result.sections[0].requestEndLineNumber).toBe(5);
			expect(result.sections[0].headers).toBeDefined();
			expect(result.sections[0].headers?.headers['Content-Type']).toBe('application/json');
			expect(result.sections[0].headers?.headers['Authorization']).toBe('Bearer token123');
			expect(result.sections[0].headers?.startLineNumber).toBe(5);
			expect(result.sections[0].body).toBeDefined();
		});

		it('should skip indented comments in multi-line request', () => {
			const content = `### Get Users
GET https://api.example.com/users
  # This is a comment
  ?page=1
  // Another comment
  &limit=10`;

			const result = parseHttpFile(content);

			expect(result.sections[0].url).toBe('https://api.example.com/users?page=1&limit=10');
			expect(result.sections[0].requestEndLineNumber).toBe(7);
		});

		it('should include non-indented comments in multi-line request', () => {
			const content = `### Get Users
GET https://api.example.com/users
  ?page=1
# This comment is not indented but still part of request
  &limit=10`;

			const result = parseHttpFile(content);

			expect(result.sections[0].url).toBe('https://api.example.com/users?page=1&limit=10');
			expect(result.sections[0].requestEndLineNumber).toBe(6);
		});

		it('should include mixed indented and non-indented comments in request', () => {
			const content = `### Get Users
GET https://api.example.com/users
  ?page=1
  # Indented comment
# Non-indented comment
  &limit=10
  // Another indented comment
  &sort=name`;

			const result = parseHttpFile(content);

			expect(result.sections[0].url).toBe('https://api.example.com/users?page=1&limit=10&sort=name');
			expect(result.sections[0].requestEndLineNumber).toBe(9);
		});
	});

	describe('section preamble parsing', () => {
		it('should parse section preamble between marker and request line', () => {
			const content = `### Get Users
# This is a comment
// Another comment
GET https://api.example.com/users`;

			const result = parseHttpFile(content);

			expect(result.sections).toHaveLength(1);
			expect(result.sections[0]).toBeDefined();
			expect(result.sections[0].preamble).toEqual({
				startLineNumber: 2,
				endLineNumber: 4,
                variables: {},
                options: {}
			});
		});

		it('should not create preamble when request immediately follows marker', () => {
			const content = `### Get Users
GET https://api.example.com/users`;

			const result = parseHttpFile(content);

			expect(result.sections[0].preamble).toBeUndefined();
		});
	});

	describe('header parsing', () => {
		it('should parse request headers', () => {
			const content = `### Create User
POST https://api.example.com/users
Content-Type: application/json
Authorization: Bearer token123`;

			const result = parseHttpFile(content);

			expect(result.sections[0].headers).toEqual({
				startLineNumber: 3,
				endLineNumber: 5,
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer token123'
				}
			});
		});

		it('should handle headers with extra whitespace', () => {
			const content = `### Request
POST https://api.example.com
Content-Type  :   application/json  `;

			const result = parseHttpFile(content);

			expect(result.sections[0].headers?.headers['Content-Type']).toBe('application/json');
		});

		it('should skip comment lines in header section', () => {
			const content = `### Request
POST https://api.example.com
Content-Type: application/json
# This is a comment
Authorization: Bearer token`;

			const result = parseHttpFile(content);

			expect(result.sections[0].headers?.headers).toEqual({
				'Content-Type': 'application/json',
				'Authorization': 'Bearer token'
			});
		});

		it('should include commented headers in header section boundaries', () => {
			const content = `###
POST https://api.example.com
Accept: */*
#  foo: bar

{}`;

			const result = parseHttpFile(content);

			expect(result.sections[0].headers).toBeDefined();
			expect(result.sections[0].headers?.startLineNumber).toBe(3);
			expect(result.sections[0].headers?.endLineNumber).toBe(5);
			expect(result.sections[0].headers?.headers).toEqual({
				'Accept': '*/*'
			});
		});

		it('should handle multiple comment lines and commented URL parts in headers', () => {
			const content = `###
POST https://api.example.com
    # /foo
# Accept: */*
# foo: bar

{}`;

			const result = parseHttpFile(content);

			expect(result.sections[0].requestEndLineNumber).toBe(6);
			expect(result.sections[0].headers).toBeUndefined();
			expect(result.sections[0].body).toBeDefined();
			expect(result.sections[0].body?.startLineNumber).toBe(7);
		});

		it('should handle multiple comment lines and commented URL parts in headers with comment before body', () => {
			const content = `###
POST https://api.example.com
    # /foo
# Accept: */*
# foo: bar

# bar: baz 
{}`;

			const result = parseHttpFile(content);

			expect(result.sections[0].requestEndLineNumber).toBe(6);
			expect(result.sections[0].headers).toBeUndefined();
			expect(result.sections[0].body).toBeDefined();
			expect(result.sections[0].body?.startLineNumber).toBe(8);
		});
	});

	describe('body parsing', () => {
		it('should parse request body after headers', () => {
			const content = `### Create User
POST https://api.example.com/users
Content-Type: application/json

{
  "name": "John",
  "email": "john@example.com"
}`;

			const result = parseHttpFile(content);

			expect(result.sections[0].body).toEqual({
				startLineNumber: 5,
				endLineNumber: 9
			});
		});

		it('should parse body without headers', () => {
			const content = `### Create User
POST https://api.example.com/users

{"name": "John"}`;

			const result = parseHttpFile(content);

			expect(result.sections[0].body).toEqual({
				startLineNumber: 4,
				endLineNumber: 5
			});
		});

		it('should trim trailing empty lines from body', () => {
			const content = `### Request
POST https://api.example.com

{"data": "test"}


`;

			const result = parseHttpFile(content);

			expect(result.sections[0].body?.endLineNumber).toBe(5);
		});

		it('should skip comment lines when finding body', () => {
			const content = `### Request
POST https://api.example.com

# Comment before body
{"data": "test"}`;

			const result = parseHttpFile(content);

			expect(result.sections[0].body).toEqual({
				startLineNumber: 5,
				endLineNumber: 6
			});
		});
	});

	describe('post-script parsing', () => {
		it('should parse simple post-script line after body', () => {
			const content = `### Request
POST https://api.example.com

{"data": "test"}
> console.log('done');`;

			const result = parseHttpFile(content);

			expect(result.sections[0].postScripts).toHaveLength(1);
			expect(result.sections[0].postScripts[0]).toEqual({
				startLineNumber: 5,
				endLineNumber: 6,
				type: 'file'
			});
		});

		it('should parse post-script with curly percent syntax on same line', () => {
			const content = `### Request
POST https://api.example.com

{"data": "test"}
> {% console.log('done'); %}`;

			const result = parseHttpFile(content);

			expect(result.sections[0].postScripts).toHaveLength(1);
			expect(result.sections[0].postScripts[0]).toEqual({
				startLineNumber: 5,
				endLineNumber: 6,
				type: 'script'
			});
		});

		it('should parse post-script with curly percent syntax spanning multiple lines', () => {
			const content = `### Request
POST https://api.example.com

{"data": "test"}
> {%
console.log('line 1');
console.log('line 2');
%}`;

			const result = parseHttpFile(content);

			expect(result.sections[0].postScripts).toHaveLength(1);
			expect(result.sections[0].postScripts[0]).toEqual({
				startLineNumber: 5,
				endLineNumber: 9,
				type: 'script'
			});
		});

		it('should parse post-script without whitespace after curly percent', () => {
			const content = `### Request
POST https://api.example.com

{"data": "test"}
> {%console.log('done');%}`;

			const result = parseHttpFile(content);

			expect(result.sections[0].postScripts).toHaveLength(1);
			expect(result.sections[0].postScripts[0]).toEqual({
				startLineNumber: 5,
				endLineNumber: 6,
				type: 'script'
			});
		});

		it('should parse post-script with whitespace before curly percent', () => {
			const content = `### Request
POST https://api.example.com

{"data": "test"}
>   {% console.log('done'); %}`;

			const result = parseHttpFile(content);

			expect(result.sections[0].postScripts).toHaveLength(1);
			expect(result.sections[0].postScripts[0]).toEqual({
				startLineNumber: 5,
				endLineNumber: 6,
				type: 'script'
			});
		});

		it('should parse post-script immediately after body without empty line', () => {
			const content = `### Request
POST https://api.example.com

{"data": "test"}
> console.log('done');`;

			const result = parseHttpFile(content);

			expect(result.sections[0].body).toEqual({
				startLineNumber: 4,
				endLineNumber: 5
			});
			expect(result.sections[0].postScripts).toHaveLength(1);
			expect(result.sections[0].postScripts[0]).toEqual({
				startLineNumber: 5,
				endLineNumber: 6,
				type: 'file'
			});
		});

		it('should parse post-script after headers when no body exists', () => {
			const content = `### Request
POST https://api.example.com
Content-Type: application/json

> console.log('done');`;

			const result = parseHttpFile(content);

			expect(result.sections[0].body).toBeUndefined();
			expect(result.sections[0].postScripts).toHaveLength(1);
			expect(result.sections[0].postScripts[0]).toEqual({
				startLineNumber: 5,
				endLineNumber: 6,
				type: 'file'
			});
		});

		it('should require empty line to terminate headers when no body before post-script', () => {
			const content = `### Request
POST https://api.example.com
Content-Type: application/json
> console.log('done');`;

			const result = parseHttpFile(content);

			expect(result.sections[0].postScripts).toHaveLength(0);
		});

		it('should parse multiple post-scripts', () => {
			const content = `### Request
POST https://api.example.com

{"data": "test"}
> console.log('first');
> console.log('second');`;

			const result = parseHttpFile(content);

			expect(result.sections[0].postScripts).toHaveLength(2);
			expect(result.sections[0].postScripts[0]).toEqual({
				startLineNumber: 5,
				endLineNumber: 6,
				type: 'file'
			});
			expect(result.sections[0].postScripts[1]).toEqual({
				startLineNumber: 6,
				endLineNumber: 7,
				type: 'file'
			});
		});

		it('should parse multiple post-scripts with curly percent syntax', () => {
			const content = `### Request
POST https://api.example.com

{"data": "test"}
> {% console.log('first'); %}
> {%
console.log('second');
%}`;

			const result = parseHttpFile(content);

			expect(result.sections[0].postScripts).toHaveLength(2);
			expect(result.sections[0].postScripts[0]).toEqual({
				startLineNumber: 5,
				endLineNumber: 6,
				type: 'script'
			});
			expect(result.sections[0].postScripts[1]).toEqual({
				startLineNumber: 6,
				endLineNumber: 9,
				type: 'script'
			});
		});

		it('should parse post-script with complex multi-line content', () => {
			const content = `### Request
POST https://api.example.com

{"data": "test"}
> {%
const response = pm.response.json();
if (response.token) {
    pm.environment.set('token', response.token);
}
%}`;

			const result = parseHttpFile(content);

			expect(result.sections[0].body).toEqual({
				startLineNumber: 4,
				endLineNumber: 5
			});
			expect(result.sections[0].postScripts).toHaveLength(1);
			expect(result.sections[0].postScripts[0]).toEqual({
				startLineNumber: 5,
				endLineNumber: 11,
				type: 'script'
			});
		});

		it('should stop post-script at next section marker', () => {
			const content = `### Request 1
POST https://api.example.com

{"data": "test"}
> console.log('done');

### Request 2
GET https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.sections[0].body).toEqual({
				startLineNumber: 4,
				endLineNumber: 5
			});
			expect(result.sections[0].postScripts).toHaveLength(1);
			expect(result.sections[0].postScripts[0]).toEqual({
				startLineNumber: 5,
				endLineNumber: 6,
				type: 'file'
			});
			expect(result.sections).toHaveLength(2);
		});

		it('should handle post-script with only greater-than on the line', () => {
			const content = `### Request
POST https://api.example.com

{"data": "test"}
>`;

			const result = parseHttpFile(content);

			expect(result.sections[0].postScripts).toHaveLength(1);
			expect(result.sections[0].postScripts[0]).toEqual({
				startLineNumber: 5,
				endLineNumber: 6,
				type: 'file'
			});
		});

		it('should parse post-script after request with no body', () => {
			const content = `### Request
GET https://api.example.com

> console.log('done');`;

			const result = parseHttpFile(content);

			expect(result.sections[0].body).toBeUndefined();
			expect(result.sections[0].postScripts).toHaveLength(1);
			expect(result.sections[0].postScripts[0]).toEqual({
				startLineNumber: 4,
				endLineNumber: 5,
				type: 'file'
			});
		});

		it('should handle unclosed curly percent syntax', () => {
			const content = `### Request
POST https://api.example.com

{"data": "test"}
> {%
console.log('unclosed');
### Next Section
GET https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.sections[0].postScripts).toHaveLength(1);
			expect(result.sections[0].postScripts[0]).toEqual({
				startLineNumber: 5,
				endLineNumber: 6,
				type: 'script'
			});
		});
	});

	describe('divider sections', () => {
		it('should mark sections without verb as dividers', () => {
			const content = `### Divider Section

### Real Request
GET https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.sections).toHaveLength(1);
			expect(result.sections[0].isDivider).toBe(false);
		});

		it('should skip first divider section', () => {
			const content = `### First Divider

### Real Request
GET https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.sections).toHaveLength(1);
			expect(result.sections[0].name).toBe('Real Request');
		});

		it('should skip last divider section', () => {
			const content = `### Real Request
GET https://api.example.com

### Last Divider`;

			const result = parseHttpFile(content);

			expect(result.sections).toHaveLength(1);
			expect(result.sections[0].name).toBe('Real Request');
		});
	});

	describe('preamble variables', () => {
		it('should parse variables from file preamble', () => {
			const content = `@baseUrl = https://api.example.com
@token = abc123

### Request
GET {{baseUrl}}/data`;

			const result = parseHttpFile(content);

			expect(result.preamble.variables).toEqual({
				baseUrl: 'https://api.example.com',
				token: 'abc123'
			});
		});

		it('should trim variable names and values', () => {
			const content = `@  name  =  value with spaces  

### Request
GET https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.preamble.variables).toEqual({
				name: 'value with spaces'
			});
		});

		it('should handle empty value', () => {
			const content = `@emptyVar = 

### Request
GET https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.preamble.variables).toEqual({
				emptyVar: ''
			});
		});

		it('should handle variable without equals sign as empty string', () => {
			const content = `@variableWithoutValue

### Request
GET https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.preamble.variables).toEqual({
				variableWithoutValue: ''
			});
		});

		it('should handle variable with whitespace separator instead of equals', () => {
			const content = `@varName some value here

### Request
GET https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.preamble.variables).toEqual({
				varName: 'some value here'
			});
		});

		it('should handle multiple variables without equals sign', () => {
			const content = `@var1
@var2 value2
@var3

### Request
GET https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.preamble.variables).toEqual({
				var1: '',
				var2: 'value2',
				var3: ''
			});
		});

		it('should handle mixed variables with and without equals sign', () => {
			const content = `@varWithEquals = some value
@varWithWhitespace another value
@varWithoutValue

### Request
GET https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.preamble.variables).toEqual({
				varWithEquals: 'some value',
				varWithWhitespace: 'another value',
				varWithoutValue: ''
			});
		});

		it('should trim whitespace-separated values', () => {
			const content = `@varName    value with spaces   

### Request
GET https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.preamble.variables).toEqual({
				varName: 'value with spaces'
			});
		});

		it('should handle multiple variables', () => {
			const content = `@var1 = value1
@var2 = value2
@var3 = value3

### Request
GET https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.preamble.variables).toEqual({
				var1: 'value1',
				var2: 'value2',
				var3: 'value3'
			});
		});

		it('should parse variables from section preamble', () => {
			const content = `### Request
@sectionVar = section value
GET https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.sections[0].preamble?.variables).toEqual({
				sectionVar: 'section value'
			});
		});

		it('should handle both file and section variables', () => {
			const content = `@fileVar = file value

### Request
@sectionVar = section value
GET https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.preamble.variables).toEqual({
				fileVar: 'file value'
			});
			expect(result.sections[0].preamble?.variables).toEqual({
				sectionVar: 'section value'
			});
		});

		it('should not include variables property when no variables found', () => {
			const content = `### Request
GET https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.preamble.variables).toStrictEqual({});
			expect(result.sections[0].preamble).toBeUndefined();
		});

		it('should handle variables with special characters in value', () => {
			const content = `@url = https://api.example.com/path?query=value&other=123
@json = {"key": "value"}

### Request
GET {{url}}`;

			const result = parseHttpFile(content);

			expect(result.preamble.variables).toEqual({
				url: 'https://api.example.com/path?query=value&other=123',
				json: '{"key": "value"}'
			});
		});

		it('should handle variables with equals in value', () => {
			const content = `@equation = x = y + z

### Request
GET https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.preamble.variables).toEqual({
				equation: 'x = y + z'
			});
		});
	});

	describe('line tracking', () => {
		it('should track section boundaries correctly', () => {
			const content = `### Section 1
GET https://api.example.com

### Section 2
POST https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.sections[0].startLineNumber).toBe(1);
			expect(result.sections[0].endLineNumber).toBe(4);
			expect(result.sections[1].startLineNumber).toBe(4);
			expect(result.sections[1].endLineNumber).toBe(6);
		});

		it('should store all lines', () => {
			const content = `### Test
GET https://api.example.com`;

			const result = parseHttpFile(content);

			expect(result.lines).toHaveLength(2);
			expect(result.lines[0]).toBe('### Test');
			expect(result.lines[1]).toBe('GET https://api.example.com');
		});
	});
});

describe('parseHttpResponse', () => {
	describe('status line parsing', () => {
		it('should parse HTTP status line', () => {
			const content = `HTTP/1.1 200 OK
Content-Type: application/json

{"success": true}`;

			const result = parseHttpResponse(content);

			expect(result).not.toBeNull();
			expect(result?.codeLine).toBe('HTTP/1.1 200 OK');
			expect(result?.code).toBe(200);
		});

		it('should parse different HTTP versions', () => {
			const content = `HTTP/2.0 404 Not Found`;

			const result = parseHttpResponse(content);

			expect(result?.code).toBe(404);
		});

		it('should return null for invalid status line', () => {
			const content = `Not a valid HTTP response`;

			const result = parseHttpResponse(content);

			expect(result).toBeNull();
		});

		it('should return null for empty content', () => {
			const content = ``;

			const result = parseHttpResponse(content);

			expect(result).toBeNull();
		});
	});

	describe('response header parsing', () => {
		it('should parse response headers', () => {
			const content = `HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 42
Cache-Control: no-cache

{"success": true}`;

			const result = parseHttpResponse(content);

			expect(result?.headers).toEqual({
				startLineNumber: 2,
				endLineNumber: 5,
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': '42',
					'Cache-Control': 'no-cache'
				}
			});
		});

		it('should handle headers with extra whitespace', () => {
			const content = `HTTP/1.1 200 OK
  Content-Type  :   application/json  

body`;

			const result = parseHttpResponse(content);

			expect(result?.headers?.headers['Content-Type']).toBe('application/json');
		});

		it('should handle response with no headers', () => {
			const content = `HTTP/1.1 204 No Content

`;

			const result = parseHttpResponse(content);

			expect(result?.headers).toBeUndefined();
		});
	});

	describe('response body parsing', () => {
		it('should parse response body after empty line', () => {
			const content = `HTTP/1.1 200 OK
Content-Type: application/json

{"success": true}`;

			const result = parseHttpResponse(content);

			expect(result?.body).toEqual({
				startLineNumber: 4,
				endLineNumber: 5
			});
		});

		it('should parse multi-line body', () => {
			const content = `HTTP/1.1 200 OK

{
  "name": "John",
  "email": "john@example.com"
}`;

			const result = parseHttpResponse(content);

			expect(result?.body).toEqual({
				startLineNumber: 3,
				endLineNumber: 7
			});
		});

		it('should trim trailing empty lines from body', () => {
			const content = `HTTP/1.1 200 OK

{"data": "test"}


`;

			const result = parseHttpResponse(content);

			expect(result?.body?.endLineNumber).toBe(4);
		});

		it('should handle response with no body', () => {
			const content = `HTTP/1.1 204 No Content
Content-Length: 0`;

			const result = parseHttpResponse(content);

			expect(result?.body).toBeUndefined();
		});

		it('should not create body without empty line separator', () => {
			const content = `HTTP/1.1 200 OK
Content-Type: text/plain`;

			const result = parseHttpResponse(content);

			expect(result?.body).toBeUndefined();
		});
	});

	describe('line storage', () => {
		it('should store all lines', () => {
			const content = `HTTP/1.1 200 OK
Content-Type: application/json

{"success": true}`;

			const result = parseHttpResponse(content);

			expect(result?.lines).toHaveLength(4);
			expect(result?.lines[0]).toBe('HTTP/1.1 200 OK');
			expect(result?.lines[3]).toBe('{"success": true}');
		});
	});

	describe('various status codes', () => {
		it('should parse success codes', () => {
			const codes = [200, 201, 204];

			codes.forEach(code => {
				const content = `HTTP/1.1 ${code} Message`;
				const result = parseHttpResponse(content);
				expect(result?.code).toBe(code);
			});
		});

		it('should parse client error codes', () => {
			const codes = [400, 401, 403, 404];

			codes.forEach(code => {
				const content = `HTTP/1.1 ${code} Message`;
				const result = parseHttpResponse(content);
				expect(result?.code).toBe(code);
			});
		});

		it('should parse server error codes', () => {
			const codes = [500, 502, 503];

			codes.forEach(code => {
				const content = `HTTP/1.1 ${code} Message`;
				const result = parseHttpResponse(content);
				expect(result?.code).toBe(code);
			});
		});
	});
});

