<script lang="ts">
    export let currentName: string;
    export let showFolderCheckbox: boolean = false;
    export let showFileCheckbox: boolean = false;
    export let onConfirm: (newName: string, renameFolder: boolean, renameFile: boolean) => void;
    export let onCancel: () => void;

    let newName = currentName;
    let renameFolder = showFolderCheckbox;
    let renameFile = showFileCheckbox;

    $: showCheckboxes = showFolderCheckbox && showFileCheckbox;
    $: isOkDisabled = !newName.trim() || (showCheckboxes && !renameFolder && !renameFile);

    function handleConfirm() {
        if (isOkDisabled) return;
        onConfirm(newName, renameFolder, renameFile);
    }

    function handleCancel() {
        onCancel();
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            handleConfirm();
            return;
        }
        if (event.key === 'Escape') {
            handleCancel();
            return;
        }
    }
</script>

<div class="modal-backdrop" on:click={handleCancel} role="button" tabindex="-1" on:keydown={handleKeydown}>
    <div class="modal" on:click|stopPropagation role="dialog" tabindex="0" on:keydown={handleKeydown}>
        <h2>Rename</h2>
        <div class="modal-content">
            <input
                type="text"
                bind:value={newName}
                on:keydown={handleKeydown}
                class="name-input"
            />

            {#if showCheckboxes}
                <div class="checkboxes">
                    <label>
                        <input type="checkbox" bind:checked={renameFolder} />
                        Rename folder
                    </label>
                    <label>
                        <input type="checkbox" bind:checked={renameFile} />
                        Rename file
                    </label>
                </div>
            {/if}
        </div>
        <div class="modal-actions">
            <button on:click={handleConfirm} disabled={isOkDisabled}>OK</button>
            <button on:click={handleCancel}>Cancel</button>
        </div>
    </div>
</div>

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .modal {
        background: var(--bg-primary);
        color: var(--text-primary);
        padding: 1.5rem;
        border-radius: 8px;
        min-width: 300px;
        max-width: 500px;
        border: 1px solid var(--border-default);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    h2 {
        margin-top: 0;
        margin-bottom: 1rem;
        color: var(--text-primary);
        font-size: 1.2rem;
    }

    .modal-content {
        margin-bottom: 1rem;
    }

    .name-input {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid var(--border-default);
        border-radius: 4px;
        background: var(--bg-secondary);
        color: var(--text-primary);
        font-size: 0.9rem;
        font-family: inherit;
    }

    .name-input:focus {
        outline: none;
        border-color: var(--interactive-primary);
    }

    .checkboxes {
        margin-top: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .checkboxes label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        color: var(--text-primary);
    }

    .checkboxes input[type="checkbox"] {
        cursor: pointer;
    }

    .modal-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
    }

    button {
        padding: 0.5rem 1rem;
        border: 1px solid var(--border-default);
        background: var(--interactive-secondary);
        color: var(--text-primary);
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
    }

    button:hover {
        background: var(--bg-tertiary);
    }

    button:first-child {
        background: var(--interactive-primary);
        border-color: var(--interactive-primary);
    }

    button:first-child:hover {
        opacity: 0.9;
    }

    button:first-child:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    button:first-child:disabled:hover {
        opacity: 0.5;
    }
</style>

