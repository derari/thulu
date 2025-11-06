<script lang="ts">
    import {onMount} from 'svelte';
    import type {EnvironmentConfig} from './collection';
    import {
        type AvailableEnvironment,
        type EnvironmentVariable,
        getEnvironmentVariables,
        listAvailableEnvironments
    } from './environmentParser';
    import {ArrowDown, Globe, Lock, SquarePen, Trash2} from 'lucide-svelte';
    import UnsavedChangesModal from './UnsavedChangesModal.svelte';
    import {openEnvironments} from './stores/openEnvironments';
    import {currentCollection} from './stores/currentCollection';
    import {globalVariables} from './stores/globalVariables';

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
    let isRenamingEnvironment = false;
    let isCreatingEnvironment = false;
    let newEnvironmentName = '';
    let errorMessage = '';
    let isCurrentEnvLocallyDefined = false;
    let collectionGlobalVars: Record<string, string> = {};
    let openDropdownVariableName: string | null = null;
    let variableParentSources: Map<string, Array<{source: string, value: string, isPrivate: boolean}>> = new Map();

    const SELECTED_ENV_KEY = 'thulu:selectedEnvironment';

    function saveSelectedEnvironment(envName: string) {
        if (envName) {
            localStorage.setItem(SELECTED_ENV_KEY, envName);
        }
    }

    function loadSelectedEnvironmentFromStorage(): string {
        return localStorage.getItem(SELECTED_ENV_KEY) || '';
    }

    // Save to localStorage when selection changes
    $: if (selectedEnvironment) {
        saveSelectedEnvironment(selectedEnvironment);
    }

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

        // Reset create/rename modes when switching folders
        isCreatingEnvironment = false;
        isRenamingEnvironment = false;
        newEnvironmentName = '';
        errorMessage = '';

        // Try to get the selected environment from localStorage (shared with HttpEditor)
        const previousSelectedEnv = loadSelectedEnvironmentFromStorage();

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
            originalVariables = JSON.parse(JSON.stringify(variables));
            deletedVariables.clear();
            hasChanges = false;
            nextNewVarId = 0;

            // Load parent sources for all variables
            await loadParentSourcesForAllVariables();
        } catch (error) {
            console.error('Failed to load variables:', error);
            variables = [];
            originalVariables = [];
        }
    }

    async function loadParentSourcesForAllVariables() {
        variableParentSources.clear();

        for (const variable of variables) {
            if (variable.isInherited || variable.isOverridden) {
                const sources = await getParentSourcesForVariable(variable.name);
                if (sources.length > 0) {
                    variableParentSources.set(variable.name, sources);
                }
            }
        }

        variableParentSources = new Map(variableParentSources);
    }

    async function getParentSourcesForVariable(variableName: string): Promise<Array<{source: string, value: string, isPrivate: boolean}>> {
        const sources: Array<{source: string, value: string, isPrivate: boolean}> = [];

        // Walk up the folder hierarchy
        let currentPath = environmentConfig.folderPath;
        const rootPath = collectionRoot.replace(/\\/g, '/');

        while (true) {
            const parentPath = getParentPath(currentPath);
            if (!parentPath || parentPath === currentPath) break;
            if (parentPath.length < rootPath.length) break;

            currentPath = parentPath;

            // Check both public and private env files
            const publicEnvPath = joinPath(currentPath, 'http-client.env.json');
            const privateEnvPath = joinPath(currentPath, 'http-client.private.env.json');

            try {
                // Check public file
                const publicContent = await window.electronAPI.readFile(publicEnvPath);
                if (publicContent) {
                    const publicEnvFile = JSON.parse(publicContent);
                    if (publicEnvFile[selectedEnvironment]?.[variableName] !== undefined) {
                        sources.push({
                            source: getBaseName(currentPath),
                            value: publicEnvFile[selectedEnvironment][variableName],
                            isPrivate: false
                        });
                    }
                }
            } catch (error) {
                // File doesn't exist
            }

            try {
                // Check private file
                const privateContent = await window.electronAPI.readFile(privateEnvPath);
                if (privateContent) {
                    const privateEnvFile = JSON.parse(privateContent);
                    if (privateEnvFile[selectedEnvironment]?.[variableName] !== undefined) {
                        sources.push({
                            source: getBaseName(currentPath),
                            value: privateEnvFile[selectedEnvironment][variableName],
                            isPrivate: true
                        });
                    }
                }
            } catch (error) {
                // File doesn't exist
            }

            if (currentPath === rootPath) break;
        }

        return sources;
    }

    function joinPath(basePath: string, fileName: string): string {
        return `${basePath}${basePath.endsWith('/') || basePath.endsWith('\\') ? '' : '/'}${fileName}`;
    }

    function getParentPath(filePath: string): string {
        const normalized = filePath.replace(/\\/g, '/');
        const parts = normalized.split('/');
        parts.pop();
        return parts.join('/');
    }

    function toggleInheritanceDropdown(variableName: string) {
        if (openDropdownVariableName === variableName) {
            openDropdownVariableName = null;
        } else {
            openDropdownVariableName = variableName;
        }
    }

    function closeDropdown() {
        openDropdownVariableName = null;
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
        variables = variables; // Trigger reactivity
    }

    async function saveChanges() {
        const publicEnvPath = `${environmentConfig.folderPath}/http-client.env.json`;
        const privateEnvPath = `${environmentConfig.folderPath}/http-client.private.env.json`;

        try {
            // Read existing files
            let publicEnvFile: any = {};
            let privateEnvFile: any = {};

            try {
                const publicContent = await window.electronAPI.readFile(publicEnvPath);
                if (publicContent) {
                    publicEnvFile = JSON.parse(publicContent);
                }
            } catch (error) {
                // File doesn't exist yet
            }

            try {
                const privateContent = await window.electronAPI.readFile(privateEnvPath);
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
            await window.electronAPI.writeFile(
                publicEnvPath,
                JSON.stringify(publicEnvFile, null, 2)
            );

            await window.electronAPI.writeFile(
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
            if (variable.parentValue !== undefined) {
                const inheritedValue = variable.value;
                const inheritedIsPrivate = variable.isPrivate;
                const inheritedSource = variable.source;

                variable.value = variable.parentValue;
                variable.isPrivate = variable.parentIsPrivate!;

                variable.parentValue = inheritedValue;
                variable.parentIsPrivate = inheritedIsPrivate;
                variable.parentSource = inheritedSource;
            } else {
                variable.parentValue = variable.value;
                variable.parentIsPrivate = variable.isPrivate;
                variable.parentSource = variable.source;
            }

            variable.isInherited = false;
            variable.isOverridden = true;
            variable.isEditable = true;
        } else if (variable.isOverridden && variable.parentValue !== undefined) {
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
        variables = [...variables];
        hasChanges = true;
    }

    function isEnvironmentLocallyDefined(): boolean {
        const currentEnv = availableEnvironments.find(env => env.name === selectedEnvironment);
        return currentEnv?.isFromCurrentFolder || false;
    }

    function startCreateEnvironment() {
        newEnvironmentName = '';
        errorMessage = '';
        isCreatingEnvironment = true;
    }

    function cancelCreate() {
        isCreatingEnvironment = false;
        newEnvironmentName = '';
        errorMessage = '';
    }

    async function confirmCreate() {
        const trimmedName = newEnvironmentName.trim();

        if (!trimmedName) {
            errorMessage = 'Environment name cannot be empty';
            return;
        }

        // Check if environment already exists
        if (availableEnvironments.some(env => env.name === trimmedName)) {
            errorMessage = 'An environment with this name already exists';
            return;
        }

        // Create empty environment in both files
        const publicEnvPath = `${environmentConfig.folderPath}/http-client.env.json`;

        try {
            let publicEnvFile: any = {};

            try {
                const publicContent = await window.electronAPI.readFile(publicEnvPath);
                if (publicContent) publicEnvFile = JSON.parse(publicContent);
            } catch (error) {
            }

            // Create empty environment
            publicEnvFile[trimmedName] = {};

            await window.electronAPI.writeFile(
                publicEnvPath,
                JSON.stringify(publicEnvFile, null, 2)
            );

            // Reload environments and select the new one
            await loadEnvironments();
            selectedEnvironment = trimmedName;
            cancelCreate();
        } catch (error) {
            console.error('Failed to create environment:', error);
            errorMessage = 'Failed to create environment';
        }
    }

    async function deleteEnvironment() {
        if (!isEnvironmentLocallyDefined()) {
            return;
        }

        if (!window.confirm(`Are you sure you want to delete the environment "${selectedEnvironment}"?`)) {
            return;
        }

        const publicEnvPath = `${environmentConfig.folderPath}/http-client.env.json`;
        const privateEnvPath = `${environmentConfig.folderPath}/http-client.private.env.json`;

        try {
            let publicEnvFile: any = {};
            let privateEnvFile: any = {};

            try {
                const publicContent = await window.electronAPI.readFile(publicEnvPath);
                if (publicContent) publicEnvFile = JSON.parse(publicContent);
            } catch (error) {
            }

            try {
                const privateContent = await window.electronAPI.readFile(privateEnvPath);
                if (privateContent) privateEnvFile = JSON.parse(privateContent);
            } catch (error) {
            }

            // Delete from both files
            delete publicEnvFile[selectedEnvironment];
            delete privateEnvFile[selectedEnvironment];

            await window.electronAPI.writeFile(
                publicEnvPath,
                JSON.stringify(publicEnvFile, null, 2)
            );

            await window.electronAPI.writeFile(
                privateEnvPath,
                JSON.stringify(privateEnvFile, null, 2)
            );

            // Reload environments
            await loadEnvironments();
        } catch (error) {
            console.error('Failed to delete environment:', error);
            errorMessage = 'Failed to delete environment';
        }
    }

    function startRenameEnvironment() {
        if (!isEnvironmentLocallyDefined()) {
            return;
        }

        newEnvironmentName = selectedEnvironment;
        errorMessage = '';
        isRenamingEnvironment = true;
    }

    function cancelRename() {
        isRenamingEnvironment = false;
        newEnvironmentName = '';
        errorMessage = '';
    }

    async function confirmRename() {
        const trimmedName = newEnvironmentName.trim();

        if (!trimmedName || trimmedName === selectedEnvironment) {
            cancelRename();
            return;
        }

        if (availableEnvironments.some(env => env.name === trimmedName)) {
            errorMessage = 'An environment with this name already exists';
            return;
        }

        const publicEnvPath = `${environmentConfig.folderPath}/http-client.env.json`;
        const privateEnvPath = `${environmentConfig.folderPath}/http-client.private.env.json`;

        try {
            let publicEnvFile: any = {};
            let privateEnvFile: any = {};

            try {
                const publicContent = await window.electronAPI.readFile(publicEnvPath);
                if (publicContent) publicEnvFile = JSON.parse(publicContent);
            } catch (error) {
            }

            try {
                const privateContent = await window.electronAPI.readFile(privateEnvPath);
                if (privateContent) privateEnvFile = JSON.parse(privateContent);
            } catch (error) {
            }

            // Rename in both files
            if (publicEnvFile[selectedEnvironment]) {
                publicEnvFile[trimmedName] = publicEnvFile[selectedEnvironment];
                delete publicEnvFile[selectedEnvironment];
            }

            if (privateEnvFile[selectedEnvironment]) {
                privateEnvFile[trimmedName] = privateEnvFile[selectedEnvironment];
                delete privateEnvFile[selectedEnvironment];
            }

            await window.electronAPI.writeFile(
                publicEnvPath,
                JSON.stringify(publicEnvFile, null, 2)
            );

            await window.electronAPI.writeFile(
                privateEnvPath,
                JSON.stringify(privateEnvFile, null, 2)
            );

            // Reload environments and select the renamed one
            await loadEnvironments();
            selectedEnvironment = trimmedName;
            cancelRename();
        } catch (error) {
            console.error('Failed to rename environment:', error);
            errorMessage = 'Failed to rename environment';
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

<svelte:window on:click={closeDropdown} />

<div class="environments-view">
    <div class="header">
        <h2>Environments in {folderName}</h2>
    </div>

    <div class="content">
        {#if loading}
            <div class="loading">Loading environments...</div>
        {:else}
            <div class="selector">
                <label for="env-select">Select environment:</label>
                <div class="environment-controls">
                    {#if isCreatingEnvironment}
                        <input
                                type="text"
                                bind:value={newEnvironmentName}
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
                    {:else if isRenamingEnvironment}
                        <input
                                type="text"
                                bind:value={newEnvironmentName}
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
                        <select id="env-select" bind:value={selectedEnvironment}
                                disabled={availableEnvironments.length === 0}>
                            {#if availableEnvironments.length === 0}
                                <option value="">No environments available</option>
                            {:else}
                                {#each availableEnvironments as env}
                                    <option value={env.name}>
                                        {env.name}
                                        {#if !env.isFromCurrentFolder}{' '}({env.source}){/if}
                                    </option>
                                {/each}
                            {/if}
                        </select>
                        <button
                                class="control-button"
                                on:click={startCreateEnvironment}
                                title="Create new environment"
                        >
                            +
                        </button>
                        <button
                                class="control-button"
                                on:click={startRenameEnvironment}
                                disabled={!isCurrentEnvLocallyDefined || availableEnvironments.length === 0}
                                title={availableEnvironments.length === 0 ? "No environment selected" : (isCurrentEnvLocallyDefined ? "Rename environment" : "Cannot rename inherited environment")}
                        >
                            ✎
                        </button>
                        <button
                                class="control-button delete-button"
                                on:click={deleteEnvironment}
                                disabled={!isCurrentEnvLocallyDefined || availableEnvironments.length === 0}
                                title={availableEnvironments.length === 0 ? "No environment selected" : (isCurrentEnvLocallyDefined ? "Delete environment" : "Cannot delete inherited environment")}
                        >
                            <Trash2 size={16}/>
                        </button>
                    {/if}
                </div>
                {#if errorMessage}
                    <div class="error-message">{errorMessage}</div>
                {/if}
            </div>

            {#if availableEnvironments.length > 0}
                {#if selectedEnvironment && variables.length > 0}
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
                                                        title={variable.isOverridden ? "Overridden from parent - Click to see sources" : "Inherited from {variable.source} - Click to see sources"}
                                                        class="clickable-icon"
                                                        on:click={(e) => { e.stopPropagation(); toggleInheritanceDropdown(variable.name); }}
                                                >
                                                    {#if variable.isOverridden}
                                                        <SquarePen size={16}/>
                                                    {:else}
                                                        <ArrowDown size={16}/>
                                                    {/if}
                                                </button>

                                                {#if openDropdownVariableName === variable.name && variableParentSources.has(variable.name)}
                                                    <div class="inheritance-dropdown">
                                                        <div class="dropdown-header">Defined in:</div>
                                                        {#each variableParentSources.get(variable.name) || [] as parentSource}
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

                {#if Object.keys(collectionGlobalVars).length > 0}
                    <div class="global-variables-section">
                        <h2>Global Variables</h2>
                        <div class="variables-table">
                            {#each Object.entries(collectionGlobalVars) as [key, value]}
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
                                                on:click={() => deleteGlobalVariable(key)}
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
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

