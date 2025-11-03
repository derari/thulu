import { StreamLanguage } from '@codemirror/language';
import { getHighlighterForContentType } from './contentTypeMapping.js';

type ParserState = 'preamble' | 'section-title' | 'headers' | 'body' | 'status-line';

interface HttpState {
	state: ParserState;
	contentType: string | null;
	bodyHighlighter: ((stream: any) => string | null) | null;
	mode: 'request' | 'response';
}

const HTTP_VERBS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'];

export function createHttpLanguage(mode: 'request' | 'response' = 'request') {
	return StreamLanguage.define<HttpState>({
		startState: () => ({
			state: mode === 'response' ? 'status-line' : 'preamble',
			contentType: null,
			bodyHighlighter: null,
			mode
		}),

		token(stream, state) {
			if (stream.sol()) {
				// Response status line (HTTP/1.1 200 OK)
				if (state.mode === 'response' && state.state === 'status-line') {
					if (stream.match(/^HTTP\/[\d.]+/)) {
						state.state = 'headers';
						stream.skipToEnd();
						return null;
					}
				}

				// Section marker - resets to section-title state (only in request mode)
				if (state.mode === 'request' && stream.match(/^###/)) {
					state.state = 'section-title';
					state.contentType = null;
					state.bodyHighlighter = null;
					return 'meta';
				}

				// Comment (only outside body and only in request mode)
				if (state.mode === 'request' && state.state !== 'body' && stream.match(/^#/)) {
					stream.skipToEnd();
					return 'comment';
				}

				// HTTP verb - transitions to headers state (only in request mode)
				if (state.mode === 'request' && (state.state === 'preamble' || state.state === 'section-title')) {
					for (const verb of HTTP_VERBS) {
						if (stream.match(verb)) {
							state.state = 'headers';
							return 'strong';
						}
					}
				}

				// Header line - must be valid HTTP header format
				if (state.state === 'headers') {
					// Valid HTTP header: starts with alphanumeric/dash, has colon, followed by value
					// This excludes JSON like {"key": "value"} which starts with {
					const match = stream.string.match(/^([a-zA-Z0-9\-]+):\s*(.*)$/);
					if (match && stream.match(/^([a-zA-Z0-9\-]+):/)) {
						const headerName = match[1].trim().toLowerCase();
						if (headerName === 'content-type') {
							state.contentType = stream.string.substring(stream.pos).trim();
						}
						return 'keyword';
					}

					// Not a valid header line while in headers state -> must be body content
					state.state = 'body';
					state.bodyHighlighter = getHighlighterForContentType(state.contentType);
					// Fall through to body handling below
				}
			}

			// Section title (text after ###) - only in request mode
			if (state.mode === 'request' && state.state === 'section-title' && stream.pos === 3) {
				stream.skipToEnd();
				state.state = 'preamble';
				return 'heading';
			}

			// Body content - use the appropriate highlighter
			if (state.state === 'body') {
				if (stream.eatSpace()) {
					return null;
				}

				if (state.bodyHighlighter) {
					const token = state.bodyHighlighter(stream);
					if (token) {
						return token;
					}
				}

				stream.next();
				return null;
			}

			stream.next();
			return null;
		},

		languageData: {
			commentTokens: { line: '#' }
		}
	});
}

// Default export for backwards compatibility (request mode)
export const httpLanguage = createHttpLanguage('request');
