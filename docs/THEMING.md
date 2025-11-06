# Theming System

## Overview

A comprehensive theming system with semantic color values that supports light mode, dark mode, and system preference detection.

## Files

### `renderer/src/lib/theme.ts`
Defines all theme colors and semantic values:

```typescript
export interface Theme {
    background: { primary, secondary, tertiary }
    text: { primary, secondary, tertiary, inverse }
    border: { default, focus, hover }
    interactive: { primary, primaryHover, primaryActive, secondary, secondaryHover, danger, dangerHover }
    state: { success, warning, error, info }
    sidebar: { background, header, itemHover, itemActive }
    editor: { background, lineNumber, selection, cursor }
}
```

Two complete themes are defined:
- `lightTheme` - Light color scheme
- `darkTheme` - Dark color scheme

### `renderer/src/lib/stores/theme.ts`
Manages theme state:

- `themeMode` - Store for current theme mode ('light' | 'dark' | 'system')
- `currentTheme` - Derived store that returns the active theme
- `isDarkMode` - Derived boolean for dark mode detection
- Listens to system theme changes via `prefers-color-scheme`

### `renderer/src/lib/ThemeProvider.svelte`
Component that:
1. Loads theme preference from Electron preferences
2. Applies theme as CSS variables to `:root`
3. Reactively updates when theme changes

### Updated Preferences
`appearance` field now uses proper types: `'light' | 'dark' | 'system'`

## CSS Variables

All UI colors are available as CSS variables:

### Background
- `--bg-primary` - Main background
- `--bg-secondary` - Secondary background
- `--bg-tertiary` - Tertiary background

### Text
- `--text-primary` - Primary text
- `--text-secondary` - Secondary/muted text
- `--text-tertiary` - Tertiary/very muted text
- `--text-inverse` - Text on dark backgrounds

### Borders
- `--border-default` - Default border color
- `--border-focus` - Focus state border
- `--border-hover` - Hover state border

### Interactive Elements
- `--interactive-primary` - Primary action buttons
- `--interactive-primary-hover` - Primary button hover
- `--interactive-primary-active` - Primary button active
- `--interactive-secondary` - Secondary buttons
- `--interactive-secondary-hover` - Secondary button hover
- `--interactive-danger` - Destructive actions
- `--interactive-danger-hover` - Danger button hover

### States
- `--state-success` - Success messages
- `--state-warning` - Warning messages
- `--state-error` - Error messages
- `--state-info` - Info messages

### Sidebar
- `--sidebar-bg` - Sidebar background
- `--sidebar-header` - Sidebar header background
- `--sidebar-item-hover` - Sidebar item hover state
- `--sidebar-item-active` - Sidebar active item

### Editor
- `--editor-bg` - Editor background
- `--editor-line-number` - Line number color
- `--editor-selection` - Text selection background
- `--editor-cursor` - Cursor color

## Usage in Components

### Using CSS Variables

```svelte
<style>
    .my-component {
        background: var(--bg-primary);
        color: var(--text-primary);
        border: 1px solid var(--border-default);
    }

    .my-button {
        background: var(--interactive-primary);
        color: var(--text-inverse);
    }

    .my-button:hover {
        background: var(--interactive-primary-hover);
    }
</style>
```

### Accessing Theme in JavaScript

```svelte
<script>
    import { currentTheme, isDarkMode } from '$lib/stores/theme.js';

    $: console.log('Current theme:', $currentTheme);
    $: console.log('Is dark mode:', $isDarkMode);
</script>
```

### Changing Theme

```svelte
<script>
    import { themeMode } from '$lib/stores/theme.js';

    function setDarkMode() {
        themeMode.setTheme('dark');
    }

    function setLightMode() {
        themeMode.setTheme('light');
    }

    function setSystemMode() {
        themeMode.setTheme('system');
    }
</script>
```

## How It Works

1. **App starts** → `ThemeProvider` loads preferences
2. **Theme preference loaded** → Sets `themeMode` store
3. **Store updates** → `currentTheme` derived store recalculates
4. **Theme changes** → CSS variables are updated via `applyCSSVariables()`
5. **All components** → Automatically re-render with new colors

## System Theme Detection

When `appearance: 'system'` is selected:
- Checks `prefers-color-scheme` media query
- Returns `darkTheme` if system is in dark mode
- Returns `lightTheme` if system is in light mode
- Listens for system theme changes and updates automatically

## Preferences Integration

The theme is saved to Electron preferences:

```typescript
window.electronAPI.savePreferences({ appearance: 'dark' });
```

On app start, the saved preference is loaded and applied.

## Adding New Colors

1. **Add to Theme interface** in `theme.ts`:
   ```typescript
   export interface Theme {
       // ...existing...
       myNewSection: {
           color1: string;
           color2: string;
       }
   }
   ```

2. **Add to both themes**:
   ```typescript
   export const lightTheme: Theme = {
       // ...existing...
       myNewSection: {
           color1: '#ff0000',
           color2: '#00ff00'
       }
   };

   export const darkTheme: Theme = {
       // ...existing...
       myNewSection: {
           color1: '#ff6666',
           color2: '#66ff66'
       }
   };
   ```

3. **Add CSS variables** in `ThemeProvider.svelte`:
   ```typescript
   root.style.setProperty('--my-color1', theme.myNewSection.color1);
   root.style.setProperty('--my-color2', theme.myNewSection.color2);
   ```

4. **Use in components**:
   ```css
   .my-element {
       color: var(--my-color1);
   }
   ```

## Updated Components

All existing components now use theme CSS variables:
- ✅ MainView
- ✅ Sidebar
- ✅ CollectionItems
- ✅ CollectionsOverview
- ✅ HttpEditor
- ✅ PreferencesModal

## Benefits

✅ **Single source of truth** - All colors defined in one place
✅ **Semantic naming** - Colors named by purpose, not appearance
✅ **Type safe** - Full TypeScript support
✅ **Reactive** - Changes apply instantly across all components
✅ **Persistent** - Saved to preferences
✅ **System aware** - Follows OS theme when set to 'system'
✅ **Extensible** - Easy to add new colors or themes

