// สีประจำเกม ใช้แทนภาพการ์ดตอนยังไม่มีรูป และเป็นพื้นหลัง tile เกม ให้แต่ละเกมจำสีได้
// เรียงให้เกมตั้งต้นจาก seed ได้สีคนละโทนกัน เกมที่ admin เพิ่มทีหลังอาจซ้ำได้ เพราะมีแค่ 8 สี
const gradients = [
  'from-emerald-300 via-teal-400 to-cyan-600',
  'from-sky-300 via-indigo-400 to-violet-600',
  'from-rose-300 via-fuchsia-400 to-purple-600',
  'from-amber-300 via-orange-400 to-rose-500',
  'from-lime-200 via-emerald-400 to-teal-700',
  'from-cyan-200 via-sky-400 to-blue-700',
  'from-yellow-200 via-amber-400 to-orange-600',
  'from-violet-300 via-purple-500 to-indigo-700',
]

// คำนวณจาก slug เพราะ admin เพิ่มเกมได้เอง จะกำหนดสีตายตัวรายเกมไม่ได้
// ใช้ FNV-1a เพราะ hash แบบคูณ 31 ทำให้ slug ตั้งต้นครึ่งหนึ่งได้สีซ้ำกัน
export const gradientFor = (seed: string) => {
  let hash = 2166136261
  for (const ch of seed) {
    hash ^= ch.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return gradients[(hash >>> 0) % gradients.length]
}
