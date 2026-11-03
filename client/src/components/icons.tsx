// ไอคอนไม่กี่ตัว วาดเองแทนการติดตั้งทั้ง library สีตาม currentColor ขนาดกำหนดผ่าน className
const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

type IconProps = { className?: string }

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function ChevronIcon({ className, direction }: IconProps & { direction: 'left' | 'right' }) {
  return (
    <svg {...svgProps} className={className}>
      <path d={direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
    </svg>
  )
}

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M10 21v-6h4v6" />
    </svg>
  )
}

// การ์ดซ้อนกัน สื่อถึงการเรียกดูประกาศทั้งหมด
export function CardsIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <rect x="4" y="7" width="11" height="14" rx="2" />
      <path d="M9 3h9a2 2 0 0 1 2 2v12" />
    </svg>
  )
}

export function SwapIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <path d="M4 8h14" />
      <path d="m14 4 4 4-4 4" />
      <path d="M20 16H6" />
      <path d="m10 12-4 4 4 4" />
    </svg>
  )
}

export function ShieldCheckIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}
