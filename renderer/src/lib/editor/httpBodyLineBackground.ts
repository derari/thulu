import { ViewPlugin, Decoration, EditorView } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

const bodyLineDecoration = Decoration.line({
    attributes: { class: 'http-body-line' }
});

const errorLineDecoration = Decoration.line({
    attributes: { class: 'http-body-line http-body-error-line' }
});

export const httpBodyLineBackground = ViewPlugin.fromClass(class {
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

        let inBody = false;
        let inHeaders = false;
        let foundRequest = false;
        let hadEmptyLineAfterHeaders = false;
        let lastNonEmptyLineWasHeader = false;

        for (let line = 1; line <= doc.lines; line++) {
            const lineObj = doc.line(line);
            const text = lineObj.text;

            // Section marker resets state
            if (text.startsWith('###')) {
                inBody = false;
                inHeaders = false;
                foundRequest = false;
                hadEmptyLineAfterHeaders = false;
                lastNonEmptyLineWasHeader = false;
                continue;
            }

            // Empty lines (not comments)
            if (text.trim() === '') {
                if (inHeaders && lastNonEmptyLineWasHeader) {
                    hadEmptyLineAfterHeaders = true;
                }
                continue;
            }

            // Comment (outside body)
            if (!inBody && text.startsWith('#')) {
                // Comments don't count as empty line separator
                continue;
            }

            // HTTP verb (request) or HTTP status line (response) starts headers
            if (!foundRequest && (/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|TRACE|CONNECT)\s/.test(text) || /^HTTP\/[\d.]+/.test(text))) {
                foundRequest = true;
                inHeaders = true;
                lastNonEmptyLineWasHeader = false;
                continue;
            }

            // Header line (Key: Value pattern)
            if (inHeaders && /^[^:]+:/.test(text)) {
                lastNonEmptyLineWasHeader = true;
                continue;
            }

            // First non-empty, non-comment, non-header line after headers starts body
            if (inHeaders) {
                inBody = true;
                inHeaders = false;

                const isError = !hadEmptyLineAfterHeaders;

                if (isError) {
                    builder.add(lineObj.from, lineObj.from, errorLineDecoration);
                } else {
                    builder.add(lineObj.from, lineObj.from, bodyLineDecoration);
                }
                continue;
            }

            if (inBody) {
                builder.add(lineObj.from, lineObj.from, bodyLineDecoration);
            }
        }

        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});

export {};

