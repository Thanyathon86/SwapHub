import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // ต้องตรงกับ paths ใน tsconfig.app.json
    alias: { '@shared': fileURLToPath(new URL('../shared/src', import.meta.url)) },
  },
  server: {
    port: 5174,
    // ใช้ API server ตัวเดียวกับเว็บ user
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
