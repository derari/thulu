<script lang="ts">
    import {Trash2} from 'lucide-svelte';

    export let variables: Record<string, string>;
    export let onDelete: (key: string) => void;
</script>

{#if Object.keys(variables).length > 0}
    <div class="global-variables-section">
        <h2>Global Variables</h2>
        <div class="variables-table">
            {#each Object.entries(variables) as [key, value]}
                <div class="variable-row">
                    <div class="icon-cell inheritance-icon"></div>
                    <div class="icon-cell lock-icon"></div>
                    <div class="name-cell">
                        <span class="readonly-text">{key}</span>
                    </div>
                    <div class="value-cell">
                        <span class="readonly-text">{value}</span>
                    </div>
                    <div class="icon-cell delete-icon">
                        <button
                                type="button"
                                title="Delete global variable"
                                class="clickable-icon delete-button"
                                on:click={() => onDelete(key)}
                        >
                            <Trash2 size={16}/>
                        </button>
                    </div>
                </div>
            {/each}
        </div>
    </div>
{/if}

<style>
    .variables-table {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .variable-row {
        display: grid;
        grid-template-columns: 24px 24px 1fr 2fr 24px;
        gap: 0.75rem;
        align-items: center;
        padding: 0.5rem;
        border-radius: 4px;
        transition: background 0.15s ease;
    }

    .variable-row:hover {
        background: var(--sidebar-item-hover);
    }

    .icon-cell {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
    }

    .clickable-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 2px;
        border-radius: 3px;
        transition: background 0.15s ease, color 0.15s ease;
        border: none;
        background: transparent;
        color: inherit;
    }

    .clickable-icon:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .clickable-icon:hover:not(:disabled) {
        background: var(--sidebar-item-hover);
        color: var(--text-primary);
    }

    .clickable-icon:active:not(:disabled) {
        transform: scale(0.95);
    }

    .inheritance-icon {
        width: 24px;
    }

    .lock-icon {
        width: 24px;
    }

    .delete-icon {
        width: 24px;
    }

    .delete-button {
        color: var(--text-secondary);
    }

    .delete-button:hover:not(:disabled) {
        color: #ef4444;
        background: transparent;
    }

    .name-cell,
    .value-cell {
        display: flex;
        align-items: center;
    }

    .readonly-text {
        color: var(--text-secondary);
        font-size: 0.9rem;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        padding-left: 9px;
        margin-top: -1px;
    }

    .global-variables-section {
        margin-top: 3rem;
        padding-top: 2rem;
        border-top: 2px solid var(--border-default);
    }

    .global-variables-section h2 {
        margin: 0 0 1rem 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-primary);
    }
</style>
