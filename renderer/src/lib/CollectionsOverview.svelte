<script lang="ts">
    import {onMount} from 'svelte';
    import { currentCollection } from './stores/currentCollection.js';

    var collections: CollectionMetaData[] = [];
    var currentCollectionPath: string | undefined;

    function handleCollectionClick(collectionPath: string, collectionName: string) {
        window.electronAPI.savePreferences({currentCollectionPath: collectionPath});
        currentCollection.loadCollection(collectionPath, collectionName);
    }

    onMount(() => {
        window.electronAPI.onPreferencesLoad((preferences: Preferences) => {
            if (preferences.collections) {
                collections = preferences.collections;
            }
            currentCollectionPath = preferences.currentCollectionPath;

            if (preferences.currentCollectionPath && preferences.collections) {
                const current = preferences.collections.find(
                    c => c.path === preferences.currentCollectionPath
                );
                if (current) {
                    currentCollection.loadCollection(current.path, current.name);
                }
            }
        });
        window.electronAPI.requestPreferences();
    });
</script>

<div class="collections-overview">
    <h1>Collections</h1>

    {#if collections.length === 0}
        <p class="empty-state">No collections yet. Open a collection from the File menu.</p>
    {:else}
        <div class="collections-list">
            {#each collections as collection}
                <div
                    class="collection-item"
                    class:active={currentCollectionPath === collection.path}
                    role="button"
                    tabindex="0"
                    on:click={() => handleCollectionClick(collection.path, collection.name)}
                    on:keydown={(e) => e.key === 'Enter' && handleCollectionClick(collection.path, collection.name)}
                >
                    <h2>{collection.name}</h2>
                    <p class="collection-path">{collection.path}</p>
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .collections-overview {
        padding: 2rem;
        background: var(--bg-primary);
        color: var(--text-primary);
    }

    h1 {
        margin-bottom: 2rem;
        color: var(--text-primary);
    }

    .empty-state {
        color: var(--text-secondary);
        font-style: italic;
    }

    .collections-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .collection-item {
        padding: 1rem;
        border: 1px solid var(--border-default);
        border-radius: 4px;
        background: var(--bg-secondary);
        cursor: pointer;
        transition: all 0.2s;
    }

    .collection-item:hover {
        background: var(--bg-tertiary);
        border-color: var(--border-hover);
    }

    .collection-item.active {
        background: var(--sidebar-item-active);
        border-color: var(--interactive-primary);
    }

    .collection-item h2 {
        margin: 0 0 0.5rem 0;
        font-size: 1.2rem;
        color: var(--text-primary);
    }

    .collection-path {
        margin: 0;
        color: var(--text-secondary);
        font-size: 0.9rem;
        font-family: monospace;
    }
</style>

