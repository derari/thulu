// JSON body highlighting
export function highlightJsonToken(stream: any): string | null {
	// JSON property keys (strings followed by colon)
	if (stream.match(/"(?:[^"\\]|\\.)*"(?=\s*:)/)) {
		return 'keyword';
	}

	// JSON strings
	if (stream.match(/"(?:[^"\\]|\\.)*"/)) {
		return 'string';
	}

	// JSON numbers
	if (stream.match(/-?\d+\.?\d*([eE][+-]?\d+)?/)) {
		return 'number';
	}

	// JSON booleans and null
	if (stream.match(/\b(true|false|null)\b/)) {
		return 'atom';
	}

	// JSON structural characters
	if (stream.match(/[{}\[\]:,]/)) {
		return 'punctuation';
	}

	return null;
}
