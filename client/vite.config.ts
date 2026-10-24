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
    port: 5173,
    // ส่งต่อ request /api ไปที่ backend ตอน dev (ไม่ต้องเปิด CORS กว้าง)
    proxy: {
      '/api': 'http://localhost:4000',
      // รูปที่ผู้ขายอัปโหลด server เสิร์ฟเองที่ /uploads
      '/uploads': 'http://localhost:4000',
    },
  },
})
