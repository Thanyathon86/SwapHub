import { gradientFor } from './gradient'
import type { CardCondition, ItemKind } from './listingsApi'

export type ArtProps = {
  gameSlug: string
  gameName: string
  title: string
  setName: string
  itemKind: ItemKind
  cardNumber?: string | null
  condition?: CardCondition | null
  gradingCompanyName?: string | null | undefined
  grade?: string | null
  size?: 'sm' | 'lg'
}

export function ListingArt(props: ArtProps) {
  const { gameSlug, gameName, title, setName, itemKind, cardNumber, condition, size = 'sm' } = props
  const lg = size === 'lg'
  const tiny = lg ? 'text-xs' : 'text-[10px]'

  return (
    <div
      className={`@container relative aspect-[63/88] w-full overflow-hidden rounded-xl bg-linear-to-br ${gradientFor(gameSlug)} ${lg ? 'p-5' : 'p-3'}`}
    >
      {/* แสงสะท้อนแบบการ์ดฟอยล์ */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.55),transparent_55%)]" />
      <div className={`pointer-events-none absolute rounded-lg ring-1 ring-white/40 ${lg ? 'inset-3' : 'inset-1.5'}`} />
      {itemKind === 'SEALED' && <div className="pointer-events-none absolute inset-x-0 top-1/3 h-1/5 bg-white/15" />}
      {/* สีพื้นบางเกมสว่างมาก ต้องมีเงารองไว้ ชื่อการ์ดสีขาวถึงจะอ่านออก */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/50 to-transparent" />

      <div className="relative flex h-full flex-col text-white">
        {itemKind === 'GRADED' ? (
          <GradeLabel name={props.gradingCompanyName} grade={props.grade} lg={lg} />
        ) : (
          <div className="flex items-start justify-between gap-2">
            <span className={`min-w-0 truncate font-medium tracking-wider text-white uppercase [text-shadow:0_1px_4px_rgb(0_0_0/0.45)] @max-[8rem]:hidden ${tiny}`}>
              {gameName}
            </span>
            {(itemKind === 'SEALED' || condition) && (
              <span className={`ml-auto shrink-0 rounded-full bg-black/20 font-semibold ${lg ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'}`}>
                {itemKind === 'SEALED' ? 'SEALED' : condition}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto">
          {itemKind === 'GRADED' && (
            <div className={`font-medium tracking-wider text-white/80 uppercase ${tiny}`}>{gameName}</div>
          )}
          <div
            className={`leading-tight font-semibold [text-shadow:0_1px_8px_rgb(0_0_0/0.25)] @max-[8rem]:text-xs ${lg ? 'line-clamp-4 text-3xl' : 'line-clamp-3 text-base'}`}
          >
            {title || 'ชื่อการ์ด'}
          </div>
          <div className={`mt-1 truncate text-white/80 @max-[8rem]:hidden ${lg ? 'text-sm' : 'text-[11px]'}`}>
            {setName || 'ชุด'}
            {cardNumber ? ` · ${cardNumber}` : ''}
          </div>
        </div>
      </div>
    </div>
  )
}

type GradeLabelProps = { name?: string | null | undefined; grade?: string | null | undefined; lg: boolean }

// ทำให้คล้ายป้ายบนกล่อง slab ของการ์ดเกรด
function GradeLabel({ name, grade, lg }: GradeLabelProps) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg bg-white/95 text-zinc-900 shadow-sm ${lg ? 'px-4 py-2.5' : 'px-2.5 py-1.5'}`}
    >
      <span className={`font-bold tracking-wide ${lg ? 'text-sm' : 'text-[11px]'}`}>{name || 'GRADE'}</span>
      <span className={`font-bold tabular-nums ${lg ? 'text-2xl' : 'text-base'}`}>{grade || '–'}</span>
    </div>
  )
}
