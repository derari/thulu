import type { ParsedHttpFile, HttpSection } from './httpParser';
import type { PostScript } from '../collection';
import { getEnvironmentVariablesMap } from '../environmentParser';

export interface RequestExecutionParams {
	parsedFile: ParsedHttpFile;
	sectionLineNumber: number;
	selectedEnvironment: string;
	fileDirectory: string;
	collectionPath: string;
	globalVariables?: Record<string, string>;
}

export interface HttpRequestResponse {
	statusLine: string;
	headers: Record<string, string>;
	body: string;
	timeMs: number;
	scriptResults?: ScriptExecutionResult[];
}

export interface ScriptExecutionResult {
	success: boolean;
	error?: string;
	logs: string[];
	globalVariableChanges?: Record<string, string>;
}

function extractScriptCode(lines: string[], postScript: PostScript): string {
	const scriptLines = lines.slice(postScript.startLineNumber - 1, postScript.endLineNumber - 1);

	if (postScript.type === 'script') {
		const joined = scriptLines.join('\n');
		const match = joined.match(/>\s*{%\s*([\s\S]*?)\s*%}/);
		if (match) {
			return match[1].trim();
		}
		const startMatch = joined.match(/>\s*{%\s*([\s\S]*)/);
		if (startMatch) {
			return startMatch[1].trim();
		}
		return '';
	}

	if (scriptLines.length === 0) {
		return '';
	}

	const firstLine = scriptLines[0];
	return firstLine.substring(firstLine.indexOf('>') + 1).trim();
}

async function executePostScripts(
	lines: string[],
	postScripts: PostScript[],
	collectionPath: string,
	responseBody: string,
	responseHeaders: Record<string, string>
): Promise<ScriptExecutionResult[]> {
	const results: ScriptExecutionResult[] = [];
	const contentType = responseHeaders['content-type'] || '';

	for (const postScript of postScripts) {
		const code = extractScriptCode(lines, postScript);

		if (!code) {
			results.push({
				success: true,
				logs: []
			});
			continue;
		}

		try {
			const result = await window.electronAPI.executeScript({
				code,
				timeout: 5000,
				collectionPath,
				responseBody,
				responseContentType: contentType
			});

			results.push(result);
		} catch (error) {
			results.push({
				success: false,
				error: error instanceof Error ? error.message : String(error),
				logs: []
			});
		}
	}

	return results;
}

function substituteVariables(text: string, variables: Record<string, string>): string {
	const visited = new Set<string>();
	return substituteVariablesRecursive(text, variables, visited);
}

function substituteVariablesRecursive(text: string, variables: Record<string, string>, visited: Set<string>): string {
	const variablePattern = /\{\{\s*([^}]+)\s*}}/g;
	return text.replace(variablePattern, (match, varName) => {
		const key = varName.trim();
		if (visited.has(key)) {
			throw new Error('Variable substitution loop detected for: ' + key);
		}
		if (variables[key] === undefined) {
			return match;
		}
		visited.add(key);
		const value = substituteVariablesRecursive(variables[key], variables, visited);
		visited.delete(key);
		return value;
	});
}

function findSectionByLineNumber(sections: HttpSection[], lineNumber: number): HttpSection | null {
	return sections.find(s =>
		lineNumber >= s.startLineNumber && lineNumber < s.endLineNumber
	) || null;
}

function extractBodyFromSection(lines: string[], bodySection: { startLineNumber: number; endLineNumber: number } | undefined): string | null {
	if (!bodySection) {
		return null;
	}

	const bodyLines = lines.slice(bodySection.startLineNumber - 1, bodySection.endLineNumber - 1);

	if (bodyLines.length === 0) {
		return null;
	}

	return bodyLines.join('\n');
}

async function loadEnvironmentVariables(
	environmentName: string,
	fileDirectory: string,
	collectionPath: string
): Promise<Record<string, string>> {
	if (!environmentName) {
		return {};
	}

	try {
		return await getEnvironmentVariablesMap(
			environmentName,
			fileDirectory,
			collectionPath
		);
	} catch (error) {
		console.error('Failed to load environment variables:', error);
		return {};
	}
}

function mergeVariablesFromFile(
	parsedFile: ParsedHttpFile,
	currentSection: HttpSection,
	baseVariables: Record<string, string>,
	globalVariables?: Record<string, string>
): Record<string, string> {
	const merged = { ...baseVariables };

	for (const section of parsedFile.sections) {
		if (section === currentSection) {
			continue;
		}

		if (section.preamble?.variables) {
			for (const [key, value] of Object.entries(section.preamble.variables)) {
				if (merged[key] === undefined) {
					merged[key] = value;
				}
			}
		}
	}

	if (parsedFile.preamble.variables) {
		for (const [key, value] of Object.entries(parsedFile.preamble.variables)) {
			merged[key] = value;
		}
	}

	if (currentSection.preamble?.variables) {
		for (const [key, value] of Object.entries(currentSection.preamble.variables)) {
			merged[key] = value;
		}
	}

	if (globalVariables) {
		for (const [key, value] of Object.entries(globalVariables)) {
			merged[key] = value;
		}
	}

	return merged;
}

export async function executeHttpRequest(params: RequestExecutionParams): Promise<HttpRequestResponse> {
	const { parsedFile, sectionLineNumber, selectedEnvironment, fileDirectory, collectionPath, globalVariables } = params;

	const section = findSectionByLineNumber(parsedFile.sections, sectionLineNumber);

	if (!section || !section.verb || !section.url) {
		throw new Error('Failed to extract request from section');
	}

	const headers = section.headers?.headers || {};
	const bodyContent = extractBodyFromSection(parsedFile.lines, section.body);

	const envVariables = await loadEnvironmentVariables(
		selectedEnvironment,
		fileDirectory,
		collectionPath
	);

	const variables = mergeVariablesFromFile(parsedFile, section, envVariables, globalVariables);

	const url = substituteVariables(section.url, variables);

	const substitutedHeaders: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		const substitutedKey = substituteVariables(key, variables);
		substitutedHeaders[substitutedKey] = substituteVariables(value, variables);
	}

	let body = bodyContent;
	if (body) {
		body = substituteVariables(body, variables);
	}

	console.log('Executing request:', { verb: section.verb, url, headers: substitutedHeaders, body });

	const startTime = performance.now();

	try {
		const response = await window.electronAPI.httpRequest({
			url: url,
			method: section.verb,
			headers: substitutedHeaders,
			body: body || undefined
		});

		const endTime = performance.now();
		const timeMs = Math.round(endTime - startTime);

		console.log('Response received:', response.status, response.statusText);

		const statusLine = `HTTP/1.1 ${response.status} ${response.statusText}`;

		const scriptResults = await executePostScripts(
			parsedFile.lines,
			section.postScripts,
			collectionPath,
			response.body,
			response.headers
		);

		return {
			statusLine,
			headers: response.headers,
			body: response.body,
			timeMs,
			scriptResults
		};
	} catch (error) {
		const endTime = performance.now();
		const timeMs = Math.round(endTime - startTime);

		return {
			statusLine: 'Error',
			headers: {},
			body: error instanceof Error ? error.message : String(error),
			timeMs
		};
	}
}

