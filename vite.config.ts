/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/keyfall/',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Keyfall',
        short_name: 'Keyfall',
        description: 'Learn piano songs with falling notes.',
        start_url: '/keyfall/',
        scope: '/keyfall/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#101632',
        theme_color: '#101632',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,mid,mp3,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
