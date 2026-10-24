import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'
import { listingsApi, type Listing } from '@shared/listings/listingsApi'
import { draftFromListing } from '../../features/listings/draft'
import { ListingForm } from '../../features/listings/ListingForm'
import { ListingPhotos } from '../../features/listings/ListingPhotos'

// บอกผู้ขายก่อนกดบันทึก ว่าแก้อะไรแล้วประกาศจะหายจากตลาดไปรอตรวจ
const notices = {
  ACTIVE:
    'แก้ราคา จำนวน และรายละเอียดได้ทันที แต่ถ้าแก้ข้อมูลตัวการ์ด (ชื่อ ชุด สภาพ เกรด ฯลฯ) ประกาศจะกลับไปรอตรวจ และข้อเสนอที่ค้างอยู่จะถูกยกเลิก',
  PENDING_REVIEW: 'ประกาศนี้กำลังรอตรวจ แก้แล้วยังคงรอตรวจเหมือนเดิม',
  REJECTED: 'แก้ตามเหตุผลที่ไม่ผ่าน แล้วบันทึกเพื่อส่งตรวจใหม่',
} as const

export default function EditListingPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const photoError = (location.state as { photoError?: boolean } | null)?.photoError === true
  const { data: loaded, error } = useResource(() => listingsApi.mineOne(id), id)
  // ผลจากการเพิ่ม/ลบรูปล่าสุด (สถานะอาจเปลี่ยนเป็นรอตรวจ) ใช้แทนข้อมูลที่โหลดมาตอนแรก
  const [updated, setUpdated] = useState<Listing | null>(null)
  const listing = updated?.id === id ? updated : loaded

  if (error !== undefined && !listing) {
    return (
      <div className="py-20 text-center">
        <p className="font-medium">{errorMessage(error)}</p>
        <Link to="/my-listings" className="btn btn-secondary mt-6">
          กลับไปประกาศของฉัน
        </Link>
      </div>
    )
  }
  if (!listing) return <Spinner />

  if (listing.status === 'CLOSED') {
    return (
      <div className="py-20 text-center">
        <p className="font-medium">ประกาศนี้ปิดแล้ว แก้ไขไม่ได้</p>
        <Link to="/my-listings" className="btn btn-secondary mt-6">
          กลับไปประกาศของฉัน
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/my-listings" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← ประกาศของฉัน
        </Link>
        <h1 className="mt-2 text-3xl font-semibold">แก้ไขประกาศ</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">{notices[listing.status]}</p>
        {listing.status === 'REJECTED' && listing.rejectReason && (
          <p className="mt-3 max-w-2xl rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">เหตุผลที่ไม่ผ่าน: {listing.rejectReason}</p>
        )}
        {photoError && (
          <p className="mt-3 max-w-2xl rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            ลงประกาศแล้ว แต่อัปโหลดรูปบางรูปไม่สำเร็จ ลองเพิ่มรูปอีกครั้งด้านล่าง
          </p>
        )}
      </div>
      <ListingPhotos listing={listing} onChange={setUpdated} />
      <ListingForm
        initial={draftFromListing(listing)}
        lockKind
        submitLabel={listing.status === 'REJECTED' ? 'บันทึกและส่งตรวจใหม่' : 'บันทึก'}
        onSubmit={async (input) => {
          const saved = await listingsApi.update(id, input)
          // บอกหน้ารายการว่าประกาศถูกส่งกลับไปรอตรวจหรือไม่ จะได้แจ้งผู้ขายให้ชัด
          navigate('/my-listings', { state: { updated: saved.status } })
        }}
        onCancel={() => navigate('/my-listings')}
      />
    </div>
  )
}
