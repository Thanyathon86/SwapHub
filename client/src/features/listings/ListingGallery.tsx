import { useState } from 'react'
import { ListingCover } from '@shared/listings/ListingCover'
import { imageUrl, type Listing } from '@shared/listings/listingsApi'

// รูปใหญ่หนึ่งรูป + แถบรูปย่อยให้กดสลับ ถ้ามีรูปเดียวหรือไม่มีรูปก็แสดงแค่ปก
export function ListingGallery({ listing }: { listing: Listing }) {
  const [index, setIndex] = useState(0)
  const { images } = listing
  const current = images[index] ?? images[0]

  if (!current || images.length === 1) return <ListingCover listing={listing} size="lg" />

  return (
    <div className="space-y-3">
      <a href={imageUrl(current.key)} target="_blank" rel="noreferrer" title="เปิดรูปขนาดเต็ม">
        <img
          src={imageUrl(current.key)}
          alt={`${listing.title} รูปที่ ${index + 1}`}
          width={current.width}
          height={current.height}
          className="aspect-[63/88] w-full rounded-2xl bg-zinc-100 object-cover"
        />
      </a>
      <div className="grid grid-cols-6 gap-2">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`ดูรูปที่ ${i + 1}`}
            aria-pressed={i === index}
            className={`overflow-hidden rounded-lg ring-2 transition ${i === index ? 'ring-zinc-900' : 'ring-transparent hover:ring-zinc-300'}`}
          >
            <img src={imageUrl(img.key)} alt="" loading="lazy" className="aspect-square w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}
