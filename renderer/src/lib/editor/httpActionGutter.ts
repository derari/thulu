import { gutter, GutterMarker, EditorView } from '@codemirror/view';
import { RangeSetBuilder, StateField } from '@codemirror/state';
import type { HttpSection } from '../collection';
import { parseHttpFile } from './httpParser.js';

type RequestExecutor = (sectionLineNumber: number) => void;

class PlayIconMarker extends GutterMarker {
    constructor(private sectionLineNumber: number, private executeRequest: RequestExecutor) {
        super();
    }

    eq(other: GutterMarker): boolean {
        return other instanceof PlayIconMarker &&
            other.sectionLineNumber === this.sectionLineNumber &&
            other.executeRequest === this.executeRequest;
    }

    toDOM() {
        const icon = document.createElement('span');
        icon.className = 'http-play-icon';
        icon.textContent = '▶';
        icon.title = 'Execute request';
        icon.style.cursor = 'pointer';
        icon.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.executeRequest(this.sectionLineNumber);
        });
        return icon;
    }
}

function createSectionsField(initialSections: HttpSection[] = []) {
    return StateField.define<HttpSection[]>({
        create() {
            return initialSections;
        },
        update(sections, tr) {
            if (tr.docChanged) {
                const parsed = parseHttpFile(tr.newDoc.toString());
                return parsed.sections;
            }
            return sections;
        }
    });
}

function createRequestExecutorField(initialExecutor: RequestExecutor | null = null) {
    return StateField.define<RequestExecutor | null>({
        create() {
            return initialExecutor;
        },
        update(executor) {
            return executor;
        }
    });
}

export function createHttpActionGutterExtension(executor: RequestExecutor, sections: HttpSection[]) {
    const sectionsFieldWithInit = createSectionsField(sections);
    const executorFieldWithInit = createRequestExecutorField(executor);

    return [
        sectionsFieldWithInit,
        executorFieldWithInit,
        gutter({
            class: 'cm-http-action-gutter',
            markers: (view: EditorView) => {
                const builder = new RangeSetBuilder<GutterMarker>();
                const secs = view.state.field(sectionsFieldWithInit);
                const exec = view.state.field(executorFieldWithInit);

                if (!exec) {
                    return builder.finish();
                }

                for (const section of secs) {
                    if (section.verbLine && !section.isDivider) {
                        const line = view.state.doc.line(section.verbLine);
                        const marker = new PlayIconMarker(section.lineNumber, exec);
                        builder.add(line.from, line.from, marker);
                    }
                }

                return builder.finish();
            },
            renderEmptyElements: true
        })
    ];
}


