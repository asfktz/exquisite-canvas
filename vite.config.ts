import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// SINGLE=1 builds one self-contained HTML file. ENTRY=wireframe picks wireframe.html instead of index.html.
const entry = process.env.ENTRY === 'wireframe' ? 'wireframe.html' : 'index.html';

export default defineConfig({
  plugins: [svelte(), tailwindcss(), ...(process.env.SINGLE ? [viteSingleFile()] : [])],
  build: { rollupOptions: { input: process.env.SINGLE ? entry : ['index.html', 'wireframe.html'] } },
  server: { host: true, allowedHosts: true },
  preview: { host: true, allowedHosts: true },
});
