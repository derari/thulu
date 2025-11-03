<script lang="ts">
    export let onSave: () => Promise<void>;
    export let onDiscard: () => void;
    export let onCancel: () => void;

    let saving = false;

    async function handleSave() {
        saving = true;
        try {
            await onSave();
        } finally {
            saving = false;
        }
    }
</script>

<div class="modal-backdrop" on:click={onCancel} role="presentation">
    <div class="modal" on:click|stopPropagation on:keydown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
        <div class="modal-header">
            <h2>Unsaved Changes</h2>
        </div>

        <div class="modal-content">
            <p>You have unsaved changes. What would you like to do?</p>
        </div>

        <div class="modal-actions">
            <button class="save-button" on:click={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
            </button>
            <button class="discard-button" on:click={onDiscard} disabled={saving}>
                Discard Changes
            </button>
            <button class="cancel-button" on:click={onCancel} disabled={saving}>
                Cancel
            </button>
        </div>
    </div>
</div>

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .modal {
        background: var(--editor-bg);
        border: 1px solid var(--border-default);
        border-radius: 8px;
        min-width: 400px;
        max-width: 500px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .modal-header {
        padding: 1.5rem;
        border-bottom: 1px solid var(--border-default);
    }

    .modal-header h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-primary);
    }

    .modal-content {
        padding: 1.5rem;
    }

    .modal-content p {
        margin: 0;
        color: var(--text-primary);
        line-height: 1.5;
    }

    .modal-actions {
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--border-default);
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
    }

    button {
        padding: 0.5rem 1.5rem;
        border: 1px solid var(--border-default);
        border-radius: 4px;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .cancel-button {
        background: var(--editor-bg);
        color: var(--text-primary);
    }

    .cancel-button:hover:not(:disabled) {
        background: var(--sidebar-item-hover);
    }

    .discard-button {
        background: var(--editor-bg);
        color: #ef4444;
        border-color: #ef4444;
    }

    .discard-button:hover:not(:disabled) {
        background: #ef4444;
        color: white;
    }

    .save-button {
        background: var(--text-primary);
        color: var(--editor-bg);
        border-color: var(--text-primary);
    }

    .save-button:hover:not(:disabled) {
        opacity: 0.9;
    }
</style>

