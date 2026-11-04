import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

type Mail = { to: string; subject: string; text: string }

const transport = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : null

// อีเมลที่ "ส่ง" ตอนไม่ได้ตั้ง SMTP เก็บไว้ให้ test อ่านลิงก์ได้ (เก็บแค่ล่าสุดไม่กี่ฉบับ ไม่ให้ memory โต)
export const devOutbox: Mail[] = []
const OUTBOX_LIMIT = 20

export const sendMail = async (mail: Mail) => {
  if (transport) {
    await transport.sendMail({ from: env.MAIL_FROM, ...mail })
    return
  }
  // production ต้องตั้ง SMTP_URL เสมอ (config/env.ts) ส่วนนี้จึงทำงานแค่ตอน dev กับ test ซึ่งพิมพ์ลิงก์ออก console ได้
  devOutbox.push(mail)
  if (devOutbox.length > OUTBOX_LIMIT) devOutbox.shift()
  if (env.NODE_ENV === 'development') {
    console.log(`\n[dev mail] to: ${mail.to}\nsubject: ${mail.subject}\n\n${mail.text}\n`)
  }
}
