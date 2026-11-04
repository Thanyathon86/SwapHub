import type { Role } from '../generated/prisma/enums.js'
import { AppError } from './errors.js'

// อักขระที่มองไม่เห็นหรือสลับทิศตัวอักษร ใช้ทำชื่อว่างหรือหลอกตาได้ (⠀ เป็นอักษรเบรลล์ว่าง ไม่อยู่ในกลุ่มด้านหน้า)
// ยกเว้น ZWNJ, ZWJ และ variation selector เพราะอีโมจิหลายตัวต้องใช้
const HIDDEN_CHARS = /(?![‌‍︎️])[\p{Cc}\p{Cf}\p{Co}\p{Default_Ignorable_Code_Point}⠀]/u
const VISIBLE_CHAR = /[\p{L}\p{N}\p{S}\p{P}]/u

// ภาษาไทยไม่มีช่องว่างคั่นคำ จึงหาแบบมีอยู่ข้างในหลังตัดช่องว่างและเครื่องหมายออก ("ทีม งาน", "TCG Nexus")
// swaphub คือชื่อเดิมของเว็บ ยังกันไว้ไม่ให้แอบอ้างแบรนด์เก่า
const RESERVED_ANYWHERE = ['ทีมงาน', 'แอดมิน', 'แอดมิ้น', 'ผู้ดูแล', 'เจ้าหน้าที่', 'tcgnexus', 'swaphub']
// อังกฤษหาแบบเป็นคำ ไม่งั้น badminton จะติดคำว่า admin
const RESERVED_WORD = /(?:^|[^a-z])(?:admin|administrator|support|staff|moderator|official)(?:[^a-z]|$)/

const isStaffLike = (name: string) => {
  // NFKC ทำให้ตัวอักษรแปลก ๆ อย่าง ａｄｍｉｎ กลายเป็นตัวปกติ
  const lower = name.normalize('NFKC').toLowerCase()
  const compact = lower.replace(/[\p{Z}\p{P}\p{S}\p{Cf}]/gu, '')
  return RESERVED_WORD.test(lower) || RESERVED_ANYWHERE.some((word) => compact.includes(word))
}

// หน้าเว็บแสดงทีมงานว่า "ทีมงาน TCGNexus" ถ้าผู้ใช้ตั้งชื่อแบบนี้ได้จะหลอกคู่ดีลในแชทได้
// admin ตัวจริงใช้คำเหล่านี้ได้ เพราะชื่อที่ผู้ใช้เห็นคือชื่อกลางของทีมงานอยู่แล้ว
export const assertDisplayName = (name: string, role: Role = 'USER') => {
  if (HIDDEN_CHARS.test(name) || !VISIBLE_CHAR.test(name)) {
    throw new AppError(400, 'DISPLAY_NAME_INVALID', 'Display name contains invisible characters')
  }
  if (role !== 'ADMIN' && isStaffLike(name)) {
    throw new AppError(400, 'DISPLAY_NAME_RESERVED', 'Display name looks like a staff account')
  }
}
