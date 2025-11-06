import {
	type HttpBodySection,
	type HttpSection,
	type ParsedHttpFile,
	parseHttpFile
} from './httpParser.js';

export interface HttpRequest {
	verb: string;
	url: string;
	headers: Record<string, string>;
	body: string | null;
}

export function extractRequestFromSection(
	content: string,
	sectionLineNumber: number
): HttpRequest | null {
	const parsed = parseHttpFile(content);
	return extractRequest(parsed, sectionLineNumber);
}

export function extractRequest(
	parsed: ParsedHttpFile,
	sectionLineNumber: number
): HttpRequest | null {

	const section = findSectionByLineNumber(parsed.sections, sectionLineNumber);

	if (!section || !section.verb || !section.url) {
		return null;
	}

	const headers = section.headers?.headers || {};
	const body = extractBodyContent(parsed.lines, section.body);

	return {
		verb: section.verb,
		url: section.url,
		headers,
		body
	};
}

function findSectionByLineNumber(sections: HttpSection[], lineNumber: number): HttpSection | null {
	for (const section of sections) {
		if (lineNumber >= section.startLineNumber && lineNumber < section.endLineNumber) {
			return section;
		}
	}
	return null;
}

function extractBodyContent(
	lines: string[],
	bodySection: HttpBodySection | undefined
): string | null {
	if (!bodySection) {
		return null;
	}

	const bodyLines = lines.slice(bodySection.startLineNumber - 1, bodySection.endLineNumber - 1);

	if (bodyLines.length === 0) {
		return null;
	}

	return bodyLines.join('\n');
}
