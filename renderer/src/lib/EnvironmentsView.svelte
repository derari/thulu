<script lang="ts">
    import { onMount } from 'svelte';
    import type { EnvironmentConfig } from './collection';
    import { listAvailableEnvironments, type AvailableEnvironment, getEnvironmentVariables, type EnvironmentVariable } from './environmentParser';
    import { Lock, Globe, ArrowDown, Edit, Trash2 } from 'lucide-svelte';
    import UnsavedChangesModal from './UnsavedChangesModal.svelte';
    import { openEnvironments } from './stores/openEnvironments';

    export let environmentConfig: EnvironmentConfig;
    export let collectionRoot: string;

    let folderName = '';
    let availableEnvironments: AvailableEnvironment[] = [];
    let selectedEnvironment = '';
    let loading = true;
    let variables: EnvironmentVariable[] = [];
    let deletedVariables = new Set<string>();
    let originalVariables: EnvironmentVariable[] = [];
    let hasChanges = false;
    let nextNewVarId = 0;
    let showUnsavedChangesModal = false;
    let previousEnvironmentConfig: EnvironmentConfig | null = null;
    let pendingActionValue: 'navigate' | 'close' | null = null;
    let previousSelectedEnvironment = '';

    // Subscribe to pending action
    openEnvironments.pendingAction.subscribe(value => {
        pendingActionValue = value;
    });

    function getBaseName(filePath: string): string {
        const normalized = filePath.replace(/\\/g, '/');
        const parts = normalized.split('/');
        return parts[parts.length - 1] || '';
    }

    async function loadEnvironments() {
        loading = true;
        const baseName = getBaseName(environmentConfig.folderPath);
        folderName = baseName || 'Root';

        try {
            availableEnvironments = await listAvailableEnvironments(
                environmentConfig.folderPath,
                collectionRoot
            );

            if (availableEnvironments.length > 0) {
                selectedEnvironment = availableEnvironments[0].name;
            }
        } catch (error) {
            console.error('Failed to load environments:', error);
        }

        loading = false;
    }

    $: if (environmentConfig && previousEnvironmentConfig) {
        // Check if environment config changed (navigation attempt)
        if (environmentConfig.folderPath !== previousEnvironmentConfig.folderPath) {
            if (hasChanges) {
                // Show modal and prevent navigation
                showUnsavedChangesModal = true;
            } else {
                // No changes, allow navigation
                previousEnvironmentConfig = environmentConfig;
                loadEnvironments();
            }
        }
        // Don't reload if folderPath is the same
    } else if (environmentConfig && !previousEnvironmentConfig) {
        // First load
        previousEnvironmentConfig = environmentConfig;
        loadEnvironments();
    }

    $: if (selectedEnvironment && selectedEnvironment !== previousSelectedEnvironment) {
        previousSelectedEnvironment = selectedEnvironment;
        loadVariables();
    }

    $: {
        openEnvironments.setHasUnsavedChanges(hasChanges);
    }

    $: if (pendingActionValue && hasChanges && !showUnsavedChangesModal) {
        showUnsavedChangesModal = true;
    }

    async function loadVariables() {
        if (!selectedEnvironment) return;

        try {
            variables = await getEnvironmentVariables(
                selectedEnvironment,
                environmentConfig.folderPath,
                collectionRoot
            );
            originalVariables = JSON.parse(JSON.stringify(variables));
            deletedVariables.clear();
            hasChanges = false;
            nextNewVarId = 0;
        } catch (error) {
            console.error('Failed to load variables:', error);
            variables = [];
            originalVariables = [];
        }
    }

    function addNewVariable() {
        const newVar: EnvironmentVariable = {
            name: `newVar${nextNewVarId++}`,
            value: '',
            isPrivate: false,
            source: getBaseName(environmentConfig.folderPath) || 'Root',
            isInherited: false,
            isOverridden: false,
            isEditable: true
        };
        variables = [...variables, newVar];
        hasChanges = true;
    }

    async function saveChanges() {
        const publicEnvPath = `${environmentConfig.folderPath}/http-client.env.json`;
        const privateEnvPath = `${environmentConfig.folderPath}/http-client.private.env.json`;

        try {
            // Read existing files
            let publicEnvFile: any = {};
            let privateEnvFile: any = {};

            try {
                const publicContent = await window.electronAPI.readHttpFile(publicEnvPath);
                if (publicContent) {
                    publicEnvFile = JSON.parse(publicContent);
                }
            } catch (error) {
                // File doesn't exist yet
            }

            try {
                const privateContent = await window.electronAPI.readHttpFile(privateEnvPath);
                if (privateContent) {
                    privateEnvFile = JSON.parse(privateContent);
                }
            } catch (error) {
                // File doesn't exist yet
            }

            // Get existing vars for this environment or create empty objects
            const publicVars = publicEnvFile[selectedEnvironment] || {};
            const privateVars = privateEnvFile[selectedEnvironment] || {};

            // Process each variable
            for (const variable of variables) {
                if (variable.isEditable && !isDeleted(variable)) {
                    // Add or update the variable in the appropriate file
                    if (variable.isPrivate) {
                        privateVars[variable.name] = variable.value;
                        // Remove from public if it was there before
                        delete publicVars[variable.name];
                    } else {
                        publicVars[variable.name] = variable.value;
                        // Remove from private if it was there before
                        delete privateVars[variable.name];
                    }
                } else if (variable.isInherited || isDeleted(variable)) {
                    // Remove from both files if inherited or deleted
                    delete publicVars[variable.name];
                    delete privateVars[variable.name];
                }
            }

            // Update the environment objects
            publicEnvFile[selectedEnvironment] = publicVars;
            privateEnvFile[selectedEnvironment] = privateVars;

            // Write back to files (always write to handle deletions)
            await window.electronAPI.writeHttpFile(
                publicEnvPath,
                JSON.stringify(publicEnvFile, null, 2)
            );

            await window.electronAPI.writeHttpFile(
                privateEnvPath,
                JSON.stringify(privateEnvFile, null, 2)
            );

            // Reload variables
            await loadVariables();
        } catch (error) {
            console.error('Failed to save changes:', error);
        }
    }

    function cancelChanges() {
        variables = JSON.parse(JSON.stringify(originalVariables));
        deletedVariables.clear();
        hasChanges = false;
    }

    async function handleModalSave() {
        await saveChanges();
        showUnsavedChangesModal = false;
        pendingActionValue = null;
        previousEnvironmentConfig = environmentConfig;
        openEnvironments.confirmNavigation();
        loadEnvironments();
    }

    function handleModalDiscard() {
        cancelChanges();
        showUnsavedChangesModal = false;
        pendingActionValue = null;
        previousEnvironmentConfig = environmentConfig;
        openEnvironments.confirmNavigation();
        loadEnvironments();
    }

    function handleModalCancel() {
        showUnsavedChangesModal = false;
        pendingActionValue = null;
        openEnvironments.cancelNavigation();
    }

    function markChanged() {
        hasChanges = true;
    }

    function togglePrivacy(variable: EnvironmentVariable) {
        if (!variable.isEditable) return;
        variable.isPrivate = !variable.isPrivate;
        variables = [...variables];
        hasChanges = true;
    }

    function toggleDelete(variable: EnvironmentVariable) {
        const varKey = `${variable.name}`;

        if (variable.isOverridden) {
            // For overridden vars: change to inherited
            if (variable.parentValue !== undefined) {
                const localValue = variable.value;
                const localIsPrivate = variable.isPrivate;

                variable.value = variable.parentValue;
                variable.isPrivate = variable.parentIsPrivate!;
                variable.source = variable.parentSource!;
                variable.isInherited = true;
                variable.isOverridden = false;
                variable.isEditable = false;

                variable.parentValue = localValue;
                variable.parentIsPrivate = localIsPrivate;
            }
        } else if (!variable.isInherited) {
            // For new vars: toggle deleted state
            if (deletedVariables.has(varKey)) {
                deletedVariables.delete(varKey);
            } else {
                deletedVariables.add(varKey);
            }
            deletedVariables = new Set(deletedVariables);
        }

        variables = [...variables];
        hasChanges = true;
    }

    function isDeleted(variable: EnvironmentVariable): boolean {
        return deletedVariables.has(variable.name);
    }

    function toggleVariableInheritance(variable: EnvironmentVariable) {
        if (variable.isInherited) {
            // Make it editable (override the inherited value)
            // The current value is from parent, parentValue should have our local override if it exists
            if (variable.parentValue !== undefined) {
                // We have a saved local value, restore it
                const inheritedValue = variable.value;
                const inheritedIsPrivate = variable.isPrivate;
                const inheritedSource = variable.source;

                variable.value = variable.parentValue;
                variable.isPrivate = variable.parentIsPrivate!;

                // Keep inherited info as parent
                variable.parentValue = inheritedValue;
                variable.parentIsPrivate = inheritedIsPrivate;
                variable.parentSource = inheritedSource;
            } else {
                // No saved local value, so just store the inherited value as parent
                variable.parentValue = variable.value;
                variable.parentIsPrivate = variable.isPrivate;
                variable.parentSource = variable.source;
                // Value stays the same, just becomes editable
            }

            variable.isInherited = false;
            variable.isOverridden = true;
            variable.isEditable = true;
        } else if (variable.isOverridden && variable.parentValue !== undefined) {
            // Revert to inherited (use parent value)
            // Store current local value
            const localValue = variable.value;
            const localIsPrivate = variable.isPrivate;

            variable.value = variable.parentValue;
            variable.isPrivate = variable.parentIsPrivate!;
            variable.source = variable.parentSource!;
            variable.isInherited = true;
            variable.isOverridden = false;
            variable.isEditable = false;

            // Keep local value so we can toggle back
            variable.parentValue = localValue;
            variable.parentIsPrivate = localIsPrivate;
        }
        variables = [...variables];
        hasChanges = true;
    }

    onMount(async () => {
        await loadEnvironments();
    });
</script>

<div class="environments-view">
    <div class="header">
        <h2>Environments in {folderName}</h2>
    </div>

    <div class="content">
        {#if loading}
            <div class="loading">Loading environments...</div>
        {:else if availableEnvironments.length === 0}
            <div class="empty">No environments found</div>
        {:else}
            <div class="selector">
                <label for="env-select">Select environment:</label>
                <select id="env-select" bind:value={selectedEnvironment}>
                    {#each availableEnvironments as env}
                        <option value={env.name}>
                            {env.name}{#if !env.isFromCurrentFolder}{' '}({env.source}){/if}
                        </option>
                    {/each}
                </select>
            </div>

            {#if selectedEnvironment && variables.length > 0}
                <div class="variables-section">
                    <h3>Variables</h3>
                    <div class="variables-table">
                        {#each variables as variable}
                            <div class="variable-row" class:deleted={isDeleted(variable)}>
                                <div class="icon-cell inheritance-icon">
                                    {#if variable.isOverridden}
                                        <span
                                            title="Overridden from parent - Click to use inherited value"
                                            class="clickable-icon"
                                            role="button"
                                            tabindex="0"
                                            on:click={() => toggleVariableInheritance(variable)}
                                            on:keydown={(e) => e.key === 'Enter' && toggleVariableInheritance(variable)}
                                        >
                                            <Edit size={16} />
                                        </span>
                                    {:else if variable.isInherited}
                                        <span
                                            title="Inherited from {variable.source} - Click to override"
                                            class="clickable-icon"
                                            role="button"
                                            tabindex="0"
                                            on:click={() => toggleVariableInheritance(variable)}
                                            on:keydown={(e) => e.key === 'Enter' && toggleVariableInheritance(variable)}
                                        >
                                            <ArrowDown size={16} />
                                        </span>
                                    {/if}
                                </div>
                                <div class="icon-cell lock-icon">
                                    {#if variable.isPrivate}
                                        <span
                                            title={variable.isEditable ? "Private - Click to make public" : "Private"}
                                            class:clickable-icon={variable.isEditable}
                                            role={variable.isEditable ? "button" : undefined}
                                            tabindex={variable.isEditable ? 0 : undefined}
                                            on:click={() => togglePrivacy(variable)}
                                            on:keydown={(e) => variable.isEditable && e.key === 'Enter' && togglePrivacy(variable)}
                                        >
                                            <Lock size={16} />
                                        </span>
                                    {:else}
                                        <span
                                            title={variable.isEditable ? "Public - Click to make private" : "Public"}
                                            class:clickable-icon={variable.isEditable}
                                            role={variable.isEditable ? "button" : undefined}
                                            tabindex={variable.isEditable ? 0 : undefined}
                                            on:click={() => togglePrivacy(variable)}
                                            on:keydown={(e) => variable.isEditable && e.key === 'Enter' && togglePrivacy(variable)}
                                        >
                                            <Globe size={16} />
                                        </span>
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
                                    {#if variable.isEditable}
                                        <span
                                            title={isDeleted(variable) ? "Restore variable" : (variable.isOverridden ? "Revert to inherited" : "Delete variable")}
                                            class="clickable-icon delete-button"
                                            role="button"
                                            tabindex="0"
                                            on:click={() => toggleDelete(variable)}
                                            on:keydown={(e) => e.key === 'Enter' && toggleDelete(variable)}
                                        >
                                            <Trash2 size={16} />
                                        </span>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>

                    <button class="add-variable-button" on:click={addNewVariable}>
                        Add Variable
                    </button>
                </div>
            {:else if selectedEnvironment && variables.length === 0}
                <div class="empty-variables">No variables defined for this environment</div>
                <button class="add-variable-button" on:click={addNewVariable}>
                    Add Variable
                </button>
            {/if}

            {#if selectedEnvironment}
                <div class="action-buttons">
                    <button class="cancel-button" on:click={cancelChanges} disabled={!hasChanges}>
                        Cancel
                    </button>
                    <button class="save-button" on:click={saveChanges} disabled={!hasChanges}>
                        Save
                    </button>
                </div>
            {/if}
        {/if}
    </div>
</div>

{#if showUnsavedChangesModal}
    <UnsavedChangesModal
        onSave={handleModalSave}
        onDiscard={handleModalDiscard}
        onCancel={handleModalCancel}
    />
{/if}

<style>
    .environments-view {
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--editor-bg);
        color: var(--text-primary);
    }

    .header {
        padding: 1rem;
        border-bottom: 1px solid var(--border-default);
        background: var(--sidebar-header);
    }

    .header h2 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
    }

    .content {
        padding: 1rem;
        flex: 1;
        overflow-y: auto;
    }

    .loading,
    .empty {
        color: var(--text-secondary);
        font-style: italic;
    }

    .selector {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .selector label {
        font-weight: 500;
        color: var(--text-primary);
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
    }

    .clickable-icon:hover {
        background: var(--sidebar-item-hover);
        color: var(--text-primary);
    }

    .clickable-icon:active {
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

    .delete-button:hover {
        color: #ef4444;
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
    }

    .editable-input:focus {
        outline: 2px solid var(--border-focus);
        outline-offset: 1px;
    }

    .readonly-text {
        color: var(--text-secondary);
        font-size: 0.9rem;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
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

    .action-buttons {
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
        margin-top: 2rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border-default);
    }

    .save-button,
    .cancel-button {
        padding: 0.5rem 1.5rem;
        border: 1px solid var(--border-default);
        border-radius: 4px;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .save-button {
        background: var(--text-primary);
        color: var(--editor-bg);
        border-color: var(--text-primary);
    }

    .save-button:hover:not(:disabled) {
        opacity: 0.9;
    }

    .save-button:disabled {
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

    .cancel-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>

