<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { EditorView, lineNumbers } from '@codemirror/view';
    import { EditorState } from '@codemirror/state';
    import { httpResponse } from './stores/httpResponse.js';
    import { createHttpLanguage } from './editor/httpLanguage.js';
    import { httpSyntaxHighlighting } from './editor/httpHighlighting.js';
    import { httpEditorTheme } from './editor/httpEditorTheme.js';
    import { httpBodyLineBackground } from './editor/httpBodyLineBackground.js';
    import { httpStatusCodeHighlighting } from './editor/httpStatusCodeHighlighting.js';
    import { responseFormatGutterExtension, setFormatStateEffect, setFormatToggleCallback } from './editor/responseFormatGutter.js';

    export let orientation: 'horizontal' | 'vertical' = 'vertical';

    var size: number = 400;
    var isResizing = false;
    var startPos = 0;
    var startSize = 0;
    var editorElement: HTMLDivElement;
    var editor: EditorView | null = null;
    var headerCount: number = 0;
    var emptyLineNumber: number = 0;
    var isFormatted: boolean = true;
    var rawBody: string = '';
    var contentType: string = '';

    function calculateResponseStructure(response: typeof $httpResponse) {
        if (!response) {
            headerCount = 0;
            emptyLineNumber = 0;
            return;
        }

        headerCount = Object.keys(response.headers).length;
        emptyLineNumber = 1 + headerCount + 1;
    }

    function canFormatContentType(ct: string): boolean {
        const lowerCt = ct.toLowerCase();
        return lowerCt.includes('json') || lowerCt.includes('xml') || lowerCt.includes('html');
    }

    function formatBody(body: string, ct: string): string {
        const lowerCt = ct.toLowerCase();

        try {
            if (lowerCt.includes('json')) {
                return JSON.stringify(JSON.parse(body), null, 2);
            }

            if (lowerCt.includes('xml') || lowerCt.includes('html')) {
                // Simple XML/HTML formatting
                const formatted = body
                    .replace(/>\s*</g, '>\n<')
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);

                let indent = 0;
                const result: string[] = [];

                for (const line of formatted) {
                    if (line.startsWith('</')) {
                        indent = Math.max(0, indent - 2);
                    }

                    result.push(' '.repeat(indent) + line);

                    if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>') && !line.includes('</')) {
                        indent += 2;
                    }
                }

                return result.join('\n');
            }
        } catch (e) {
            console.error('Error formatting body:', e);
        }

        return body;
    }

    function toggleFormat() {
        isFormatted = !isFormatted;
        updateEditor($httpResponse);
    }

    function createEditor() {
        if (!editorElement) return;

        const state = EditorState.create({
            doc: '',
            extensions: [
                lineNumbers({
                    formatNumber: (lineNo: number) => {
                        if (lineNo === 1) {
                            return '';
                        }
                        if (lineNo === emptyLineNumber) {
                            return '';
                        }
                        if (lineNo < emptyLineNumber) {
                            return String(lineNo - 1);
                        }
                        if (lineNo > emptyLineNumber) {
                            return String(lineNo - emptyLineNumber);
                        }
                        return '';
                    }
                }),
                responseFormatGutterExtension,
                createHttpLanguage('response'),
                httpSyntaxHighlighting,
                httpStatusCodeHighlighting,
                httpEditorTheme,
                httpBodyLineBackground,
                EditorView.lineWrapping,
                EditorView.editable.of(false),
                EditorState.readOnly.of(true)
            ]
        });

        editor = new EditorView({
            state,
            parent: editorElement
        });

        editor.dispatch({
            effects: setFormatToggleCallback.of(toggleFormat)
        });
    }

    function updateEditor(response: typeof $httpResponse) {
        if (!editor) return;

        calculateResponseStructure(response);

        if (!response) {
            editor.dispatch({
                changes: { from: 0, to: editor.state.doc.length, insert: '' },
                effects: setFormatStateEffect.of({
                    bodyStartLine: 0,
                    isFormatted: false,
                    canFormat: false
                })
            });
            return;
        }

        rawBody = response.body;
        contentType = response.headers['content-type'] || response.headers['Content-Type'] || '';
        const canFormat = canFormatContentType(contentType);

        const lines: string[] = [];
        lines.push(response.statusLine);

        for (const [key, value] of Object.entries(response.headers)) {
            lines.push(`${key}: ${value}`);
        }

        lines.push('');

        const bodyToUse = (isFormatted && canFormat) ? formatBody(rawBody, contentType) : rawBody;
        lines.push(bodyToUse);

        const text = lines.join('\n');
        const bodyStartLine = emptyLineNumber + 1;

        editor.dispatch({
            changes: { from: 0, to: editor.state.doc.length, insert: text },
            effects: setFormatStateEffect.of({
                bodyStartLine: bodyStartLine,
                isFormatted: isFormatted,
                canFormat: canFormat
            })
        });
    }

    function destroyEditor() {
        if (editor) {
            editor.destroy();
            editor = null;
        }
    }

    // ...existing code...


    function handleMouseDown(event: MouseEvent) {
        isResizing = true;
        startPos = orientation === 'vertical' ? event.clientX : event.clientY;
        startSize = size;
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }

    function handleMouseMove(event: MouseEvent) {
        if (!isResizing) return;

        const currentPos = orientation === 'vertical' ? event.clientX : event.clientY;
        const delta = startPos - currentPos;
        var newSize = startSize + delta;

        const minSize = 200;
        const maxSize = orientation === 'vertical' ? window.innerWidth - 400 : window.innerHeight - 400;

        if (newSize < minSize) newSize = minSize;
        if (newSize > maxSize) newSize = maxSize;

        size = newSize;
    }

    function handleMouseUp() {
        isResizing = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }

    $: headerTitle = $httpResponse ? `Response after ${$httpResponse.timeMs}ms` : 'Response';
    $: if (editor) {
        updateEditor($httpResponse);
    }

    onMount(() => {
        createEditor();

        window.electronAPI.onPreferencesLoad((preferences: Preferences) => {
            if (orientation === 'vertical' && preferences.responseWidth && preferences.responseWidth >= 200) {
                size = preferences.responseWidth;
            }
            if (orientation === 'horizontal' && preferences.responseHeight && preferences.responseHeight >= 200) {
                size = preferences.responseHeight;
            }
        });
        window.electronAPI.requestPreferences();

        window.addEventListener('beforeunload', () => {
            if (orientation === 'vertical') {
                window.electronAPI.savePreferences({responseWidth: size});
            }
            if (orientation === 'horizontal') {
                window.electronAPI.savePreferences({responseHeight: size});
            }
        });
    });

    onDestroy(() => {
        destroyEditor();
    });

    $: sizeStyle = orientation === 'vertical' ? `width: ${size}px;` : `height: ${size}px;`;
</script>

<button
    class="resizer"
    class:horizontal={orientation === 'horizontal'}
    class:vertical={orientation === 'vertical'}
    aria-label="Resize response panel"
    on:mousedown={handleMouseDown}
></button>
<div class="response-view" class:horizontal={orientation === 'horizontal'} class:vertical={orientation === 'vertical'} style={sizeStyle}>
    <div class="response-header">
        <span class="response-title">{headerTitle}</span>
    </div>
    <div class="response-content">
        <div class="editor-container" bind:this={editorElement}></div>
        {#if !$httpResponse}
            <p class="no-response">No response yet</p>
        {/if}
    </div>
</div>

<style>
    .resizer {
        background: var(--border-default);
        border: none;
        padding: 0;
        margin: 0;
        flex-shrink: 0;
    }

    .resizer.vertical {
        width: 6px;
        cursor: ew-resize;
        height: 100%;
    }

    .resizer.horizontal {
        height: 6px;
        cursor: ns-resize;
        width: 100%;
    }

    .resizer:hover {
        background: var(--border-hover);
    }

    .resizer:active {
        background: var(--interactive-primary);
    }

    .response-view {
        display: flex;
        flex-direction: column;
        background: var(--editor-bg);
        border: 1px solid var(--border-default);
        overflow: hidden;
    }

    .response-view.vertical {
        height: 100%;
    }

    .response-view.horizontal {
        width: 100%;
    }

    .response-header {
        padding: 0.75rem 1rem;
        background: var(--bg-secondary);
        border-bottom: 1px solid var(--border-default);
        font-weight: 600;
        color: var(--text-primary);
        flex-shrink: 0;
    }

    .response-title {
        font-size: 0.9rem;
    }

    .response-content {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        padding: 0;
        position: relative;
    }

    .editor-container {
        flex: 1;
        overflow: auto;
        background: var(--editor-bg);
    }

    .no-response {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        color: var(--text-secondary);
        font-style: italic;
        background: var(--editor-bg);
        pointer-events: none;
    }
</style>

