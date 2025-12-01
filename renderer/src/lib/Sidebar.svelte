<script lang="ts">
    import {onMount} from 'svelte';
    import {currentCollectionName, hasCurrentCollection, currentCollection} from './stores/currentCollection.js';
    import {openFile} from './stores/openFile.js';
    import {openEnvironments} from './stores/openEnvironments.js';
    import CollectionItems from './CollectionItems.svelte';
    import NewItemModal from './NewItemModal.svelte';
    import RenameModal from './RenameModal.svelte';
    import {MoreVertical, Info} from 'lucide-svelte';
    import ReadmeView from './ReadmeView.svelte';

    let width: number = 200;
    let isResizing = false;
    let startX = 0;
    let startWidth = 200;
    let showHeaderMenu = false;
    let showNewItemModal = false;
    let newItemType: 'file' | 'folder' = 'file';
    let showRenameModal = false;
    let showReadmeView = false;
    let readmeName: string = 'README';

    async function handleCollectionNameClick() {
        await openFile.save();
        openFile.close();
        openEnvironments.close();
    }

    function handleMouseDown(event: MouseEvent) {
        isResizing = true;
        startX = event.clientX;
        startWidth = width;
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }

    function handleMouseMove(event: MouseEvent) {
        if (!isResizing) return;
        let newWidth = startWidth + (event.clientX - startX);
        if (newWidth < 50) newWidth = 50;
        if (newWidth > 600) newWidth = 600;
        width = newWidth;
    }

    function handleMouseUp() {
        if (!isResizing) return;
        isResizing = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.electronAPI.savePreferences({sidebarWidth: width});
    }

    function joinPath(dir: string, name: string): string {
        const normalizedDir = dir.replace(/\\/g, '/');
        return `${normalizedDir}/${name}`.replace(/\\/g, '/');
    }

    function toggleHeaderMenu(event: MouseEvent) {
        event.stopPropagation();
        showHeaderMenu = !showHeaderMenu;
    }

    function handleNewFolderClick(event: MouseEvent) {
        event.stopPropagation();
        showHeaderMenu = false;
        newItemType = 'folder';
        showNewItemModal = true;
    }

    function handleNewFileClick(event: MouseEvent) {
        event.stopPropagation();
        showHeaderMenu = false;
        newItemType = 'file';
        showNewItemModal = true;
    }

    async function handleNewItemConfirm(name: string) {
        if (!$currentCollection) return;

        showNewItemModal = false;

        const rootPath = $currentCollection.path;

        if (newItemType === 'folder') {
            const newFolderPath = joinPath(rootPath, name);
            const result = await window.electronAPI.createFolder(newFolderPath);

            if (result.success) {
                await currentCollection.loadCollection(
                    $currentCollection.path,
                    $currentCollection.name
                );
            }
        }

        if (newItemType === 'file') {
            const fileName = `${name}.http`;
            const newFilePath = joinPath(rootPath, fileName);
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
    }

    function handleNewItemCancel() {
        showNewItemModal = false;
    }

    function handleRenameClick(event: MouseEvent) {
        event.stopPropagation();
        showHeaderMenu = false;
        showRenameModal = true;
    }

    async function handleRenameConfirm(newName: string, _renameFolder?: boolean, _renameFile?: boolean) {
        if (!$currentCollection) return;

        showRenameModal = false;

        const result = await window.electronAPI.updateCollectionName(
            $currentCollection.path,
            newName
        );

        if (result.success) {
            // Reload the collection with the new name
            await currentCollection.loadCollection(
                $currentCollection.path,
                newName
            );
        }
    }

    function handleRenameCancel() {
        showRenameModal = false;
    }

    function handleShowInFileSystem(event: MouseEvent) {
        event.stopPropagation();
        showHeaderMenu = false;
        if ($currentCollection) {
            window.electronAPI.showInFileSystem($currentCollection.path);
        }
    }

    function handleClickOutside() {
        if (showHeaderMenu) {
            showHeaderMenu = false;
        }
    }

    function handleInfoClick(event: MouseEvent) {
        event.stopPropagation();
        showHeaderMenu = false;
        readmeName = $currentCollection?.name || 'README';
        showReadmeView = true;
    }

    function handleCloseReadme() {
        showReadmeView = false;
        readmeName = 'README';
    }

    onMount(() => {
        window.electronAPI.onPreferencesLoad((preferences: Preferences) => {
            if (preferences.sidebarWidth && preferences.sidebarWidth >= 50) {
                width = preferences.sidebarWidth;
            }
        });
        window.electronAPI.requestPreferences();
    });
</script>

<svelte:window on:click={handleClickOutside} />

{#if $hasCurrentCollection}
    <div class="sidebar" style="width: {width}px; min-width: 50px; max-width: 600px;">
        <div class="sidebar-header">
            <div
                    class="header-title"
                    role="button"
                    tabindex="0"
                    on:click={handleCollectionNameClick}
                    on:keydown={(e) => e.key === 'Enter' && handleCollectionNameClick()}
            >
                {$currentCollectionName}
            </div>
            <div class="header-actions">
                {#if $currentCollection?.root.hasReadme}
                    <button
                            class="header-action-button info-button"
                            on:click={handleInfoClick}
                            title="Collection has README"
                            aria-label="Collection has README"
                    >
                        <Info size={16}/>
                    </button>
                {/if}
                <button
                        class="header-menu-button"
                        on:click={toggleHeaderMenu}
                        title="More options"
                        aria-label="More options"
                >
                    <MoreVertical size={16}/>
                </button>

                {#if showHeaderMenu}
                    <div class="header-dropdown-menu">
                        <button
                                class="dropdown-item"
                                on:click={handleNewFolderClick}
                        >
                            New Folder
                        </button>
                        <button
                                class="dropdown-item"
                                on:click={handleNewFileClick}
                        >
                            New File
                        </button>
                        <div class="dropdown-separator"></div>
                        <button
                                class="dropdown-item"
                                on:click={handleRenameClick}
                        >
                            Rename
                        </button>
                        <button
                                class="dropdown-item"
                                on:click={handleShowInFileSystem}
                        >
                            Show in File System
                        </button>
                    </div>
                {/if}
            </div>
        </div>
        <CollectionItems/>
        <slot/>
    </div>
    <button class="sidebar-resizer" aria-label="Resize sidebar" on:mousedown={handleMouseDown}></button>
{/if}

{#if showNewItemModal}
    <NewItemModal
        itemType={newItemType}
        onConfirm={handleNewItemConfirm}
        onCancel={handleNewItemCancel}
    />
{/if}

{#if showRenameModal && $currentCollection}
    <RenameModal
        currentName={$currentCollection.name}
        showFolderCheckbox={false}
        showFileCheckbox={false}
        onConfirm={handleRenameConfirm}
        onCancel={handleRenameCancel}
    />
{/if}

{#if showReadmeView && $currentCollection}
    <ReadmeView
        folderPath={$currentCollection.path}
        name={readmeName}
        onClose={handleCloseReadme}
    />
{/if}

<style>
    .sidebar {
        height: 100%;
        background: var(--sidebar-bg);
        border-right: 1px solid var(--border-default);
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .sidebar-header {
        font-weight: bold;
        padding: 1rem;
        border-bottom: 1px solid var(--border-default);
        background: var(--sidebar-header);
        color: var(--text-primary);
        flex-shrink: 0;
        user-select: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .header-title {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
    }

    .header-title:hover {
        opacity: 0.8;
    }

    .header-actions {
        position: relative;
        display: flex;
        align-items: center;
    }

    .header-menu-button {
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

    .header-menu-button:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
    }

    .header-action-button {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 0.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 3px;
        transition: all 0.2s;
    }

    .header-action-button.info-button {
        color: var(--text-secondary);
    }

    .header-action-button.info-button:hover {
        color: var(--text-primary);
        background: var(--bg-tertiary);
    }

    .header-dropdown-menu {
        position: absolute;
        top: 100%;
        right: 0;
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

    .dropdown-separator {
        height: 1px;
        background: var(--border-default);
        margin: 0.25rem 0;
    }

    .sidebar-resizer {
        width: 6px;
        cursor: ew-resize;
        background: var(--border-default);
        height: 100%;
        z-index: 10;
        border: none;
        padding: 0;
        margin: 0;
    }
</style>
