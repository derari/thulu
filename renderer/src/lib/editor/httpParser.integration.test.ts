import { describe, it, expect } from 'vitest';
import { parseHttpFile } from './httpParser';

describe('Post-Script Integration', () => {
	it('should parse and identify script type correctly', () => {
		const content = `### Test Request
GET https://api.example.com

> {% console.log("script type"); %}`;

		const result = parseHttpFile(content);

		expect(result.sections[0].postScripts).toHaveLength(1);
		expect(result.sections[0].postScripts[0].type).toBe('script');
	});

	it('should parse and identify file type correctly', () => {
		const content = `### Test Request
GET https://api.example.com

> console.log("file type");`;

		const result = parseHttpFile(content);

		expect(result.sections[0].postScripts).toHaveLength(1);
		expect(result.sections[0].postScripts[0].type).toBe('file');
	});

	it('should parse multi-line script correctly', () => {
		const content = `### Test Request
GET https://api.example.com

> {%
console.log("line 1");
console.log("line 2");
%}`;

		const result = parseHttpFile(content);

		expect(result.sections[0].postScripts).toHaveLength(1);
		expect(result.sections[0].postScripts[0].type).toBe('script');
		expect(result.sections[0].postScripts[0].startLineNumber).toBe(4);
		expect(result.sections[0].postScripts[0].endLineNumber).toBe(8);
	});

	it('should handle empty post-script array for requests without scripts', () => {
		const content = `### Test Request
GET https://api.example.com`;

		const result = parseHttpFile(content);

		expect(result.sections[0].postScripts).toEqual([]);
	});

	it('should parse multiple post-scripts with mixed types', () => {
		const content = `### Test Request
GET https://api.example.com

> {% console.log("script 1"); %}
> console.log("file");
> {% console.log("script 2"); %}`;

		const result = parseHttpFile(content);

		expect(result.sections[0].postScripts).toHaveLength(3);
		expect(result.sections[0].postScripts[0].type).toBe('script');
		expect(result.sections[0].postScripts[1].type).toBe('file');
		expect(result.sections[0].postScripts[2].type).toBe('script');
	});

	it('should handle post-script after body with no empty line', () => {
		const content = `### Test Request
POST https://api.example.com

{"data": "test"}
> {% console.log("done"); %}`;

		const result = parseHttpFile(content);

		expect(result.sections[0].body).toBeDefined();
		expect(result.sections[0].postScripts).toHaveLength(1);
		expect(result.sections[0].postScripts[0].type).toBe('script');
	});
});

