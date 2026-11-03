import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { errorMessage } from '@shared/lib/api'

// ตรงกับ tile เกมหน้าแรกและขนาดที่ server เก็บ
const ASPECT = 16 / 10
const OUTPUT_WIDTH = 960
const PREVIEW_WIDTH = 800
const MAX_ZOOM = 3
const ARROW_STEP = 0.02
const JPEG_QUALITY = 0.92

// x, y เป็นสัดส่วนของความกว้างกรอบ ไม่ผูกกับขนาดจอ ภาพ preview กับไฟล์ที่ส่งจึงตรงกันแม้ความละเอียดต่างกัน
type View = { zoom: number; rotation: number; x: number; y: number }

const initialView: View = { zoom: 1, rotation: 0, x: 0, y: 0 }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const rotatedSize = (img: HTMLImageElement, rotation: number) =>
  rotation % 180 === 0 ? [img.naturalWidth, img.naturalHeight] : [img.naturalHeight, img.naturalWidth]

// อัตราย่อขยายที่ zoom 1 ให้รูปคลุมกรอบพอดี คิดในหน่วยที่ความกว้างกรอบเท่ากับ 1
const scaleOf = (img: HTMLImageElement, view: View) => {
  const [width = 1, height = 1] = rotatedSize(img, view.rotation)
  return Math.max(1 / width, 1 / ASPECT / height) * view.zoom
}

// ไม่ให้เลื่อนจนเห็นช่องว่างในกรอบ
const clampView = (img: HTMLImageElement, view: View): View => {
  const [width = 1, height = 1] = rotatedSize(img, view.rotation)
  const scale = scaleOf(img, view)
  const maxX = Math.max(0, (width * scale - 1) / 2)
  const maxY = Math.max(0, (height * scale - 1 / ASPECT) / 2)
  return { ...view, x: clamp(view.x, -maxX, maxX), y: clamp(view.y, -maxY, maxY) }
}

const draw = (canvas: HTMLCanvasElement, img: HTMLImageElement, view: View) => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width, height } = canvas
  const scale = scaleOf(img, view) * width
  const drawWidth = img.naturalWidth * scale
  const drawHeight = img.naturalHeight * scale
  // ไฟล์ที่ส่งเป็น JPEG ซึ่งไม่มีความโปร่งใส ถ้าไม่ลงพื้นขาวไว้ PNG โปร่งใสจะกลายเป็นพื้นดำ
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingQuality = 'high'
  ctx.save()
  ctx.translate(width / 2 + view.x * width, height / 2 + view.y * width)
  ctx.rotate((view.rotation * Math.PI) / 180)
  ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
  ctx.restore()
}

// JPEG เพราะ Safari เข้ารหัส WebP จาก canvas ไม่ได้ และ server แปลงเป็น WebP ให้อยู่แล้ว
const renderBlob = (img: HTMLImageElement, view: View) =>
  new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_WIDTH
    canvas.height = OUTPUT_WIDTH / ASPECT
    draw(canvas, img, view)
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Cannot export image'))), 'image/jpeg', JPEG_QUALITY)
  })

type Props = {
  file: File
  // แสดงทับบนรูป ให้เห็นว่าตำแหน่งไหนจะโดนชื่อเกมบังตอนขึ้นหน้าแรก
  gameName: string
  onCancel: () => void
  onSave: (image: Blob) => Promise<void>
}

export function GameImageCropper({ file, gameName, onCancel, onSave }: Props) {
  const titleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [unreadable, setUnreadable] = useState(false)
  const [view, setView] = useState(initialView)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  // showModal ให้พื้นหลังกดไม่ได้และจำกัด focus ไว้ในหน้าต่างโดยไม่ต้องเขียนเอง
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal()
  }, [])

  useEffect(() => {
    // รอบที่ถูกยกเลิกต้องไม่แตะ state: URL ถูกคืนไปแล้ว onerror จะทำงานทั้งที่ไฟล์ปกติ (เกิดจริงตอน StrictMode)
    let stale = false
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      if (!stale) setImage(img)
    }
    // เช่นรูป HEIC จาก iPhone ที่ Chrome บน Windows เปิดไม่ได้
    img.onerror = () => {
      if (!stale) setUnreadable(true)
    }
    img.src = url
    return () => {
      stale = true
      URL.revokeObjectURL(url)
    }
  }, [file])

  useEffect(() => {
    if (canvas.current && image) draw(canvas.current, image, view)
  }, [image, view])

  const update = (next: Partial<View>) => {
    if (image) setView((current) => clampView(image, { ...current, ...next }))
  }

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    // capture ไว้ ลากออกนอกกรอบแล้วรูปยังตามนิ้ว ไม่ค้างกลางทาง
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current || !image) return
    const frameWidth = e.currentTarget.getBoundingClientRect().width
    const dx = (e.clientX - drag.current.x) / frameWidth
    const dy = (e.clientY - drag.current.y) / frameWidth
    drag.current = { x: e.clientX, y: e.clientY }
    setView((current) => clampView(image, { ...current, x: current.x + dx, y: current.y + dy }))
  }

  const endDrag = () => {
    drag.current = null
  }

  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-ARROW_STEP, 0],
      ArrowRight: [ARROW_STEP, 0],
      ArrowUp: [0, -ARROW_STEP],
      ArrowDown: [0, ARROW_STEP],
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    update({ x: view.x + move[0], y: view.y + move[1] })
  }

  const onSubmit = async () => {
    if (!image) return
    setBusy(true)
    setError(null)
    try {
      await onSave(await renderBlob(image, view))
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      // ปุ่ม Esc: ปิดผ่าน state ของแม่ และห้ามปิดระหว่างกำลังอัปโหลด
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onCancel()
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl backdrop:bg-black/60 sm:p-6"
    >
      <h2 id={titleId} className="font-semibold text-slate-800">
        รูปของ {gameName}
      </h2>
      <p className="mt-1 text-sm text-slate-500">ลากรูปเพื่อจัดตำแหน่ง กรอบนี้คือส่วนที่จะแสดงบนหน้าแรก</p>

      {unreadable ? (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">เปิดไฟล์นี้ไม่ได้ ลองใช้รูป JPG, PNG หรือ WebP</p>
      ) : (
        <>
          <div className="relative mt-4 aspect-[16/10] overflow-hidden rounded-xl bg-slate-100">
            <canvas
              ref={canvas}
              width={PREVIEW_WIDTH}
              height={PREVIEW_WIDTH / ASPECT}
              tabIndex={0}
              aria-label="ตำแหน่งรูปในกรอบ กดปุ่มลูกศรเพื่อขยับ"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={onKeyDown}
              // touch-none: ไม่ให้นิ้วที่กำลังลากรูปกลายเป็นการเลื่อนหน้าจอ
              className="block size-full cursor-grab touch-none active:cursor-grabbing"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-3/5 items-end bg-linear-to-t from-black/60 to-transparent p-3 sm:p-5">
              <span className="text-lg/tight font-semibold text-white [text-shadow:0_1px_8px_rgb(0_0_0/0.35)] sm:text-2xl/tight">
                {gameName}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <label htmlFor={`${titleId}-zoom`} className="shrink-0 text-sm text-slate-600">
              ซูม
            </label>
            <input
              id={`${titleId}-zoom`}
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={view.zoom}
              disabled={!image}
              onChange={(e) => update({ zoom: Number(e.target.value) })}
              className="min-w-0 flex-1 accent-indigo-600"
            />
            <button
              type="button"
              disabled={!image}
              onClick={() => update({ rotation: (view.rotation + 90) % 360, x: 0, y: 0 })}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-60"
            >
              หมุน 90°
            </button>
          </div>
        </>
      )}

      {error !== null && <p className="mt-3 text-sm text-red-600">{errorMessage(error)}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-lg px-4 py-2 text-sm text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-60"
        >
          ยกเลิก
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy || !image}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? 'กำลังบันทึก...' : 'บันทึกรูป'}
        </button>
      </div>
    </dialog>
  )
}
