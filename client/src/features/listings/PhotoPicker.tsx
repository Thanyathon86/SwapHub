import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { MAX_PHOTOS, photoProblem } from './photos'

// เลือกรูปไว้ในเครื่องก่อน ยังไม่อัปโหลด ใช้ตอนลงประกาศใหม่ที่ยังไม่มี id ให้อัปโหลดเข้าไป
export function PhotoPicker({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const [problem, setProblem] = useState<string | null>(null)
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  // คืน memory ของ preview เก่าทุกครั้งที่รายการเปลี่ยน
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews])

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    // ล้างค่า input ให้เลือกไฟล์เดิมซ้ำได้หลังลบออก
    e.target.value = ''
    const bad = picked.map(photoProblem).find(Boolean)
    const ok = picked.filter((f) => !photoProblem(f))
    const room = MAX_PHOTOS - files.length
    setProblem(bad ?? (ok.length > room ? `ใส่รูปได้สูงสุด ${MAX_PHOTOS} รูป` : null))
    onChange([...files, ...ok.slice(0, room)])
  }

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-zinc-700">รูปการ์ด</legend>
      <p className="mb-3 text-xs text-zinc-500">
        สูงสุด {MAX_PHOTOS} รูป ไม่เกิน 5MB ต่อรูป รูปแรกเป็นปก ถ่ายให้เห็นหน้า-หลังและตำหนิชัด ๆ (ข้อมูลตำแหน่งในรูปจะถูกลบอัตโนมัติ)
      </p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {previews.map((url, i) => (
          <div key={url} className="relative">
            <img src={url} alt={`รูปที่ ${i + 1}`} className="aspect-square w-full rounded-xl object-cover ring-1 ring-zinc-200" />
            <button
              type="button"
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              aria-label={`ลบรูปที่ ${i + 1}`}
              className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-zinc-900 text-xs text-white"
            >
              ×
            </button>
          </div>
        ))}
        {files.length < MAX_PHOTOS && (
          <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-zinc-300 text-sm text-zinc-500 hover:border-zinc-500 hover:text-zinc-800">
            + เพิ่มรูป
            <input type="file" accept="image/*" multiple onChange={onPick} className="sr-only" />
          </label>
        )}
      </div>
      {problem && <p className="mt-2 text-sm text-red-600">{problem}</p>}
    </fieldset>
  )
}
