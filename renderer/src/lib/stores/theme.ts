import { derived, writable } from 'svelte/store';
import type { Theme, ThemeMode } from '../theme';
import { darkTheme, lightTheme } from '../theme';

function getSystemTheme(): 'light' | 'dark' {
	if (typeof window === 'undefined') return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function createThemeStore() {
	const { subscribe, set } = writable<ThemeMode>('system');

	if (typeof window !== 'undefined') {
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
			set('system');
		});
	}

	return {
		subscribe,
		setTheme(mode: ThemeMode) {
			set(mode);
		}
	};
}

export const themeMode = createThemeStore();

export const currentTheme = derived<typeof themeMode, Theme>(themeMode, ($themeMode) => {
	if ($themeMode === 'light') return lightTheme;
	if ($themeMode === 'dark') return darkTheme;

	const systemTheme = getSystemTheme();
	return systemTheme === 'dark' ? darkTheme : lightTheme;
});

export const isDarkMode = derived(currentTheme, ($currentTheme) => $currentTheme === darkTheme);

export {};
