import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [svelte(), tailwindcss(), ...(process.env.SINGLE ? [viteSingleFile()] : [])],
  server: { host: true, allowedHosts: true },
  preview: { host: true, allowedHosts: true },
});
