import { derived, writable } from 'svelte/store';
import type { CollectionItem, CurrentCollection } from '../collection';
import { parseHttpFile } from '$lib/editor/httpParser.js';
import { scanCollectionRoot } from '../collectionScanner.js';
import { globalVariables } from './globalVariables.js';

async function parseCollectionItems(items: CollectionItem[]): Promise<CollectionItem[]> {
	const parsed: CollectionItem[] = [];

	for (const item of items) {
		const parsedItem: CollectionItem = { ...item };

		if (item.filePath) {
			const content = await window.electronAPI.readFile(item.filePath);
			if (content) {
				const parsed = parseHttpFile(content);
				parsedItem.sections = parsed.sections;
			}
		}

		if (item.items && item.items.length > 0) {
			parsedItem.items = await parseCollectionItems(item.items);
		}

		parsed.push(parsedItem);
	}

	return parsed;
}

function createCurrentCollectionStore() {
	const { subscribe, set, update } = writable<CurrentCollection | null>(null);

	return {
		subscribe,
		set,
		update,

		async loadCollection(path: string, name: string) {
			let previousPath: string | null = null;
			subscribe(currentCollection => {
				if (currentCollection) {
					previousPath = currentCollection.path;
				}
			})();

			if (previousPath && previousPath !== path) {
				globalVariables.clear(previousPath);
			}

			const root = await scanCollectionRoot(path);
			const parsedItems = await parseCollectionItems([root]);

			const collection: CurrentCollection = {
				path,
				name,
				root: parsedItems[0],
				metadata: { collectionName: name }
			};

			set(collection);
		},

		clear() {
			let currentPath: string | null = null;
			subscribe(currentCollection => {
				if (currentCollection) {
					currentPath = currentCollection.path;
				}
			})();

			if (currentPath) {
				globalVariables.clear(currentPath);
			}

			set(null);
		},

		async refreshFile(filePath: string) {
			const content = await window.electronAPI.readFile(filePath);
			if (!content) {
				return;
			}

			const parsed = parseHttpFile(content);

			update((collection) => {
				if (!collection) return null;

				const updateItems = (items: CollectionItem[]): CollectionItem[] => {
					return items.map((item) => {
						if (item.filePath === filePath) {
							return { ...item, sections: parsed.sections };
						}
						if (item.items) {
							return { ...item, items: updateItems(item.items) };
						}
						return item;
					});
				};

				return {
					...collection,
					root: updateItems([collection.root])[0]
				};
			});
		}
	};
}

export const currentCollection = createCurrentCollectionStore();

export const hasCurrentCollection = derived(
	currentCollection,
	($currentCollection) => $currentCollection !== null
);

export const currentCollectionName = derived(
	currentCollection,
	($currentCollection) => $currentCollection?.name ?? ''
);

export {};
