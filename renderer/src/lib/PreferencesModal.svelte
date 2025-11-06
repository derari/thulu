<script lang="ts">
    import {onMount} from 'svelte';

    export var onClose: () => void;

    var appearanceOptions = [
        {value: 'system', label: 'System'},
        {value: 'dark', label: 'Dark'},
        {value: 'light', label: 'Light'}
    ];

    var selectedAppearance: string = 'system';

    function savePreferences() {
        window.electronAPI.savePreferences({appearance: selectedAppearance} as Preferences);
        onClose();
    }

    function cancelPreferences() {
        onClose();
    }

    onMount(() => {
        window.electronAPI.onPreferencesLoad((preferences: Preferences) => {
            selectedAppearance = preferences.appearance ?? 'system';
        });
        window.electronAPI.requestPreferences();
    });
</script>

<div class="modal-backdrop">
    <div class="modal">
        <h2>Preferences</h2>
        <div>
            <h3>Appearance</h3>
            {#each appearanceOptions as option}
                <label>
                    <input type="radio" bind:group={selectedAppearance} value={option.value}/>
                    {option.label}
                </label>
            {/each}
        </div>
        <div class="modal-actions">
            <button on:click={savePreferences}>Save</button>
            <button on:click={cancelPreferences}>Cancel</button>
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
        padding: 2rem;
        border-radius: 8px;
        min-width: 300px;
        border: 1px solid var(--border-default);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    h2 {
        margin-top: 0;
        color: var(--text-primary);
    }

    h3 {
        color: var(--text-primary);
        margin-bottom: 0.5rem;
    }

    label {
        display: block;
        padding: 0.5rem;
        cursor: pointer;
        color: var(--text-primary);
    }

    label:hover {
        background: var(--bg-secondary);
    }

    .modal-actions {
        margin-top: 1rem;
        display: flex;
        gap: 1rem;
    }

    button {
        padding: 0.5rem 1rem;
        border: 1px solid var(--border-default);
        background: var(--interactive-secondary);
        color: var(--text-primary);
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
    }

    button:hover {
        background: var(--interactive-secondary-hover);
    }

    button:first-child {
        background: var(--interactive-primary);
        color: var(--text-inverse);
        border-color: var(--interactive-primary);
    }

    button:first-child:hover {
        background: var(--interactive-primary-hover);
    }
</style>
