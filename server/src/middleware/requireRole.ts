import type { RequestHandler } from 'express'
import type { Role } from '../generated/prisma/enums.js'
import { AppError } from '../lib/errors.js'

// ต้องใช้หลัง requireAuth เสมอ
export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required')
    if (!roles.includes(req.user.role)) throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions')
    next()
  }
