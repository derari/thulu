<script lang="ts">
    import {onMount} from 'svelte';
    import { currentCollectionName, hasCurrentCollection } from './stores/currentCollection.js';
    import { openFile } from './stores/openFile.js';
    import { openEnvironments } from './stores/openEnvironments.js';
    import CollectionItems from './CollectionItems.svelte';

    var width: number = 200;
    var isResizing = false;
    var startX = 0;
    var startWidth = 200;

    async function handleCollectionNameClick() {
        await openFile.save();
        openFile.close();
        openEnvironments.close();
    }

    function handleMouseDown(event: MouseEvent) {
        isResizing = true;
        startX = event.clientX;
        startWidth = width;
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }

    function handleMouseMove(event: MouseEvent) {
        if (!isResizing) return;
        var newWidth = startWidth + (event.clientX - startX);
        if (newWidth < 50) newWidth = 50;
        if (newWidth > 600) newWidth = 600;
        width = newWidth;
    }

    function handleMouseUp() {
        isResizing = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }

    onMount(() => {
        window.electronAPI.onPreferencesLoad((preferences: Preferences) => {
            if (preferences.sidebarWidth && preferences.sidebarWidth >= 50) {
                width = preferences.sidebarWidth;
            }
        });
        window.electronAPI.requestPreferences();

        window.addEventListener('beforeunload', () => {
            window.electronAPI.savePreferences({sidebarWidth: width});
        });
    });
</script>

{#if $hasCurrentCollection}
<div class="sidebar" style="width: {width}px; min-width: 50px; max-width: 600px;">
    <div
        class="sidebar-header"
        role="button"
        tabindex="0"
        on:click={handleCollectionNameClick}
        on:keydown={(e) => e.key === 'Enter' && handleCollectionNameClick()}
    >
        {$currentCollectionName}
    </div>
    <CollectionItems />
    <slot/>
</div>
<button class="sidebar-resizer" aria-label="Resize sidebar" on:mousedown={handleMouseDown}></button>
{/if}

<style>
    .sidebar {
        height: 100%;
        background: var(--sidebar-bg);
        border-right: 1px solid var(--border-default);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .sidebar-header {
        font-weight: bold;
        padding: 1rem;
        border-bottom: 1px solid var(--border-default);
        background: var(--sidebar-header);
        color: var(--text-primary);
        flex-shrink: 0;
        cursor: pointer;
        user-select: none;
    }

    .sidebar-header:hover {
        background: var(--sidebar-item-hover);
    }

    .sidebar-resizer {
        width: 6px;
        cursor: ew-resize;
        background: var(--border-default);
        height: 100%;
        z-index: 10;
        border: none;
        padding: 0;
        margin: 0;
    }
</style>
