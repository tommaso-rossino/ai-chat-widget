import { copyFileSync, mkdirSync } from 'node:fs';
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    // Client entry: marked "use client" so it works in React Server Components apps (Next.js App Router).
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    // No rollup treeshake here: it strips the "use client" banner.
    target: 'es2020',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    banner: { js: '"use client";' },
  },
  {
    // Server entry: framework-agnostic, Web Request/Response only.
    entry: { server: 'src/server/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: false,
    treeshake: true,
    target: 'es2022',
    platform: 'neutral',
    onSuccess: async () => {
      mkdirSync('dist', { recursive: true });
      copyFileSync('src/styles/chat-widget.css', 'dist/styles.css');
    },
  },
]);
