import { useResource } from '@shared/lib/useResource'
import { listingsApi, type BrowseQuery } from '@shared/listings/listingsApi'
import { ListingRow } from './ListingRow'

type Props = { title: string; to: string; query: BrowseQuery }

// แถวที่โหลดข้อมูลเอง เป็นส่วนเสริมของหน้าแรก โหลดไม่ขึ้นหรือไม่มีของก็ซ่อนไป ไม่ทำให้ทั้งหน้าดูพัง
export function BrowseRow({ title, to, query }: Props) {
  const { data, error } = useResource(() => listingsApi.browse(query))
  if (error !== undefined || data?.listings.length === 0) return null
  return <ListingRow title={title} to={to} listings={data?.listings} />
}
