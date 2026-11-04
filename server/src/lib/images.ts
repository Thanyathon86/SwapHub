import sharp from 'sharp'
import { AppError } from './errors.js'

const MAX_SIDE = 1600
const AVATAR_SIDE = 400
// tile เกมกว้างสุดราว 308px เผื่อจอความละเอียดสูง 3 เท่า
const GAME_IMAGE_WIDTH = 960
const GAME_IMAGE_HEIGHT = 600
// กันไฟล์เล็กที่ขยายเป็นรูปยักษ์ตอน decode (decompression bomb) 40 ล้าน pixel ใหญ่พอสำหรับรูปจากมือถือ
const MAX_INPUT_PIXELS = 40_000_000

const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff])
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const RIFF_SIGNATURE = Buffer.from('RIFF')
const WEBP_SIGNATURE = Buffer.from('WEBP')

const isSupportedFormat = (input: Buffer) =>
  input.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE) ||
  input.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) ||
  (input.subarray(0, 4).equals(RIFF_SIGNATURE) && input.subarray(8, 12).equals(WEBP_SIGNATURE))

// sharp เลือกตัวถอดรหัสจากเนื้อไฟล์ และรองรับ SVG, TIFF, GIF ด้วย ตรวจลายเซ็นก่อนเพื่อให้ไฟล์ชนิดอื่นไม่ถึงตัวถอดรหัสเลย
// ลดความเสี่ยงจากบั๊กใน parser ของรูปแบบที่ไม่ได้เปิดให้อัปโหลดอยู่แล้ว
const openImage = (input: Buffer) => {
  if (!isSupportedFormat(input)) throw new Error('Unsupported image format')
  return sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
}

// ให้ sharp อ่านเนื้อไฟล์จริง ไม่เชื่อนามสกุลหรือ content-type ที่ client ส่งมา ถ้าไม่ใช่รูปจะ decode ไม่ผ่าน
// แปลงเป็น WebP ทุกครั้ง ซึ่งตัด metadata ทิ้งหมด (EXIF อาจมีพิกัด GPS ของบ้านผู้ขาย)
export const processImage = async (input: Buffer) => {
  try {
    const { data, info } = await openImage(input)
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
    return await openImage(input)
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
