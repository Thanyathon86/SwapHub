import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import express, { Router, type RequestHandler } from 'express'
import { notFound } from './notFound.js'

const INDEX = 'index.html'

const appRouter = (dir: string) => {
  const root = resolve(dir)
  // ไม่มี index.html แปลว่ายังไม่ได้ build หรือชี้ผิดที่ ให้หยุดตั้งแต่เริ่มแอป ดีกว่าผู้ใช้มาเจอหน้าพังทีหลัง
  if (!existsSync(resolve(root, INDEX))) {
    throw new Error(`${resolve(root, INDEX)} not found, run "npm run build" at the repo root first`)
  }

  const router = Router()
  // ชื่อไฟล์ใน assets มี hash ของเนื้อไฟล์ เปลี่ยนเวอร์ชันแล้วชื่อเปลี่ยน จึง cache ได้นาน
  // ไฟล์ที่หาไม่เจอต้องตอบ 404 ถ้าส่ง index.html ไป browser จะได้ HTML แทน JS แล้วหน้าพังแบบหาสาเหตุยาก
  router.use('/assets', express.static(resolve(root, 'assets'), { immutable: true, maxAge: '365d', index: false }), notFound)
  // ไฟล์นอก assets เช่น favicon ชื่อไม่เปลี่ยนตามเนื้อไฟล์ จึงไม่ตั้งให้ cache นาน
  router.use(express.static(root, { index: false }))
  // เส้นทางที่เหลือเป็นหน้าของ React Router ต้องได้ index.html และให้ตรวจใหม่ทุกครั้ง ไม่งั้นผู้ใช้จะค้างเวอร์ชันเก่า
  router.get('/{*path}', (_req, res) => {
    res.set('Cache-Control', 'no-cache')
    res.sendFile(INDEX, { root })
  })
  return router
}

// แยกแอปตาม hostname แต่ละแอปจึงอยู่คนละ origin และเรียก /api กับ /uploads แบบ relative ผ่าน origin ของตัวเองได้
export const serveWeb = (apps: Record<string, string>): RequestHandler => {
  const routers = new Map(Object.entries(apps).map(([host, dir]) => [host, appRouter(dir)]))
  return (req, res, next) => {
    // ไม่เสิร์ฟหน้าให้ Host ที่ไม่รู้จัก กันคนชี้ domain ของตัวเองมาแล้วได้หน้าเว็บเราไปแอบอ้าง
    const router = routers.get((req.hostname ?? '').toLowerCase())
    if (router) router(req, res, next)
    else next()
  }
}
