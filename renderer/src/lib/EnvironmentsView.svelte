<script lang="ts">
    import {onMount} from 'svelte';
    import {get} from 'svelte/store';
    import type {EnvironmentConfig} from './collection';
    import {
        type AvailableEnvironment,
        type EnvironmentVariable,
        getEnvironmentVariables,
        listAvailableEnvironments
    } from './environmentParser';
    import EnvironmentSelector from './EnvironmentSelector.svelte';
    import GlobalVariablesTable from './GlobalVariablesTable.svelte';
    import UnsavedChangesModal from './UnsavedChangesModal.svelte';
    import VariableTable from './VariableTable.svelte';
    import {openEnvironments} from './stores/openEnvironments';
    import {currentCollection} from './stores/currentCollection';
    import {globalVariables} from './stores/globalVariables';
    import {environmentSelection} from './stores/environmentSelection';
    import {baseName} from './paths';
    import {copyVariables} from './environmentDraft';
    import {
        createEnvironment,
        deleteEnvironment as deleteEnvironmentFromFiles,
        getVariableParentSources,
        type ParentSource,
        renameEnvironment,
        saveEnvironmentVariables
    } from './environmentFiles';

    export let environmentConfig: EnvironmentConfig;
    export let collectionRoot: string;

    const DUPLICATE_NAME_ERROR = 'An environment with this name already exists';

    let folderName = '';
    let availableEnvironments: AvailableEnvironment[] = [];
    let selectedEnvironment = '';
    let loading = true;
    let variables: EnvironmentVariable[] = [];
    let deletedVariables = new Set<string>();
    let originalVariables: EnvironmentVariable[] = [];
    let hasChanges = false;
    let showUnsavedChangesModal = false;
    let previousEnvironmentConfig: EnvironmentConfig | null = null;
    let pendingActionValue: 'navigate' | 'close' | null = null;
    let previousSelectedEnvironment = '';
    let isCurrentEnvLocallyDefined = false;
    let collectionGlobalVars: Record<string, string> = {};
    let variableParentSources: Map<string, ParentSource[]> = new Map();

    // Remember the selection (shared with HttpEditor)
    $: if (selectedEnvironment) {
        environmentSelection.select(selectedEnvironment);
    }

    // Subscribe to pending action
    openEnvironments.pendingAction.subscribe(value => {
        pendingActionValue = value;
    });

    async function loadEnvironments() {
        loading = true;
        folderName = baseName(environmentConfig.folderPath) || 'Root';

        const previousSelectedEnv = get(environmentSelection);

        try {
            if (!$currentCollection) {
                availableEnvironments = [];
                loading = false;
                return;
            }

            availableEnvironments = await listAvailableEnvironments(
                environmentConfig.folderPath,
                $currentCollection
            );

            if (availableEnvironments.length > 0) {
                // Try to keep the same environment selected if it exists in the new folder
                const envExists = availableEnvironments.some(env => env.name === previousSelectedEnv);
                if (envExists && previousSelectedEnv) {
                    selectedEnvironment = previousSelectedEnv;
                    // Force reload variables since folder changed but env name stayed the same
                    await loadVariables();
                } else {
                    // Select first environment (this will trigger loadVariables via reactive statement)
                    selectedEnvironment = availableEnvironments[0].name;
                }
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

    $: {
        const currentEnv = availableEnvironments.find(env => env.name === selectedEnvironment);
        isCurrentEnvLocallyDefined = currentEnv?.isFromCurrentFolder || false;
    }

    $: if ($currentCollection) {
        collectionGlobalVars = globalVariables.get($currentCollection.path);
    }

    async function loadVariables() {
        if (!selectedEnvironment) return;

        try {
            variables = await getEnvironmentVariables(
                selectedEnvironment,
                environmentConfig.folderPath,
                collectionRoot
            );
            originalVariables = copyVariables(variables);
            deletedVariables = new Set();
            hasChanges = false;

            await loadParentSourcesForAllVariables();
        } catch (error) {
            console.error('Failed to load variables:', error);
            variables = [];
            originalVariables = [];
        }
    }

    async function loadParentSourcesForAllVariables() {
        const sourcesByVariable = new Map<string, ParentSource[]>();

        for (const variable of variables) {
            if (variable.isInherited || variable.isOverridden) {
                const sources = await getVariableParentSources(
                    selectedEnvironment,
                    variable.name,
                    environmentConfig.folderPath,
                    collectionRoot
                );
                if (sources.length > 0) {
                    sourcesByVariable.set(variable.name, sources);
                }
            }
        }

        variableParentSources = sourcesByVariable;
    }

    async function saveChanges() {
        try {
            await saveEnvironmentVariables(
                environmentConfig.folderPath,
                selectedEnvironment,
                variables,
                deletedVariables
            );

            await loadVariables();
        } catch (error) {
            console.error('Failed to save changes:', error);
        }
    }

    function cancelChanges() {
        variables = copyVariables(originalVariables);
        deletedVariables = new Set();
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

    async function handleCreateEnvironment(name: string): Promise<string | null> {
        if (availableEnvironments.some(env => env.name === name)) {
            return DUPLICATE_NAME_ERROR;
        }

        try {
            await createEnvironment(environmentConfig.folderPath, name);

            // Reload environments and select the new one
            await loadEnvironments();
            selectedEnvironment = name;
            return null;
        } catch (error) {
            console.error('Failed to create environment:', error);
            return 'Failed to create environment';
        }
    }

    async function handleRenameEnvironment(name: string): Promise<string | null> {
        if (availableEnvironments.some(env => env.name === name)) {
            return DUPLICATE_NAME_ERROR;
        }

        try {
            await renameEnvironment(environmentConfig.folderPath, selectedEnvironment, name);

            // Reload environments and select the renamed one
            await loadEnvironments();
            selectedEnvironment = name;
            return null;
        } catch (error) {
            console.error('Failed to rename environment:', error);
            return 'Failed to rename environment';
        }
    }

    async function handleDeleteEnvironment(): Promise<string | null> {
        try {
            await deleteEnvironmentFromFiles(environmentConfig.folderPath, selectedEnvironment);
            await loadEnvironments();
            return null;
        } catch (error) {
            console.error('Failed to delete environment:', error);
            return 'Failed to delete environment';
        }
    }

    function deleteGlobalVariable(key: string) {
        if (!$currentCollection) return;
        globalVariables.delete($currentCollection.path, key);
        collectionGlobalVars = globalVariables.get($currentCollection.path);
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
        {:else}
            <EnvironmentSelector
                    environments={availableEnvironments}
                    bind:selected={selectedEnvironment}
                    isLocallyDefined={isCurrentEnvLocallyDefined}
                    onCreate={handleCreateEnvironment}
                    onRename={handleRenameEnvironment}
                    onDelete={handleDeleteEnvironment}
            />

            {#if availableEnvironments.length > 0}
                {#if selectedEnvironment}
                    <VariableTable
                            bind:variables
                            bind:deletedNames={deletedVariables}
                            parentSources={variableParentSources}
                            {folderName}
                            on:change={() => hasChanges = true}
                    />

                    <div class="action-buttons">
                        <button class="cancel-button" on:click={cancelChanges} disabled={!hasChanges}>
                            Cancel
                        </button>
                        <button class="save-button" on:click={saveChanges} disabled={!hasChanges}>
                            Save
                        </button>
                    </div>
                {/if}

                <GlobalVariablesTable variables={collectionGlobalVars} onDelete={deleteGlobalVariable}/>
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

    .loading {
        color: var(--text-secondary);
        font-style: italic;
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
