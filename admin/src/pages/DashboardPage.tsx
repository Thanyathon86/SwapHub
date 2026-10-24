import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'
import { adminApi, type Dashboard, type EventType } from '../features/adminApi'
import { BarList } from '../features/dashboard/BarList'
import { ColumnChart } from '../features/dashboard/ColumnChart'
import { auditActionLabels, formatDateTime } from '../features/labels'

const card = 'rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200'
const number = (n: number) => n.toLocaleString('th-TH')

// key ของวันจาก server เป็นวันตามเวลาไทยอยู่แล้ว แปลงกลับด้วย +07:00 ไม่ให้วันเลื่อนตามเครื่องที่เปิดดู
const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00+07:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' })

function Tile({ label, value, note, to }: { label: string; value: number; note?: ReactNode; to?: string }) {
  const body = (
    <>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-slate-800 tabular-nums">{number(value)}</div>
      {note && <div className="mt-1 text-xs text-slate-500">{note}</div>}
    </>
  )
  return to ? (
    <Link to={to} className={`${card} block hover:ring-indigo-300`}>
      {body}
    </Link>
  ) : (
    <div className={card}>{body}</div>
  )
}

const securityRows: { key: keyof Dashboard['security24h']; type: EventType; label: string }[] = [
  { key: 'loginFailed', type: 'LOGIN_FAILED', label: 'ล็อกอินไม่สำเร็จ' },
  { key: 'rateLimited', type: 'RATE_LIMITED', label: 'ส่งคำขอถี่เกิน' },
  { key: 'accessDenied', type: 'ACCESS_DENIED', label: 'พยายามเข้าส่วนที่ไม่มีสิทธิ์' },
  { key: 'serverErrors', type: 'SERVER_ERROR', label: 'ระบบผิดพลาด' },
]

export default function DashboardPage() {
  const { data, error, loading, reload } = useResource(adminApi.dashboard)

  if (error !== undefined && !data) {
    return <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMessage(error)}</p>
  }
  if (!data) return <Spinner />

  const { attention, totals, daily, listingsByGame, security24h, recentAudit } = data
  const series = (key: 'users' | 'listings' | 'deals') => daily.map((d) => ({ label: dayLabel(d.day), value: d[key] }))

  return (
    <section className={`space-y-8 ${loading ? 'opacity-70' : ''}`}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          รีเฟรช
        </button>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-slate-500">ต้องจัดการ</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Tile
            label="ประกาศรออนุมัติ"
            value={attention.pendingListings}
            to="/listings"
            note={
              attention.pendingListingsOver24h > 0 ? (
                // สถานะเตือนต้องมีไอคอนและข้อความ ไม่ใช้สีอย่างเดียว
                <span className="font-medium text-amber-700">⚠ รอเกิน 24 ชม. {number(attention.pendingListingsOver24h)} รายการ</span>
              ) : (
                'ไม่มีรายการที่รอนานเกิน 24 ชม.'
              )
            }
          />
          <Tile label="ข้อเสนอที่รอผู้ขายตอบ" value={attention.pendingOffers} note="ผู้ใช้ตอบกันเอง แสดงไว้ดูภาพรวม" />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-slate-500">ภาพรวม</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile label="ผู้ใช้ทั้งหมด" value={totals.users} note={`ใหม่ใน 7 วัน +${number(totals.newUsers7d)}`} to="/users" />
          <Tile label="ประกาศที่เปิดอยู่" value={totals.activeListings} to="/listings?status=ACTIVE" />
          <Tile label="ดีลที่ตกลงกันใน 7 วัน" value={totals.deals7d} />
          <Tile label="ผู้ใช้ที่ถูกระงับ" value={totals.suspendedUsers} to="/users?status=SUSPENDED" />
        </div>
      </div>

      {/* small multiples: แยกกราฟละตัวชี้วัด ไม่เอามารวมแกนเดียวเพราะขนาดตัวเลขต่างกันมาก */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-slate-500">30 วันล่าสุด</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <ColumnChart title="ผู้ใช้ใหม่ต่อวัน" points={series('users')} unit="คน" />
          <ColumnChart title="ประกาศใหม่ต่อวัน" points={series('listings')} unit="ประกาศ" />
          <ColumnChart title="ดีลที่ตกลงต่อวัน" points={series('deals')} unit="ดีล" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={card}>
          <h2 className="mb-4 text-sm font-medium text-slate-700">ประกาศที่เปิดอยู่ตามเกม</h2>
          {listingsByGame.length === 0 ? (
            <p className="text-sm text-slate-500">ยังไม่มีเกม</p>
          ) : (
            <BarList
              unit="ประกาศ"
              items={listingsByGame.map((g) => ({ id: g.id, label: g.name, value: g.activeListings, muted: !g.isActive }))}
            />
          )}
        </div>

        <div className={card}>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-slate-700">ความปลอดภัย 24 ชม.</h2>
            <Link to="/events" className="text-xs text-indigo-600 hover:underline">
              ดู log ทั้งหมด
            </Link>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {securityRows.map((row) => {
              const value = security24h[row.key]
              return (
                <li key={row.key}>
                  <Link to={`/events?type=${row.type}`} className="flex justify-between gap-3 py-2 hover:text-indigo-700">
                    <span className="text-slate-600">
                      {value > 0 && <span aria-hidden="true">⚠ </span>}
                      {row.label}
                    </span>
                    <span className={`font-medium tabular-nums ${value > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                      {number(value)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        <div className={card}>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-slate-700">การจัดการล่าสุด</h2>
            <Link to="/audit" className="text-xs text-indigo-600 hover:underline">
              ดูทั้งหมด
            </Link>
          </div>
          {recentAudit.length === 0 ? (
            <p className="text-sm text-slate-500">ยังไม่มีประวัติ</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {recentAudit.map((log) => {
                const action = auditActionLabels[log.action]
                return (
                  <li key={log.id}>
                    <div className="text-slate-700">
                      <span className="font-medium">{log.actor.displayName}</span>{' '}
                      <span className={`rounded-full px-2 py-0.5 text-xs ${action.className}`}>{action.text}</span>{' '}
                      <span className="font-medium">{log.targetUser.displayName}</span>
                    </div>
                    <div className="text-xs text-slate-400">{formatDateTime(log.createdAt)}</div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
