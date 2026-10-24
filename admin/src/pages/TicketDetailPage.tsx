import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'
import { MessageThread } from '@shared/support/MessageThread'
import { ticketCategoryLabel } from '@shared/support/types'
import { adminApi, type AdminTicketDetail } from '../features/adminApi'
import { formatDateTime, ticketStatusLabels } from '../features/labels'

export default function TicketDetailPage() {
  const { id = '' } = useParams()
  const { user: me } = useAuth()
  const { data: loaded, error } = useResource(() => adminApi.getTicket(id), id)
  const [updated, setUpdated] = useState<AdminTicketDetail | null>(null)
  const ticket = updated?.id === id ? updated : loaded
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<unknown>(null)

  if (error !== undefined && !ticket) {
    return <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMessage(error)}</p>
  }
  if (!ticket) return <Spinner />

  const run = async (action: () => Promise<AdminTicketDetail>) => {
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
    if (await run(() => adminApi.replyTicket(id, reply))) setReply('')
  }

  const onClose = () => {
    if (window.confirm('ปิดเรื่องนี้? ผู้ใช้จะตอบต่อไม่ได้')) void run(() => adminApi.closeTicket(id))
  }

  const status = ticketStatusLabels[ticket.status]
  const isClosed = ticket.status === 'CLOSED'
  const assignedToMe = ticket.assignee?.id === me?.id

  return (
    <section className="space-y-6">
      <Link to="/support" className="text-sm text-slate-500 hover:text-slate-800">
        ← เรื่องที่แจ้ง
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{ticket.subject}</h1>
              <p className="mt-1 text-sm text-slate-500">{ticketCategoryLabel[ticket.category]}</p>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs ${status.className}`}>{status.text}</span>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            {/* หลังบ้านเห็นชื่อจริงของ admin ที่ตอบ ส่วนผู้ใช้เห็นเป็น "ทีมงาน" */}
            <MessageThread
              messages={ticket.messages}
              nameOf={(m) => (m.fromStaff ? `${m.author.displayName} (ทีมงาน)` : m.author.displayName)}
              mine={(m) => m.fromStaff}
            />
          </div>

          {actionError !== null && <p className="text-sm text-red-600">{errorMessage(actionError)}</p>}

          {isClosed ? (
            <p className="rounded-lg bg-slate-100 p-3 text-center text-sm text-slate-500">
              ปิดเรื่องแล้วเมื่อ {ticket.closedAt && formatDateTime(ticket.closedAt)}
            </p>
          ) : (
            <form onSubmit={onReply} className="space-y-3">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={4}
                maxLength={2000}
                required
                placeholder="ตอบผู้ใช้ (ผู้ใช้จะเห็นชื่อผู้ตอบเป็น 'ทีมงาน SwapHub')"
                aria-label="ข้อความตอบกลับ"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busy || reply.trim() === ''}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  ส่งคำตอบ
                </button>
              </div>
            </form>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl bg-white p-5 text-sm shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 font-medium text-slate-700">ผู้แจ้ง</h2>
            <div className="font-medium text-slate-800">{ticket.user.displayName}</div>
            <div className="text-slate-500">{ticket.user.email}</div>
            {ticket.user.status === 'SUSPENDED' && (
              <div className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">บัญชีนี้ถูกระงับอยู่</div>
            )}
            <Link
              to={`/users?q=${encodeURIComponent(ticket.user.email)}`}
              className="mt-3 inline-block text-xs text-indigo-600 hover:underline"
            >
              ดูในหน้าผู้ใช้
            </Link>
          </div>

          <div className="rounded-xl bg-white p-5 text-sm shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 font-medium text-slate-700">การจัดการ</h2>
            <dl className="space-y-2 text-slate-600">
              <div className="flex justify-between gap-2">
                <dt>ผู้รับเรื่อง</dt>
                <dd className="text-right font-medium text-slate-800">{ticket.assignee?.displayName ?? '-'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>เปิดเมื่อ</dt>
                <dd className="text-right">{formatDateTime(ticket.createdAt)}</dd>
              </div>
            </dl>
            {!isClosed && (
              <div className="mt-4 flex flex-col gap-2">
                {!assignedToMe && (
                  <button
                    type="button"
                    onClick={() => void run(() => adminApi.assignTicket(id))}
                    disabled={busy}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
                  >
                    {ticket.assignee ? 'รับเรื่องต่อ' : 'รับเรื่อง'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  ปิดเรื่อง
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}
