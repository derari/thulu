import type { CollectionItem, CurrentCollection, EnvironmentConfig } from './collection';
import { baseName, dirName, joinPath, normalizePath } from './paths';

export interface EnvironmentVariables {
    [key: string]: string;
}

export interface EnvironmentFile {
    [environmentName: string]: EnvironmentVariables;
}

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

function parseEnvironmentFile(content: string): EnvironmentFile {
    try {
        return JSON.parse(content);
    } catch (error) {
        console.error('Failed to parse environment file:', error);
        return {};
    }
}

function getEnvironmentNamesFromFile(content: string): string[] {
    const envFile = parseEnvironmentFile(content);
    return Object.keys(envFile);
}

function findEnvironmentConfigs(
    items: CollectionItem[],
    folderPath: string,
    collectionRoot: string,
    result: FoundEnvironmentConfig[] = []
): FoundEnvironmentConfig[] {
    const normalizedFolderPath = normalizePath(folderPath);
    const normalizedRoot = normalizePath(collectionRoot);

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

    // Walk from current folder up to root, finding configs along the way
    let currentPath = normalizedFolderPath;

    while (true) {
        const config = findConfigForPath(items, currentPath);
        if (config) {
            result.push(config);
        }

        if (currentPath === normalizedRoot) {
            break;
        }

        const parentPath = dirName(currentPath);
        if (parentPath === currentPath || parentPath.length < normalizedRoot.length) {
            break;
        }

        currentPath = parentPath;
    }

    return result;
}

export async function listAvailableEnvironments(
    folderPath: string,
    collection: CurrentCollection
): Promise<AvailableEnvironment[]> {
    const environments: AvailableEnvironment[] = [];
    const seenEnvironments = new Set<string>();

    const normalizedRoot = normalizePath(collection.path);
    const normalizedFolderPath = normalizePath(folderPath);

    // Find all environment configs in the collection
    const envConfigs = findEnvironmentConfigs([collection.root], folderPath, collection.path);

    // Configs are already in depth-first order (deepest first) from findEnvironmentConfigs
    // Process environment configs from current folder up to root
    for (const config of envConfigs) {
        const configPath = normalizePath(config.folderPath);

        const isFromCurrentFolder = configPath === normalizedFolderPath;

        // Try private env file
        if (config.environments.hasPrivateEnv) {
            const privateEnvPath = joinPath(configPath, 'http-client.private.env.json');
            try {
                const privateContent = await window.electronAPI.readFile(privateEnvPath);
                if (privateContent) {
                    const envNames = getEnvironmentNamesFromFile(privateContent);
                    for (const name of envNames) {
                        if (!seenEnvironments.has(name)) {
                            seenEnvironments.add(name);
                            const relativePath =
                                configPath === normalizedRoot ? 'root' : baseName(configPath);
                            environments.push({
                                name,
                                source: relativePath,
                                isFromCurrentFolder
                            });
                        }
                    }
                }
            } catch (error) {
                // File doesn't exist, continue
            }
        }

        // Try public env file
        if (config.environments.hasPublicEnv) {
            const publicEnvPath = joinPath(configPath, 'http-client.env.json');
            try {
                const publicContent = await window.electronAPI.readFile(publicEnvPath);
                if (publicContent) {
                    const envNames = getEnvironmentNamesFromFile(publicContent);
                    for (const name of envNames) {
                        if (!seenEnvironments.has(name)) {
                            seenEnvironments.add(name);
                            const relativePath =
                                configPath === normalizedRoot ? 'root' : baseName(configPath);
                            environments.push({
                                name,
                                source: relativePath,
                                isFromCurrentFolder
                            });
                        }
                    }
                }
            } catch (error) {
                // File doesn't exist, continue
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
    normalizedRoot: string,
    initialPath: string,
    variables: Map<string, EnvironmentVariable>
): void {
    if (!envFile[environmentName]) {
        return;
    }

    var isCurrentFolder = currentPath === initialPath;

    for (var [varName, varValue] of Object.entries(envFile[environmentName])) {
        var existing = variables.get(varName);
        if (!existing) {
            variables.set(varName, {
                name: varName,
                value: String(varValue),
                isPrivate,
                source: currentPath === normalizedRoot ? 'root' : baseName(currentPath),
                isInherited: !isCurrentFolder,
                isOverridden: false,
                isShared: false,
                isEditable: isCurrentFolder
            });
            continue;
        }

        var currentSource = currentPath === normalizedRoot ? 'root' : baseName(currentPath);
        var isExistingFromCurrentFolder = existing.source === currentSource;

        if (!isExistingFromCurrentFolder && !existing.parentValue && !existing.isInherited) {
            existing.isOverridden = true;
            existing.parentValue = String(varValue);
            existing.parentIsPrivate = isPrivate;
            existing.parentSource =
                currentPath === normalizedRoot ? 'root' : baseName(currentPath);
        }
    }
}

async function processEnvironmentFile(
    envPath: string,
    isPrivate: boolean,
    environmentName: string,
    currentPath: string,
    normalizedRoot: string,
    initialPath: string,
    variables: Map<string, EnvironmentVariable>,
    sharedVariables: Map<string, EnvironmentVariable>
): Promise<void> {
    try {
        var content = await window.electronAPI.readFile(envPath);
        if (!content) {
            return;
        }

        var envFile = parseEnvironmentFile(content);
        processEnvironmentVariables(
            envFile,
            environmentName,
            isPrivate,
            currentPath,
            normalizedRoot,
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
            normalizedRoot,
            initialPath,
            sharedVariables
        );
    } catch (error) {
        // File doesn't exist, continue
    }
}

export async function getEnvironmentVariables(
    environmentName: string,
    folderPath: string,
    collectionRoot: string
): Promise<EnvironmentVariable[]> {
    const variables = new Map<string, EnvironmentVariable>();
    const sharedVariables = new Map<string, EnvironmentVariable>();
    const normalizedRoot = normalizePath(collectionRoot);
    let currentPath = normalizePath(folderPath);
    const initialPath = currentPath;

    while (true) {
        const publicEnvPath = joinPath(currentPath, 'http-client.env.json');
        const privateEnvPath = joinPath(currentPath, 'http-client.private.env.json');

        await processEnvironmentFile(
            privateEnvPath,
            true,
            environmentName,
            currentPath,
            normalizedRoot,
            initialPath,
            variables,
            sharedVariables
        );

        await processEnvironmentFile(
            publicEnvPath,
            false,
            environmentName,
            currentPath,
            normalizedRoot,
            initialPath,
            variables,
            sharedVariables
        );

        if (currentPath === normalizedRoot) {
            break;
        }

        if (!currentPath.startsWith(normalizedRoot)) {
            break;
        }

        const parentPath = dirName(currentPath);
        if (parentPath === currentPath) {
            break;
        }
        currentPath = parentPath;
    }

    for (var [varName, sharedVar] of sharedVariables) {
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
