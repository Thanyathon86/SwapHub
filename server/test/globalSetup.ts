import { execSync } from 'node:child_process'

// รันครั้งเดียวก่อนทุกไฟล์: สร้าง DB test (ถ้ายังไม่มี) และ apply migration ล่าสุด
export default function setup() {
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: process.env })
}
