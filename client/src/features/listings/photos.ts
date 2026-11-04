// ตรงกับที่ server บังคับ เช็กก่อนส่งจะได้ไม่ต้องรออัปโหลดไฟล์ใหญ่แล้วโดนปฏิเสธ
export const MAX_PHOTOS = 6
const MAX_BYTES = 5 * 1024 * 1024
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// ใส่ใน accept ของ input ด้วย iPhone จะแปลงรูป HEIC เป็น JPEG ให้เองตอนเลือกไฟล์
export const PHOTO_ACCEPT = PHOTO_TYPES.join(',')

export const photoProblem = (file: File) => {
  if (!PHOTO_TYPES.includes(file.type)) return `${file.name} ใช้ไม่ได้ รองรับเฉพาะ JPG, PNG และ WebP`
  if (file.size > MAX_BYTES) return `${file.name} ใหญ่เกิน 5MB`
  return null
}
