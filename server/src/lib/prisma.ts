import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'
import { env } from '../config/env.js'

// ใช้ instance เดียวทั้งแอป (Prisma ใช้ parameterized query กัน SQL injection ให้อยู่แล้ว)
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })

export const prisma = new PrismaClient({ adapter })
