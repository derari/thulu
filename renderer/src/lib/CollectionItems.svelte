<script lang="ts">
    // Collection items component with environment support
    import {currentCollection} from './stores/currentCollection.js';
    import {openFile} from './stores/openFile.js';
    import {openEnvironments} from './stores/openEnvironments.js';
    import type {CollectionItem, EnvironmentConfig, HttpSection} from './collection';
    import {ChevronRight, Settings, MoreVertical, AlertTriangle, Info} from 'lucide-svelte';
    import {flattenCollection, flattenItems, formatVerb, getVerbColor} from './CollectionItemsUtils';
    import RenameModal from './RenameModal.svelte';
    import NewItemModal from './NewItemModal.svelte';
    import ReadmeView from './ReadmeView.svelte';

    function basename(filePath: string): string {
        const normalized = filePath.replace(/\\/g, '/');
        const parts = normalized.split('/');
        return parts[parts.length - 1] || '';
    }

    function dirname(filePath: string): string {
        const normalized = filePath.replace(/\\/g, '/');
        const parts = normalized.split('/');
        parts.pop();
        return parts.join('/');
    }

    function joinPath(dir: string, name: string): string {
        const normalizedDir = dir.replace(/\\/g, '/');
        return `${normalizedDir}/${name}`.replace(/\\/g, '/');
    }

    const INDENT_WIDTH = 15;
    const DELETE_CONFIRMATION_TIMEOUT = 10000;

    let collapsed: Set<string> = new Set();
    let openMenuKey: string | null = null;
    let confirmDeleteKey: string | null = null;
    let confirmDeleteItem: CollectionItem | null = null;
    let confirmDeleteType: 'file' | 'folder' | 'environment' | null = null;
    let confirmDeleteEnvironmentConfig: EnvironmentConfig | null = null;
    let deleteTimeoutId: number | null = null;
    let showRenameModal = false;
    let renameItem: CollectionItem | null = null;
    let showNewItemModal = false;
    let newItemType: 'file' | 'folder' | 'request' = 'file';
    let newItemParent: CollectionItem | null = null;
    let showReadmeView = false;
    let readmeFolderPath: string | null = null;
    let readmeName: string = 'README';

    $: flatItems = (() => {
        if (!$currentCollection) return [];
        collapsed;
        return flattenCollection($currentCollection.root, isCollapsed);
    })();

    function toggle(key: string) {
        if (key.endsWith('.http')) key = key.substring(0, key.length - 5);
        if (collapsed.has(key)) {
            collapsed.delete(key);
        } else {
            collapsed.add(key);
        }
        collapsed = new Set(collapsed);
    }

    function isCollapsed(key: string | undefined): boolean {
        if (!key) return false;
        if (key.endsWith('.http')) key = key.substring(0, key.length - 5);
        return collapsed.has(key);
    }

    async function handleItemClick(item: CollectionItem, section?: HttpSection) {
        if (!item.filePath) return;

        // If the file is already open, just jump to the section without reloading
        if ($openFile && $openFile.filePath === item.filePath) {
            openFile.jumpToSection(section?.startLineNumber);
            return;
        }

        // Otherwise, go through the full flow (save current, close environments, open file)
        await openFile.save();
        const closed = openEnvironments.close();
        if (closed) {
            // Environments view closed successfully, open the file
            openFile.openFile(item.filePath, section?.startLineNumber);
        }
        // If not closed, modal will be shown and navigation will happen after user decision
    }

    async function handleEnvironmentClick(environmentConfig: EnvironmentConfig) {
        if (!$currentCollection) return;
        await openFile.save();
        openFile.close();
        openEnvironments.open(environmentConfig, $currentCollection.path);
        // If navigation didn't happen immediately, the modal will be shown by EnvironmentsView
    }

    function getItemKey(item: CollectionItem, section?: HttpSection, environmentConfig?: EnvironmentConfig): string {
        if (section) {
            return `${item.filePath}:${section.startLineNumber}`;
        }
        if (environmentConfig) {
            return `env:${environmentConfig.folderPath}`;
        }
        return item.folderPath || item.filePath || item.title;
    }

    function toggleMenu(event: MouseEvent, key: string) {
        event.stopPropagation();
        if (openMenuKey === key) {
            openMenuKey = null;
            return;
        }
        openMenuKey = key;
        confirmDeleteKey = null;
        clearDeleteTimeout();
    }

    function handleDeleteClick(event: MouseEvent, key: string, item: CollectionItem) {
        event.stopPropagation();
        openMenuKey = null;

        // Extract the delete type from the key if present
        if (key.endsWith(':file')) {
            confirmDeleteType = 'file';
            confirmDeleteKey = key.substring(0, key.length - 5);
        } else if (key.endsWith(':folder')) {
            confirmDeleteType = 'folder';
            confirmDeleteKey = key.substring(0, key.length - 7);
        } else {
            confirmDeleteType = item.folderPath ? 'folder' : 'file';
            confirmDeleteKey = key;
        }

        confirmDeleteItem = item;
        startDeleteTimeout();
    }

    function startDeleteTimeout() {
        clearDeleteTimeout();
        deleteTimeoutId = window.setTimeout(() => {
            confirmDeleteKey = null;
            confirmDeleteItem = null;
            confirmDeleteType = null;
            confirmDeleteEnvironmentConfig = null;
            deleteTimeoutId = null;
        }, DELETE_CONFIRMATION_TIMEOUT);
    }

    function clearDeleteTimeout() {
        if (deleteTimeoutId !== null) {
            window.clearTimeout(deleteTimeoutId);
            deleteTimeoutId = null;
        }
    }

    async function confirmDelete(event: MouseEvent) {
        event.stopPropagation();
        clearDeleteTimeout();

        if (confirmDeleteType === 'environment') {
            if (!confirmDeleteEnvironmentConfig) return;

            const publicEnvPath = joinPath(confirmDeleteEnvironmentConfig.folderPath, 'http-client.env.json');
            const privateEnvPath = joinPath(confirmDeleteEnvironmentConfig.folderPath, 'http-client.private.env.json');

            const operations: Promise<{ success: boolean; error?: string }>[] = [];

            if (confirmDeleteEnvironmentConfig.hasPublicEnv) {
                operations.push(window.electronAPI.deletePath(publicEnvPath));
            }

            if (confirmDeleteEnvironmentConfig.hasPrivateEnv) {
                operations.push(window.electronAPI.deletePath(privateEnvPath));
            }

            confirmDeleteKey = null;
            confirmDeleteType = null;
            confirmDeleteEnvironmentConfig = null;

            const results = await Promise.all(operations);
            const allSucceeded = results.every(r => r.success);

            if (allSucceeded && $currentCollection) {
                await currentCollection.loadCollection(
                    $currentCollection.path,
                    $currentCollection.name
                );
            }
            return;
        }

        if (!confirmDeleteItem) return;

        const pathToDelete = confirmDeleteType === 'file'
            ? confirmDeleteItem.filePath
            : confirmDeleteItem.folderPath;

        if (!pathToDelete) return;

        confirmDeleteKey = null;
        confirmDeleteItem = null;
        confirmDeleteType = null;

        const result = await window.electronAPI.deletePath(pathToDelete);

        if (result.success) {
            if ($openFile && $openFile.filePath === pathToDelete) {
                openFile.close();
            }

            if ($currentCollection) {
                await currentCollection.loadCollection(
                    $currentCollection.path,
                    $currentCollection.name
                );
            }
        }
    }

    function handleClickOutside() {
        if (openMenuKey !== null) {
            openMenuKey = null;
        }
    }

    function handleRenameClick(event: MouseEvent, item: CollectionItem) {
        event.stopPropagation();
        openMenuKey = null;
        renameItem = item;
        showRenameModal = true;
    }

    function getCurrentName(item: CollectionItem): string {
        // When there's both a file and folder, use the file name (without extension)
        // When there's only a folder, use the folder name
        // When there's only a file, use the file name (without extension)
        const targetPath = item.filePath || item.folderPath;
        if (!targetPath) return '';
        const fullName = basename(targetPath);

        // For files (whether alone or with a folder), strip the extension
        if (item.filePath) {
            const lastDot = fullName.lastIndexOf('.');
            if (lastDot > 0) {
                return fullName.substring(0, lastDot);
            }
        }

        return fullName;
    }

    function getExtension(filePath: string): string {
        const name = basename(filePath);
        const lastDot = name.lastIndexOf('.');
        if (lastDot > 0) {
            return name.substring(lastDot);
        }
        return '';
    }

    async function handleRenameConfirm(newName: string, renameFolder: boolean, renameFile: boolean) {
        if (!renameItem) return;

        showRenameModal = false;

        const operations: Promise<{ success: boolean; error?: string }>[] = [];

        if (renameFile && renameItem.filePath) {
            const dir = dirname(renameItem.filePath);
            const extension = getExtension(renameItem.filePath);
            const newNameWithExtension = newName + extension;
            const newPath = joinPath(dir, newNameWithExtension);
            operations.push(window.electronAPI.renamePath(renameItem.filePath, newPath));
        }

        if (renameFolder && renameItem.folderPath) {
            const dir = dirname(renameItem.folderPath);
            const newPath = joinPath(dir, newName);
            operations.push(window.electronAPI.renamePath(renameItem.folderPath, newPath));
        }

        const results = await Promise.all(operations);
        const allSucceeded = results.every(r => r.success);

        if (allSucceeded) {
            if ($openFile && renameItem.filePath && $openFile.filePath === renameItem.filePath) {
                openFile.close();
            }

            if ($currentCollection) {
                await currentCollection.loadCollection(
                    $currentCollection.path,
                    $currentCollection.name
                );
            }
        }

        renameItem = null;
    }

    function handleRenameCancel() {
        showRenameModal = false;
        renameItem = null;
    }

    function handleNewFolderClick(event: MouseEvent, item: CollectionItem) {
        event.stopPropagation();
        openMenuKey = null;
        newItemParent = item;
        newItemType = 'folder';
        showNewItemModal = true;
    }

    function handleInfoClick(event: MouseEvent, folderPath: string, itemName: string) {
        event.stopPropagation();
        readmeFolderPath = folderPath;
        readmeName = itemName;
        showReadmeView = true;
    }

    function handleCloseReadme() {
        showReadmeView = false;
        readmeFolderPath = null;
        readmeName = 'README';
    }

    function handleNewFileClick(event: MouseEvent, item: CollectionItem) {
        event.stopPropagation();
        openMenuKey = null;
        newItemParent = item;
        newItemType = 'file';
        showNewItemModal = true;
    }

    function handleNewRequestClick(event: MouseEvent, item: CollectionItem) {
        event.stopPropagation();
        openMenuKey = null;
        newItemParent = item;
        newItemType = 'request';
        showNewItemModal = true;
    }

    async function handleNewEnvironmentClick(event: MouseEvent, item: CollectionItem) {
        event.stopPropagation();
        openMenuKey = null;

        if (!$currentCollection) return;

        const targetFolder = item.folderPath || dirname(item.filePath || '');
        const envFilePath = joinPath(targetFolder, 'http-client.env.json');
        const initialContent = '{}';

        const result = await window.electronAPI.createFile(envFilePath, initialContent);

        if (result.success) {
            await currentCollection.loadCollection(
                $currentCollection.path,
                $currentCollection.name
            );
        }
    }

    async function handleNewItemConfirm(name: string, createNewFile?: boolean) {
        if (!newItemParent || !$currentCollection) return;

        showNewItemModal = false;

        let parentPath = newItemParent.folderPath || dirname(newItemParent.filePath || '');

        if (newItemType === 'folder') {
            const newFolderPath = joinPath(parentPath, name);
            const result = await window.electronAPI.createFolder(newFolderPath);

            if (result.success) {
                await currentCollection.loadCollection(
                    $currentCollection.path,
                    $currentCollection.name
                );
            }
        }

        if (newItemType === 'request') {
            // Adjust variables for the file branch to use
            if (!createNewFile) {
                // Use folder name as the file name
                name = basename(newItemParent.folderPath || dirname(newItemParent.filePath || ''));
                // Adjust parentPath to be the parent of the current folder
                parentPath = dirname(newItemParent.folderPath || '');
                // Set the parent to have a folderPath so file branch uses it directly
                newItemParent = { ...newItemParent, folderPath: parentPath };
            }
            // Convert request type to file type so file branch handles it
            newItemType = 'file';
        }

        if (newItemType === 'file') {
            let targetFolder = parentPath;

            if (!newItemParent.folderPath) {
                const parentItemName = getCurrentName(newItemParent);
                targetFolder = joinPath(parentPath, parentItemName);
                await window.electronAPI.createFolder(targetFolder);
            }

            const fileName = `${name}.http`;
            const newFilePath = joinPath(targetFolder, fileName);
            const initialContent = `
### New Request

GET https://example.com

###
`;

            const result = await window.electronAPI.createFile(newFilePath, initialContent);

            if (result.success) {
                await currentCollection.loadCollection(
                    $currentCollection.path,
                    $currentCollection.name
                );
            }
        }

        newItemParent = null;
    }

    function handleNewItemCancel() {
        showNewItemModal = false;
        newItemParent = null;
    }

    function handleDeleteEnvironment(event: MouseEvent, itemKey: string, environmentConfig: EnvironmentConfig) {
        event.stopPropagation();
        openMenuKey = null;
        confirmDeleteKey = itemKey;
        confirmDeleteType = 'environment';
        confirmDeleteEnvironmentConfig = environmentConfig;
        startDeleteTimeout();
    }

    function isRootEnvironment(environmentConfig: EnvironmentConfig | undefined): boolean {
        if (!environmentConfig || !$currentCollection) return true;
        return environmentConfig.folderPath === $currentCollection.path;
    }

    export {formatVerb, getVerbColor, flattenCollection, flattenItems};
</script>

<svelte:window on:click={handleClickOutside} />

<div class="collection-items">
    {#if $currentCollection}
        {#if flatItems.length === 0}
            <p class="empty-message">No .http files found in this collection</p>
        {:else}
            <div class="items-list">
                {#each flatItems as {
                    item,
                    indent,
                    isSection,
                    section,
                    hasChildren,
                    folderPath,
                    fileKey,
                    isEnvironment,
                    environmentConfig
                } }
                    {#if isSection && section?.isDivider}
                        <div class="divider"
                             style="margin-left: {(indent * INDENT_WIDTH) + 8}px; margin-right: 8px;"></div>
                    {:else if isEnvironment}
                        {@const itemKey = getItemKey(item, section, environmentConfig)}
                        {@const isRoot = isRootEnvironment(environmentConfig)}
                        <div
                                class="item environment-item"
                                class:clickable={!!environmentConfig}
                                style="padding-left: {indent * INDENT_WIDTH}px;"
                                role="button"
                                tabindex="0"
                                on:click={() => environmentConfig && handleEnvironmentClick(environmentConfig)}
                                on:keydown={(e) => { if (e.key === 'Enter' && environmentConfig) handleEnvironmentClick(environmentConfig) }}
                        >
                            <span class="environment-icon">
                                <Settings size={16}/>
                            </span>
                            <span class="item-title">{item.title}</span>

                            {#if !isRoot && environmentConfig}
                                <div class="item-actions">
                                    {#if confirmDeleteKey === itemKey}
                                        <button
                                                class="action-button confirm-delete-button"
                                                on:click={(e) => confirmDelete(e)}
                                                title="Confirm delete"
                                                aria-label="Confirm delete"
                                        >
                                            <AlertTriangle size={16}/>
                                        </button>
                                    {:else}
                                        <button
                                                class="action-button menu-button"
                                                on:click={(e) => toggleMenu(e, itemKey)}
                                                title="More options"
                                                aria-label="More options"
                                        >
                                            <MoreVertical size={16}/>
                                        </button>

                                        {#if openMenuKey === itemKey}
                                            <div class="dropdown-menu">
                                                <button
                                                        class="dropdown-item delete-item"
                                                        on:click={(e) => handleDeleteEnvironment(e, itemKey, environmentConfig)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        {/if}
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    {:else}
                        {@const itemKey = getItemKey(item, section)}
                        <div
                                class="item"
                                class:clickable={!!item.filePath}
                                style="padding-left: {indent * INDENT_WIDTH}px;"
                                role="button"
                                tabindex={item.filePath ? 0 : -1}
                                on:click={() => handleItemClick(item, section)}
                                on:keydown={(e) => e.key === 'Enter' && handleItemClick(item, section)}
                        >
                            {#if isSection && section?.verb}
                                <span class="verb-badge" style="color: {getVerbColor(section.verb)}">
                                    {formatVerb(section.verb)}
                                </span>
                            {:else if hasChildren}
                                <span
                                        class="chevron"
                                        class:collapsed={isCollapsed(folderPath || fileKey)}
                                        role="button"
                                        tabindex="0"
                                        on:click|stopPropagation={() => {
                                            toggle(folderPath || fileKey || '');
                                        }}
                                        on:keydown|stopPropagation={(e) => {
                                            if (e.key === 'Enter') {
                                                toggle(folderPath || fileKey || '');
                                            }
                                        }}
                                >
                                    <ChevronRight size={16}/>
                                </span>
                            {:else}
                                <span class="chevron-spacer"></span>
                            {/if}
                            <span class="item-title">{item.title}</span>

                            {#if !isSection && (item.folderPath || item.filePath)}
                                <div class="item-actions">
                                    {#if confirmDeleteKey === itemKey}
                                        <button
                                                class="action-button confirm-delete-button"
                                                on:click={(e) => confirmDelete(e)}
                                                title="Confirm delete"
                                                aria-label="Confirm delete"
                                        >
                                            <AlertTriangle size={16}/>
                                        </button>
                                    {:else}
                                        {#if item.hasReadme}
                                            <button
                                                    class="action-button info-button"
                                                    on:click={(e) => handleInfoClick(e, item.folderPath || '', item.title)}
                                                    title="Contains README"
                                                    aria-label="Contains README"
                                            >
                                                <Info size={16}/>
                                            </button>
                                        {/if}
                                        <button
                                                class="action-button menu-button"
                                                on:click={(e) => toggleMenu(e, itemKey)}
                                                title="More options"
                                                aria-label="More options"
                                        >
                                            <MoreVertical size={16}/>
                                        </button>

                                        {#if openMenuKey === itemKey}
                                            <div class="dropdown-menu">
                                                <button
                                                        class="dropdown-item"
                                                        on:click={(e) => handleNewFolderClick(e, item)}
                                                >
                                                    New Folder
                                                </button>
                                                {#if item.folderPath && !item.filePath}
                                                    <button
                                                            class="dropdown-item"
                                                            on:click={(e) => handleNewRequestClick(e, item)}
                                                    >
                                                        New Request
                                                    </button>
                                                {:else}
                                                    <button
                                                            class="dropdown-item"
                                                            on:click={(e) => handleNewFileClick(e, item)}
                                                    >
                                                        New File
                                                    </button>
                                                {/if}
                                                {#if item.folderPath && !item.environments && item.items && item.items.length > 0}
                                                    <button
                                                            class="dropdown-item"
                                                            on:click={(e) => handleNewEnvironmentClick(e, item)}
                                                    >
                                                        New Environment
                                                    </button>
                                                {/if}
                                                <div class="dropdown-separator"></div>
                                                <button
                                                        class="dropdown-item"
                                                        on:click={(e) => handleRenameClick(e, item)}
                                                >
                                                    Rename
                                                </button>
                                                <div class="dropdown-separator"></div>
                                                {#if item.filePath}
                                                    <button
                                                            class="dropdown-item delete-item"
                                                            on:click={(e) => handleDeleteClick(e, `${itemKey}:file`, item)}
                                                    >
                                                        Delete {#if item.folderPath}All Requests{/if}
                                                    </button>
                                                {/if}
                                                {#if item.folderPath}
                                                    <button
                                                            class="dropdown-item delete-item"
                                                            on:click={(e) => handleDeleteClick(e, `${itemKey}:folder`, item)}
                                                    >
                                                        Delete {#if item.filePath}All Subgroups{/if}
                                                    </button>
                                                {/if}
                                            </div>
                                        {/if}
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    {/if}
                {/each}
            </div>
        {/if}
    {:else}
        <p class="no-collection">Select a collection to view its items</p>
    {/if}
</div>

{#if showRenameModal && renameItem}
    <RenameModal
        currentName={getCurrentName(renameItem)}
        showFolderCheckbox={!!renameItem.folderPath}
        showFileCheckbox={!!renameItem.filePath}
        onConfirm={handleRenameConfirm}
        onCancel={handleRenameCancel}
    />
{/if}

{#if showNewItemModal}
    <NewItemModal
        itemType={newItemType}
        onConfirm={handleNewItemConfirm}
        onCancel={handleNewItemCancel}
    />
{/if}

{#if showReadmeView && readmeFolderPath}
    <ReadmeView
        folderPath={readmeFolderPath}
        name={readmeName}
        onClose={handleCloseReadme}
    />
{/if}

<style>
    .collection-items {
        padding: 1rem 0 1rem 1rem;
        background: var(--sidebar-bg);
        color: var(--text-primary);
        flex: 1;
        overflow-y: auto;
        font-size: 0.75rem;
    }

    .empty-message,
    .no-collection {
        color: var(--text-secondary);
        font-style: italic;
    }

    .items-list {
        display: flex;
        flex-direction: column;
    }

    .item {
        padding: 0.5rem 0;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--text-primary);
        position: relative;
    }

    .item-title {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .item.clickable {
        cursor: pointer;
    }

    .item.clickable:hover {
        background: var(--sidebar-item-hover);
    }

    .environment-item {
        color: var(--text-secondary);
        font-style: italic;
    }

    .environment-item.clickable:hover {
        background: var(--sidebar-item-hover);
    }

    .environment-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
    }

    .divider {
        height: 3px;
        background: var(--border-default);
        margin: 0.1rem 0;
        opacity: 0.5;
    }

    .chevron {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
        cursor: pointer;
        transition: transform 0.2s ease;
        transform: rotate(90deg);
    }

    .chevron.collapsed {
        transform: rotate(0deg);
    }

    .chevron:hover {
        color: var(--text-primary);
    }

    .chevron-spacer {
        display: inline-block;
        width: 16px;
    }

    .verb-badge {
        font-size: 0.55rem;
        font-weight: 600;
        padding: 2px 4px 1px 4px;
        border: 1px solid currentColor;
        border-radius: 3px;
        font-family: 'Monaspace Neon', 'Consolas', 'Monaco', 'Courier New', monospace;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 32px;
        opacity: 0.8;
    }

    .item-actions {
        margin-left: auto;
        position: relative;
        display: flex;
        align-items: center;
    }

    .action-button {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 0.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 3px;
        transition: all 0.2s;
    }

    .action-button:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
    }

    .confirm-delete-button {
        color: var(--interactive-danger);
        animation: pulse 0.5s ease-in-out;
    }

    .confirm-delete-button:hover {
        background: var(--interactive-danger);
        color: white;
    }

    .info-button {
        color: var(--text-secondary);
    }

    .info-button:hover {
        color: var(--text-primary);
    }

    @keyframes pulse {
        0%, 100% {
            transform: scale(1);
        }
        50% {
            transform: scale(1.1);
        }
    }

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

    .dropdown-item {
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

    .dropdown-item:hover {
        background: var(--bg-tertiary);
    }

    .dropdown-item.delete-item {
        color: var(--interactive-danger);
    }

    .dropdown-item.delete-item:hover {
        background: var(--interactive-danger);
        color: white;
    }

    .dropdown-separator {
        height: 1px;
        background: var(--border-default);
        margin: 0.25rem 0;
    }
</style>
