import { get, writable } from 'svelte/store';

/**
 * Renderer-side mirror of the preferences owned by the main process.
 * Subscribing starts listening to `preferences:load` and requests the current value;
 * `update` persists a partial change and applies it locally right away.
 */
function createPreferencesStore() {
    const store = writable<Preferences | null>(null, (set) => {
        if (typeof window === 'undefined' || !window.electronAPI) {
            return;
        }
        const unsubscribe = window.electronAPI.onPreferencesLoad((preferences) => set(preferences));
        window.electronAPI.requestPreferences();
        return unsubscribe;
    });

    const { subscribe, update: updateStore } = store;

    function update(partial: Partial<Preferences>) {
        updateStore((current) => ({ ...current, ...partial }));
        window.electronAPI.savePreferences(partial);
    }

    return {
        subscribe,
        update,

        /** Applies `patch` to the stored entry for a collection, adding the entry if it is missing. */
        updateCollection(collectionPath: string, name: string, patch: Partial<CollectionMetaData>) {
            const existing = get(store)?.collections ?? [];
            const collections = existing.some((c) => c.path === collectionPath)
                ? existing.map((c) => (c.path === collectionPath ? { ...c, ...patch } : c))
                : [...existing, { path: collectionPath, name, ...patch }];
            update({ collections });
        }
    };
}

export const preferences = createPreferencesStore();
