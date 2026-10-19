<script lang="ts">
    import {Trash2} from 'lucide-svelte';
    import type {AvailableEnvironment} from './environmentParser';

    export let environments: AvailableEnvironment[];
    export let selected: string;
    /** Whether the selected environment is defined in the current folder, and can therefore be renamed or deleted */
    export let isLocallyDefined: boolean;
    /** Each handler returns an error message, or null when the operation succeeded */
    export let onCreate: (name: string) => Promise<string | null>;
    export let onRename: (name: string) => Promise<string | null>;
    export let onDelete: () => Promise<string | null>;

    let isCreating = false;
    let isRenaming = false;
    let newName = '';
    let errorMessage = '';

    function startCreate() {
        newName = '';
        errorMessage = '';
        isCreating = true;
    }

    function cancelCreate() {
        isCreating = false;
        newName = '';
        errorMessage = '';
    }

    async function confirmCreate() {
        const trimmedName = newName.trim();

        if (!trimmedName) {
            errorMessage = 'Environment name cannot be empty';
            return;
        }

        const error = await onCreate(trimmedName);
        if (error) {
            errorMessage = error;
            return;
        }
        cancelCreate();
    }

    function startRename() {
        if (!isLocallyDefined) {
            return;
        }

        newName = selected;
        errorMessage = '';
        isRenaming = true;
    }

    function cancelRename() {
        isRenaming = false;
        newName = '';
        errorMessage = '';
    }

    async function confirmRename() {
        const trimmedName = newName.trim();

        if (!trimmedName || trimmedName === selected) {
            cancelRename();
            return;
        }

        const error = await onRename(trimmedName);
        if (error) {
            errorMessage = error;
            return;
        }
        cancelRename();
    }

    async function deleteSelected() {
        if (!isLocallyDefined) {
            return;
        }

        if (!window.confirm(`Are you sure you want to delete the environment "${selected}"?`)) {
            return;
        }

        const error = await onDelete();
        if (error) {
            errorMessage = error;
        }
    }
</script>

<div class="selector">
    <label for="env-select">Select environment:</label>
    <div class="environment-controls">
        {#if isCreating}
            <input
                    type="text"
                    bind:value={newName}
                    class="rename-input"
                    placeholder="New environment name"
                    on:keydown={(e) => {
                    if (e.key === 'Enter') confirmCreate();
                    if (e.key === 'Escape') cancelCreate();
                }}
            />
            <button class="control-button confirm-button" on:click={confirmCreate}
                    title="Create environment">
                ✓
            </button>
            <button class="control-button cancel-button-inline" on:click={cancelCreate} title="Cancel">
                ✕
            </button>
        {:else if isRenaming}
            <input
                    type="text"
                    bind:value={newName}
                    class="rename-input"
                    on:keydown={(e) => {
                    if (e.key === 'Enter') confirmRename();
                    if (e.key === 'Escape') cancelRename();
                }}
            />
            <button class="control-button confirm-button" on:click={confirmRename} title="Confirm rename">
                ✓
            </button>
            <button class="control-button cancel-button-inline" on:click={cancelRename} title="Cancel">
                ✕
            </button>
        {:else}
            <select id="env-select" bind:value={selected}
                    disabled={environments.length === 0}>
                {#if environments.length === 0}
                    <option value="">No environments available</option>
                {:else}
                    {#each environments as env}
                        <option value={env.name}>
                            {env.name}
                            {#if !env.isFromCurrentFolder}{' '}({env.source}){/if}
                        </option>
                    {/each}
                {/if}
            </select>
            <button
                    class="control-button"
                    on:click={startCreate}
                    title="Create new environment"
            >
                +
            </button>
            <button
                    class="control-button"
                    on:click={startRename}
                    disabled={!isLocallyDefined || environments.length === 0}
                    title={environments.length === 0 ? "No environment selected" : (isLocallyDefined ? "Rename environment" : "Cannot rename inherited environment")}
            >
                ✎
            </button>
            <button
                    class="control-button delete-button"
                    on:click={deleteSelected}
                    disabled={!isLocallyDefined || environments.length === 0}
                    title={environments.length === 0 ? "No environment selected" : (isLocallyDefined ? "Delete environment" : "Cannot delete inherited environment")}
            >
                <Trash2 size={16}/>
            </button>
        {/if}
    </div>
    {#if errorMessage}
        <div class="error-message">{errorMessage}</div>
    {/if}
</div>

<style>
    .selector {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .selector label {
        font-weight: 500;
        color: var(--text-primary);
    }

    .environment-controls {
        display: flex;
        gap: 0.5rem;
        align-items: center;
    }

    .environment-controls select {
        flex: 1;
    }

    .selector select {
        padding: 0.5rem;
        border: 1px solid var(--border-default);
        border-radius: 4px;
        background: var(--editor-bg);
        color: var(--text-primary);
        font-size: 1rem;
        cursor: pointer;
    }

    .selector select:focus {
        outline: 2px solid var(--border-focus);
        outline-offset: 2px;
    }

    .selector select:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .control-button {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--border-default);
        border-radius: 4px;
        background: var(--editor-bg);
        color: var(--text-primary);
        font-size: 1rem;
        cursor: pointer;
        transition: background 0.15s ease;
        min-width: 36px;
    }

    .control-button:hover:not(:disabled) {
        background: var(--sidebar-item-hover);
    }

    .control-button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .delete-button:hover:not(:disabled) {
        background: #ef4444;
        color: white;
        border-color: #ef4444;
    }

    .confirm-button:hover:not(:disabled) {
        background: var(--state-success);
        color: white;
        border-color: var(--state-success);
    }

    .cancel-button-inline:hover:not(:disabled) {
        background: #ef4444;
        color: white;
        border-color: #ef4444;
    }

    .rename-input {
        flex: 1;
        padding: 0.5rem;
        border: 1px solid var(--border-default);
        border-radius: 4px;
        background: var(--editor-bg);
        color: var(--text-primary);
        font-size: 1rem;
    }

    .rename-input:focus {
        outline: 2px solid var(--border-focus);
        outline-offset: 2px;
    }

    .error-message {
        color: #ef4444;
        font-size: 0.875rem;
        margin-top: 0.25rem;
    }
</style>
