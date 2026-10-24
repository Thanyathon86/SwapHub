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
  devOutbox.push(mail)
  if (devOutbox.length > OUTBOX_LIMIT) devOutbox.shift()
  if (env.NODE_ENV === 'production') {
    // production ที่ลืมตั้ง SMTP ผู้ใช้จะไม่ได้รับอีเมล ต้องให้คนดูแลเห็น แต่ห้ามพิมพ์ลิงก์ออก log
    console.error(`SMTP_URL is not set, email to ${mail.to} was not sent`)
  } else if (env.NODE_ENV === 'development') {
    console.log(`\n[dev mail] to: ${mail.to}\nsubject: ${mail.subject}\n\n${mail.text}\n`)
  }
}
