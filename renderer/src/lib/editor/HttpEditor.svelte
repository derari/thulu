<script lang="ts">
    import {onDestroy, onMount} from 'svelte';
    import {EditorView, keymap, lineNumbers} from '@codemirror/view';
    import {Compartment, EditorState} from '@codemirror/state';
    import {defaultKeymap} from '@codemirror/commands';
    import {createHttpLanguage} from './httpLanguage.js';
    import {httpSyntaxHighlighting} from './httpHighlighting.js';
    import {httpEditorTheme} from './httpEditorTheme.js';
    import {createHttpBodyLineBackground} from './httpBodyLineBackground.js';
    import {createHttpActionGutterExtension} from './httpActionGutter.js';
    import {parseHttpFile} from './httpParser.js';
    import {toggleLineComment} from './commentUtils.js';
    import {openFile} from '../stores/openFile.js';
    import {httpResponse} from '../stores/httpResponse.js';
    import {currentCollection} from '../stores/currentCollection.js';
    import {globalVariables} from '../stores/globalVariables.js';
    import {isDarkMode} from '../stores/theme.js';
    import {
        type AvailableEnvironment,
        listAvailableEnvironments
    } from '../environmentParser.js';
    import {executeHttpRequest} from './httpRequestExecutor.js';

    export let content: string = '';
    export let sectionLineNumber: number | undefined = undefined;

    let editorView: EditorView | null = null;
    let editorElement: HTMLDivElement;
    let availableEnvironments: AvailableEnvironment[] = [];
    let selectedEnvironment: string = '';
    let relativeFilename: string = '';
    let isDirty: boolean = false;
    const httpLang = createHttpLanguage({mode: 'request'});
    const httpBodyBg = createHttpBodyLineBackground({mode: 'request'});

    const SELECTED_ENV_KEY = 'thulu:selectedEnvironment';

    if (typeof window !== 'undefined') {
        selectedEnvironment = loadSelectedEnvironment();
    }

    $: saveSelectedEnvironment(selectedEnvironment);

    $: isDirty = $openFile && content !== $openFile.content || false;

    $: if ($openFile) {
        loadEnvironments();
        relativeFilename = getRelativeFilename($openFile);
    }

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

    $: if (editorView && sectionLineNumber) {
        scrollToSection();
    }

    function saveSelectedEnvironment(envName: string) {
        if (envName) {
            localStorage.setItem(SELECTED_ENV_KEY, envName);
        } else {
            localStorage.removeItem(SELECTED_ENV_KEY);
        }
    }

    function loadSelectedEnvironment(): string {
        return localStorage.getItem(SELECTED_ENV_KEY) || '';
    }

    function handleSaveFile() {
        openFile.save();
    }

    function getIsMacPlatform(): boolean {
        return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    }

    function getRelativeFilename(file: any): string {
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

    async function loadEnvironments() {
        const file = $openFile;
        const collection = $currentCollection;

        if (!file || !collection) {
            availableEnvironments = [];
            selectedEnvironment = '';
            return;
        }

        try {
            const filePath = file.filePath;
            // Normalize path separators and find the last separator
            const normalizedPath = filePath.replace(/\\/g, '/');
            const lastSlashIndex = normalizedPath.lastIndexOf('/');
            const fileDir = lastSlashIndex > 0 ? filePath.substring(0, lastSlashIndex) : filePath;

            const previouslySelected = loadSelectedEnvironment();

            availableEnvironments = await listAvailableEnvironments(fileDir, collection);

            // Check if current selectedEnvironment (loaded from localStorage on init) is valid
            if (selectedEnvironment && availableEnvironments.some(env => env.name === selectedEnvironment)) {
                // Already set from localStorage initialization, just keep it
            } else if (previouslySelected && availableEnvironments.some(env => env.name === previouslySelected)) {
                selectedEnvironment = previouslySelected;
            } else if (availableEnvironments.length === 0) {
                selectedEnvironment = '';
            } else {
                selectedEnvironment = '';
            }
        } catch (error) {
            console.error('Failed to load environments:', error);
            availableEnvironments = [];
            selectedEnvironment = '';
        }
    }

    async function executeRequest(sectionLineNumber: number) {
        await openFile.save();

        const currentContent = editorView ? editorView.state.doc.toString() : content;
        const parsed = parseHttpFile(currentContent);

        if (!$openFile || !$currentCollection) {
            console.error('No file or collection loaded');
            return;
        }

        const filePath = $openFile.filePath;
        const normalizedPath = filePath.replace(/\\/g, '/');
        const lastSlashIndex = normalizedPath.lastIndexOf('/');
        const fileDirectory = lastSlashIndex > 0 ? filePath.substring(0, lastSlashIndex) : filePath;

        const collectionPath = $currentCollection.path;
        const collectionGlobalVars = globalVariables.get(collectionPath);

        try {
            const response = await executeHttpRequest({
                parsedFile: parsed,
                sectionLineNumber,
                selectedEnvironment,
                fileDirectory,
                collectionPath,
                globalVariables: collectionGlobalVars
            });

            if (response.scriptResults && response.scriptResults.length > 0) {
                console.log('Post-script results:', response.scriptResults);
                response.scriptResults.forEach((result, index) => {
                    if (result.success) {
                        console.log(`Script ${index + 1}: Success`);
                        if (result.logs.length > 0) {
                            console.log('  Logs:', result.logs);
                        }
                        if (result.globalVariableChanges) {
                            console.log('  Global variable changes:', result.globalVariableChanges);
                            for (const [key, value] of Object.entries(result.globalVariableChanges)) {
                                globalVariables.set(collectionPath, key, value);
                            }
                        }
                    } else {
                        console.error(`Script ${index + 1}: Failed -`, result.error);
                        if (result.logs.length > 0) {
                            console.log('  Logs:', result.logs);
                        }
                    }
                });
            }

            httpResponse.setResponse(response);
        } catch (error) {
            console.error('Request execution failed:', error);
            httpResponse.setResponse({
                statusLine: 'Error',
                headers: {},
                body: error instanceof Error ? error.message : String(error),
                timeMs: 0
            });
        }
    }


    function createEditor() {
        if (!editorElement) return;

        const parsed = parseHttpFile(content);
        httpLang.updateParsedFile(parsed);
        httpBodyBg.updateParsedFile(parsed);

        const currentThemeMode = $isDarkMode ? 'dark' : 'light';

        const langCompartment = new Compartment;

        const duplicateLineAndMoveDown = (view: EditorView) => {
            const { state } = view;
            const { from } = state.selection.main;
            const line = state.doc.lineAt(from);

            view.dispatch({
                changes: { from: line.to, insert: '\n' + line.text },
                selection: { anchor: line.to + 1 }
            });

            return true;
        };

        const duplicateLineAndMoveUp = (view: EditorView) => {
            const { state } = view;
            const { from } = state.selection.main;
            const line = state.doc.lineAt(from);

            view.dispatch({
                changes: { from: line.from, insert: line.text + '\n' },
                selection: { anchor: line.from }
            });

            return true;
        };

        const deleteCurrentLine = (view: EditorView) => {
            const { state } = view;
            const { from } = state.selection.main;
            const line = state.doc.lineAt(from);

            const deleteFrom = line.from;
            const deleteTo = Math.min(line.to + 1, state.doc.length);

            view.dispatch({
                changes: { from: deleteFrom, to: deleteTo, insert: '' }
            });

            return true;
        };

        const moveLineDown = (view: EditorView) => {
            const { state } = view;
            const { from } = state.selection.main;
            const line = state.doc.lineAt(from);
            const nextLine = line.to + 1 < state.doc.length ? state.doc.lineAt(line.to + 1) : null;

            if (!nextLine) {
                return true;
            }

            const lineText = state.doc.sliceString(line.from, line.to);
            const nextLineText = state.doc.sliceString(nextLine.from, nextLine.to);

            view.dispatch({
                changes: [
                    { from: line.from, to: line.to, insert: nextLineText },
                    { from: nextLine.from, to: nextLine.to, insert: lineText }
                ],
                selection: { anchor: nextLine.from }
            });

            return true;
        };

        const moveLineUp = (view: EditorView) => {
            const { state } = view;
            const { from } = state.selection.main;
            const line = state.doc.lineAt(from);

            if (line.from === 0) {
                return true;
            }

            const prevLine = state.doc.lineAt(line.from - 1);
            const lineText = state.doc.sliceString(line.from, line.to);
            const prevLineText = state.doc.sliceString(prevLine.from, prevLine.to);

            view.dispatch({
                changes: [
                    { from: prevLine.from, to: prevLine.to, insert: lineText },
                    { from: line.from, to: line.to, insert: prevLineText }
                ],
                selection: { anchor: prevLine.from }
            });

            return true;
        };

        const toggleLineCommentCurrentLine = (view: EditorView) => {
            const { state } = view;
            const { from } = state.selection.main;
            const line = state.doc.lineAt(from);
            toggleLineComment(view, line.number);
            return true;
        };

        const submitRequest = async (view: EditorView) => {
            const { state } = view;
            const { from } = state.selection.main;
            const cursorLine = state.doc.lineAt(from).number;

            var sectionForExecution = 1;
            for (const section of parsed.sections) {
                if (section.startLineNumber <= cursorLine) {
                    sectionForExecution = section.startLineNumber;
                }
            }

            await executeRequest(sectionForExecution);
            return true;
        };

        const saveShortcut = {
            key: 'Ctrl-s',
            run: (view: EditorView) => {
                handleSaveFile();
                return true;
            }
        };

        const duplicateLineShortcuts = [
            {
                key: 'Ctrl-d',
                run: duplicateLineAndMoveDown
            },
            {
                key: 'Ctrl-Shift-ArrowDown',
                run: duplicateLineAndMoveDown
            },
            {
                key: 'Ctrl-Shift-ArrowUp',
                run: duplicateLineAndMoveUp
            },
            {
                key: 'Ctrl-e',
                run: deleteCurrentLine
            },
            {
                key: 'Alt-Shift-ArrowUp',
                run: moveLineUp
            },
            {
                key: 'Alt-Shift-ArrowDown',
                run: moveLineDown
            },
            {
                key: 'Ctrl-/',
                run: toggleLineCommentCurrentLine
            },
            {
                key: 'Ctrl-Shift-c',
                run: toggleLineCommentCurrentLine
            },
            {
                key: 'Ctrl-Enter',
                run: submitRequest
            }
        ];

        const startState = EditorState.create({
            doc: content,
            extensions: [
                lineNumbers(),
                ...createHttpActionGutterExtension(executeRequest, parsed.sections, currentThemeMode),
                keymap.of([saveShortcut, ...duplicateLineShortcuts, ...defaultKeymap]),
                langCompartment.of(httpLang.language),
                httpSyntaxHighlighting,
                httpEditorTheme,
                httpBodyBg.plugin,
                EditorView.lineWrapping,
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        content = update.state.doc.toString();
                        const newParsed = parseHttpFile(content);
                        const newLang = httpLang.updateParsedFile(newParsed).language;
                        httpBodyBg.updateParsedFile(newParsed);
                        editorView?.dispatch({
                            effects: langCompartment.reconfigure(newLang)
                        })
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

        // Get line height to calculate offset for second line position
        const lineHeight = editorView.defaultLineHeight;

        editorView.dispatch({
            selection: {anchor: line.from},
            effects: EditorView.scrollIntoView(line.from, {
                y: "start",
                yMargin: lineHeight
            })
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
</script>

<div class="http-editor">
    <div class="editor-header">
        <span class="editor-title">{relativeFilename}{isDirty ? '*' : ''}</span>
        {#if availableEnvironments.length > 0}
            <select class="env-selector" bind:value={selectedEnvironment}>
                <option value="">No env selected</option>
                {#each availableEnvironments as env}
                    <option value={env.name}>
                        {env.name}
                    </option>
                {/each}
            </select>
        {/if}
    </div>
    <div bind:this={editorElement} class="editor-container"></div>
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
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
    }

    .editor-title {
        font-size: 0.9rem;
    }

    .env-selector {
        padding: 0.375rem 0.5rem;
        border: 1px solid var(--border-default);
        border-radius: 4px;
        background: var(--editor-bg);
        color: var(--text-primary);
        font-size: 0.85rem;
        cursor: pointer;
        min-width: 150px;
    }

    .env-selector:focus {
        outline: 2px solid var(--border-focus);
        outline-offset: 2px;
    }

    .editor-container {
        flex: 1;
        overflow: auto;
    }
</style>

