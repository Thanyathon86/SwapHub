import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { checkOrigin } from './middleware/checkOrigin.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { apiLimiter } from './middleware/rateLimit.js'
import { serveWeb } from './middleware/serveWeb.js'
import { uploadRoot } from './lib/storage.js'
import { apiRouter } from './routes.js'

export const app = express()

app.disable('x-powered-by')
// ถ้าไม่ตั้งเมื่ออยู่หลัง proxy, rate limit จะเห็นทุกคนเป็น IP เดียวกัน
app.set('trust proxy', env.TRUST_PROXY)

// ใช้นโยบายเดียวกันทุก response หน้าเว็บโหลดแค่ไฟล์ของตัวเองกับฟอนต์จาก Google
// ไม่มี unsafe-inline เพราะ build ของ Vite ไม่มี script หรือ style แบบ inline ถ้ามีคนฝัง script มาได้ browser จะไม่รันให้
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        // blob: คือรูปพรีวิวก่อนอัปโหลดและรูปในหน้าครอป
        imgSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    frameguard: { action: 'deny' },
  }),
)
// เว็บไม่ได้ใช้ความสามารถเหล่านี้ ปิดไว้ ถ้ามีสคริปต์แปลกปลอมจะขอกล้องหรือตำแหน่งไม่ได้
app.use((_req, res, next) => {
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  next()
})
app.use(cors({ origin: [env.CLIENT_ORIGIN, env.ADMIN_ORIGIN], credentials: true }))
// API มีข้อมูลส่วนตัว (อีเมล, ข้อเสนอ, แชท) ถ้า browser หรือ proxy เก็บไว้ คนที่ใช้เครื่องร่วมกันจะเห็นได้
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})
// จำกัดก่อน parse body เพื่อไม่เสียแรง parse request ที่จะโดนปฏิเสธอยู่แล้ว
app.use('/api', apiLimiter)
app.use('/api', checkOrigin)
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

app.use('/api', apiRouter)

// รูปที่อัปโหลด ชื่อไฟล์เป็น uuid ไม่เคยถูกเขียนทับ จึง cache ได้นานแบบ immutable
// helmet ตั้ง nosniff ไว้แล้ว browser จะไม่ตีความไฟล์เป็นอย่างอื่นนอกจากรูป
app.use('/uploads', express.static(uploadRoot, { immutable: true, maxAge: '365d', index: false, dotfiles: 'deny' }))

// ต้องอยู่ก่อน serveWeb ไม่งั้นรูปหรือ API ที่ไม่มีอยู่จะได้ index.html กลับไปพร้อม 200
app.use(['/api', '/uploads'], notFound)

// production ให้ Express เสิร์ฟหน้าเว็บเอง header ด้านบนจึงครอบหน้าเว็บด้วย ตอน dev ไม่ตั้งค่านี้เพราะ Vite เสิร์ฟให้
const webApps = {
  ...(env.WEB_CLIENT_DIR && { [new URL(env.CLIENT_ORIGIN).hostname]: env.WEB_CLIENT_DIR }),
  ...(env.WEB_ADMIN_DIR && { [new URL(env.ADMIN_ORIGIN).hostname]: env.WEB_ADMIN_DIR }),
}
if (Object.keys(webApps).length > 0) app.use(serveWeb(webApps))

app.use(errorHandler)
