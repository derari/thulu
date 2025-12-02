import type {
	HttpBodySection,
	HttpHeaderSection,
	HttpSection,
	ParsedHttpResponse,
	PostScript,
	Preamble
} from '../collection';

export type { ParsedHttpResponse, HttpSection, HttpBodySection };

export interface ParsedHttpFile {
	preamble: Preamble;
	sections: HttpSection[];
	lines: string[];
}

const SECTION_MARKER = '###';
const HTTP_VERBS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'];
const HTTP_RESPONSE_PATTERN = /^HTTP\/[\d.]+\s+(\d{3})/;

function extractSectionName(line: string): string {
	const afterMarker = line.substring(SECTION_MARKER.length).trim();
	return afterMarker || '';
}

function parseVariables(lines: string[], startLine: number, endLine: number, isOptions: boolean): Record<string, string> {
	const variables: Record<string, string> = {};

	for (let i = startLine - 1; i < endLine - 1 && i < lines.length; i++) {
		const line = lines[i].trim();
		const matchesPattern = isOptions ? startsWithOptionMarker(line) : line.startsWith('@');

		if (matchesPattern) {
			const afterAt = extractAfterMarker(line, isOptions);
			const equalsIndex = afterAt.indexOf('=');

			if (equalsIndex > 0) {
				const name = afterAt.substring(0, equalsIndex).trim();
				const value = afterAt.substring(equalsIndex + 1).trim();

				if (name) {
					variables[name] = value;
				}
			} else {
				const whitespaceMatch = afterAt.match(/^(\S+)\s+(.*)$/);
				if (whitespaceMatch) {
					const name = whitespaceMatch[1];
					const value = whitespaceMatch[2].trim();
					if (name) {
						variables[name] = value;
					}
				} else {
					const name = afterAt.trim();
					if (name) {
						variables[name] = '';
					}
				}
			}
		}
	}

	return variables;
}

function startsWithOptionMarker(line: string): boolean {
	const trimmed = line.replace(/\s+/g, '');
	return trimmed.startsWith('#@');
}

function extractAfterMarker(line: string, isOptions: boolean): string {
	if (!isOptions) {
		return line.substring(1);
	}

	const hashIndex = line.indexOf('#');
	const afterHash = line.substring(hashIndex + 1).trimStart();

	if (afterHash.startsWith('@')) {
		return afterHash.substring(1);
	}

	return '';
}

function extractVerbAndUrl(
	lines: string[],
	startIndex: number,
	nextSectionIndex?: number
): { verb?: string; url?: string; requestStartLineNumber?: number; requestEndLineNumber?: number } {
	const endIndex = nextSectionIndex !== undefined ? nextSectionIndex : lines.length;

	for (let i = startIndex + 1; i < endIndex; i++) {
		const line = lines[i].trim();

		if (line === '' || line.startsWith('#') || line.startsWith('//') || line.startsWith('@')) {
			continue;
		}

		for (const verb of HTTP_VERBS) {
			if (line.startsWith(verb + ' ')) {
				const firstLinePart = line.substring(verb.length + 1).trim();
				const urlParts = [firstLinePart];
				const requestStartLineNumber = i + 1;
				let requestEndLineNumber = requestStartLineNumber + 1;

				for (let j = i + 1; j < endIndex; j++) {
					const nextLine = lines[j];
					const trimmedNextLine = nextLine.trim();

					if (trimmedNextLine === '') {
						break;
					}

					const isComment = trimmedNextLine.startsWith('#') || trimmedNextLine.startsWith('//');
					const isIndented = nextLine[0] === ' ' || nextLine[0] === '\t';

					if (isIndented || isComment) {
						requestEndLineNumber = j + 2;
						if (!isComment) {
							urlParts.push(trimmedNextLine);
						}
					} else {
						break;
					}
				}

				const url = urlParts.join('');
				return { verb, url, requestStartLineNumber, requestEndLineNumber };
			}
		}

		break;
	}

	return {};
}

function parseHeadersAndBody(
	lines: string[],
	verbLineIndex: number,
	endIndex: number
): { headers?: HttpHeaderSection; body?: HttpBodySection; postScripts: PostScript[] } {
	const headerMap: Record<string, string> = {};
	let headerStartLine: number | undefined;
	let headerEndLine: number | undefined;
	let bodyStartLine: number | undefined;
	let bodyEndLine: number | undefined;
	const postScripts: PostScript[] = [];
	let inHeaders = true;
	let inBody = false;

	for (
		let currentLineIndex = verbLineIndex + 1;
		currentLineIndex < endIndex;
		currentLineIndex++
	) {
		const line = lines[currentLineIndex];
		const trimmedLine = line.trim();

		if (inHeaders) {
			if (trimmedLine === '') {
				inHeaders = false;
				inBody = true;
				continue;
			}

			if (headerStartLine === undefined) {
				headerStartLine = currentLineIndex + 1;
			}
			headerEndLine = currentLineIndex + 2;

			if (trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
				continue;
			}

			const colonIndex = trimmedLine.indexOf(':');
			if (colonIndex > 0) {
				const key = trimmedLine.substring(0, colonIndex).trim();
				headerMap[key] = trimmedLine.substring(colonIndex + 1).trim();
				continue;
			}

			continue;
		}

		if (line.startsWith('>')) {
			if (bodyStartLine !== undefined && bodyEndLine !== undefined) {
				for (let i = currentLineIndex - 1; i >= bodyStartLine - 1; i--) {
					const trimmedBodyLine = lines[i].trim();
					if (trimmedBodyLine !== '' && !trimmedBodyLine.startsWith('>')) {
						bodyEndLine = i + 2;
						break;
					}
				}
			}

			const postScriptStartLine = currentLineIndex + 1;
			const afterGreater = trimmedLine.substring(1).trim();

			if (afterGreater.startsWith('{%')) {
				let postScriptEndLine = currentLineIndex + 2;
				let foundClosing = afterGreater.includes('%}');

				if (!foundClosing) {
					for (let i = currentLineIndex + 1; i < endIndex; i++) {
						const searchLine = lines[i];
						if (searchLine.includes('%}')) {
							postScriptEndLine = i + 2;
							foundClosing = true;
							currentLineIndex = i;
							break;
						}
					}

					if (!foundClosing) {
						postScriptEndLine = currentLineIndex + 2;
					}
				}

				postScripts.push({
					startLineNumber: postScriptStartLine,
					endLineNumber: postScriptEndLine,
					type: 'script'
				});
			} else {
				postScripts.push({
					startLineNumber: postScriptStartLine,
					endLineNumber: currentLineIndex + 2,
					type: 'file'
				});
			}

			continue;
		}

		if (inBody) {
			if (trimmedLine === '' || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
				continue;
			}

			if (bodyStartLine === undefined) {
				bodyStartLine = currentLineIndex + 1;
			}

			bodyEndLine = currentLineIndex + 2;
		}
	}

	if (bodyEndLine !== undefined && bodyStartLine !== undefined && postScripts.length === 0) {
		for (let i = endIndex - 1; i >= bodyStartLine - 1; i--) {
			const trimmedLine = lines[i].trim();
			if (trimmedLine !== '' && !trimmedLine.startsWith('>')) {
				bodyEndLine = i + 2;
				break;
			}
		}
	}

	const result: { headers?: HttpHeaderSection; body?: HttpBodySection; postScripts: PostScript[] } = {
		postScripts
	};

	if (
		Object.keys(headerMap).length > 0 &&
		headerStartLine !== undefined &&
		headerEndLine !== undefined
	) {
		result.headers = {
			startLineNumber: headerStartLine,
			endLineNumber: headerEndLine,
			headers: headerMap
		};
	}

	if (bodyStartLine !== undefined && bodyEndLine !== undefined && bodyStartLine < bodyEndLine) {
		result.body = {
			startLineNumber: bodyStartLine,
			endLineNumber: bodyEndLine
		};
	}

	return result;
}

export function parseHttpFile(content: string): ParsedHttpFile {
	const sections: HttpSection[] = [];
	const lines = content.split('\n');
	const sectionIndices: number[] = [];

	// First pass: find all section markers
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].startsWith(SECTION_MARKER)) {
			sectionIndices.push(i);
		}
	}

	// Calculate preamble (everything before first section)
	const preambleStartLine = 1;
	const preambleEndLine = sectionIndices.length > 0 ? sectionIndices[0] + 1 : lines.length + 1;
	const preambleVariables = parseVariables(lines, preambleStartLine, preambleEndLine, false);
	const preambleOptions = parseVariables(lines, preambleStartLine, preambleEndLine, true);

	const preamble: Preamble = {
		startLineNumber: preambleStartLine,
		endLineNumber: preambleEndLine,
		variables: preambleVariables,
        options: preambleOptions
	};

	// Second pass: process sections
	for (let idx = 0; idx < sectionIndices.length; idx++) {
		const i = sectionIndices[idx];
		const line = lines[i];
		const nextSectionIndex =
			idx + 1 < sectionIndices.length ? sectionIndices[idx + 1] : undefined;
		const endIndex = nextSectionIndex !== undefined ? nextSectionIndex : lines.length;

		const name = extractSectionName(line);
		const { verb, url, requestStartLineNumber, requestEndLineNumber } = extractVerbAndUrl(lines, i, nextSectionIndex);

		const isDivider = !verb && !url;

		// Skip dividers that are first or last
		const isFirst = idx === 0;
		const isLast = idx === sectionIndices.length - 1;

		if (isDivider && (isFirst || isLast)) {
			continue;
		}

		// Use URL as title if untitled
		const title = name || url || 'Untitled';

		// Calculate section preamble (between section marker and request line)
		let sectionPreamble: Preamble | undefined;
		if (requestStartLineNumber) {
			const preambleStart = i + 2; // Line after section marker (1-indexed)
			const preambleEnd = requestStartLineNumber; // Request line (1-indexed)
			if (preambleStart < preambleEnd) {
				const sectionVariables = parseVariables(lines, preambleStart, preambleEnd, false);
				const sectionOptions = parseVariables(lines, preambleStart, preambleEnd, true);
				sectionPreamble = {
					startLineNumber: preambleStart,
					endLineNumber: preambleEnd,
					variables: sectionVariables,
                    options: sectionOptions
				};
			}
		}

		// Parse headers and body if we have a request line
		let headers: HttpHeaderSection | undefined;
		let body: HttpBodySection | undefined;
		let postScripts: PostScript[] = [];
		if (requestStartLineNumber && requestEndLineNumber) {
			const parsed = parseHeadersAndBody(lines, requestEndLineNumber - 2, endIndex);
			headers = parsed.headers;
			body = parsed.body;
			postScripts = parsed.postScripts;
		}

		sections.push({
			name: title,
			startLineNumber: i + 1,
			endLineNumber: endIndex + 1,
			preamble: sectionPreamble,
			verb,
			requestStartLineNumber,
			requestEndLineNumber,
			url,
			isDivider,
			headers,
			body,
			postScripts
		});
	}

	return {
		preamble,
		sections,
		lines
	};
}

export function parseHttpResponse(content: string): ParsedHttpResponse | null {
	const lines = content.split('\n');

	if (lines.length === 0) {
		return null;
	}

	// First line should be the status line (e.g., "HTTP/1.1 200 OK")
	const statusLine = lines[0].trim();
	const match = statusLine.match(HTTP_RESPONSE_PATTERN);

	if (!match) {
		return null;
	}

	const code = parseInt(match[1], 10);
	let headerStartLine = 2; // Line after status line (1-indexed)
	let headerEndLine = headerStartLine;
	let bodyStartLine: number | undefined;
	let bodyEndLine: number | undefined;
	const headerMap: Record<string, string> = {};

	// Parse headers (lines after status line until empty line)
	let foundEmptyLine = false;
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();

		if (line === '') {
			foundEmptyLine = true;
			headerEndLine = i + 1; // 1-indexed, exclusive
			bodyStartLine = i + 2; // 1-indexed, line after empty line
			break;
		}

		// Header format: "Key: Value"
		const colonIndex = line.indexOf(':');
		if (colonIndex > 0) {
			const key = line.substring(0, colonIndex).trim();
			headerMap[key] = line.substring(colonIndex + 1).trim();
			headerEndLine = i + 2; // 1-indexed, exclusive (next line)
		}
	}

	// Create headers section if we found any headers
	let headers: HttpHeaderSection | undefined;
	if (Object.keys(headerMap).length > 0) {
		headers = {
			startLineNumber: headerStartLine,
			endLineNumber: headerEndLine,
			headers: headerMap
		};
	}

	// Create body section if there's content after headers
	let body: HttpBodySection | undefined;
	if (foundEmptyLine && bodyStartLine) {
		// Find last non-empty line for body end
		bodyEndLine = lines.length + 1; // 1-indexed, exclusive (after last line)

		// Trim trailing empty lines
		for (let i = lines.length - 1; i >= bodyStartLine - 1; i--) {
			if (lines[i].trim() !== '') {
				bodyEndLine = i + 2; // 1-indexed, exclusive (line after last content)
				break;
			}
		}

		if (bodyStartLine < bodyEndLine) {
			body = {
				startLineNumber: bodyStartLine,
				endLineNumber: bodyEndLine
			};
		}
	}

	return {
		codeLine: statusLine,
		code,
		headers,
		body,
		lines
	};
}
