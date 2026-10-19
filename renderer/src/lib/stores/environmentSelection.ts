import { writable } from 'svelte/store';

const STORAGE_KEY = 'thulu:selectedEnvironment';

function readStoredName(): string {
    try {
        return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
        return '';
    }
}

function writeStoredName(name: string) {
    try {
        if (name) {
            localStorage.setItem(STORAGE_KEY, name);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    } catch {
        // storage unavailable, selection just won't survive a restart
    }
}

/** Name of the environment the user picked last, shared by the editor and the environments view. */
function createEnvironmentSelectionStore() {
    const { subscribe, set } = writable<string>(readStoredName());

    return {
        subscribe,

        select(name: string) {
            set(name);
            writeStoredName(name);
        }
    };
}

export const environmentSelection = createEnvironmentSelectionStore();
