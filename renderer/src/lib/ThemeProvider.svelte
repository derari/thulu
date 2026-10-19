<script lang="ts">
    import {currentTheme, themeMode} from './stores/theme.js';
    import {preferences} from './stores/preferences.js';

    $: themeMode.setTheme($preferences?.appearance || 'system');

    function camelToKebab(str: string): string {
        return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    }

    function setCSSVariablesRecursive(obj: any, prefix: string = '') {
        const root = document.documentElement;

        Object.keys(obj).forEach(key => {
            let value = obj[key];
            const kebabKey = camelToKebab(key);
            const renamedKebabKey = kebabKey.replace(/\bbackground\b/g, 'bg');
            const cssVarName = prefix ? `${prefix}-${renamedKebabKey}` : renamedKebabKey;

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                setCSSVariablesRecursive(value, cssVarName);
                return;
            }

            if (`${value}`.startsWith('--')) value = `var(${value})`;
            root.style.setProperty(`--${cssVarName}`, value);
        });
    }

    function applyCSSVariables(theme: any) {
        setCSSVariablesRecursive(theme);
    }

    $: applyCSSVariables($currentTheme);
</script>

<slot/>

