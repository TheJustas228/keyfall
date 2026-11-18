/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: '/keyfall/',
  plugins: [svelte()],
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
