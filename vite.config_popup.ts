import { globSync } from 'glob';
import { defineConfig } from 'vite';
// import solid from 'vite-plugin-solid';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectFiles = Object.fromEntries(globSync(['./src/popup/popup.html', "./src/assets/*"]).map((file) => {
    const fileURL = fileURLToPath(new URL(file, import.meta.url));
    file = file.replace(/\.(html)$/, ".js");
    return [
        path.relative(
            'src',
            file.slice(0, file.length)
        ),
        fileURL
    ];
}));

export default defineConfig(
    {
        // plugins: [solid()],
        build: {
            minify: false,
            emptyOutDir: false,
            rollupOptions: {
                input: projectFiles,
                output: {
                    inlineDynamicImports: false,
                    format: 'esm',
                    manualChunks: {},
                    entryFileNames: 'src/[name]',
                    assetFileNames: 'assets/[name].[ext]',
                }
            },
        },
    }
);
