import type { DecorationSet } from '@codemirror/view';
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import type { ParsedHttpFile, ParsedHttpResponse } from './httpParser';

const bodyLineDecoration = Decoration.line({
	attributes: { class: 'http-body-line' }
});

interface BodyRange {
	startLine: number;
	endLine: number;
}

interface HttpBodyLineBackgroundConfig {
	mode?: 'request' | 'response';
	parsedFile?: ParsedHttpFile | null;
	parsedResponse?: ParsedHttpResponse | null;
}

function getBodyRanges(
	parsedFile: ParsedHttpFile | null,
	parsedResponse: ParsedHttpResponse | null,
	mode: 'request' | 'response'
): BodyRange[] {
	const ranges: BodyRange[] = [];

	if (mode === 'request' && parsedFile) {
		for (const section of parsedFile.sections) {
			if (section.body) {
				ranges.push({
					startLine: section.body.startLineNumber,
					endLine: section.body.endLineNumber
				});
			}

			// Add post-script ranges
			if (section.postScripts) {
				for (const postScript of section.postScripts) {
					ranges.push({
						startLine: postScript.startLineNumber,
						endLine: postScript.endLineNumber
					});
				}
			}
		}
	}

	if (mode === 'response' && parsedResponse?.body) {
		ranges.push({
			startLine: parsedResponse.body.startLineNumber,
			endLine: parsedResponse.body.endLineNumber
		});
	}

	return ranges;
}

function isLineInBody(lineNumber: number, bodyRanges: BodyRange[]): boolean {
	for (const range of bodyRanges) {
		if (lineNumber >= range.startLine && lineNumber < range.endLine) {
			return true;
		}
	}
	return false;
}

export function createHttpBodyLineBackground(config: HttpBodyLineBackgroundConfig = {}) {
	const mode = config.mode || 'request';
	const parsedFileRef = { current: config.parsedFile || null };
	const parsedResponseRef = { current: config.parsedResponse || null };

	return {
		plugin: ViewPlugin.fromClass(
			class {
				decorations: DecorationSet;
				bodyRanges: BodyRange[];

				constructor(view: EditorView) {
					this.bodyRanges = getBodyRanges(
						parsedFileRef.current,
						parsedResponseRef.current,
						mode
					);
					this.decorations = this.buildDecorations(view);
				}

				update(update: any) {
					const newBodyRanges = getBodyRanges(
						parsedFileRef.current,
						parsedResponseRef.current,
						mode
					);
					const rangesChanged =
						JSON.stringify(newBodyRanges) !== JSON.stringify(this.bodyRanges);

					if (update.docChanged || update.viewportChanged || rangesChanged) {
						this.bodyRanges = newBodyRanges;
						this.decorations = this.buildDecorations(update.view);
					}
				}

				buildDecorations(view: EditorView): DecorationSet {
					const builder = new RangeSetBuilder<Decoration>();
					const doc = view.state.doc;

					for (let line = 1; line <= doc.lines; line++) {
						if (isLineInBody(line, this.bodyRanges)) {
							const lineObj = doc.line(line);
							builder.add(lineObj.from, lineObj.from, bodyLineDecoration);
						}
					}

					return builder.finish();
				}
			},
			{
				decorations: (v) => v.decorations
			}
		),
		updateParsedFile: (newParsedFile: ParsedHttpFile | null) => {
			parsedFileRef.current = newParsedFile;
		},
		getParsedFile: () => parsedFileRef.current,
		updateParsedResponse: (newParsedResponse: ParsedHttpResponse | null) => {
			parsedResponseRef.current = newParsedResponse;
		},
		getParsedResponse: () => parsedResponseRef.current
	};
}

export const httpBodyLineBackground = createHttpBodyLineBackground().plugin;

export {};
