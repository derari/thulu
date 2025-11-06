import { get, writable } from 'svelte/store';
import type { OpenFile } from '../collection';
import { currentCollection } from './currentCollection.js';

interface OpenFileState extends OpenFile {
	isDirty: boolean;
}

function createOpenFileStore() {
	const store = writable<OpenFileState | null>(null);
	const { subscribe, set, update } = store;

	return {
		subscribe,

		async openFile(filePath: string, sectionLineNumber?: number) {
			const content = await window.electronAPI.readFile(filePath);
			set({
				filePath,
				content: content ?? '',
				sectionLineNumber,
				isDirty: false
			});
		},

		jumpToSection(sectionLineNumber?: number) {
			update((file) => {
				if (!file) return null;
				return { ...file, sectionLineNumber };
			});
		},

		updateContent(content: string) {
			update((file) => {
				if (!file) return null;
				return { ...file, content, isDirty: true };
			});
		},

		async save(): Promise<{ success: boolean }> {
			const currentFile = get(store);

			if (!currentFile || !currentFile.isDirty) {
				return { success: true };
			}

			const result = await window.electronAPI.writeFile(
				currentFile.filePath,
				currentFile.content
			);

			if (result.success) {
				update((file) => {
					if (!file) return null;
					return { ...file, isDirty: false };
				});

				// Refresh the collection to update sections in sidebar
				await currentCollection.refreshFile(currentFile.filePath);
			}

			return result;
		},

		close() {
			set(null);
		}
	};
}

export const openFile = createOpenFileStore();

export {};
