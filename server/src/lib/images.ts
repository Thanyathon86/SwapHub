import sharp from 'sharp'
import { AppError } from './errors.js'

const MAX_SIDE = 1600
// กันไฟล์เล็กที่ขยายเป็นรูปยักษ์ตอน decode (decompression bomb) 40 ล้าน pixel ใหญ่พอสำหรับรูปจากมือถือ
const MAX_INPUT_PIXELS = 40_000_000

// ให้ sharp อ่านเนื้อไฟล์จริง ไม่เชื่อนามสกุลหรือ content-type ที่ client ส่งมา ถ้าไม่ใช่รูปจะ decode ไม่ผ่าน
// แปลงเป็น WebP ทุกครั้ง ซึ่งตัด metadata ทิ้งหมด (EXIF อาจมีพิกัด GPS ของบ้านผู้ขาย)
export const processImage = async (input: Buffer) => {
  try {
    const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      // หมุนตาม EXIF ก่อนตัดทิ้ง ไม่งั้นรูปจากมือถือจะตะแคง
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true })
    return { data, width: info.width, height: info.height }
  } catch {
    throw new AppError(400, 'INVALID_IMAGE', 'File is not a supported image')
  }
}
