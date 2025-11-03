import { writable, derived } from 'svelte/store';
import type { EnvironmentConfig } from '../collection';

interface OpenEnvironmentsView {
    environmentConfig: EnvironmentConfig;
    collectionRoot: string;
}

interface PendingNavigation {
    environmentConfig: EnvironmentConfig;
    collectionRoot: string;
}

function createOpenEnvironmentsStore() {
    const { subscribe, set, update } = writable<OpenEnvironmentsView | null>(null);
    const pendingAction = writable<'navigate' | 'close' | null>(null);
    let hasUnsavedChanges = false;
    let pendingNavigation: PendingNavigation | null = null;

    return {
        subscribe,
        pendingAction: {
            subscribe: pendingAction.subscribe
        },
        open(environmentConfig: EnvironmentConfig, collectionRoot: string) {
            if (hasUnsavedChanges) {
                // Store the pending navigation and wait for user decision
                pendingNavigation = { environmentConfig, collectionRoot };
                pendingAction.set('navigate');
                return false; // Indicate that navigation is pending
            }
            set({ environmentConfig, collectionRoot });
            return true; // Navigation happened immediately
        },
        close() {
            if (hasUnsavedChanges) {
                pendingNavigation = null;
                pendingAction.set('close');
                return false; // Indicate that close is pending
            }
            set(null);
            return true; // Close happened immediately
        },
        setHasUnsavedChanges(value: boolean) {
            hasUnsavedChanges = value;
        },
        confirmNavigation() {
            if (pendingNavigation) {
                set(pendingNavigation);
                pendingNavigation = null;
            } else {
                set(null);
            }
            hasUnsavedChanges = false;
            pendingAction.set(null);
        },
        cancelNavigation() {
            pendingNavigation = null;
            pendingAction.set(null);
        }
    };
}

export const openEnvironments = createOpenEnvironmentsStore();

