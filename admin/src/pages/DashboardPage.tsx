import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'
import { gradientFor } from '@shared/listings/gradient'
import { formatDate, formatPrice } from '@shared/listings/labels'
import { imageUrl } from '@shared/listings/listingsApi'
import { Icon, type IconName } from '../components/icons'
import { adminApi, type AuditAction, type Dashboard, type EventType } from '../features/adminApi'
import { ColumnChart } from '../features/dashboard/ColumnChart'
import { DonutChart } from '../features/dashboard/DonutChart'
import { auditActionLabels, formatDateTime } from '../features/labels'

const CHART_DAYS = 30
const PENDING_ROWS = 5

const card = 'rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5'
const number = (n: number) => n.toLocaleString('th-TH')

// key ของวันจาก server เป็นวันตามเวลาไทยอยู่แล้ว แปลงกลับด้วย +07:00 ไม่ให้วันเลื่อนตามเครื่องที่เปิดดู
const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00+07:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' })

type TileProps = { icon: IconName; label: string; value: number; note?: ReactNode; to: string; urgent?: boolean }

// งานค้างใช้สีเหลือง เพราะสีหลักของหลังบ้านแดงอยู่แล้ว ถ้าเตือนด้วยแดงจะแยกจากของปกติไม่ออก
function Tile({ icon, label, value, note, to, urgent = false }: TileProps) {
  return (
    // จอเล็กเรียงไอคอนไว้เหนือตัวเลข การ์ดกว้างพอวางสองใบต่อแถว ไม่ต้องเลื่อนผ่านตัวเลขสี่แถวกว่าจะถึงกราฟ
    <Link to={to} className={`${card} flex flex-col items-start gap-2 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:gap-3`}>
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-full sm:size-11 ${urgent ? 'bg-amber-100 text-amber-800' : 'bg-brand-50 text-brand-600'}`}
      >
        <Icon name={icon} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-slate-500">{label}</span>
        <span className="block text-2xl font-semibold text-slate-900">{number(value)}</span>
        {note && <span className="mt-0.5 block text-xs text-slate-500">{note}</span>}
      </span>
    </Link>
  )
}

function CardHeader({ icon, title, to, linkLabel = 'ดูทั้งหมด' }: { icon: IconName; title: string; to?: string; linkLabel?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800">
        <Icon name={icon} className="size-4.5 text-slate-500" />
        <span className="truncate">{title}</span>
      </h2>
      {to && (
        <Link to={to} className="shrink-0 text-xs font-medium text-brand-600 hover:underline">
          {linkLabel}
        </Link>
      )}
    </div>
  )
}

const auditIcons: Record<AuditAction, IconName> = {
  USER_PROMOTED: 'shield',
  USER_DEMOTED: 'user',
  USER_SUSPENDED: 'ban',
  USER_REACTIVATED: 'refresh',
  REVIEW_REMOVED: 'star',
  LISTING_APPROVED: 'tag',
  LISTING_REJECTED: 'tag',
  CATALOG_CHANGED: 'cards',
  TICKET_CLOSED: 'message',
}

const securityRows: { key: keyof Dashboard['security24h']; type: EventType; label: string }[] = [
  { key: 'loginFailed', type: 'LOGIN_FAILED', label: 'ล็อกอินไม่สำเร็จ' },
  { key: 'rateLimited', type: 'RATE_LIMITED', label: 'ส่งคำขอถี่เกิน' },
  { key: 'accessDenied', type: 'ACCESS_DENIED', label: 'พยายามเข้าส่วนที่ไม่มีสิทธิ์' },
  { key: 'serverErrors', type: 'SERVER_ERROR', label: 'ระบบผิดพลาด' },
]

const rowClass = 'flex items-center gap-3 py-2.5 text-sm'

export default function DashboardPage() {
  const { data, error, loading, reload } = useResource(adminApi.dashboard)
  const pending = useResource(() => adminApi.listListings({ status: 'PENDING_REVIEW', page: 1 }))

  if (error !== undefined && !data) {
    return <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMessage(error)}</p>
  }
  if (!data) return <Spinner />

  const { attention, totals, daily, listingsByGame, security24h, recentAudit } = data
  const series = (key: 'users' | 'listings' | 'deals') => daily.map((d) => ({ label: dayLabel(d.day), value: d[key] }))
  const busy = loading || pending.loading
  const refresh = () => {
    reload()
    pending.reload()
  }

  return (
    <section className={`space-y-4 transition-opacity ${busy ? 'opacity-70' : ''}`}>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
        >
          <Icon name="refresh" className="size-4" />
          รีเฟรช
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Tile icon="users" label="ผู้ใช้ทั้งหมด" value={totals.users} note={`ใหม่ใน 7 วัน +${number(totals.newUsers7d)}`} to="/users" />
        <Tile icon="tag" label="ประกาศที่เปิดอยู่" value={totals.activeListings} to="/listings?status=ACTIVE" />
        <Tile
          icon="clock"
          label="ประกาศรออนุมัติ"
          value={attention.pendingListings}
          to="/listings"
          urgent={attention.pendingListings > 0}
          note={
            attention.pendingListingsOver24h > 0 && (
              // สถานะเตือนต้องมีไอคอนและข้อความ ไม่ใช้สีอย่างเดียว
              <span className="flex items-center gap-1 font-medium text-amber-800">
                <Icon name="alert" className="size-3.5" />
                รอเกิน 24 ชม. {number(attention.pendingListingsOver24h)} รายการ
              </span>
            )
          }
        />
        <Tile icon="message" label="เรื่องที่แจ้งรอตอบ" value={attention.openTickets} to="/support" urgent={attention.openTickets > 0} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className={`${card} min-w-0 xl:col-span-2`}>
          <CardHeader icon="chart" title={`กิจกรรม ${CHART_DAYS} วันล่าสุด`} />
          <ColumnChart
            days={CHART_DAYS}
            metrics={[
              { key: 'users', label: 'ผู้ใช้ใหม่', unit: 'คน', points: series('users') },
              { key: 'listings', label: 'ประกาศใหม่', unit: 'ประกาศ', points: series('listings') },
              { key: 'deals', label: 'ดีล', unit: 'ดีล', points: series('deals') },
            ]}
          />
        </div>
        <div className={`${card} min-w-0`}>
          <CardHeader icon="donut" title="ประกาศที่เปิดอยู่ตามเกม" to="/catalog" linkLabel="ดูเกมทั้งหมด" />
          <DonutChart
            unit="ประกาศ"
            emptyText="ยังไม่มีประกาศที่เปิดอยู่"
            items={listingsByGame.map((g) => ({ id: g.id, label: g.name, value: g.activeListings, muted: !g.isActive }))}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <div className={`${card} min-w-0 xl:col-span-2`}>
          <CardHeader icon="history" title="การจัดการล่าสุด" to="/audit" />
          {recentAudit.length === 0 ? (
            <p className="text-sm text-slate-500">ยังไม่มีประวัติ</p>
          ) : (
            <ul className="space-y-2">
              {recentAudit.map((log) => {
                const action = auditActionLabels[log.action]
                return (
                  <li key={log.id} className="flex items-center gap-3 rounded-lg p-2.5 ring-1 ring-slate-100">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600">
                      <Icon name={auditIcons[log.action]} className="size-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      {/* การแก้เกมหรือบริษัทเกรดไม่มีผู้ใช้เป้าหมาย แสดงว่าแก้อะไรแทน */}
                      <div className="truncate text-sm font-medium text-slate-800">{log.targetUser?.displayName ?? log.detail}</div>
                      <div className="truncate text-xs text-slate-500">
                        โดย {log.actor.displayName} · {formatDateTime(log.createdAt)}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${action.className}`}>{action.text}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className={`${card} min-w-0 xl:col-span-3`}>
          <CardHeader icon="tag" title="ประกาศรอตรวจ" to="/listings" />
          {pending.error !== undefined && !pending.data ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMessage(pending.error)}</p>
          ) : pending.data?.listings.length === 0 ? (
            <p className="text-sm text-slate-500">ไม่มีประกาศรอตรวจ</p>
          ) : (
            <div className="overflow-x-auto">
              {/* table-fixed: ชื่อการ์ดยาวติดกันต้องถูกตัดในช่องตัวเอง ไม่ดันคอลัมน์ราคาออกนอกกรอบ
                  จอเล็กเหลือแค่ชื่อกับราคาที่ต้องดูก่อนตัดสินใจกดเข้าไปตรวจ ไม่ต้องเลื่อนตารางแนวนอน */}
              <table className="w-full table-fixed text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">ประกาศ</th>
                    <th className="hidden w-36 px-3 py-2 font-medium sm:table-cell">ผู้ขาย</th>
                    <th className="w-28 px-3 py-2 text-right font-medium">ราคา</th>
                    <th className="hidden w-28 px-3 py-2 text-right font-medium sm:table-cell">ส่งเมื่อ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pending.data?.listings.slice(0, PENDING_ROWS).map((l) => {
                    const cover = l.images[0]
                    return (
                      <tr key={l.id}>
                        <td className="px-3 py-2">
                          <Link to="/listings" className="flex items-center gap-3 hover:text-brand-700">
                            {/* ภาพวาดการ์ดย่อขนาดนี้ตัวหนังสือจะอ่านไม่ออก ใช้แค่สีประจำเกม */}
                            {cover ? (
                              <img
                                src={imageUrl(cover.key)}
                                alt=""
                                loading="lazy"
                                className="aspect-[63/88] w-8 shrink-0 rounded bg-slate-100 object-cover"
                              />
                            ) : (
                              <span className={`aspect-[63/88] w-8 shrink-0 rounded bg-linear-to-br ${gradientFor(l.game.slug)}`} />
                            )}
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-slate-800">{l.title}</span>
                              <span className="block truncate text-xs text-slate-500">{l.game.name}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="hidden truncate px-3 py-2 text-slate-600 sm:table-cell">{l.seller.displayName}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-slate-800 tabular-nums">
                          {formatPrice(l.price) ?? 'แลกเท่านั้น'}
                        </td>
                        <td className="hidden px-3 py-2 text-right whitespace-nowrap text-slate-500 sm:table-cell">{formatDate(l.createdAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${card} min-w-0`}>
          <CardHeader icon="shield" title="ความปลอดภัย 24 ชม." to="/events" linkLabel="ดู log ทั้งหมด" />
          <ul className="divide-y divide-slate-100">
            {securityRows.map((row) => {
              const value = security24h[row.key]
              return (
                <li key={row.key}>
                  <Link to={`/events?type=${row.type}`} className={`${rowClass} hover:text-brand-700`}>
                    <Icon name={value > 0 ? 'alert' : 'shield'} className={`size-4 ${value > 0 ? 'text-amber-700' : 'text-slate-400'}`} />
                    <span className="min-w-0 flex-1 text-slate-600">{row.label}</span>
                    <span className={`font-medium tabular-nums ${value > 0 ? 'text-amber-800' : 'text-slate-500'}`}>{number(value)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        <div className={`${card} min-w-0`}>
          <CardHeader icon="swap" title="ความเคลื่อนไหวของผู้ใช้" />
          <ul className="divide-y divide-slate-100">
            <li className={rowClass}>
              <Icon name="swap" className="size-4 text-slate-400" />
              <span className="min-w-0 flex-1 text-slate-600">ดีลที่ตกลงกันใน 7 วัน</span>
              <span className="font-medium text-slate-800 tabular-nums">{number(totals.deals7d)}</span>
            </li>
            <li className={rowClass}>
              <Icon name="clock" className="size-4 text-slate-400" />
              <span className="min-w-0 flex-1 text-slate-600">
                ข้อเสนอที่รอผู้ขายตอบ
                <span className="block text-xs text-slate-500">ผู้ใช้ตอบกันเอง แสดงไว้ดูภาพรวม</span>
              </span>
              <span className="font-medium text-slate-800 tabular-nums">{number(attention.pendingOffers)}</span>
            </li>
            <li>
              <Link to="/users?status=SUSPENDED" className={`${rowClass} hover:text-brand-700`}>
                <Icon name="ban" className="size-4 text-slate-400" />
                <span className="min-w-0 flex-1 text-slate-600">ผู้ใช้ที่ถูกระงับ</span>
                <span className="font-medium text-slate-800 tabular-nums">{number(totals.suspendedUsers)}</span>
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}
