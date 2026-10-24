import { useState, type ChangeEvent } from 'react'
import { errorMessage } from '@shared/lib/api'
import { imageUrl, listingsApi, type Listing } from '@shared/listings/listingsApi'
import { MAX_PHOTOS, photoProblem } from './photos'

type Props = { listing: Listing; onChange: (listing: Listing) => void }

// จัดการรูปของประกาศที่มีอยู่แล้ว เพิ่ม/ลบมีผลทันที ไม่ต้องรอกดบันทึกฟอร์ม
export function ListingPhotos({ listing, onChange }: Props) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const { images } = listing

  // เปลี่ยนรูปของประกาศที่เปิดอยู่ทำให้ต้องตรวจใหม่ (server เป็นคนตัดสิน) เตือนก่อนเพราะข้อเสนอที่ค้างจะถูกยกเลิก
  const confirmReview = () =>
    listing.status !== 'ACTIVE' ||
    window.confirm('เปลี่ยนรูปแล้วประกาศจะกลับไปรอตรวจ และข้อเสนอที่ค้างอยู่จะถูกยกเลิก ทำต่อไหม?')

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (picked.length === 0 || !confirmReview()) return
    setProblem(null)
    setBusy(true)
    let latest = listing
    try {
      // อัปโหลดทีละรูป ถ้ารูปไหนพังรูปที่ขึ้นไปแล้วยังอยู่
      for (const file of picked.slice(0, MAX_PHOTOS - images.length)) {
        const bad = photoProblem(file)
        if (bad) {
          setProblem(bad)
          continue
        }
        latest = await listingsApi.uploadImage(listing.id, file)
        onChange(latest)
      }
    } catch (err) {
      setProblem(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const onRemove = async (imageId: string) => {
    if (!confirmReview()) return
    setProblem(null)
    setBusy(true)
    try {
      onChange(await listingsApi.removeImage(listing.id, imageId))
    } catch (err) {
      setProblem(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-3xl p-5 ring-1 ring-zinc-200">
      <h2 className="text-sm font-medium text-zinc-700">รูปการ์ด</h2>
      <p className="mt-1 mb-4 text-xs text-zinc-500">
        สูงสุด {MAX_PHOTOS} รูป ไม่เกิน 5MB ต่อรูป รูปแรกเป็นปก เพิ่มหรือลบแล้วมีผลทันที
      </p>
      <div className={`grid grid-cols-3 gap-3 sm:grid-cols-6 ${busy ? 'opacity-60' : ''}`}>
        {images.map((img, i) => (
          <div key={img.id} className="relative">
            <img
              src={imageUrl(img.key)}
              alt={`รูปที่ ${i + 1}`}
              className="aspect-square w-full rounded-xl object-cover ring-1 ring-zinc-200"
            />
            <button
              type="button"
              onClick={() => onRemove(img.id)}
              disabled={busy}
              aria-label={`ลบรูปที่ ${i + 1}`}
              className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-zinc-900 text-xs text-white disabled:opacity-50"
            >
              ×
            </button>
          </div>
        ))}
        {images.length < MAX_PHOTOS && (
          <label
            className={`grid aspect-square place-items-center rounded-xl border border-dashed border-zinc-300 text-sm text-zinc-500 ${busy ? 'cursor-wait' : 'cursor-pointer hover:border-zinc-500 hover:text-zinc-800'}`}
          >
            {busy ? 'กำลังอัปโหลด...' : '+ เพิ่มรูป'}
            <input type="file" accept="image/*" multiple disabled={busy} onChange={onPick} className="sr-only" />
          </label>
        )}
      </div>
      {problem && <p className="mt-2 text-sm text-red-600">{problem}</p>}
    </section>
  )
}
