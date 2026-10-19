<script lang="ts">
    import {createEventDispatcher} from 'svelte';
    import {ChevronRight, Info, Settings, TriangleAlert} from 'lucide-svelte';
    import type {CollectionItem, EnvironmentConfig, HttpSection} from './collection';
    import {formatVerb, getItemKey, getVerbColor, INDENT_WIDTH} from './CollectionItemsUtils';
    import {deleteEnvironment, deleteItem, type NewItemKind} from './collectionOperations';
    import RowActionButton from './RowActionButton.svelte';
    import RowMenu from './RowMenu.svelte';
    import {itemMenu} from './stores/itemMenu';

    export let item: CollectionItem;
    /** Set when the row shows a request of the file instead of the file or folder itself */
    export let section: HttpSection | undefined = undefined;
    export let indent: number;
    export let isSection: boolean;
    export let hasChildren: boolean;
    export let collapsed: boolean;
    /** Key of the folder or file that the chevron collapses */
    export let toggleKey: string;
    export let environmentConfig: EnvironmentConfig | undefined = undefined;
    export let isRootEnvironment: boolean;

    const dispatch = createEventDispatcher<{
        select: { item: CollectionItem; section?: HttpSection };
        toggle: string;
        readme: { folderPath: string; title: string };
        newItem: { kind: NewItemKind; item: CollectionItem };
        newEnvironment: CollectionItem;
        rename: CollectionItem;
        openEnvironment: EnvironmentConfig;
    }>();

    const {confirmingKey} = itemMenu;

    $: itemKey = getItemKey(item, section);
    $: envKey = `${itemKey}:env`;
    // An environment of a folder without a file is shown on the folder row itself
    $: hasInlineEnv = !!environmentConfig && !isRootEnvironment && !!item.folderPath && !item.filePath;

    function select() {
        dispatch('select', {item, section});
    }

    function newItem(kind: NewItemKind) {
        itemMenu.close();
        dispatch('newItem', {kind, item});
    }

    function newEnvironment() {
        itemMenu.close();
        dispatch('newEnvironment', item);
    }

    function rename() {
        itemMenu.close();
        dispatch('rename', item);
    }
</script>

<div
        class="item"
        class:clickable={!!item.filePath}
        style="padding-left: {indent * INDENT_WIDTH}px;"
        role="button"
        tabindex={item.filePath ? 0 : -1}
        on:click={select}
        on:keydown={(e) => e.key === 'Enter' && select()}
>
    {#if isSection && section?.verb}
        <span class="verb-badge" style="color: {getVerbColor(section.verb)}">
            {formatVerb(section.verb)}
        </span>
    {:else if hasChildren}
        <span
                class="chevron"
                class:collapsed
                role="button"
                tabindex="0"
                on:click|stopPropagation={() => dispatch('toggle', toggleKey)}
                on:keydown|stopPropagation={(e) => {
                    if (e.key === 'Enter') {
                        dispatch('toggle', toggleKey);
                    }
                }}
        >
            <ChevronRight size={16}/>
        </span>
    {:else}
        <span class="chevron-spacer"></span>
    {/if}
    <span class="item-title">{item.title}</span>

    {#if !isSection && (item.folderPath || item.filePath)}
        <div class="item-actions">
            {#if item.hasReadme}
                <RowActionButton
                        title="Show README"
                        on:click={() => dispatch('readme', {folderPath: item.folderPath || '', title: item.title})}
                >
                    <Info size={16}/>
                </RowActionButton>
            {/if}

            {#if hasInlineEnv}
                {#if $confirmingKey === envKey}
                    <RowActionButton
                            variant="danger"
                            title="Confirm delete environment"
                            on:click={() => itemMenu.confirmDelete()}
                    >
                        <TriangleAlert size={16}/>
                    </RowActionButton>
                {:else}
                    <RowActionButton
                            title="Open Environment"
                            on:click={() => dispatch('openEnvironment', environmentConfig!)}
                    >
                        <Settings size={16}/>
                    </RowActionButton>
                {/if}
            {/if}

            <RowMenu {itemKey}>
                <button class="dropdown-item" on:click|stopPropagation={() => newItem('folder')}>
                    New Folder
                </button>
                {#if item.folderPath && !item.filePath}
                    <button class="dropdown-item" on:click|stopPropagation={() => newItem('request')}>
                        New Request
                    </button>
                {:else}
                    <button class="dropdown-item" on:click|stopPropagation={() => newItem('file')}>
                        New File
                    </button>
                {/if}
                {#if item.folderPath && !item.environments && item.items && item.items.length > 0}
                    <button class="dropdown-item" on:click|stopPropagation={newEnvironment}>
                        New Environment
                    </button>
                {/if}
                <div class="dropdown-separator"></div>
                <button class="dropdown-item" on:click|stopPropagation={rename}>
                    Rename
                </button>
                <div class="dropdown-separator"></div>
                {#if hasInlineEnv}
                    <button
                            class="dropdown-item delete-item"
                            on:click|stopPropagation={() => itemMenu.requestDelete(envKey, () => deleteEnvironment(environmentConfig!))}
                    >
                        Delete Environment
                    </button>
                {/if}
                {#if item.filePath}
                    <button
                            class="dropdown-item delete-item"
                            on:click|stopPropagation={() => itemMenu.requestDelete(itemKey, () => deleteItem(item.filePath!))}
                    >
                        Delete {#if item.folderPath}All Requests{/if}
                    </button>
                {/if}
                {#if item.folderPath}
                    <button
                            class="dropdown-item delete-item"
                            on:click|stopPropagation={() => itemMenu.requestDelete(itemKey, () => deleteItem(item.folderPath!))}
                    >
                        Delete {#if item.filePath}All Subgroups{/if}
                    </button>
                {/if}
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

    .item.clickable:hover {
        background: var(--sidebar-item-hover);
    }

    .chevron {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
        cursor: pointer;
        transition: transform 0.2s ease;
        transform: rotate(90deg);
    }

    .chevron.collapsed {
        transform: rotate(0deg);
    }

    .chevron:hover {
        color: var(--text-primary);
    }

    .chevron-spacer {
        display: inline-block;
        width: 16px;
    }

    .verb-badge {
        font-size: 0.55rem;
        font-weight: 600;
        padding: 2px 4px 0 4px;
        border: 1px solid currentColor;
        border-radius: 3px;
        font-family: 'Monaspace Neon', 'Consolas', 'Monaco', 'Courier New', monospace;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 32px;
        opacity: 0.8;
    }

    .item-actions {
        margin-left: auto;
        position: relative;
        display: flex;
        align-items: center;
    }
</style>
