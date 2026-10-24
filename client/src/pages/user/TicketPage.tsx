import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'
import { MessageThread } from '@shared/support/MessageThread'
import { ticketCategoryLabel } from '@shared/support/types'
import { useAuth } from '@shared/auth/useAuth'
import { STAFF_NAME, supportApi, ticketStatusLabel, type TicketDetail } from '../../features/support/supportApi'

export default function TicketPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: loaded, error } = useResource(() => supportApi.get(id), id)
  // เก็บผลจากการตอบ/ปิดไว้แทนการโหลดใหม่ จะได้ไม่กระพริบ
  const [updated, setUpdated] = useState<TicketDetail | null>(null)
  const ticket = updated?.id === id ? updated : loaded
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<unknown>(null)

  if (error !== undefined && !ticket) {
    return (
      <div className="py-20 text-center">
        <p className="font-medium">{errorMessage(error)}</p>
        <Link to="/support" className="btn btn-secondary mt-6">
          กลับไปหน้าติดต่อทีมงาน
        </Link>
      </div>
    )
  }
  if (!ticket) return <Spinner />

  const run = async (action: () => Promise<TicketDetail>) => {
    setBusy(true)
    setActionError(null)
    try {
      setUpdated(await action())
      return true
    } catch (err) {
      setActionError(err)
      return false
    } finally {
      setBusy(false)
    }
  }

  const onReply = async (e: FormEvent) => {
    e.preventDefault()
    if (await run(() => supportApi.reply(id, reply))) setReply('')
  }

  const onClose = async () => {
    if (!window.confirm('ปิดเรื่องนี้? ปิดแล้วจะตอบต่อไม่ได้ ถ้ามีปัญหาอีกต้องแจ้งเรื่องใหม่')) return
    if (await run(() => supportApi.close(id))) navigate('/support', { state: { closed: id } })
  }

  const status = ticketStatusLabel[ticket.status]
  const isClosed = ticket.status === 'CLOSED'

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link to="/support" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← ติดต่อทีมงาน
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">{ticket.subject}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${status.className}`}>{status.text}</span>
        </div>
        <p className="mt-1 text-sm text-zinc-500">{ticketCategoryLabel[ticket.category]}</p>
      </div>

      <MessageThread
        messages={ticket.messages}
        nameOf={(m) => (m.fromStaff ? STAFF_NAME : (user?.displayName ?? 'คุณ'))}
        mine={(m) => !m.fromStaff}
      />

      {actionError !== null && <p className="text-sm text-red-600">{errorMessage(actionError)}</p>}

      {isClosed ? (
        <div className="rounded-2xl bg-zinc-50 p-4 text-center text-sm text-zinc-500">
          เรื่องนี้ปิดแล้ว{' '}
          <Link to="/support/new" className="font-medium text-zinc-900 underline">
            แจ้งเรื่องใหม่
          </Link>
        </div>
      ) : (
        <form onSubmit={onReply} className="space-y-3 border-t border-zinc-100 pt-6">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            maxLength={2000}
            required
            placeholder="พิมพ์ข้อความถึงทีมงาน"
            aria-label="ข้อความตอบกลับ"
            className="input"
          />
          <div className="flex flex-wrap justify-between gap-3">
            <button type="button" onClick={onClose} disabled={busy} className="btn btn-secondary">
              ปัญหาได้รับการแก้แล้ว ปิดเรื่อง
            </button>
            <button type="submit" disabled={busy || reply.trim() === ''} className="btn btn-primary">
              ส่งข้อความ
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
