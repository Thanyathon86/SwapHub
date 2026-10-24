import { artPropsOf } from './labels'
import { ListingArt } from './ListingArt'
import { imageUrl, type Listing } from './listingsApi'

type Props = { listing: Pick<Listing, 'images' | 'title'> & Parameters<typeof artPropsOf>[0]; size?: 'sm' | 'lg' }

// ใช้รูปแรกที่ผู้ขายอัปโหลดเป็นปก ถ้ายังไม่มีรูปใช้ภาพวาดเดิม กรอบสัดส่วนเดียวกับการ์ดจริง (63:88) layout จะไม่กระโดด
export function ListingCover({ listing, size = 'sm' }: Props) {
  const cover = listing.images[0]
  if (!cover) return <ListingArt {...artPropsOf(listing)} size={size} />
  return (
    <img
      src={imageUrl(cover.key)}
      alt={listing.title}
      loading="lazy"
      width={cover.width}
      height={cover.height}
      className="aspect-[63/88] w-full rounded-2xl bg-zinc-100 object-cover"
    />
  )
}
