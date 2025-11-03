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

function joinPath(basePath: string, fileName: string): string {
    return `${basePath}${basePath.endsWith('/') || basePath.endsWith('\\') ? '' : '/'}${fileName}`;
}

function getBaseName(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    return parts[parts.length - 1] || '';
}

function getParentPath(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    parts.pop();
    return parts.join('/');
}

export interface EnvironmentVariable {
    name: string;
    value: string;
    isPrivate: boolean;
    source: string;
    isInherited: boolean;
    isOverridden: boolean;
    isEditable: boolean;
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

export async function listAvailableEnvironments(
    folderPath: string,
    collectionRoot: string
): Promise<AvailableEnvironment[]> {
    const environments: AvailableEnvironment[] = [];
    const seenEnvironments = new Set<string>();

    const normalizedRoot = collectionRoot.replace(/\\/g, '/');
    let currentPath = folderPath.replace(/\\/g, '/');
    const initialPath = currentPath;
    const isFirstIteration = (path: string) => path === initialPath;

    while (true) {
        const publicEnvPath = joinPath(currentPath, 'http-client.env.json');
        const privateEnvPath = joinPath(currentPath, 'http-client.private.env.json');

        try {
            const privateContent = await window.electronAPI.readHttpFile(privateEnvPath);
            if (privateContent) {
                const envNames = getEnvironmentNamesFromFile(privateContent);
                for (const name of envNames) {
                    if (!seenEnvironments.has(name)) {
                        seenEnvironments.add(name);
                        const relativePath = currentPath === normalizedRoot
                            ? 'root'
                            : getBaseName(currentPath);
                        environments.push({
                            name,
                            source: relativePath,
                            isFromCurrentFolder: isFirstIteration(currentPath)
                        });
                    }
                }
            }
        } catch (error) {
            // File doesn't exist, continue
        }

        try {
            const publicContent = await window.electronAPI.readHttpFile(publicEnvPath);
            if (publicContent) {
                const envNames = getEnvironmentNamesFromFile(publicContent);
                for (const name of envNames) {
                    if (!seenEnvironments.has(name)) {
                        seenEnvironments.add(name);
                        const relativePath = currentPath === normalizedRoot
                            ? 'root'
                            : getBaseName(currentPath);
                        environments.push({
                            name,
                            source: relativePath,
                            isFromCurrentFolder: isFirstIteration(currentPath)
                        });
                    }
                }
            }
        } catch (error) {
            // File doesn't exist, continue
        }

        if (currentPath === normalizedRoot) {
            break;
        }

        if (!currentPath.startsWith(normalizedRoot)) {
            break;
        }

        const parentPath = getParentPath(currentPath);
        if (parentPath === currentPath) {
            break;
        }
        currentPath = parentPath;
    }

    return environments;
}

export async function getEnvironmentVariables(
    environmentName: string,
    folderPath: string,
    collectionRoot: string
): Promise<EnvironmentVariable[]> {
    const variables = new Map<string, EnvironmentVariable>();
    const normalizedRoot = collectionRoot.replace(/\\/g, '/');
    let currentPath = folderPath.replace(/\\/g, '/');
    const initialPath = currentPath;

    while (true) {
        const publicEnvPath = joinPath(currentPath, 'http-client.env.json');
        const privateEnvPath = joinPath(currentPath, 'http-client.private.env.json');
        const isCurrentFolder = currentPath === initialPath;

        try {
            const privateContent = await window.electronAPI.readHttpFile(privateEnvPath);
            if (privateContent) {
                const envFile = parseEnvironmentFile(privateContent);
                if (envFile[environmentName]) {
                    for (const [varName, varValue] of Object.entries(envFile[environmentName])) {
                        const existing = variables.get(varName);
                        if (!existing) {
                            variables.set(varName, {
                                name: varName,
                                value: String(varValue),
                                isPrivate: true,
                                source: currentPath === normalizedRoot ? 'root' : getBaseName(currentPath),
                                isInherited: !isCurrentFolder,
                                isOverridden: false,
                                isEditable: isCurrentFolder
                            });
                        } else if (!isCurrentFolder) {
                            // Variable in current folder overrides this parent one
                            existing.isOverridden = true;
                            existing.parentValue = String(varValue);
                            existing.parentIsPrivate = true;
                            existing.parentSource = currentPath === normalizedRoot ? 'root' : getBaseName(currentPath);
                        }
                    }
                }
            }
        } catch (error) {
            // File doesn't exist, continue
        }

        try {
            const publicContent = await window.electronAPI.readHttpFile(publicEnvPath);
            if (publicContent) {
                const envFile = parseEnvironmentFile(publicContent);
                if (envFile[environmentName]) {
                    for (const [varName, varValue] of Object.entries(envFile[environmentName])) {
                        const existing = variables.get(varName);
                        if (!existing) {
                            variables.set(varName, {
                                name: varName,
                                value: String(varValue),
                                isPrivate: false,
                                source: currentPath === normalizedRoot ? 'root' : getBaseName(currentPath),
                                isInherited: !isCurrentFolder,
                                isOverridden: false,
                                isEditable: isCurrentFolder
                            });
                        } else if (!isCurrentFolder) {
                            // Variable in current folder overrides this parent one
                            existing.isOverridden = true;
                            existing.parentValue = String(varValue);
                            existing.parentIsPrivate = false;
                            existing.parentSource = currentPath === normalizedRoot ? 'root' : getBaseName(currentPath);
                        }
                    }
                }
            }
        } catch (error) {
            // File doesn't exist, continue
        }

        if (currentPath === normalizedRoot) {
            break;
        }

        if (!currentPath.startsWith(normalizedRoot)) {
            break;
        }

        const parentPath = getParentPath(currentPath);
        if (parentPath === currentPath) {
            break;
        }
        currentPath = parentPath;
    }

    return Array.from(variables.values());
}

export {};

