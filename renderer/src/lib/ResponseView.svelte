<script lang="ts">
    import {onDestroy, onMount} from 'svelte';
    import {EditorView, lineNumbers} from '@codemirror/view';
    import {EditorState} from '@codemirror/state';
    import {httpResponse} from './stores/httpResponse.js';
    import {currentCollection} from './stores/currentCollection.js';
    import {createHttpLanguage} from './editor/httpLanguage.js';
    import {parseHttpResponse} from './editor/httpParser.js';
    import {httpSyntaxHighlighting} from './editor/httpHighlighting.js';
    import {httpEditorTheme} from './editor/httpEditorTheme.js';
    import {createHttpBodyLineBackground} from './editor/httpBodyLineBackground.js';
    import {httpStatusCodeHighlighting} from './editor/httpStatusCodeHighlighting.js';
    import {
        responseFormatGutterExtension,
        setFormatStateEffect,
        setFormatToggleCallback
    } from './editor/responseFormatGutter.js';
    import HistoryView from './HistoryView.svelte';

    export let orientation: 'horizontal' | 'vertical' = 'vertical';

    var activeTab: 'response' | 'request' = 'response';
    var showHistory: boolean = false;
    var size: number = 400;
    var isResizing = false;
    var startPos = 0;
    var startSize = 0;
    var editorElement: HTMLDivElement;
    var editor: EditorView | null = null;
    var requestEditorElement: HTMLDivElement;
    var requestEditor: EditorView | null = null;
    var httpLang: ReturnType<typeof createHttpLanguage> = createHttpLanguage({mode: 'response'});
    var httpBodyBg = createHttpBodyLineBackground({mode: 'response'});
    var requestHttpLang: ReturnType<typeof createHttpLanguage> = createHttpLanguage({mode: 'request'});
    var requestHttpBodyBg = createHttpBodyLineBackground({mode: 'request'});
    var headerCount: number = 0;
    var emptyLineNumber: number = 0;
    var redirectPreambleLines: number = 0;
    var isFormatted: boolean = true;
    var rawBody: string = '';
    var contentType: string = '';
    var previousResponseId: string | null = null;

    function calculateResponseStructure(response: typeof $httpResponse) {
        if (!response) {
            headerCount = 0;
            emptyLineNumber = 0;
            redirectPreambleLines = 0;
            return;
        }

        redirectPreambleLines = response.redirects && response.redirects.length > 0
            ? response.redirects.length + 2  // "Redirects" header + N hop lines + empty separator
            : 0;
        headerCount = Object.keys(response.headers).length;
        // redirectPreambleLines + status line + headers + empty line
        emptyLineNumber = redirectPreambleLines + 1 + headerCount + 1;
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

    function createRequestEditor() {
        if (!requestEditorElement) return;

        const state = EditorState.create({
            doc: '',
            extensions: [
                lineNumbers(),
                requestHttpLang.language,
                httpSyntaxHighlighting,
                httpEditorTheme,
                requestHttpBodyBg.plugin,
                EditorView.lineWrapping,
                EditorView.editable.of(false),
                EditorState.readOnly.of(true)
            ]
        });

        requestEditor = new EditorView({
            state,
            parent: requestEditorElement
        });
    }

    function updateRequestEditor(response: typeof $httpResponse) {
        if (!requestEditor) return;

        if (!response?.resolvedRequest) {
            requestEditor.dispatch({
                changes: {from: 0, to: requestEditor.state.doc.length, insert: ''}
            });
            return;
        }

        const req = response.resolvedRequest;
        const lines: string[] = [];
        lines.push(`${req.method} ${req.url}`);
        for (const [key, value] of Object.entries(req.headers)) {
            lines.push(`${key}: ${value}`);
        }
        lines.push('');
        if (req.body) {
            lines.push(req.body);
        }
        const text = lines.join('\n');

        requestEditor.dispatch({
            changes: {from: 0, to: requestEditor.state.doc.length, insert: text},
            effects: EditorView.scrollIntoView(0, {y: 'start'})
        });
    }

    function createEditor() {
        if (!editorElement) return;

        const state = EditorState.create({
            doc: '',
            extensions: [
                lineNumbers({
                    formatNumber: (lineNo: number) => {
                        // Redirect preamble lines (redirect hops + empty separator) — no line numbers
                        if (lineNo <= redirectPreambleLines) {
                            return '';
                        }
                        // Status line
                        if (lineNo === redirectPreambleLines + 1) {
                            return '';
                        }
                        if (lineNo === emptyLineNumber) {
                            return '';
                        }
                        if (lineNo < emptyLineNumber) {
                            return String(lineNo - redirectPreambleLines - 1);
                        }
                        if (lineNo > emptyLineNumber) {
                            return String(lineNo - emptyLineNumber);
                        }
                        return '';
                    }
                }),
                responseFormatGutterExtension,
                httpLang.language,
                httpSyntaxHighlighting,
                httpStatusCodeHighlighting,
                httpEditorTheme,
                httpBodyBg.plugin,
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
                changes: {from: 0, to: editor.state.doc.length, insert: ''},
                effects: setFormatStateEffect.of({
                    bodyStartLine: 0,
                    isFormatted: false,
                    canFormat: false
                })
            });
            previousResponseId = null;
            return;
        }

        // Create a unique ID for this response based on timestamp and status
        const currentResponseId = `${response.timeMs}-${response.statusLine}`;
        const isNewResponse = previousResponseId !== currentResponseId;
        previousResponseId = currentResponseId;

        rawBody = response.body;
        contentType = response.headers['content-type'] || response.headers['Content-Type'] || '';
        const canFormat = canFormatContentType(contentType);

        const lines: string[] = [];

        // Redirect preamble
        if (response.redirects && response.redirects.length > 0) {
            lines.push('Redirects');
            for (const hop of response.redirects) {
                lines.push(`-> ${hop.status}: ${hop.method} ${hop.url}`);
            }
            lines.push('');
        }

        lines.push(response.statusLine);

        for (const [key, value] of Object.entries(response.headers)) {
            lines.push(`${key}: ${value}`);
        }

        if (rawBody) {
            lines.push('');

            const bodyToUse = (isFormatted && canFormat) ? formatBody(rawBody, contentType) : rawBody;
            lines.push(bodyToUse);
        }

        const text = lines.join('\n');
        const bodyStartLine = emptyLineNumber + 1;

        // Parse the response — parseHttpResponse now scans for the first HTTP/... line,
        // so it works correctly whether or not a redirect preamble is present.
        const parsedResponse = parseHttpResponse(text);
        httpLang.updateParsedResponse(parsedResponse);
        httpBodyBg.updateParsedResponse(parsedResponse);

        editor.dispatch({
            changes: {from: 0, to: editor.state.doc.length, insert: text},
            effects: setFormatStateEffect.of({
                bodyStartLine: bodyStartLine,
                isFormatted: isFormatted,
                canFormat: canFormat
            })
        });

        // Scroll to top if this is a new response
        if (isNewResponse) {
            requestAnimationFrame(() => {
                if (editor) {
                    editor.dispatch({
                        effects: EditorView.scrollIntoView(0, {y: "start"})
                    });
                }
            });
        }
    }

    function destroyEditor() {
        if (editor) {
            editor.destroy();
            editor = null;
        }
        if (requestEditor) {
            requestEditor.destroy();
            requestEditor = null;
        }
    }

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

    $: headerTitle = $httpResponse ? `Completed in ${$httpResponse.timeMs}ms` : '';
    $: if (editor) {
        updateEditor($httpResponse);
    }
    $: if (requestEditor) {
        updateRequestEditor($httpResponse);
    }
    $: if ($httpResponse) {
        activeTab = 'response';
    }

    onMount(() => {
        createEditor();
        createRequestEditor();

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
        aria-label="Resize response panel"
        class="resizer"
        class:horizontal={orientation === 'horizontal'}
        class:vertical={orientation === 'vertical'}
        on:mousedown={handleMouseDown}
></button>
<div class="response-view" class:horizontal={orientation === 'horizontal'} class:vertical={orientation === 'vertical'}
     style={sizeStyle}>
    <div class="response-header">
        {#if showHistory}
            <button class="back-btn" on:click={() => showHistory = false}>← Back</button>
            <span class="response-title">History</span>
        {:else}
            {#if $httpResponse}
                <div class="tabs">
                    <button class="tab" class:active={activeTab === 'response'} on:click={() => activeTab = 'response'}>Response</button>
                    <button class="tab" class:active={activeTab === 'request'} on:click={() => activeTab = 'request'}>Request</button>
                </div>
                <span class="response-title">{headerTitle}</span>
            {/if}
        {/if}
        {#if $currentCollection && !showHistory}
            <button class="history-btn" on:click={() => showHistory = true}>History</button>
        {/if}
    </div>
    <div class="response-content">
        {#if showHistory && $currentCollection}
            <HistoryView
                collectionPath={$currentCollection.path}
                onSelect={() => { showHistory = false; activeTab = 'response'; }}
            />
        {:else if !$httpResponse}
            <p class="no-response">No response yet</p>
        {/if}
        <div bind:this={editorElement} class="editor-container" class:hidden={showHistory || !$httpResponse || activeTab !== 'response'}></div>
        <div bind:this={requestEditorElement} class="editor-container" class:hidden={showHistory || !$httpResponse || activeTab !== 'request'}></div>
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
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .history-btn {
        margin-left: auto;
        background: none;
        border: 1px solid transparent;
        border-radius: 4px;
        padding: 0.2rem 0.65rem;
        font-size: 0.8rem;
        font-weight: 500;
        color: var(--text-secondary);
        cursor: pointer;
    }

    .history-btn:hover {
        color: var(--text-primary);
        background: var(--bg-hover, var(--border-default));
    }

    .back-btn {
        background: none;
        border: none;
        padding: 0.2rem 0.4rem;
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--interactive-primary);
        cursor: pointer;
    }

    .back-btn:hover {
        opacity: 0.8;
    }

    .tabs {
        display: flex;
        gap: 0.25rem;
    }

    .tab {
        background: none;
        border: 1px solid transparent;
        border-radius: 4px;
        padding: 0.2rem 0.65rem;
        font-size: 0.8rem;
        font-weight: 500;
        color: var(--text-secondary);
        cursor: pointer;
    }

    .tab:hover {
        color: var(--text-primary);
        background: var(--bg-hover, var(--border-default));
    }

    .tab.active {
        color: var(--interactive-primary);
        border-color: var(--interactive-primary);
        background: none;
    }

    .editor-container.hidden {
        display: none;
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

