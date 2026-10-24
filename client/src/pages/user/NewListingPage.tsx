import { useNavigate } from 'react-router'
import { listingsApi } from '@shared/listings/listingsApi'
import { ListingForm } from '../../features/listings/ListingForm'

export default function NewListingPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">ลงประกาศ</h1>
        <p className="mt-2 text-sm text-zinc-500">ประกาศจะแสดงในตลาดหลังจากทีมงานตรวจแล้ว</p>
      </div>
      <ListingForm
        submitLabel="ส่งให้ตรวจ"
        onSubmit={async (input) => {
          await listingsApi.create(input)
          navigate('/my-listings', { state: { created: true } })
        }}
        onCancel={() => navigate(-1)}
      />
    </div>
  )
}
