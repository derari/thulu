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
            // Scan for the first HTTP status line (may be preceded by a redirect preamble)
            for (let i = 1; i <= doc.lines; i++) {
                const line = doc.line(i);
                const match = line.text.match(/^HTTP\/[\d.]+\s+(\d{3})/);
                if (match) {
                    const statusCode = parseInt(match[1], 10);
                    const cssClass = getStatusCodeClass(statusCode);

                    if (cssClass) {
                        builder.add(line.from, line.from, Decoration.line({ class: cssClass }));
                    }
                    break;
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
