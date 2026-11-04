import { useOutletContext } from 'react-router'
import { api } from '@shared/lib/api'

export type UserCounts = { incomingOffers: number; answeredTickets: number; escrowActions: number }

export const fetchCounts = () => api<UserCounts>('/me/counts')

// UserLayout ดึงตัวเลขครั้งเดียวแล้วส่งต่อผ่าน Outlet ให้หน้าลูกใช้ ไม่ต้องยิงซ้ำทุกหน้า
export const useCounts = () => useOutletContext<UserCounts | null>()

// เมนูข้อเสนอรวมทุกอย่างที่ต้องทำต่อ ทั้งข้อเสนอที่รอตอบและขั้นตอนเงินวางกลาง
export const offerTasks = (counts: UserCounts | null | undefined) => counts && counts.incomingOffers + counts.escrowActions
export const OFFER_TASKS_LABEL = 'ข้อเสนอที่รอคุณดำเนินการ'
