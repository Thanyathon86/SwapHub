import { app } from './app.js'
import { env } from './config/env.js'
import { deleteOldEvents } from './lib/events.js'
import { prisma } from './lib/prisma.js'
import { deleteExpiredSessions } from './lib/session.js'
import { deleteStaleResetTokens } from './modules/auth/auth.service.js'

const server = app.listen(env.PORT, () => {
  console.log(`API running on http://localhost:${env.PORT}`)
})

// session หมดอายุ, log ที่เกินระยะเก็บ และลิงก์รีเซ็ตรหัสที่หมดอายุจะค้างใน DB ถ้าไม่กวาดเป็นรอบ
const CLEANUP_MS = 60 * 60 * 1000
const cleanup = () => {
  deleteExpiredSessions().catch((err: unknown) => console.error('Session cleanup failed:', err))
  deleteOldEvents().catch((err: unknown) => console.error('Event log cleanup failed:', err))
  deleteStaleResetTokens().catch((err: unknown) => console.error('Reset token cleanup failed:', err))
}
cleanup()
const cleanupTimer = setInterval(cleanup, CLEANUP_MS)

const shutdown = async () => {
  clearInterval(cleanupTimer)
  server.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
