import sharp from 'sharp'
import { AppError } from './errors.js'

const MAX_SIDE = 1600
const AVATAR_SIDE = 400
// tile เกมกว้างสุดราว 308px เผื่อจอความละเอียดสูง 3 เท่า
const GAME_IMAGE_WIDTH = 960
const GAME_IMAGE_HEIGHT = 600
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

// ครอปตรงกลางให้ได้ขนาดตายตัว ใช้กับรูปที่หน้าเว็บแสดงเป็นกรอบสัดส่วนคงที่
const coverWebp = async (input: Buffer, width: number, height: number) => {
  try {
    return await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width, height, fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer()
  } catch {
    throw new AppError(400, 'INVALID_IMAGE', 'File is not a supported image')
  }
}

// หน้าเว็บแสดงเป็นวงกลม
export const processAvatar = (input: Buffer) => coverWebp(input, AVATAR_SIDE, AVATAR_SIDE)

// หน้าหลังบ้านครอปมาเป็น 16:10 แล้ว แต่ server บังคับซ้ำ เพราะ client ส่งรูปสัดส่วนอื่นมาก็ได้
export const processGameImage = (input: Buffer) => coverWebp(input, GAME_IMAGE_WIDTH, GAME_IMAGE_HEIGHT)
