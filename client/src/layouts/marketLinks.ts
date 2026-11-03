import { kindLabel } from '@shared/listings/labels'

// แท็บหน้าร้านกับลิงก์ใน footer ใช้ชุดเดียวกัน เพิ่มหมวดแล้วขึ้นทั้งสองที่
export const marketLinks = [
  { key: 'latest', label: 'ล่าสุด', to: '/' },
  { key: 'SINGLE', label: kindLabel.SINGLE, to: '/browse?itemKind=SINGLE' },
  { key: 'GRADED', label: kindLabel.GRADED, to: '/browse?itemKind=GRADED' },
  { key: 'SEALED', label: kindLabel.SEALED, to: '/browse?itemKind=SEALED' },
  { key: 'TRADE', label: 'รับแลก', to: '/browse?type=TRADE' },
  { key: 'all', label: 'ทั้งหมด', to: '/browse' },
]
