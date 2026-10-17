import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // ส่งต่อ request /api ไปที่ backend ตอน dev (ไม่ต้องเปิด CORS กว้าง)
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
