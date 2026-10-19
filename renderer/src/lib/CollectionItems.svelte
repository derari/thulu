<script lang="ts">
    // Collection items component with environment support
    import {currentCollection} from './stores/currentCollection.js';
    import {openFile} from './stores/openFile.js';
    import {openEnvironments} from './stores/openEnvironments.js';
    import {preferences} from './stores/preferences.js';
    import {itemMenu} from './stores/itemMenu.js';
    import type {CollectionItem, EnvironmentConfig, HttpSection} from './collection';
    import {flattenCollection, flattenItems, formatVerb, getVerbColor, INDENT_WIDTH} from './CollectionItemsUtils';
    import * as operations from './collectionOperations';
    import EnvironmentRow from './EnvironmentRow.svelte';
    import ItemRow from './ItemRow.svelte';
    import RenameModal from './RenameModal.svelte';
    import NewItemModal from './NewItemModal.svelte';
    import ReadmeView from './ReadmeView.svelte';

    let collapsed: Set<string> = new Set();
    let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    // Re-initialize collapsed state whenever the active collection changes
    let lastLoadedCollectionPath: string | null = null;
    $: if ($currentCollection && $preferences && $currentCollection.path !== lastLoadedCollectionPath) {
        lastLoadedCollectionPath = $currentCollection.path;
        const entry = $preferences.collections?.find(c => c.path === $currentCollection!.path);
        collapsed = new Set(entry?.collapsedPaths ?? []);
    }

    function saveCollapsedState() {
        if (saveDebounceTimer !== null) clearTimeout(saveDebounceTimer);
        saveDebounceTimer = setTimeout(() => {
            if (!$currentCollection) return;
            preferences.updateCollection($currentCollection.path, $currentCollection.name, {collapsedPaths: [...collapsed]});
        }, 300);
    }

    let showRenameModal = false;
    let renameTarget: CollectionItem | null = null;
    let showNewItemModal = false;
    let newItemKind: operations.NewItemKind = 'file';
    let newItemParent: CollectionItem | null = null;
    let showReadmeView = false;
    let readmeFolderPath: string | null = null;
    let readmeName: string = 'README';

    $: flatItems = (() => {
        if (!$currentCollection) return [];
        collapsed;
        return flattenCollection($currentCollection.root, isCollapsed);
    })();

    function collapseKey(key: string): string {
        return key.endsWith('.http') ? key.substring(0, key.length - 5) : key;
    }

    function toggle(key: string) {
        key = collapseKey(key);
        if (collapsed.has(key)) {
            collapsed.delete(key);
        } else {
            collapsed.add(key);
        }
        collapsed = new Set(collapsed);
        saveCollapsedState();
    }

    function isCollapsed(key: string | undefined): boolean {
        if (!key) return false;
        return collapsed.has(collapseKey(key));
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
            await openFile.openFile(item.filePath, section?.startLineNumber);
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

    function isRootEnvironment(environmentConfig: EnvironmentConfig | undefined): boolean {
        if (!environmentConfig || !$currentCollection) return true;
        return environmentConfig.folderPath === $currentCollection.path;
    }

    function handleRename(item: CollectionItem) {
        renameTarget = item;
        showRenameModal = true;
    }

    async function handleRenameConfirm(newName: string, renameFolder: boolean, renameFile: boolean) {
        if (!renameTarget) return;

        showRenameModal = false;
        await operations.renameItem(renameTarget, newName, renameFolder, renameFile);
        renameTarget = null;
    }

    function handleRenameCancel() {
        showRenameModal = false;
        renameTarget = null;
    }

    function handleNewItem(kind: operations.NewItemKind, item: CollectionItem) {
        newItemParent = item;
        newItemKind = kind;
        showNewItemModal = true;
    }

    async function handleNewItemConfirm(name: string, createNewFile?: boolean) {
        if (!newItemParent || !$currentCollection) return;

        showNewItemModal = false;
        await operations.createItem(newItemKind, newItemParent, name, createNewFile);
        newItemParent = null;
    }

    function handleNewItemCancel() {
        showNewItemModal = false;
        newItemParent = null;
    }

    function handleShowReadme(folderPath: string, itemName: string) {
        readmeFolderPath = folderPath;
        readmeName = itemName;
        showReadmeView = true;
    }

    function handleCloseReadme() {
        showReadmeView = false;
        readmeFolderPath = null;
        readmeName = 'README';
    }

    export {formatVerb, getVerbColor, flattenCollection, flattenItems};
</script>

<svelte:window on:click={() => itemMenu.close()} />

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
                        <EnvironmentRow
                                title={item.title}
                                {indent}
                                {environmentConfig}
                                isRoot={isRootEnvironment(environmentConfig)}
                                on:open={(e) => handleEnvironmentClick(e.detail)}
                        />
                    {:else}
                        <ItemRow
                                {item}
                                {section}
                                {indent}
                                {isSection}
                                {hasChildren}
                                {environmentConfig}
                                collapsed={isCollapsed(folderPath || fileKey)}
                                toggleKey={folderPath || fileKey || ''}
                                isRootEnvironment={isRootEnvironment(environmentConfig)}
                                on:select={(e) => handleItemClick(e.detail.item, e.detail.section)}
                                on:toggle={(e) => toggle(e.detail)}
                                on:readme={(e) => handleShowReadme(e.detail.folderPath, e.detail.title)}
                                on:newItem={(e) => handleNewItem(e.detail.kind, e.detail.item)}
                                on:newEnvironment={(e) => operations.createEnvironmentFor(e.detail)}
                                on:rename={(e) => handleRename(e.detail)}
                                on:openEnvironment={(e) => handleEnvironmentClick(e.detail)}
                        />
                    {/if}
                {/each}
            </div>
        {/if}
    {:else}
        <p class="no-collection">Select a collection to view its items</p>
    {/if}
</div>

{#if showRenameModal && renameTarget}
    <RenameModal
        currentName={operations.itemName(renameTarget)}
        showFolderCheckbox={!!renameTarget.folderPath}
        showFileCheckbox={!!renameTarget.filePath}
        onConfirm={handleRenameConfirm}
        onCancel={handleRenameCancel}
    />
{/if}

{#if showNewItemModal}
    <NewItemModal
        itemType={newItemKind}
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

    .divider {
        height: 3px;
        background: var(--border-default);
        margin: 0.1rem 0;
        opacity: 0.5;
    }
</style>
