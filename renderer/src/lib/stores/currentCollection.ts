import { writable, derived } from 'svelte/store';
import type { CurrentCollection, CollectionItem } from '../collection';
import { parseHttpFile } from '$lib/editor/httpParser.js';

async function parseCollectionItems(items: CollectionItem[]): Promise<CollectionItem[]> {
    const parsed: CollectionItem[] = [];

    for (const item of items) {
        const parsedItem: CollectionItem = { ...item };

        if (item.filePath) {
            const content = await window.electronAPI.readHttpFile(item.filePath);
            const parsed = parseHttpFile(content);
            parsedItem.sections = parsed.sections;
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
            const items = await window.electronAPI.loadCollectionItems(path);
            const parsedItems = await parseCollectionItems(items);

            const collection: CurrentCollection = {
                path,
                name,
                items: parsedItems,
                metadata: { collectionName: name }
            };

            set(collection);
        },

        clear() {
            set(null);
        },

        async refreshFile(filePath: string) {
            const content = await window.electronAPI.readHttpFile(filePath);
            const parsed = parseHttpFile(content);

            update(collection => {
                if (!collection) return null;

                const updateItems = (items: CollectionItem[]): CollectionItem[] => {
                    return items.map(item => {
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
                    items: updateItems(collection.items)
                };
            });
        }
    };
}

export const currentCollection = createCurrentCollectionStore();

export const hasCurrentCollection = derived(
    currentCollection,
    $currentCollection => $currentCollection !== null
);

export const currentCollectionName = derived(
    currentCollection,
    $currentCollection => $currentCollection?.name ?? ''
);

export {};

