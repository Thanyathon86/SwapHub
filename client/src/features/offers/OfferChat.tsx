import { useEffect, useState, type FormEvent } from 'react'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'
import { MessageThread } from '@shared/support/MessageThread'
import { offersApi, type Party } from './offersApi'

// ถี่กว่าตัวเลขบนเมนูเพราะเปิดอยู่ตอนกำลังคุยกัน แต่ยังไม่ถี่จนชน apiLimiter (300 ครั้ง / 15 นาที)
const POLL_MS = 15_000

// แชทของข้อเสนอหนึ่งรายการ โหลดเฉพาะตอนเปิด ไม่ดึงข้อความของทุกข้อเสนอในหน้ารายการ
export function OfferChat({ offerId, me, other }: { offerId: string; me: string; other: Party }) {
  const [tick, setTick] = useState(0)
  const { data, error, reload } = useResource(() => offersApi.messages(offerId), `${offerId}:${tick}`)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [sendError, setSendError] = useState<unknown>(null)

  useEffect(() => {
    const timer = setInterval(() => {
      // แท็บที่ซ่อนอยู่ไม่ต้องดึง ประหยัด request ตอนเปิดทิ้งไว้
      if (document.visibilityState === 'visible') setTick((n) => n + 1)
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setSendError(null)
    try {
      await offersApi.sendMessage(offerId, draft)
      setDraft('')
      reload()
    } catch (err) {
      setSendError(err)
    } finally {
      setBusy(false)
    }
  }

  if (!data) {
    return error !== undefined ? <p className="text-sm text-red-600">{errorMessage(error)}</p> : <Spinner />
  }

  return (
    <div className="space-y-3 rounded-xl bg-zinc-50 px-3 py-3">
      {data.messages.length === 0 ? (
        <p className="text-sm text-zinc-500">ยังไม่มีข้อความ ถามรายละเอียดหรือต่อรองกับ {other.displayName} ได้ที่นี่</p>
      ) : (
        <div className="max-h-96 overflow-y-auto pr-1">
          <MessageThread
            messages={data.messages}
            nameOf={(m) => (m.authorId === me ? 'คุณ' : other.displayName)}
            mine={(m) => m.authorId === me}
          />
        </div>
      )}

      {data.canSend ? (
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder={`ข้อความถึง ${other.displayName}`}
            aria-label="ข้อความ"
            className="input flex-1"
          />
          <button type="submit" disabled={busy || draft.trim() === ''} className="btn btn-primary">
            ส่ง
          </button>
        </form>
      ) : (
        <p className="text-sm text-zinc-500">ข้อเสนอนี้จบแล้ว อ่านข้อความเดิมได้อย่างเดียว</p>
      )}
      {sendError !== null && <p className="text-sm text-red-600">{errorMessage(sendError)}</p>}
    </div>
  )
}
