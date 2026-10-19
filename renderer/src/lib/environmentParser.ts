import type { CollectionItem, CurrentCollection, EnvironmentConfig } from './collection';
import {
    type EnvironmentFile,
    folderAndAncestors,
    folderLabel,
    readEnvironmentFile
} from './environmentFiles';
import { normalizePath } from './paths';

export interface AvailableEnvironment {
    name: string;
    source: string;
    isFromCurrentFolder: boolean;
}

interface FoundEnvironmentConfig {
    folderPath: string;
    environments: EnvironmentConfig;
}

export interface EnvironmentVariable {
    name: string;
    value: string;
    isPrivate: boolean;
    source: string;
    isInherited: boolean;
    isOverridden: boolean;
    isEditable: boolean;
    isShared: boolean;
    parentValue?: string;
    parentIsPrivate?: boolean;
    parentSource?: string;
}

function findEnvironmentConfigs(
    items: CollectionItem[],
    folderPath: string,
    collectionRoot: string,
    result: FoundEnvironmentConfig[] = []
): FoundEnvironmentConfig[] {
    function findConfigForPath(
        items: CollectionItem[],
        targetPath: string
    ): FoundEnvironmentConfig | null {
        for (const item of items) {
            if (!item.folderPath) {
                continue;
            }

            const itemPath = normalizePath(item.folderPath);

            if (itemPath === targetPath && item.environments) {
                return {
                    folderPath: item.folderPath,
                    environments: item.environments
                };
            }

            // Only recurse if this folder is in the ancestor path
            if (targetPath.startsWith(itemPath) && item.items && item.items.length > 0) {
                const found = findConfigForPath(item.items, targetPath);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    for (const ancestorPath of folderAndAncestors(folderPath, collectionRoot)) {
        const config = findConfigForPath(items, ancestorPath);
        if (config) {
            result.push(config);
        }
    }

    return result;
}

export async function listAvailableEnvironments(
    folderPath: string,
    collection: CurrentCollection
): Promise<AvailableEnvironment[]> {
    const environments: AvailableEnvironment[] = [];
    const seenEnvironments = new Set<string>();

    const normalizedFolderPath = normalizePath(folderPath);

    // Configs are ordered from the current folder up to the root
    const envConfigs = findEnvironmentConfigs([collection.root], folderPath, collection.path);

    for (const config of envConfigs) {
        const configPath = normalizePath(config.folderPath);
        const isFromCurrentFolder = configPath === normalizedFolderPath;
        const source = folderLabel(configPath, collection.path);

        const filesToRead = [
            { isPrivate: true, exists: config.environments.hasPrivateEnv },
            { isPrivate: false, exists: config.environments.hasPublicEnv }
        ];

        for (const { isPrivate, exists } of filesToRead) {
            if (!exists) {
                continue;
            }
            const envFile = await readEnvironmentFile(configPath, isPrivate);
            for (const name of Object.keys(envFile)) {
                if (!seenEnvironments.has(name)) {
                    seenEnvironments.add(name);
                    environments.push({ name, source, isFromCurrentFolder });
                }
            }
        }
    }

    return environments;
}

function processEnvironmentVariables(
    envFile: EnvironmentFile,
    environmentName: string,
    isPrivate: boolean,
    currentPath: string,
    collectionRoot: string,
    initialPath: string,
    variables: Map<string, EnvironmentVariable>
): void {
    if (!envFile[environmentName]) {
        return;
    }

    const isCurrentFolder = currentPath === initialPath;
    const currentSource = folderLabel(currentPath, collectionRoot);

    for (const [varName, varValue] of Object.entries(envFile[environmentName])) {
        const existing = variables.get(varName);
        if (!existing) {
            variables.set(varName, {
                name: varName,
                value: String(varValue),
                isPrivate,
                source: currentSource,
                isInherited: !isCurrentFolder,
                isOverridden: false,
                isShared: false,
                isEditable: isCurrentFolder
            });
            continue;
        }

        const isExistingFromCurrentFolder = existing.source === currentSource;

        if (!isExistingFromCurrentFolder && !existing.parentValue && !existing.isInherited) {
            existing.isOverridden = true;
            existing.parentValue = String(varValue);
            existing.parentIsPrivate = isPrivate;
            existing.parentSource = currentSource;
        }
    }
}

async function processEnvironmentFile(
    isPrivate: boolean,
    environmentName: string,
    currentPath: string,
    collectionRoot: string,
    initialPath: string,
    variables: Map<string, EnvironmentVariable>,
    sharedVariables: Map<string, EnvironmentVariable>
): Promise<void> {
    const envFile = await readEnvironmentFile(currentPath, isPrivate);

    processEnvironmentVariables(
        envFile,
        environmentName,
        isPrivate,
        currentPath,
        collectionRoot,
        initialPath,
        variables
    );

    if (environmentName === '$shared') {
        return;
    }
    processEnvironmentVariables(
        envFile,
        '$shared',
        isPrivate,
        currentPath,
        collectionRoot,
        initialPath,
        sharedVariables
    );
}

export async function getEnvironmentVariables(
    environmentName: string,
    folderPath: string,
    collectionRoot: string
): Promise<EnvironmentVariable[]> {
    const variables = new Map<string, EnvironmentVariable>();
    const sharedVariables = new Map<string, EnvironmentVariable>();
    const folders = folderAndAncestors(folderPath, collectionRoot);
    const initialPath = folders[0];

    for (const currentPath of folders) {
        // The private file is read first so its values win over the public file in the same folder
        for (const isPrivate of [true, false]) {
            await processEnvironmentFile(
                isPrivate,
                environmentName,
                currentPath,
                collectionRoot,
                initialPath,
                variables,
                sharedVariables
            );
        }
    }

    for (const [varName, sharedVar] of sharedVariables) {
        const variable = variables.get(varName);
        if (variable) {
            if (!variable.parentValue) {
                if (!sharedVar.isInherited) variable.isOverridden = true;
                variable.parentValue = sharedVar.value;
                variable.parentIsPrivate = sharedVar.isPrivate;
                variable.parentSource = sharedVar.source;
            }
        } else {
            sharedVar.isOverridden = false;
            sharedVar.isInherited = true;
            sharedVar.isEditable = false;
            sharedVar.isShared = true;
            variables.set(varName, sharedVar);
        }
    }

    return Array.from(variables.values());
}

export async function getEnvironmentVariablesMap(
    environmentName: string,
    folderPath: string,
    collectionRoot: string
): Promise<Record<string, string>> {
    const variables = await getEnvironmentVariables(environmentName, folderPath, collectionRoot);
    const map: Record<string, string> = {};

    for (const variable of variables) {
        map[variable.name] = variable.value;
    }

    return map;
}

export {};
