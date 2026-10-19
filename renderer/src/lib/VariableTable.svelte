<script lang="ts">
    import {createEventDispatcher} from 'svelte';
    import {ArrowDown, Globe, Lock, SquarePen, Trash2} from 'lucide-svelte';
    import type {EnvironmentVariable} from './environmentParser';
    import type {ParentSource} from './environmentFiles';
    import {createVariable, toggleDelete as toggleDeleteVariable, toggleInheritance} from './environmentDraft';

    export let variables: EnvironmentVariable[];
    /** Names of the local variables that are marked for deletion */
    export let deletedNames: Set<string>;
    /** Where each inherited or overridden variable is defined in the parent folders */
    export let parentSources: Map<string, ParentSource[]>;
    /** Name of the folder that new variables are added to */
    export let folderName: string;

    const dispatch = createEventDispatcher<{ change: void }>();

    let openDropdownVariableName: string | null = null;

    function changed() {
        variables = [...variables];
        dispatch('change');
    }

    function isDeleted(variable: EnvironmentVariable): boolean {
        return deletedNames.has(variable.name);
    }

    function toggleInheritanceDropdown(variableName: string) {
        openDropdownVariableName = openDropdownVariableName === variableName ? null : variableName;
    }

    function closeDropdown() {
        openDropdownVariableName = null;
    }

    function addNewVariable() {
        variables = [...variables, createVariable(variables.map(v => v.name), folderName)];
        dispatch('change');
    }

    function togglePrivacy(variable: EnvironmentVariable) {
        if (!variable.isEditable) return;
        variable.isPrivate = !variable.isPrivate;
        changed();
    }

    function toggleDelete(variable: EnvironmentVariable) {
        deletedNames = toggleDeleteVariable(variable, deletedNames);
        changed();
    }

    function toggleVariableInheritance(variable: EnvironmentVariable) {
        toggleInheritance(variable);
        changed();
    }

    function markChanged() {
        dispatch('change');
    }
</script>

<svelte:window on:click={closeDropdown} />

{#if variables.length > 0}
    <div class="variables-section">
        <h3>Variables</h3>
        <div class="variables-table">
            {#each variables as variable}
                <div class="variable-row" class:deleted={isDeleted(variable)}>
                    <div class="icon-cell inheritance-icon">
                        {#if variable.isOverridden || variable.isInherited}
                            <div class="dropdown-container">
                                <button
                                        type="button"
                                        title={(variable.isOverridden ? "Overridden" : "Inherited")
                                             + " from " + variable.source
                                             + (variable.isShared ? " (shared)" : "")
                                             + " - Click to see sources"}
                                        class="clickable-icon"
                                        on:click={(e) => { e.stopPropagation(); toggleInheritanceDropdown(variable.name); }}
                                >
                                    {#if variable.isOverridden}
                                        <SquarePen size={16}/>
                                    {:else}
                                        <ArrowDown size={16}/>
                                    {/if}
                                </button>

                                {#if openDropdownVariableName === variable.name && parentSources.has(variable.name)}
                                    <div class="inheritance-dropdown">
                                        <div class="dropdown-header">Defined in:</div>
                                        {#each parentSources.get(variable.name) || [] as parentSource}
                                            <div class="dropdown-item">
                                                <div class="dropdown-item-source">
                                                    {parentSource.source}
                                                    {#if parentSource.isPrivate}
                                                        <Lock size={12}/>
                                                    {:else}
                                                        <Globe size={12}/>
                                                    {/if}
                                                </div>
                                                <div class="dropdown-item-value">{parentSource.value}</div>
                                            </div>
                                        {/each}
                                                    </div>
                                                {/if}
                                            </div>
                                        {/if}
                                    </div>
                                    <div class="icon-cell lock-icon">
                                        {#if variable.isPrivate}
                                            <button
                                                    type="button"
                                                    title={variable.isEditable ? "Private - Click to make public" : "Private"}
                                                    class="clickable-icon"
                                                    on:click={() => togglePrivacy(variable)}
                                                    disabled={!variable.isEditable}
                                            >
                                                <Lock size={16}/>
                                            </button>
                                        {:else}
                                            <button
                                                    type="button"
                                                    title={variable.isEditable ? "Public - Click to make private" : "Public"}
                                                    class="clickable-icon"
                                                    on:click={() => togglePrivacy(variable)}
                                                    disabled={!variable.isEditable}
                                            >
                                                <Globe size={16}/>
                                            </button>
                                        {/if}
                                    </div>
                                    <div class="name-cell">
                                        {#if variable.isEditable}
                                            <input
                                                    type="text"
                                                    bind:value={variable.name}
                                                    class="editable-input"
                                                    disabled={isDeleted(variable)}
                                                    on:input={markChanged}
                                            />
                                        {:else}
                                            <span class="readonly-text">{variable.name}</span>
                                        {/if}
                                    </div>
                                    <div class="value-cell">
                                        {#if variable.isEditable}
                                            <input
                                                    type="text"
                                                    bind:value={variable.value}
                                                    class="editable-input"
                                                    disabled={isDeleted(variable)}
                                                    on:input={markChanged}
                                            />
                                        {:else}
                                            <span class="readonly-text">{variable.value}</span>
                                        {/if}
                                    </div>
                                    <div class="icon-cell delete-icon">
                                        {#if variable.isInherited}
                                            <button
                                                    type="button"
                                                    title="Click to override this inherited variable"
                                                    class="clickable-icon edit-button"
                                                    on:click={() => toggleVariableInheritance(variable)}
                                            >
                                                <SquarePen size={16}/>
                                            </button>
                                        {:else if variable.isEditable}
                                            <button
                                                    type="button"
                                                    title={isDeleted(variable) ? "Restore variable" : (variable.isOverridden ? "Revert to inherited" : "Delete variable")}
                                                    class="clickable-icon delete-button"
                                                    on:click={() => toggleDelete(variable)}
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
        </div>

        <button class="add-variable-button" on:click={addNewVariable}>
            Add Variable
        </button>
    </div>
{:else}
    <div class="empty-variables">No variables defined for this environment</div>
    <button class="add-variable-button" on:click={addNewVariable}>
        Add Variable
    </button>
{/if}

<style>
    .variables-section {
        margin-top: 2rem;
    }

    .variables-section h3 {
        margin: 0 0 1rem 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--text-primary);
    }

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

    .variable-row.deleted {
        opacity: 0.5;
    }

    .variable-row.deleted .editable-input {
        text-decoration: line-through;
    }

    .variable-row.deleted .readonly-text {
        text-decoration: line-through;
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

    .dropdown-container {
        position: relative;
    }

    .inheritance-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        margin-top: 4px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-default);
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        min-width: 200px;
        max-width: 400px;
    }

    .dropdown-header {
        padding: 0.5rem;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-secondary);
        border-bottom: 1px solid var(--border-default);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .dropdown-item {
        padding: 0.5rem;
        border-bottom: 1px solid var(--border-default);
    }

    .dropdown-item:last-child {
        border-bottom: none;
    }

    .dropdown-item-source {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.75rem;
        color: var(--text-secondary);
        margin-bottom: 0.25rem;
    }

    .dropdown-item-value {
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: 0.85rem;
        color: var(--text-primary);
        word-break: break-all;
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

    .edit-button {
        color: var(--text-secondary);
    }

    .edit-button:hover:not(:disabled) {
        color: var(--text-primary);
        background: var(--sidebar-item-hover);
    }

    .name-cell,
    .value-cell {
        display: flex;
        align-items: center;
    }

    .editable-input {
        width: 100%;
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--border-default);
        border-radius: 3px;
        background: var(--editor-bg);
        color: var(--text-primary);
        font-size: 0.9rem;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        line-height: 1.2;
        margin: -4px 0;
    }

    .editable-input:focus {
        outline: 2px solid var(--border-focus);
        outline-offset: 1px;
    }

    .readonly-text {
        color: var(--text-secondary);
        font-size: 0.9rem;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        padding-left: 9px;
        margin-top: -1px;
    }

    .empty-variables {
        margin-top: 2rem;
        color: var(--text-secondary);
        font-style: italic;
    }

    .add-variable-button {
        margin-top: 1rem;
        padding: 0.5rem 1rem;
        border: 1px solid var(--border-default);
        border-radius: 4px;
        background: var(--editor-bg);
        color: var(--text-primary);
        font-size: 0.9rem;
        cursor: pointer;
        transition: background 0.15s ease;
    }

    .add-variable-button:hover {
        background: var(--sidebar-item-hover);
    }
</style>
