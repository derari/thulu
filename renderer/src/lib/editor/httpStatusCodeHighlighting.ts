import type { DecorationSet } from '@codemirror/view';
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

function getStatusCodeClass(statusCode: number): string {
	if (statusCode >= 100 && statusCode < 200) {
		return 'http-status-info';
	}
	if (statusCode >= 200 && statusCode < 300) {
		return 'http-status-success';
	}
	if (statusCode >= 300 && statusCode < 400) {
		return 'http-status-redirect';
	}
	if (statusCode >= 400 && statusCode < 500) {
		return 'http-status-client-error';
	}
	if (statusCode >= 500 && statusCode < 600) {
		return 'http-status-server-error';
	}
	return '';
}

export const httpStatusCodeHighlighting = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = this.buildDecorations(view);
		}

		update(update: any) {
			if (update.docChanged || update.viewportChanged) {
				this.decorations = this.buildDecorations(update.view);
			}
		}

		buildDecorations(view: EditorView): DecorationSet {
			const builder = new RangeSetBuilder<Decoration>();
			const doc = view.state.doc;

			// Only check the first line for status code (response mode)
			if (doc.lines > 0) {
				const firstLine = doc.line(1);
				const text = firstLine.text;

				// Match HTTP status line: HTTP/1.1 200 OK
				const match = text.match(/^HTTP\/[\d.]+\s+(\d{3})/);
				if (match) {
					const statusCode = parseInt(match[1], 10);
					const cssClass = getStatusCodeClass(statusCode);

					if (cssClass) {
						const decoration = Decoration.line({
							class: cssClass
						});

						builder.add(firstLine.from, firstLine.from, decoration);
					}
				}
			}

			return builder.finish();
		}
	},
	{
		decorations: (v) => v.decorations
	}
);

export {};
