import { StreamLanguage } from '@codemirror/language';
import { getHighlighterForContentType } from './contentTypeMapping.js';
import type { HttpBodySection, ParsedHttpFile, ParsedHttpResponse } from './httpParser.js';

type ParserState = 'preamble' | 'section-title' | 'headers' | 'body' | 'status-line';

interface HttpState {
    state: ParserState;
    contentType: string | null;
    bodyHighlighter: ((stream: any) => string | null) | null;
    mode: 'request' | 'response';
    parsedFile: ParsedHttpFile | null;
    parsedResponse: ParsedHttpResponse | null;
    bodyRanges: HttpBodySection[];
    lines: string[];
    lineNumber: number;
}

const HTTP_VERBS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'];

export interface HttpLanguageConfig {
    mode?: 'request' | 'response';
    parsedFile?: ParsedHttpFile | null;
    parsedResponse?: ParsedHttpResponse | null;
}

function getBodyRanges(
    parsedFile: ParsedHttpFile | null,
    parsedResponse: ParsedHttpResponse | null
): HttpBodySection[] {
    const ranges: HttpBodySection[] = [];

    if (parsedFile) {
        for (const section of parsedFile.sections) {
            if (section.body) {
                ranges.push(section.body);
            }
        }
    }
    if (parsedResponse) {
        if (parsedResponse.body) {
            ranges.push(parsedResponse.body);
        }
    }

    return ranges;
}

function isLineInBody(lineNumber: number, bodyRanges: HttpBodySection[]): boolean {
    for (const range of bodyRanges) {
        if (lineNumber >= range.startLineNumber && lineNumber < range.endLineNumber) {
            return true;
        }
    }
    return false;
}

function isLineInPostScript(lineNumber: number, parsedFile: ParsedHttpFile | null): boolean {
    if (!parsedFile) {
        return false;
    }

    for (const section of parsedFile.sections) {
        if (section.postScripts) {
            for (const postScript of section.postScripts) {
                if (
                    lineNumber >= postScript.startLineNumber &&
                    lineNumber < postScript.endLineNumber
                ) {
                    return true;
                }
            }
        }
    }

    return false;
}

function isLineInRequest(lineNumber: number, parsedFile: ParsedHttpFile | null): boolean {
    if (!parsedFile) {
        return false;
    }

    for (const section of parsedFile.sections) {
        if (section.requestStartLineNumber && section.requestEndLineNumber) {
            if (
                lineNumber >= section.requestStartLineNumber &&
                lineNumber < section.requestEndLineNumber
            ) {
                return true;
            }
        }
    }

    return false;
}

export function createHttpLanguage(config: HttpLanguageConfig = {}) {
    const mode = config.mode || 'request';
    const parsedFileRef = { current: config.parsedFile || null };
    const parsedResponseRef = { current: config.parsedResponse || null };

    return {
        language: StreamLanguage.define<HttpState>({
            startState: () => ({
                state: mode === 'response' ? 'status-line' : 'preamble',
                contentType: null,
                bodyHighlighter: null,
                mode,
                parsedFile: null,
                parsedResponse: null,
                bodyRanges: [],
                lines: [],
                lineNumber: 0
            }),

            token(stream, state) {
                if (
                    state.parsedFile !== parsedFileRef.current ||
                    state.parsedResponse !== parsedResponseRef.current
                ) {
                    state.parsedFile = parsedFileRef.current;
                    state.parsedResponse = parsedResponseRef.current;
                    state.bodyRanges = getBodyRanges(
                        parsedFileRef.current,
                        parsedResponseRef.current
                    );
                    state.lines =
                        parsedFileRef.current?.lines || parsedResponseRef.current?.lines || [];
                }

                if (stream.sol()) {
                    state.lineNumber++;
                    while (
                        state.lineNumber < state.lines.length &&
                        state.lines[state.lineNumber - 1] === ''
                    ) {
                        state.lineNumber++;
                    }
                }

                if (isLineInBody(state.lineNumber, state.bodyRanges)) {
                    if (state.state !== 'body') {
                        state.state = 'body';
                        state.bodyHighlighter = getHighlighterForContentType(state.contentType);
                    }

                    if (state.bodyHighlighter) {
                        if (stream.eatSpace()) {
                            return null;
                        }
                        const token = state.bodyHighlighter(stream);
                        if (token) {
                            return token;
                        }
                    }

                    stream.next();
                    return null;
                }

                // Post-script highlighting
                if (isLineInPostScript(state.lineNumber, state.parsedFile)) {
                    // Highlight > at start of line
                    if (stream.sol() && stream.match(/^>/)) {
                        return 'heading';
                    }

                    // Highlight {% and %} as strong
                    if (stream.match(/{%|%}/)) {
                        return 'heading';
                    }

                    // Everything else has no highlighting
                    stream.next();
                    return null;
                }

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

                    // Variable definition in preamble - highlight @ at start of line
                    if (
                        state.mode === 'request' &&
                        (state.state === 'preamble' || state.state === 'section-title') &&
                        stream.match(/^@/)
                    ) {
                        return 'strong';
                    }

                    // Comment (only outside body and only in request mode)
                    if (state.mode === 'request' && stream.match(/^\s*(#|\/\/)/)) {
                        stream.skipToEnd();
                        return 'comment';
                    }

                    // HTTP verb - highlight but don't transition state yet (only in request mode)
                    if (
                        state.mode === 'request' &&
                        (state.state === 'preamble' || state.state === 'section-title')
                    ) {
                        for (const verb of HTTP_VERBS) {
                            if (stream.match(verb)) {
                                return 'strong';
                            }
                        }
                    }

                    // Check if we're on a request line (including multi-line requests)
                    if (
                        state.mode === 'request' &&
                        isLineInRequest(state.lineNumber, state.parsedFile)
                    ) {
                        // We're in a request line, don't transition to headers yet
                        stream.next();
                        return null;
                    }

                    // Header line - must be valid HTTP header format
                    if (
                        state.state === 'headers' ||
                        (state.mode === 'request' && state.state === 'preamble')
                    ) {
                        // Valid HTTP header: starts with alphanumeric/dash, has colon, followed by value
                        // This excludes JSON like {"key": "value"} which starts with {
                        const match = stream.string.match(/^([a-zA-Z0-9\-]+):\s*(.*)$/);
                        if (match && stream.match(/^([a-zA-Z0-9\-]+):/)) {
                            const headerName = match[1].trim().toLowerCase();
                            if (headerName === 'content-type') {
                                state.contentType = stream.string.substring(stream.pos).trim();
                            }
                            state.state = 'headers';
                            return 'keyword';
                        }
                    }
                }

                // Section title (text after ###) - only in request mode
                if (
                    state.mode === 'request' &&
                    state.state === 'section-title' &&
                    stream.pos === 3
                ) {
                    stream.skipToEnd();
                    state.state = 'preamble';
                    return 'heading';
                }

                stream.next();
                return null;
            },

            languageData: {
                commentTokens: { line: '#' }
            }
        }),
        updateParsedFile: (newParsedFile: ParsedHttpFile | null) => {
            parsedFileRef.current = newParsedFile;
            return createHttpLanguage({
                mode,
                parsedFile: newParsedFile,
                parsedResponse: parsedResponseRef.current
            });
        },
        getParsedFile: () => parsedFileRef.current,
        updateParsedResponse: (newParsedResponse: ParsedHttpResponse | null) => {
            parsedResponseRef.current = newParsedResponse;
        },
        getParsedResponse: () => parsedResponseRef.current
    };
}
