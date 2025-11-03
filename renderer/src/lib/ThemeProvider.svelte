<script lang="ts">
    import { onMount } from 'svelte';
    import { themeMode, currentTheme } from './stores/theme.js';

    onMount(() => {
        window.electronAPI.onPreferencesLoad((preferences: Preferences) => {
            const appearance = preferences.appearance || 'system';
            themeMode.setTheme(appearance);
        });
        window.electronAPI.requestPreferences();
    });

    function camelToKebab(str: string): string {
        return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    }

    function setCSSVariablesRecursive(obj: any, prefix: string = '') {
        const root = document.documentElement;

        Object.keys(obj).forEach(key => {
            const value = obj[key];
            const kebabKey = camelToKebab(key);
            const renamedKebabKey = kebabKey.replace(/\bbackground\b/g, 'bg');
            const cssVarName = prefix ? `${prefix}-${renamedKebabKey}` : renamedKebabKey;

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                setCSSVariablesRecursive(value, cssVarName);
                return;
            }

            root.style.setProperty(`--${cssVarName}`, value);
        });
    }

    function applyCSSVariables(theme: any) {
        setCSSVariablesRecursive(theme);
    }

    $: applyCSSVariables($currentTheme);
</script>

<slot />

