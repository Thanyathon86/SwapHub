import { Link, useParams } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { Avatar } from '@shared/components/Avatar'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'
import { ListingCard } from '../../features/listings/ListingCard'
import { ProfileReviews } from '../../features/profile/ProfileReviews'
import { profileApi } from '../../features/profile/profileApi'

const joined = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 px-2 py-4 text-center sm:px-4">
      <div className="text-xl font-bold text-zinc-900 tabular-nums sm:text-2xl">{value}</div>
      <div className="mt-0.5 text-xs text-zinc-500 sm:text-sm">{label}</div>
    </div>
  )
}

// คนเปิดหน้านี้มักอยากรู้ว่าคนขายน่าเชื่อถือไหมและมีอะไรขาย จึงเรียงชื่อ ตัวเลขความน่าเชื่อถือ แล้วประกาศกับรีวิว ไม่ต้องสลับแท็บ
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
  const { rating, deals, activeListings } = profile.stats
  const details = [`@${profile.username}`, profile.location, `สมาชิกตั้งแต่ ${joined(profile.createdAt)}`].filter(Boolean)

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200">
        <header className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <Avatar user={profile} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">{profile.displayName}</h1>
            <p className="mt-1 text-sm text-zinc-500">{details.join(' · ')}</p>
            {profile.bio && <p className="mt-3 text-sm whitespace-pre-line text-zinc-700">{profile.bio}</p>}
          </div>
          {user?.id === profile.id && (
            <Link to="/profile/edit" className="btn btn-secondary shrink-0 self-start sm:self-center">
              แก้ไขโปรไฟล์
            </Link>
          )}
        </header>
        <div className="grid grid-cols-3 divide-x divide-zinc-100 border-t border-zinc-100">
          <Stat value={rating.average === null ? '-' : `★ ${rating.average}`} label={rating.count > 0 ? `จาก ${rating.count} รีวิว` : 'ยังไม่มีรีวิว'} />
          <Stat value={String(deals)} label="ดีลสำเร็จ" />
          <Stat value={String(activeListings)} label="ประกาศที่เปิด" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="profile-listings" className="min-w-0">
          <h2 id="profile-listings" className="mb-4 text-lg font-semibold text-zinc-900">
            ประกาศที่เปิดอยู่
          </h2>
          {listings.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-200 px-6 py-12 text-center text-sm text-zinc-500">ยังไม่มีประกาศที่เปิดอยู่</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="profile-reviews" className="min-w-0">
          <h2 id="profile-reviews" className="mb-1 text-lg font-semibold text-zinc-900">
            รีวิวล่าสุด
          </h2>
          {/* key: เปลี่ยนไปดูโปรไฟล์คนอื่นแล้วเริ่มรายการรีวิวใหม่ ไม่ต่อท้ายของคนเดิม */}
          <ProfileReviews key={profile.username} username={profile.username} />
        </section>
      </div>
    </div>
  )
}
