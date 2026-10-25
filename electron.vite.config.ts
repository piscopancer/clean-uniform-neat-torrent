import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

const sharedAlias = { '@shared': resolve('src/shared') } as const

export default defineConfig({
  main: {
    resolve: { alias: sharedAlias },
  },
  preload: {
    resolve: { alias: sharedAlias },
    build: {
      // sandboxed preload scripts cannot be ES modules
      rolldownOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } },
    },
  },
  renderer: {
    resolve: { alias: { ...sharedAlias, '@': resolve('src/renderer/src') } },
    plugins: [react(), tailwindcss()],
  },
})
