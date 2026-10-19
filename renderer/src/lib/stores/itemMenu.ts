import { writable } from 'svelte/store';

const DELETE_CONFIRMATION_TIMEOUT = 10000;

/**
 * Which row of the collection tree has its menu open, and which one is waiting for the user to
 * confirm a delete. Only one of each exists at a time; a pending delete expires after a while.
 */
function createItemMenuStore() {
    const openKey = writable<string | null>(null);
    const confirmingKey = writable<string | null>(null);
    let pendingDelete: (() => Promise<unknown>) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function clearConfirmation() {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        pendingDelete = null;
        confirmingKey.set(null);
    }

    return {
        openKey: { subscribe: openKey.subscribe },
        confirmingKey: { subscribe: confirmingKey.subscribe },

        toggle(key: string) {
            let isOpen = false;
            openKey.update((current) => {
                isOpen = current === key;
                return isOpen ? null : key;
            });
            if (!isOpen) {
                clearConfirmation();
            }
        },

        close() {
            openKey.set(null);
        },

        /** Closes the menu and shows the confirm button on the row until `confirmDelete` is called or the time is up. */
        requestDelete(key: string, performDelete: () => Promise<unknown>) {
            clearConfirmation();
            openKey.set(null);
            pendingDelete = performDelete;
            confirmingKey.set(key);
            timeoutId = setTimeout(clearConfirmation, DELETE_CONFIRMATION_TIMEOUT);
        },

        async confirmDelete() {
            const performDelete = pendingDelete;
            clearConfirmation();
            await performDelete?.();
        }
    };
}

export const itemMenu = createItemMenuStore();
