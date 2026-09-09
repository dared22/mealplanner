// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
    exclude: ['e2e/**', '**/node_modules/**', '**/dist/**'],
  },
  resolve: {
    alias: {
      '@': resolve(rootDir, './src'),
    },
  },
})
