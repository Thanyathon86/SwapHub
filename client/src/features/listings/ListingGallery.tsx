import { useState } from 'react'
import { ListingCover } from '@shared/listings/ListingCover'
import { imageUrl, type Listing } from '@shared/listings/listingsApi'

// รูปใหญ่หนึ่งรูป + แถบรูปย่อยให้กดสลับเมื่อมีหลายรูป
// แสดงรูปเต็มไม่ครอป ผู้ซื้อต้องเห็นขอบและมุมของการ์ดเพื่อดูสภาพ ส่วนที่สัดส่วนไม่พอดีกรอบจะเห็นเป็นพื้นเทา
export function ListingGallery({ listing }: { listing: Listing }) {
  const [index, setIndex] = useState(0)
  const { images } = listing
  const current = images[index] ?? images[0]

  // ภาพวาดเป็นทรงการ์ดอยู่แล้ว กรอบต้องสูงพอไม่ให้ตัวหนังสือบนการ์ดเบียดกันบนจอเล็ก
  if (!current) {
    return (
      <div className="grid aspect-square place-items-center rounded-2xl bg-zinc-100 sm:aspect-video md:aspect-square">
        <div className="w-[64%] sm:w-[36%] md:w-[64%]">
          <ListingCover listing={listing} size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* จอเล็กใช้กรอบเตี้ยลง ให้ราคากับปุ่มอยู่ในหน้าจอแรกโดยไม่ต้องเลื่อนไกล */}
      <a
        href={imageUrl(current.key)}
        target="_blank"
        rel="noreferrer"
        title="เปิดรูปขนาดเต็ม"
        className="block aspect-[4/3] overflow-hidden rounded-2xl bg-zinc-100 sm:aspect-video md:aspect-square"
      >
        <img
          src={imageUrl(current.key)}
          alt={`${listing.title} รูปที่ ${index + 1}`}
          width={current.width}
          height={current.height}
          className="size-full object-contain"
        />
      </a>
      {images.length > 1 && (
        <div className="grid grid-cols-6 gap-1.5">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`ดูรูปที่ ${i + 1}`}
              aria-pressed={i === index}
              className={`overflow-hidden rounded-lg ring-2 transition ${i === index ? 'ring-zinc-900' : 'ring-transparent hover:ring-zinc-400'}`}
            >
              <img src={imageUrl(img.key)} alt="" loading="lazy" className="aspect-square w-full bg-zinc-100 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
