import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [sveltekit()],
    server: {
        fs: {
            // $shared lives outside the renderer folder
            allow: ['../src/shared']
        }
    }
});
