import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { checkOrigin } from './middleware/checkOrigin.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { apiLimiter } from './middleware/rateLimit.js'
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

app.use('/api', notFound)
app.use(errorHandler)
