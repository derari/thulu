<script lang="ts">
    import {onMount} from 'svelte';
    import {currentCollection} from './stores/currentCollection.js';

    var collections: CollectionMetaData[] = [];
    var currentCollectionPath: string | undefined;

    function handleCollectionClick(collectionPath: string, collectionName: string) {
        window.electronAPI.savePreferences({currentCollectionPath: collectionPath});
        currentCollection.loadCollection(collectionPath, collectionName);
    }

    function handleRemoveCollection(event: MouseEvent, collectionPath: string) {
        event.stopPropagation();

        if (currentCollectionPath === collectionPath) {
            currentCollection.clear();
            currentCollectionPath = undefined;
        }

        const updatedCollections = collections.filter(c => c.path !== collectionPath);
        collections = updatedCollections;

        const saveData: Partial<Preferences> = {
            collections: updatedCollections
        };

        if (currentCollectionPath === collectionPath) {
            saveData.currentCollectionPath = undefined;
        }

        window.electronAPI.savePreferences(saveData);
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
                    <div class="collection-content">
                        <h2>{collection.name}</h2>
                        <p class="collection-path">{collection.path}</p>
                    </div>
                    <button
                            class="remove-button"
                            on:click={(e) => handleRemoveCollection(e, collection.path)}
                            title="Remove collection"
                            aria-label="Remove collection"
                    >×</button>
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
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
    }

    .collection-item:hover {
        background: var(--bg-tertiary);
        border-color: var(--border-hover);
    }

    .collection-item.active {
        background: var(--sidebar-item-active);
        border-color: var(--interactive-primary);
    }

    .collection-content {
        flex: 1;
        min-width: 0;
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
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .remove-button {
        flex-shrink: 0;
        width: 2rem;
        height: 2rem;
        border: 1px solid var(--border-default);
        border-radius: 4px;
        background: transparent;
        color: var(--text-secondary);
        font-size: 1.5rem;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        padding: 0;
    }

    .remove-button:hover {
        background: var(--interactive-danger);
        border-color: var(--interactive-danger);
        color: white;
    }
</style>

