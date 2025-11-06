import { writable } from 'svelte/store';

interface GlobalVariablesState {
	[collectionPath: string]: Record<string, string>;
}

function createGlobalVariablesStore() {
	const { subscribe, set, update } = writable<GlobalVariablesState>({});

	return {
		subscribe,

		get: (collectionPath: string): Record<string, string> => {
			let currentState: GlobalVariablesState = {};
			subscribe(state => currentState = state)();
			return currentState[collectionPath] || {};
		},

		set: (collectionPath: string, key: string, value: string) => {
			update(state => {
				const collectionVars = state[collectionPath] || {};
				return {
					...state,
					[collectionPath]: {
						...collectionVars,
						[key]: value
					}
				};
			});
		},

		delete: (collectionPath: string, key: string) => {
			update(state => {
				const collectionVars = state[collectionPath];
				if (!collectionVars) {
					return state;
				}

				const { [key]: removed, ...rest } = collectionVars;
				return {
					...state,
					[collectionPath]: rest
				};
			});
		},

		clear: (collectionPath: string) => {
			update(state => {
				const { [collectionPath]: removed, ...rest } = state;
				return rest;
			});
		},

		clearAll: () => {
			set({});
		}
	};
}

export const globalVariables = createGlobalVariablesStore();

