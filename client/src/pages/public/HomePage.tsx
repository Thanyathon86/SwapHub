import { Link } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'
import { kindLabel } from '@shared/listings/labels'
import { listingsApi } from '@shared/listings/listingsApi'
import { GameTiles } from '../../features/home/GameTiles'
import { HomeHero } from '../../features/home/HomeHero'
import { SellBanner } from '../../features/home/SellBanner'
import { BrowseRow } from '../../features/listings/BrowseRow'
import { ListingRow } from '../../features/listings/ListingRow'

// หน้าร้าน: ดูภาพรวมของตลาดเป็นแถว ๆ ส่วนการค้นหาและตัวกรองละเอียดอยู่ที่หน้าเรียกดู
export default function HomePage() {
  const { user } = useAuth()
  // ทั้ง hero และแถวแรกใช้ประกาศล่าสุด ดึงครั้งเดียวแล้วแบ่งกันใช้
  const { data: latest, error } = useResource(() => listingsApi.browse({}))
  const { data: games } = useResource(listingsApi.popularGames)
  const hasListings = latest !== undefined && latest.listings.length > 0

  return (
    <>
      <HomeHero listings={latest?.listings} total={latest?.total} />
      <div className="page-container space-y-10 py-8 sm:py-10 lg:space-y-16 lg:py-14">
        <GameTiles games={games} />
        {error !== undefined && !latest ? (
          <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{errorMessage(error)}</p>
        ) : latest?.listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 px-6 py-20 text-center">
            <p className="font-medium">ยังไม่มีประกาศ</p>
            <p className="mt-1 text-sm text-zinc-500">มาเป็นคนแรกที่ลงการ์ดในตลาดนี้</p>
            <Link to={user ? '/sell' : '/register'} className="btn btn-primary mt-6">
              ลงประกาศ
            </Link>
          </div>
        ) : (
          <>
            <ListingRow title="ประกาศล่าสุด" to="/browse" listings={latest?.listings} />
            <BrowseRow title={kindLabel.GRADED} to="/browse?itemKind=GRADED" query={{ itemKind: 'GRADED' }} />
            <BrowseRow title={kindLabel.SEALED} to="/browse?itemKind=SEALED" query={{ itemKind: 'SEALED' }} />
          </>
        )}
      </div>
      <SellBanner />
      {hasListings && (
        // empty: ถ้าไม่มีประกาศรับแลก BrowseRow ไม่แสดงอะไร ไม่ต้องเหลือช่องว่างเปล่าเหนือ footer
        <div className="page-container py-10 empty:hidden lg:py-14">
          <BrowseRow title="รับแลก" to="/browse?type=TRADE" query={{ type: 'TRADE' }} />
        </div>
      )}
    </>
  )
}
