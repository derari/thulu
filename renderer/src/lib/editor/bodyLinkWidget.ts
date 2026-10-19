import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';

const LARGE_BODY_THRESHOLD = 1_048_576; // 1 MB

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

class BodyLinkWidget extends WidgetType {
    constructor(
        private readonly filePath: string,
        private readonly byteSize: number
    ) {
        super();
    }

    eq(other: BodyLinkWidget): boolean {
        return other.filePath === this.filePath && other.byteSize === this.byteSize;
    }

    toDOM(): HTMLElement {
        const wrap = document.createElement('div');
        wrap.className = 'cm-body-link-wrap';

        const fileName = this.filePath.split(/[\\/]/).at(-1) ?? this.filePath;

        const btn = document.createElement('button');
        btn.className = 'cm-body-link-btn';
        btn.textContent = `${fileName} (${formatBytes(this.byteSize)})`;
        btn.title = this.filePath;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.electronAPI.openFile(this.filePath);
        });

        wrap.appendChild(btn);
        return wrap;
    }

    ignoreEvent(): boolean {
        return false;
    }
}

export interface BodyLinkState {
    /** 1-based line number where the body placeholder starts */
    bodyStartLine: number;
    /** 1-based line number where the body placeholder ends (exclusive) */
    bodyEndLine: number;
    /** Absolute path to the saved body file on disk */
    filePath: string;
    /** Size in bytes to display */
    byteSize: number;
    /** Whether to show the widget (binary content-type or body > 1 MB) */
    showWidget: boolean;
}

function buildDecorations(
    state: BodyLinkState | null,
    doc: EditorView['state']['doc']
): DecorationSet {
    if (!state?.showWidget || !state.filePath) return Decoration.none;
    if (state.bodyStartLine < 1 || state.bodyStartLine > doc.lines) return Decoration.none;

    const startLine = doc.line(state.bodyStartLine);
    const endLineNum = Math.min(state.bodyEndLine - 1, doc.lines);
    const endLine = doc.line(Math.max(endLineNum, state.bodyStartLine));

    const builder = new RangeSetBuilder<Decoration>();
    builder.add(
        startLine.from,
        endLine.to,
        Decoration.replace({
            widget: new BodyLinkWidget(state.filePath, state.byteSize),
            block: true
        })
    );
    return builder.finish();
}

export function createBodyLinkExtension() {
    const setStateEffect = StateEffect.define<BodyLinkState | null>();

    const stateField = StateField.define<{
        linkState: BodyLinkState | null;
        decorations: DecorationSet;
    }>({
        create() {
            return { linkState: null, decorations: Decoration.none };
        },
        update(value, tr) {
            let linkState = value.linkState;
            for (const effect of tr.effects) {
                if (effect.is(setStateEffect)) {
                    linkState = effect.value;
                }
            }
            const decorations = buildDecorations(linkState, tr.newDoc);
            return { linkState, decorations };
        },
        provide: (f) => EditorView.decorations.from(f, (v) => v.decorations)
    });

    return {
        /** The extension to register in EditorState.create({ extensions: [...] }) */
        plugin: stateField,
        /** Dispatch the widget state to a live editor view */
        setState(newState: BodyLinkState | null, view: EditorView) {
            view.dispatch({ effects: setStateEffect.of(newState) });
        },
        shouldShowWidget(isBinary: boolean, byteSize: number): boolean {
            return isBinary || byteSize > LARGE_BODY_THRESHOLD;
        }
    };
}

export { LARGE_BODY_THRESHOLD };
