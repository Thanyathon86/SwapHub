import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { env } from '../config/env.js'

// จุดเดียวที่รู้ว่าไฟล์เก็บที่ไหน ถ้าย้ายไป S3/R2 แก้แค่ไฟล์นี้ ส่วนอื่นอ้างถึงไฟล์ด้วย key เท่านั้น
export const uploadRoot = resolve(env.UPLOAD_DIR)
// ไฟล์ส่วนตัวอยู่คนละโฟลเดอร์กับ uploadRoot ที่เปิดสาธารณะ ต้องขอผ่าน API ที่ตรวจสิทธิ์เท่านั้น
const privateRoot = resolve(env.PRIVATE_UPLOAD_DIR)

// key มาจากโค้ดเราเอง (id + uuid) แต่กันไว้อีกชั้นไม่ให้หลุดออกนอกโฟลเดอร์ uploads
const pathIn = (root: string, key: string) => {
  const path = resolve(root, key)
  if (!path.startsWith(root + sep)) throw new Error(`Invalid storage key: ${key}`)
  return path
}
const pathOf = (key: string) => pathIn(uploadRoot, key)

export const saveFile = async (key: string, data: Buffer) => {
  const path = pathOf(key)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, data)
}

// force: ไฟล์ที่หายไปแล้วไม่ถือเป็น error ลบซ้ำได้
export const removeFile = (key: string) => rm(pathOf(key), { force: true })

export const savePrivateFile = async (key: string, data: Buffer) => {
  const path = pathIn(privateRoot, key)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, data)
}

export const readPrivateFile = (key: string) => readFile(pathIn(privateRoot, key))

export const removePrivateFile = (key: string) => rm(pathIn(privateRoot, key), { force: true })
