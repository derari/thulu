<script lang="ts">
    // Collection items component with environment support
    import {currentCollection} from './stores/currentCollection.js';
    import {openFile} from './stores/openFile.js';
    import {openEnvironments} from './stores/openEnvironments.js';
    import type {CollectionItem, HttpSection, EnvironmentConfig} from './collection';
    import { ChevronRight, Settings } from 'lucide-svelte';

    interface DisplayItem {
        item: CollectionItem;
        indent: number;
        isSection: boolean;
        section?: HttpSection;
        isFolder: boolean;
        isFile: boolean;
        hasChildren: boolean;
        folderPath?: string;
        fileKey?: string;
        isEnvironment: boolean;
        environmentConfig?: EnvironmentConfig;
    }

    let collapsedFolders: Set<string> = new Set();
    let collapsedFiles: Set<string> = new Set();

    function toggleFolder(folderPath: string) {
        if (collapsedFolders.has(folderPath)) {
            collapsedFolders.delete(folderPath);
            collapsedFolders = new Set(collapsedFolders);
        } else {
            collapsedFolders.add(folderPath);
            collapsedFolders = new Set(collapsedFolders);
        }
    }

    function toggleFile(fileKey: string) {
        if (collapsedFiles.has(fileKey)) {
            collapsedFiles.delete(fileKey);
            collapsedFiles = new Set(collapsedFiles);
        } else {
            collapsedFiles.add(fileKey);
            collapsedFiles = new Set(collapsedFiles);
        }
    }

    function isFolderCollapsed(folderPath: string | undefined): boolean {
        if (!folderPath) return false;
        return collapsedFolders.has(folderPath);
    }

    function isFileCollapsed(fileKey: string | undefined): boolean {
        if (!fileKey) return false;
        return collapsedFiles.has(fileKey);
    }

    function formatVerb(verb: string): string {
        const upper = verb.toUpperCase();
        if (upper === 'PATCH') return 'PTCH';
        if (upper === 'DELETE') return 'DEL';
        if (upper === 'OPTIONS') return 'OPT';
        return upper.substring(0, 4);
    }

    function getVerbColor(verb: string): string {
        const upper = verb.toUpperCase();
        switch (upper) {
            case 'GET': return 'var(--http-verb-get)';
            case 'POST': return 'var(--http-verb-post)';
            case 'PUT': return 'var(--http-verb-put)';
            case 'PATCH': return 'var(--http-verb-patch)';
            case 'DELETE': return 'var(--http-verb-delete)';
            default: return 'var(--http-verb-other)';
        }
    }

    function handleSectionClick(filePath: string, section?: HttpSection) {
        if (!filePath) return;
        openFile.openFile(filePath, section?.lineNumber);
    }

    async function handleItemClick(item: CollectionItem, section?: HttpSection) {
        if (!item.filePath) return;
        await openFile.save();
        const closed = openEnvironments.close();
        if (closed) {
            // Environments view closed successfully, open the file
            handleSectionClick(item.filePath, section);
        }
        // If not closed, modal will be shown and navigation will happen after user decision
    }

    async function handleEnvironmentClick(environmentConfig: EnvironmentConfig) {
        if (!$currentCollection) return;
        await openFile.save();
        openFile.close();
        const navigated = openEnvironments.open(environmentConfig, $currentCollection.path);
        // If navigation didn't happen immediately, the modal will be shown by EnvironmentsView
    }

    function flattenItems(items: CollectionItem[], depth: number = 0): DisplayItem[] {
        const result: DisplayItem[] = [];

        for (const item of items) {
            const hasFolder = !!item.folderPath;
            const hasFile = !!item.filePath;
            const hasSections = hasFile && item.sections && item.sections.length > 0;
            const hasSubItems = hasFolder && item.items && item.items.length > 0;
            const hasEnvironments = !!item.environments;

            if (!hasFile && !hasFolder && hasEnvironments) {
                result.push({
                    item: {title: item.title, environments: item.environments},
                    indent: depth,
                    isSection: false,
                    isFolder: false,
                    isFile: false,
                    hasChildren: false,
                    isEnvironment: true,
                    environmentConfig: item.environments
                });
                continue;
            }

            if (!hasFile && !hasFolder) {
                continue;
            }
            const hasChildren = !!(hasFolder && (hasSubItems || hasEnvironments)) || !!(hasFile && hasSections);

            result.push({
                item: {title: item.title, folderPath: item.folderPath, filePath: item.filePath, environments: item.environments},
                indent: depth,
                isSection: false,
                isFolder: hasFolder,
                isFile: hasFile,
                hasChildren: hasChildren,
                folderPath: item.folderPath,
                fileKey: item.filePath,
                isEnvironment: false,
                environmentConfig: item.environments
            });

            if (hasFolder) {
                const isCollapsed = isFolderCollapsed(item.folderPath);

                if (hasEnvironments && !isCollapsed) {
                    result.push({
                        item: {title: 'Environments', environments: item.environments},
                        indent: depth + 1,
                        isSection: false,
                        isFolder: false,
                        isFile: false,
                        hasChildren: false,
                        isEnvironment: true,
                        environmentConfig: item.environments
                    });
                }

                if (hasSubItems && !isCollapsed) {
                    result.push(...flattenItems(item.items!, depth + 1));
                }
            }

            if (hasFile) {
                const fileKey = item.filePath!;
                const folderIsCollapsed = hasFolder && isFolderCollapsed(item.folderPath);

                if (hasSections && !folderIsCollapsed && !isFileCollapsed(fileKey)) {
                    for (const section of item.sections!) {
                        result.push({
                            item: {
                                title: section.name,
                                filePath: section.isDivider ? undefined : item.filePath
                            },
                            indent: depth + 1,
                            isSection: true,
                            section: section,
                            isFolder: false,
                            isFile: false,
                            hasChildren: false,
                            isEnvironment: false
                        });
                    }
                }
            }
        }

        return result;
    }

    $: flatItems = (() => {
        if (!$currentCollection) return [];
        collapsedFolders;
        collapsedFiles;
        return flattenItems($currentCollection.items);
    })();
</script>

<div class="collection-items">
    {#if $currentCollection}
        {#if flatItems.length === 0}
            <p class="empty-message">No .http files found in this collection</p>
        {:else}
            <div class="items-list">
                {#each flatItems as {item, indent, isSection, section, isFolder, isFile, hasChildren, folderPath, fileKey, isEnvironment, environmentConfig} }
                    {#if isSection && section?.isDivider}
                        <div class="divider" style="margin-left: {(indent * 10) + 8}px; margin-right: 8px;"></div>
                    {:else if isEnvironment}
                        <div
                                class="item environment-item clickable"
                                style="padding-left: {indent * 10}px;"
                                role="button"
                                tabindex="0"
                                on:click={() => handleEnvironmentClick(environmentConfig!)}
                                on:keydown={(e) => { if (e.key === 'Enter') handleEnvironmentClick(environmentConfig!) }}
                        >
                            <span class="environment-icon">
                                <Settings size={16} />
                            </span>
                            <span class="item-title">{item.title}</span>
                        </div>
                    {:else}
                        <div
                                class="item"
                                class:clickable={!!item.filePath}
                                style="padding-left: {indent * 10}px;"
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
                                    class:collapsed={isFolder ? isFolderCollapsed(folderPath) : isFileCollapsed(fileKey)}
                                    role="button"
                                    tabindex="0"
                                    on:click|stopPropagation={() => {
                                        if (isFolder && folderPath) {
                                            toggleFolder(folderPath);
                                        }
                                        if (isFile && fileKey) {
                                            toggleFile(fileKey);
                                        }
                                    }}
                                    on:keydown|stopPropagation={(e) => {
                                        if (e.key === 'Enter') {
                                            if (isFolder && folderPath) {
                                                toggleFolder(folderPath);
                                            }
                                            if (isFile && fileKey) {
                                                toggleFile(fileKey);
                                            }
                                        }
                                    }}
                                >
                                    <ChevronRight size={16} />
                                </span>
                            {:else}
                                <span class="chevron-spacer"></span>
                            {/if}
                            <span class="item-title">{item.title}</span>
                        </div>
                    {/if}
                {/each}
            </div>
        {/if}
    {:else}
        <p class="no-collection">Select a collection to view its items</p>
    {/if}
</div>

<style>
    .collection-items {
        padding: 1rem;
        background: var(--sidebar-bg);
        color: var(--text-primary);
        flex: 1;
        overflow-y: auto;
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
        padding: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--text-primary);
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
        font-size: 0.65rem;
        font-weight: 600;
        padding: 2px 4px;
        border: 1px solid currentColor;
        border-radius: 3px;
        font-family: monospace;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 32px;
        opacity: 0.8;
    }

    .item-title {
        font-size: 0.9rem;
    }
</style>

