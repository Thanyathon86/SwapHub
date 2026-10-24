import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { checkOrigin } from './middleware/checkOrigin.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { apiLimiter } from './middleware/rateLimit.js'
import { uploadRoot } from './lib/storage.js'
import { apiRouter } from './routes.js'

export const app = express()

app.disable('x-powered-by')
// ถ้าไม่ตั้งเมื่ออยู่หลัง proxy, rate limit จะเห็นทุกคนเป็น IP เดียวกัน
app.set('trust proxy', env.TRUST_PROXY)

app.use(helmet())
app.use(cors({ origin: [env.CLIENT_ORIGIN, env.ADMIN_ORIGIN], credentials: true }))
// จำกัดก่อน parse body เพื่อไม่เสียแรง parse request ที่จะโดนปฏิเสธอยู่แล้ว
app.use('/api', apiLimiter)
app.use('/api', checkOrigin)
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

app.use('/api', apiRouter)

// รูปที่อัปโหลด ชื่อไฟล์เป็น uuid ไม่เคยถูกเขียนทับ จึง cache ได้นานแบบ immutable
// helmet ตั้ง nosniff ไว้แล้ว browser จะไม่ตีความไฟล์เป็นอย่างอื่นนอกจากรูป
app.use('/uploads', express.static(uploadRoot, { immutable: true, maxAge: '365d', index: false, dotfiles: 'deny' }))

app.use('/api', notFound)
app.use(errorHandler)
