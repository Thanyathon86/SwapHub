import { Link } from 'react-router'
import { gradientFor } from '@shared/listings/gradient'
import { imageUrl, type CatalogGame } from '@shared/listings/listingsApi'

const SKELETON_COUNT = 4

// กำหนดความกว้างด้วย basis แทน grid เพื่อให้แถวที่ไม่เต็ม (admin เพิ่มเกมได้ไม่จำกัด) ยังจัดกึ่งกลางได้
const tileClass = 'aspect-[16/10] grow-0 basis-[calc(50%-0.375rem)] rounded-xl sm:basis-[calc(50%-0.5rem)] md:basis-[calc(25%-0.75rem)]'

// tile ของแต่ละเกม ใช้รูปที่ admin ตั้งไว้ เกมที่ยังไม่มีรูปใช้สีตาม slug กับการ์ดซ้อนกันเป็นลวดลาย
export function GameTiles({ games }: { games: CatalogGame[] | undefined }) {
  if (games?.length === 0) return null

  return (
    <nav aria-label="เลือกตามเกม" className="flex flex-wrap justify-center gap-3 sm:gap-4">
      {games
        ? games.map((game) => (
            <Link
              key={game.id}
              to={`/browse?game=${encodeURIComponent(game.slug)}`}
              className={`group relative flex items-end overflow-hidden bg-linear-to-br p-3 text-white sm:p-4 lg:p-5 ${tileClass} ${gradientFor(game.slug)}`}
            >
              {game.imageKey ? (
                // alt ว่าง: ชื่อเกมเป็นข้อความอยู่ในลิงก์แล้ว สีพื้นด้านหลังแสดงระหว่างรูปกำลังโหลด
                <img
                  src={imageUrl(game.imageKey)}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-105 motion-reduce:transform-none"
                />
              ) : (
                <>
                  <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.45),transparent_55%)]" />
                  <span
                    aria-hidden="true"
                    className="absolute top-[12%] right-[6%] aspect-[63/88] h-[110%] rotate-12 rounded-lg bg-white/15 ring-1 ring-white/30 transition duration-300 group-hover:rotate-[16deg] motion-reduce:transition-none"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute top-[22%] right-[24%] aspect-[63/88] h-[110%] -rotate-6 rounded-lg bg-white/20 ring-1 ring-white/30 transition duration-300 group-hover:-rotate-[10deg] motion-reduce:transition-none"
                  />
                </>
              )}
              {/* พื้นบางเกมหรือรูปอาจสว่างมาก ต้องมีเงาไล่ระดับรองไว้ ตัวหนังสือสีขาวถึงจะอ่านออก */}
              <span
                aria-hidden="true"
                className={`absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t to-transparent ${game.imageKey ? 'from-black/60' : 'from-black/50'}`}
              />
              <span className="relative text-base/tight font-semibold [text-shadow:0_1px_8px_rgb(0_0_0/0.35)] sm:text-lg/tight lg:text-2xl/tight">
                {game.name}
              </span>
            </Link>
          ))
        : Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <div key={i} aria-hidden="true" className={`animate-pulse bg-zinc-100 motion-reduce:animate-none ${tileClass}`} />
          ))}
    </nav>
  )
}
