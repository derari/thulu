<script lang="ts">
    import {EllipsisVertical, TriangleAlert} from 'lucide-svelte';
    import RowActionButton from './RowActionButton.svelte';
    import {itemMenu} from './stores/itemMenu';

    /** Identifies the row in the itemMenu store */
    export let itemKey: string;
    export let confirmTitle = 'Confirm delete';

    const {openKey, confirmingKey} = itemMenu;
</script>

{#if $confirmingKey === itemKey}
    <RowActionButton variant="danger" title={confirmTitle} on:click={() => itemMenu.confirmDelete()}>
        <TriangleAlert size={16}/>
    </RowActionButton>
{:else}
    <RowActionButton title="More options" on:click={() => itemMenu.toggle(itemKey)}>
        <EllipsisVertical size={16}/>
    </RowActionButton>

    {#if $openKey === itemKey}
        <div class="dropdown-menu">
            <slot/>
        </div>
    {/if}
{/if}

<style>
    .dropdown-menu {
        position: absolute;
        top: 100%;
        right: -10px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-default);
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        z-index: 100;
        min-width: 140px;
        margin-top: 0.25rem;
    }

    /* The menu entries are written by the rows that use this component */
    .dropdown-menu :global(.dropdown-item) {
        width: 100%;
        background: transparent;
        border: none;
        color: var(--text-primary);
        padding: 0.5rem 0.75rem;
        text-align: left;
        cursor: pointer;
        font-size: 0.75rem;
        transition: background 0.2s;
    }

    .dropdown-menu :global(.dropdown-item:hover) {
        background: var(--bg-tertiary);
    }

    .dropdown-menu :global(.dropdown-item.delete-item) {
        color: var(--interactive-danger);
    }

    .dropdown-menu :global(.dropdown-item.delete-item:hover) {
        background: var(--interactive-danger);
        color: white;
    }

    .dropdown-menu :global(.dropdown-separator) {
        height: 1px;
        background: var(--border-default);
        margin: 0.25rem 0;
    }
</style>
