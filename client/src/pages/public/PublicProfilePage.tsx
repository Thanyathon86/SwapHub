import { Link, useParams } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { Avatar } from '@shared/components/Avatar'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'
import { ListingCard } from '../../features/listings/ListingCard'
import { profileApi } from '../../features/profile/profileApi'

const joined = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <span className="font-semibold tabular-nums">{value}</span> <span className="text-zinc-500">{label}</span>
    </div>
  )
}

// หน้าโปรไฟล์แบบ IG: รูป + สถิติด้านบน ตามด้วยตารางประกาศ
export default function PublicProfilePage() {
  const { username = '' } = useParams()
  const { user } = useAuth()
  const { data, error } = useResource(() => profileApi.get(username), username)

  if (error !== undefined && !data) {
    return (
      <div className="py-20 text-center">
        <p className="font-medium">{errorMessage(error)}</p>
        <Link to="/" className="btn btn-secondary mt-6">
          กลับหน้าแรก
        </Link>
      </div>
    )
  }
  if (!data) return <Spinner />

  const { profile, listings } = data
  const isMe = user?.id === profile.id

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header className="flex items-start gap-6 sm:gap-10">
        <Avatar user={profile} size="lg" />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="truncate text-xl font-medium">@{profile.username}</h1>
            {isMe && (
              <Link to="/profile/edit" className="btn btn-secondary">
                แก้ไขโปรไฟล์
              </Link>
            )}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <Stat value={profile.stats.activeListings} label="ประกาศ" />
            <Stat value={profile.stats.deals} label="ดีลสำเร็จ" />
          </div>
          <div className="space-y-1 text-sm">
            <div className="font-semibold">{profile.displayName}</div>
            {profile.bio && <p className="whitespace-pre-line text-zinc-700">{profile.bio}</p>}
            <p className="text-zinc-500">
              {profile.location && `${profile.location} · `}เป็นสมาชิกตั้งแต่ {joined(profile.createdAt)}
            </p>
          </div>
        </div>
      </header>

      <section className="border-t border-zinc-100 pt-6">
        <h2 className="mb-4 text-sm font-medium tracking-wide text-zinc-500">ประกาศที่เปิดอยู่</h2>
        {listings.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">ยังไม่มีประกาศที่เปิดอยู่</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
