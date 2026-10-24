// ตรงกับที่ server บังคับ เช็กก่อนส่งจะได้ไม่ต้องรออัปโหลดไฟล์ใหญ่แล้วโดนปฏิเสธ
export const MAX_PHOTOS = 6
const MAX_BYTES = 5 * 1024 * 1024

export const photoProblem = (file: File) => {
  if (!file.type.startsWith('image/')) return `${file.name} ไม่ใช่ไฟล์รูป`
  if (file.size > MAX_BYTES) return `${file.name} ใหญ่เกิน 5MB`
  return null
}
