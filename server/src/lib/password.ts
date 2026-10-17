import argon2 from 'argon2'

// argon2id เป็นค่าเริ่มต้นของ library และเป็นตัวที่ OWASP แนะนำ
export const hashPassword = (password: string) => argon2.hash(password, { type: argon2.argon2id })

export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password)

// ใช้ตอนไม่พบอีเมล เพื่อให้เวลาตอบใกล้เคียงกรณีรหัสผิด เดาไม่ได้ว่าอีเมลไหนมีบัญชี
let dummyHash: Promise<string> | undefined
export const burnPasswordCheck = async (password: string) => {
  dummyHash ??= hashPassword('dummy-password-for-timing')
  await verifyPassword(await dummyHash, password)
}
