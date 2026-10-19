import type { CollectionItem, EnvironmentConfig } from './collection';
import { environmentFilePath, isEnvironmentFileName } from './environmentFiles';
import { joinPath } from './paths';

interface DirectoryEntry {
    name: string;
    isDirectory: boolean;
    isFile: boolean;
}

async function listDirectory(dirPath: string): Promise<DirectoryEntry[]> {
    const entries: DirectoryEntry[] = [];
    const fileList = await window.electronAPI.listDirectory(dirPath);

    for (const entry of fileList) {
        entries.push(entry);
    }

    return entries;
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        return await window.electronAPI.fileExists(filePath);
    } catch (error) {
        console.error('error checking ' + filePath, error);
        return false;
    }
}

async function folderContainsMarkdown(folderPath: string): Promise<boolean> {
    const entries = await listDirectory(folderPath);
    return entries.some((entry) => entry.isFile && entry.name.endsWith('.md'));
}

async function scanEnvironmentConfig(folderPath: string): Promise<EnvironmentConfig | undefined> {
    const hasPublicEnv = await fileExists(environmentFilePath(folderPath, false));
    const hasPrivateEnv = await fileExists(environmentFilePath(folderPath, true));

    if (!hasPublicEnv && !hasPrivateEnv) {
        return undefined;
    }
    return { folderPath, hasPublicEnv, hasPrivateEnv };
}

async function scanCollectionFolder(folderPath: string): Promise<CollectionItem[]> {
    const entries = await listDirectory(folderPath);
    const itemMap = new Map<string, CollectionItem>();

    for (const entry of entries) {
        if (entry.name.startsWith('.')) {
            continue;
        }

        if (isEnvironmentFileName(entry.name)) {
            continue;
        }

        const fullPath = joinPath(folderPath, entry.name);

        if (entry.isDirectory) {
            let item = itemMap.get(entry.name);
            if (!item) {
                item = { title: entry.name, hasReadme: false };
                itemMap.set(entry.name, item);
            }

            item.folderPath = fullPath;
            item.items = await scanCollectionFolder(fullPath);
            item.hasReadme = await folderContainsMarkdown(fullPath);

            item.environments = await scanEnvironmentConfig(fullPath);
            continue;
        }

        if (entry.isFile && entry.name.endsWith('.http')) {
            const title = entry.name.substring(0, entry.name.length - 5);
            const item = itemMap.get(title);
            if (item) {
                item.filePath = fullPath;
            } else {
                itemMap.set(title, {
                    title: title,
                    filePath: fullPath,
                    hasReadme: false
                });
            }
        }
    }

    return Array.from(itemMap.values());
}

export async function scanCollectionRoot(folderPath: string): Promise<CollectionItem> {
    const items = await scanCollectionFolder(folderPath);

    return {
        title: 'root',
        folderPath: folderPath,
        items: items,
        hasReadme: await folderContainsMarkdown(folderPath),
        environments: await scanEnvironmentConfig(folderPath)
    };
}
