import { useState } from 'react'
import { useNavigate } from 'react-router'
import { listingsApi } from '@shared/listings/listingsApi'
import { ListingForm } from '../../features/listings/ListingForm'
import { PhotoPicker } from '../../features/listings/PhotoPicker'

export default function NewListingPage() {
  const navigate = useNavigate()
  const [photos, setPhotos] = useState<File[]>([])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">ลงประกาศ</h1>
        <p className="mt-2 text-sm text-zinc-500">ประกาศจะแสดงในตลาดหลังจากทีมงานตรวจแล้ว</p>
      </div>
      <ListingForm
        submitLabel="ส่งให้ตรวจ"
        extra={<PhotoPicker files={photos} onChange={setPhotos} />}
        onSubmit={async (input) => {
          // ต้องสร้างประกาศก่อนถึงจะมี id ให้อัปโหลดรูปเข้าไป
          const listing = await listingsApi.create(input)
          try {
            for (const photo of photos) await listingsApi.uploadImage(listing.id, photo)
          } catch {
            // ประกาศสร้างแล้ว ไม่ควรให้กดส่งซ้ำ พาไปหน้าแก้ไขให้อัปโหลดรูปที่เหลือต่อ
            navigate(`/my-listings/${listing.id}/edit`, { state: { photoError: true } })
            return
          }
          navigate('/my-listings', { state: { created: true } })
        }}
        onCancel={() => navigate(-1)}
      />
    </div>
  )
}
