<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { EditorView, lineNumbers, keymap } from '@codemirror/view';
    import { EditorState } from '@codemirror/state';
    import { defaultKeymap } from '@codemirror/commands';
    import { httpLanguage } from './httpLanguage.js';
    import { httpSyntaxHighlighting } from './httpHighlighting.js';
    import { httpEditorTheme } from './httpEditorTheme.js';
    import { httpBodyLineBackground } from './httpBodyLineBackground.js';
    import { createHttpActionGutterExtension } from './httpActionGutter.js';
    import { parseHttpFile } from './httpParser.js';
    import { extractRequestFromSection } from './requestExtractor.js';
    import { openFile } from '../stores/openFile.js';
    import { httpResponse } from '../stores/httpResponse.js';
    import { currentCollection } from '../stores/currentCollection.js';

    export let content: string = '';
    export let sectionLineNumber: number | undefined = undefined;

    var editorView: EditorView | null = null;
    var editorElement: HTMLDivElement;

    function getRelativeFilename(): string {
        const file = $openFile;
        const collection = $currentCollection;

        if (!file || !collection) {
            return '';
        }

        const collectionPath = collection.path;
        const filePath = file.filePath;

        if (filePath.startsWith(collectionPath)) {
            return filePath.substring(collectionPath.length).replace(/^[\\\/]/, '');
        }

        return filePath;
    }

    $: relativeFilename = getRelativeFilename();

    async function executeRequest(sectionLineNumber: number) {
        await openFile.save();

        const currentContent = editorView ? editorView.state.doc.toString() : content;
        const request = extractRequestFromSection(currentContent, sectionLineNumber);

        if (!request) {
            console.error('Failed to extract request from section');
            return;
        }

        console.log('Executing request:', request);

        const startTime = performance.now();

        try {
            const response = await window.electronAPI.httpRequest({
                url: request.url,
                method: request.verb,
                headers: request.headers,
                body: request.body && request.verb !== 'GET' && request.verb !== 'HEAD' ? request.body : undefined
            });

            const endTime = performance.now();
            const timeMs = Math.round(endTime - startTime);

            console.log('Response received:', response.status, response.statusText);

            const statusLine = `HTTP/1.1 ${response.status} ${response.statusText}`;

            httpResponse.setResponse({
                statusLine,
                headers: response.headers,
                body: response.body,
                timeMs
            });
        } catch (error) {
            console.error('Request failed:', error);
            const endTime = performance.now();
            const timeMs = Math.round(endTime - startTime);

            httpResponse.setResponse({
                statusLine: 'Error',
                headers: {},
                body: error instanceof Error ? error.message : String(error),
                timeMs
            });
        }
    }


    function createEditor() {
        if (!editorElement) return;

        const parsed = parseHttpFile(content);

        const startState = EditorState.create({
            doc: content,
            extensions: [
                lineNumbers(),
                ...createHttpActionGutterExtension(executeRequest, parsed.sections),
                keymap.of(defaultKeymap),
                httpLanguage,
                httpSyntaxHighlighting,
                httpEditorTheme,
                httpBodyLineBackground,
                EditorView.lineWrapping,
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        content = update.state.doc.toString();
                    }
                })
            ]
        });

        editorView = new EditorView({
            state: startState,
            parent: editorElement
        });

        scrollToSection();
    }

    function scrollToSection() {
        if (!editorView || !sectionLineNumber) return;

        const line = editorView.state.doc.line(sectionLineNumber);
        editorView.dispatch({
            selection: { anchor: line.from },
            scrollIntoView: true
        });
    }

    function destroyEditor() {
        if (editorView) {
            editorView.destroy();
            editorView = null;
        }
    }

    onMount(() => {
        createEditor();
    });

    onDestroy(() => {
        destroyEditor();
    });

    $: if (editorView && content !== editorView.state.doc.toString()) {
        editorView.dispatch({
            changes: {
                from: 0,
                to: editorView.state.doc.length,
                insert: content
            }
        });
        scrollToSection();
    }
</script>

<div class="http-editor">
    <div class="editor-header">
        <span class="editor-title">{relativeFilename}</span>
    </div>
    <div class="editor-container" bind:this={editorElement}></div>
</div>

<style>
    .http-editor {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--editor-bg);
    }

    .editor-header {
        padding: 0.75rem 1rem;
        background: var(--bg-secondary);
        border-bottom: 1px solid var(--border-default);
        font-weight: 600;
        color: var(--text-primary);
        flex-shrink: 0;
    }

    .editor-title {
        font-size: 0.9rem;
    }

    .editor-container {
        flex: 1;
        overflow: auto;
    }
</style>

