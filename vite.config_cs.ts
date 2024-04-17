import { defineConfig } from 'vite';

export default defineConfig(
    {
        build: {
            minify: false,
            emptyOutDir: false,
            rollupOptions: {
                input: "./src/content_scripts/script.ts",
                output: {
                    inlineDynamicImports: false,
                    format: 'iife',
                    manualChunks: {},
                    entryFileNames: 'content_scripts/script.js',
                }
            },
        },
    }
);
