<script lang="ts">
    import {createEventDispatcher} from 'svelte';
    import {Settings} from 'lucide-svelte';
    import type {EnvironmentConfig} from './collection';
    import {INDENT_WIDTH} from './CollectionItemsUtils';
    import {deleteEnvironment} from './collectionOperations';
    import RowMenu from './RowMenu.svelte';
    import {itemMenu} from './stores/itemMenu';

    export let title: string;
    export let indent: number;
    export let environmentConfig: EnvironmentConfig | undefined;
    /** The environments of the collection root can be opened but not deleted */
    export let isRoot: boolean;

    const dispatch = createEventDispatcher<{ open: EnvironmentConfig }>();

    function open() {
        if (environmentConfig) {
            dispatch('open', environmentConfig);
        }
    }

    function deleteThis() {
        itemMenu.requestDelete(`env:${environmentConfig!.folderPath}`, () => deleteEnvironment(environmentConfig!));
    }
</script>

<div
        class="item environment-item"
        class:clickable={!!environmentConfig}
        style="padding-left: {indent * INDENT_WIDTH}px;"
        role="button"
        tabindex="0"
        on:click={open}
        on:keydown={(e) => { if (e.key === 'Enter') open() }}
>
    <span class="environment-icon">
        <Settings size={16}/>
    </span>
    <span class="item-title">{title}</span>

    {#if !isRoot && environmentConfig}
        <div class="item-actions">
            <RowMenu itemKey={`env:${environmentConfig.folderPath}`}>
                <button class="dropdown-item delete-item" on:click|stopPropagation={deleteThis}>
                    Delete
                </button>
            </RowMenu>
        </div>
    {/if}
</div>

<style>
    .item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--text-primary);
        position: relative;
    }

    .item-title {
        padding: 0.35rem 0;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .item.clickable {
        cursor: pointer;
    }

    .environment-item {
        color: var(--text-secondary);
        font-style: italic;
    }

    .environment-item.clickable:hover {
        background: var(--sidebar-item-hover);
    }

    .environment-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
    }

    .item-actions {
        margin-left: auto;
        position: relative;
        display: flex;
        align-items: center;
    }
</style>
