import { Link } from 'react-router'
import { Spinner } from '../../components/Spinner'
import { adminApi } from '../../features/admin/adminApi'
import { errorMessage } from '../../lib/api'
import { useResource } from '../../lib/useResource'

export default function DashboardPage() {
  const { data: stats, error } = useResource(adminApi.stats)

  const cards = stats && [
    { label: 'ประกาศรออนุมัติ', value: stats.pendingListings, to: '/admin/listings' },
    { label: 'ประกาศที่เปิดอยู่', value: stats.activeListings, to: '/admin/listings?status=ACTIVE' },
    { label: 'ผู้ใช้ทั้งหมด', value: stats.users, to: '/admin/users' },
    { label: 'ผู้ใช้ที่ถูกระงับ', value: stats.suspendedUsers, to: '/admin/users?status=SUSPENDED' },
    { label: 'เกมที่เปิดใช้งาน', value: stats.activeGames, to: '/admin/catalog' },
  ]

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
      {error !== undefined && !stats ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMessage(error)}</p>
      ) : !cards ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {cards.map((card) => {
            const body = (
              <>
                <div className="text-sm text-slate-500">{card.label}</div>
                <div className="mt-1 text-3xl font-bold text-slate-800">{card.value.toLocaleString('th-TH')}</div>
              </>
            )
            const className = 'block rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200'
            return card.to ? (
              <Link key={card.label} to={card.to} className={`${className} hover:ring-indigo-300`}>
                {body}
              </Link>
            ) : (
              <div key={card.label} className={className}>
                {body}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
