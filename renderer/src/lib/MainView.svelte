<script lang="ts">
    import {onMount} from 'svelte';
    import CollectionsOverview from './CollectionsOverview.svelte';
    import HttpEditor from '$lib/editor/HttpEditor.svelte';
    import ResponseView from './ResponseView.svelte';
    import EnvironmentsView from './EnvironmentsView.svelte';
    import {openFile} from './stores/openFile.js';
    import {openEnvironments} from './stores/openEnvironments.js';

    let editorContent: string = '';
    let windowWidth: number = 1200;
    let orientation: 'horizontal' | 'vertical' = 'vertical';

    $: orientation = windowWidth < 1200 ? 'horizontal' : 'vertical';

    $: if ($openFile) {
        editorContent = $openFile.content;
    }

    $: if ($openFile && editorContent !== $openFile.content) {
        openFile.updateContent(editorContent);
    }

    onMount(() => {
        window.addEventListener('beforeunload', async () => {
            await openFile.save();
        });
    });
</script>

<svelte:window bind:innerWidth={windowWidth}/>

<div class="main-view">
    {#if $openFile}
        <div class="editor-layout" class:horizontal={orientation === 'horizontal'}
             class:vertical={orientation === 'vertical'}>
            <div class="editor-panel">
                <HttpEditor
                        bind:content={editorContent}
                        sectionLineNumber={$openFile.sectionLineNumber}
                />
            </div>
            <ResponseView {orientation}/>
        </div>
    {:else if $openEnvironments}
        <EnvironmentsView
                environmentConfig={$openEnvironments.environmentConfig}
                collectionRoot={$openEnvironments.collectionRoot}
        />
    {:else}
        <CollectionsOverview/>
    {/if}
</div>

<style>
    .main-view {
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: var(--bg-primary);
    }

    .editor-layout {
        width: 100%;
        height: 100%;
        display: flex;
    }

    .editor-layout.vertical {
        flex-direction: row;
    }

    .editor-layout.horizontal {
        flex-direction: column;
    }

    .editor-panel {
        flex: 1;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
    }
</style>

