import { get } from 'svelte/store';
import { api } from './api';
import type { CollectionItem, EnvironmentConfig } from './collection';
import { createEnvironmentFile, deleteEnvironmentFiles } from './environmentFiles';
import { baseName, dirName, joinPath } from './paths';
import { currentCollection } from './stores/currentCollection';
import { openFile } from './stores/openFile';

/**
 * File operations on the items of the current collection. Each one changes the file system,
 * then reloads the collection; they resolve to whether the change succeeded.
 */

export type NewItemKind = 'file' | 'folder' | 'request';

export const NEW_REQUEST_TEMPLATE = `
### New Request

GET https://example.com

###
`;

async function reloadAfter(success: boolean): Promise<boolean> {
    if (success) {
        await currentCollection.reload();
    }
    return success;
}

function closeIfOpen(filePath: string | undefined) {
    const open = get(openFile);
    if (open && filePath && open.filePath === filePath) {
        openFile.close();
    }
}

function extensionOf(filePath: string): string {
    const name = baseName(filePath);
    const lastDot = name.lastIndexOf('.');
    return lastDot > 0 ? name.substring(lastDot) : '';
}

/** The folder an item lives in or, for a file without a folder, the folder that contains the file. */
function containingFolder(item: CollectionItem): string {
    return item.folderPath || dirName(item.filePath || '');
}

/** The name shown for an item, which is its file name without the extension, or else its folder name. */
export function itemName(item: CollectionItem): string {
    const targetPath = item.filePath || item.folderPath;
    if (!targetPath) return '';
    const fullName = baseName(targetPath);

    if (item.filePath) {
        const lastDot = fullName.lastIndexOf('.');
        if (lastDot > 0) {
            return fullName.substring(0, lastDot);
        }
    }

    return fullName;
}

export async function createFolder(parentPath: string, name: string): Promise<boolean> {
    const result = await api.createFolder(joinPath(parentPath, name));
    return reloadAfter(result.success);
}

export async function createRequestFile(folderPath: string, name: string): Promise<boolean> {
    const result = await api.createFile(joinPath(folderPath, `${name}.http`), NEW_REQUEST_TEMPLATE);
    return reloadAfter(result.success);
}

/**
 * Creates a folder, a request file or, for kind 'request', requests belonging to `parent`.
 * A file added to an item that has no folder yet gets a folder named after that item.
 * A request with `createNewFile` false goes into a file named after the folder, next to the folder.
 */
export async function createItem(
    kind: NewItemKind,
    parent: CollectionItem,
    name: string,
    createNewFile = true
): Promise<boolean> {
    let parentPath = containingFolder(parent);

    if (kind === 'folder') {
        return createFolder(parentPath, name);
    }

    let folderPath = parent.folderPath;
    if (kind === 'request' && !createNewFile) {
        name = baseName(containingFolder(parent));
        parentPath = dirName(parent.folderPath || '');
        folderPath = parentPath;
    }

    let targetFolder = parentPath;
    if (!folderPath) {
        targetFolder = joinPath(parentPath, itemName(parent));
        await api.createFolder(targetFolder);
    }

    return createRequestFile(targetFolder, name);
}

export async function createEnvironmentFor(item: CollectionItem): Promise<boolean> {
    const result = await createEnvironmentFile(containingFolder(item));
    return reloadAfter(result.success);
}

export async function renameItem(
    item: CollectionItem,
    newName: string,
    renameFolder: boolean,
    renameFile: boolean
): Promise<boolean> {
    const operations: Promise<{ success: boolean; error?: string }>[] = [];

    if (renameFile && item.filePath) {
        const newPath = joinPath(dirName(item.filePath), newName + extensionOf(item.filePath));
        operations.push(api.renamePath(item.filePath, newPath));
    }

    if (renameFolder && item.folderPath) {
        const newPath = joinPath(dirName(item.folderPath), newName);
        operations.push(api.renamePath(item.folderPath, newPath));
    }

    const results = await Promise.all(operations);
    const success = results.every((r) => r.success);
    if (success) {
        closeIfOpen(item.filePath);
    }
    return reloadAfter(success);
}

export async function deleteItem(path: string): Promise<boolean> {
    const result = await api.deletePath(path);
    if (result.success) {
        closeIfOpen(path);
    }
    return reloadAfter(result.success);
}

export async function deleteEnvironment(config: EnvironmentConfig): Promise<boolean> {
    return reloadAfter(await deleteEnvironmentFiles(config));
}

export async function renameCollection(newName: string): Promise<boolean> {
    const collection = get(currentCollection);
    if (!collection) return false;

    const result = await api.updateCollectionName(collection.path, newName);
    if (result.success) {
        await currentCollection.loadCollection(collection.path, newName);
    }
    return result.success;
}
