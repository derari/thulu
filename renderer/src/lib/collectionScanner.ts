import type { CollectionItem } from './collection';

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
		console.error("error checking " + filePath, error);
		return false;
	}
}

async function folderContainsMarkdown(folderPath: string): Promise<boolean> {
	const entries = await listDirectory(folderPath);
	return entries.some(entry => entry.isFile && entry.name.endsWith('.md'));
}

function joinPath(basePath: string, ...parts: string[]): string {
	const separator = basePath.includes('\\') ? '\\' : '/';
	return [basePath, ...parts].join(separator).replace(/[\\\/]+/g, separator);
}

async function scanCollectionFolder(folderPath: string): Promise<CollectionItem[]> {
	const entries = await listDirectory(folderPath);
	const itemMap = new Map<string, CollectionItem>();

	for (const entry of entries) {
		if (entry.name.startsWith('.')) {
			continue;
		}

		if (
			entry.name === 'http-client.env.json' ||
			entry.name === 'http-client.private.env.json'
		) {
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

			const publicEnvPath = joinPath(fullPath, 'http-client.env.json');
			const privateEnvPath = joinPath(fullPath, 'http-client.private.env.json');
			const hasPublicEnv = await fileExists(publicEnvPath);
			const hasPrivateEnv = await fileExists(privateEnvPath);

			if (hasPublicEnv || hasPrivateEnv) {
				item.environments = {
					folderPath: fullPath,
					hasPublicEnv,
					hasPrivateEnv
				};
			}

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

	const publicEnvPath = joinPath(folderPath, 'http-client.env.json');
	const privateEnvPath = joinPath(folderPath, 'http-client.private.env.json');
	const hasPublicEnv = await fileExists(publicEnvPath);
	const hasPrivateEnv = await fileExists(privateEnvPath);
	const hasReadme = await folderContainsMarkdown(folderPath);

	const rootItem: CollectionItem = {
		title: 'root',
		folderPath: folderPath,
		items: items,
		hasReadme: hasReadme
	};

	if (hasPublicEnv || hasPrivateEnv) {
		rootItem.environments = {
			folderPath,
			hasPublicEnv,
			hasPrivateEnv
		};
	}

	return rootItem;
}
