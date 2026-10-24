import type { Role } from '../generated/prisma/enums.js'

declare global {
  namespace Express {
    interface Request {
      // ตั้งโดย requireAuth เท่านั้น
      user?: { id: string; email: string; displayName: string; username: string; avatarKey: string | null; role: Role }
      sessionId?: string
    }
  }
}

export {}
