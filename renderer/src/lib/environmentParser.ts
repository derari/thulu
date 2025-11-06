import type { CollectionItem, CurrentCollection, EnvironmentConfig } from './collection';

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

function findEnvironmentConfigs(
	items: CollectionItem[],
	folderPath: string,
	collectionRoot: string,
	result: FoundEnvironmentConfig[] = []
): FoundEnvironmentConfig[] {
	const normalizedFolderPath = folderPath.replace(/\\/g, '/');
	const normalizedRoot = collectionRoot.replace(/\\/g, '/');

	function findConfigForPath(items: CollectionItem[], targetPath: string): FoundEnvironmentConfig | null {
		for (const item of items) {
            if (!item.folderPath) {
                continue;
            }

			const itemPath = item.folderPath.replace(/\\/g, '/');

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

		const parentPath = getParentPath(currentPath);
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

	const normalizedRoot = collection.path.replace(/\\/g, '/');
	const normalizedFolderPath = folderPath.replace(/\\/g, '/');

	// Find all environment configs in the collection
	const envConfigs = findEnvironmentConfigs([collection.root], folderPath, collection.path);

	// Configs are already in depth-first order (deepest first) from findEnvironmentConfigs
	// Process environment configs from current folder up to root
	for (const config of envConfigs) {
		const configPath = config.folderPath.replace(/\\/g, '/');


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
								configPath === normalizedRoot ? 'root' : getBaseName(configPath);
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
								configPath === normalizedRoot ? 'root' : getBaseName(configPath);
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
			const privateContent = await window.electronAPI.readFile(privateEnvPath);
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
								source:
									currentPath === normalizedRoot
										? 'root'
										: getBaseName(currentPath),
								isInherited: !isCurrentFolder,
								isOverridden: false,
								isEditable: isCurrentFolder
							});
						} else {
							// Check if the existing variable's source is the current folder
							const currentSource = currentPath === normalizedRoot ? 'root' : getBaseName(currentPath);
							const isExistingFromCurrentFolder = existing.source === currentSource;

							if (!isExistingFromCurrentFolder && !existing.parentValue && !existing.isInherited) {
								// Variable is defined in current folder (not inherited) and this parent has a different value
								// Only set parent value if it hasn't been set yet (to keep the immediate parent)
								existing.isOverridden = true;
								existing.parentValue = String(varValue);
								existing.parentIsPrivate = true;
								existing.parentSource =
									currentPath === normalizedRoot ? 'root' : getBaseName(currentPath);
							}
						}
					}
				}
			}
		} catch (error) {
			// File doesn't exist, continue
		}

		try {
			const publicContent = await window.electronAPI.readFile(publicEnvPath);
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
								source:
									currentPath === normalizedRoot
										? 'root'
										: getBaseName(currentPath),
								isInherited: !isCurrentFolder,
								isOverridden: false,
								isEditable: isCurrentFolder
							});
						} else {
							// Check if the existing variable's source is the current folder
							const currentSource = currentPath === normalizedRoot ? 'root' : getBaseName(currentPath);
							const isExistingFromCurrentFolder = existing.source === currentSource;

							if (!isExistingFromCurrentFolder && !existing.parentValue && !existing.isInherited) {
								// Variable is defined in current folder (not inherited) and this parent has a different value
								// Only set parent value if it hasn't been set yet (to keep the immediate parent)
								existing.isOverridden = true;
								existing.parentValue = String(varValue);
								existing.parentIsPrivate = false;
								existing.parentSource =
									currentPath === normalizedRoot ? 'root' : getBaseName(currentPath);
							}
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
