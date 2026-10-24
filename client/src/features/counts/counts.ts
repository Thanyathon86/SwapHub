import { useOutletContext } from 'react-router'
import { api } from '@shared/lib/api'

export type UserCounts = { incomingOffers: number; answeredTickets: number }

export const fetchCounts = () => api<UserCounts>('/me/counts')

// UserLayout ดึงตัวเลขครั้งเดียวแล้วส่งต่อผ่าน Outlet ให้หน้าลูกใช้ ไม่ต้องยิงซ้ำทุกหน้า
export const useCounts = () => useOutletContext<UserCounts | null>()
