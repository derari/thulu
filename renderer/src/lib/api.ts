/**
 * The renderer's single entry point to the main process (see src/preload.ts).
 * Resolves `window.electronAPI` on every call, so tests can replace it or mock this module.
 */
export const api: Window['electronAPI'] = new Proxy({} as Window['electronAPI'], {
    get: (_target, property: string) => window.electronAPI[property as keyof Window['electronAPI']]
});
