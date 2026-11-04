import argon2 from 'argon2'
import { COMMON_PASSWORDS } from './commonPasswords.js'

// argon2id เป็นค่าเริ่มต้นของ library และเป็นตัวที่ OWASP แนะนำ
export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id })

export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password)

// ใช้ตอนไม่พบอีเมล เพื่อให้เวลาตอบใกล้เคียงกรณีรหัสผิด เดาไม่ได้ว่าอีเมลไหนมีบัญชี
let dummyHash: Promise<string> | undefined
export const burnPasswordCheck = async (password: string) => {
  dummyHash ??= hashPassword('dummy-password-for-timing')
  await verifyPassword(await dummyHash, password)
}

// ระบุตัวอักษรเอง ห้ามใช้ \W เพราะจะนับภาษาไทยเป็นสัญลักษณ์ด้วย รหัสภาษาไทยจะกลายเป็นสตริงว่าง
const LEADING_NOISE = /^[0-9!@#$%^&*()_+\-=.,?~ ]+/
const TRAILING_NOISE = /[0-9!@#$%^&*()_+\-=.,?~ ]+$/
const LOOKALIKES: Record<string, string> = { '@': 'a', '4': 'a', '3': 'e', '1': 'i', '!': 'i', '0': 'o', $: 's', '5': 's', '7': 't' }
const KEYBOARD_ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm']
const BRAND_WORDS = ['tcgnexus', 'swaphub']
const MIN_DISTINCT_CHARS = 4
// ชื่อหน้าอีเมลที่สั้นมากอย่าง "ann" ไม่ควรห้ามรหัสที่บังเอิญมีตัวอักษรชุดนี้อยู่ข้างใน
const MIN_PERSONAL_WORD = 4

const replaceLookalikes = (text: string) => [...text].map((c) => LOOKALIKES[c] ?? c).join('')

// เรียงตามลำดับตัวอักษร (abcdefgh, 87654321) หรือตามแถวแป้นพิมพ์ (qwertyui)
const isSequence = (text: string) => {
  const codes = [...text].map((c) => c.codePointAt(0) ?? 0)
  const steps = codes.slice(1).map((code, i) => code - (codes[i] ?? 0))
  if (steps.every((step) => step === 1) || steps.every((step) => step === -1)) return true
  return KEYBOARD_ROWS.some((row) => row.includes(text) || [...row].reverse().join('').includes(text))
}

// NIST SP 800-63B ให้ปฏิเสธรหัสที่อยู่ในลิสต์ยอดนิยม รหัสเรียงกัน และรหัสที่มีชื่อบริการหรือชื่อผู้ใช้
// ตรวจในเครื่อง ไม่ส่งรหัสหรือ hash ไปบริการภายนอก จึงไม่ครอบคลุมเท่าฐานข้อมูลรหัสที่รั่ว แต่กันรหัสที่ถูกลองก่อนเสมอได้
export const isGuessablePassword = (password: string, email: string) => {
  const lower = password.toLowerCase()
  if (new Set(lower).size < MIN_DISTINCT_CHARS || isSequence(lower)) return true
  if (BRAND_WORDS.some((word) => lower.includes(word))) return true

  const personal = email.toLowerCase().split('@')[0] ?? ''
  if (personal.length >= MIN_PERSONAL_WORD && lower.includes(personal)) return true

  const word = lower.replace(TRAILING_NOISE, '')
  // เหลือสตริงว่างแปลว่ามีแต่ตัวเลขกับสัญลักษณ์ เช่น เบอร์โทรหรือวันเกิด
  if (word === '') return true
  return [word, replaceLookalikes(word), word.replace(LEADING_NOISE, '')].some((candidate) => COMMON_PASSWORDS.has(candidate))
}
