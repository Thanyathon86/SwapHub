import { app } from './app.js'
import { env } from './config/env.js'
import { prisma } from './lib/prisma.js'
import { deleteExpiredSessions } from './lib/session.js'

const server = app.listen(env.PORT, () => {
  console.log(`API running on http://localhost:${env.PORT}`)
})

// session ที่หมดอายุแล้วไม่มีใครใช้ cookie มาอีกจะค้างใน DB จึงต้องกวาดเป็นรอบ
const SESSION_CLEANUP_MS = 60 * 60 * 1000
const cleanupSessions = () =>
  deleteExpiredSessions().catch((err: unknown) => console.error('Session cleanup failed:', err))
void cleanupSessions()
const cleanupTimer = setInterval(cleanupSessions, SESSION_CLEANUP_MS)

const shutdown = async () => {
  clearInterval(cleanupTimer)
  server.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
