import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { analyze } from './vite.config.ts'

// The admin page (admin.html → dist/admin.html, served at /admin behind
// Cloudflare Access). Built on its own after the game, into the same dist/, so
// the game's bundle (and the single-file page built from it) never includes it.
export default defineConfig({
  plugins: [react(), tailwindcss(), ...analyze('admin')],
  base: '/',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    emptyOutDir: false,
    sourcemap: !!process.env.ANALYZE,
    assetsDir: 'admin-assets',
    // The admin page, and the design system gallery (admin/gallery.html, served at /admin/gallery) on its own.
    rollupOptions: { input: ['admin.html', 'admin/gallery.html'] },
  },
})
