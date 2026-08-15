import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Minimal vitest config for the repo's first test suite (ticket #8).
// The `@` alias mirrors tsconfig paths (vitest does not read tsconfig paths);
// no react plugin is needed — the tests under test are pure TypeScript modules
// with no JSX.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
});
