import type { TicketStatus } from '@shared/support/types'
import type { AuditAction, EscrowEventType, EscrowStatus, EventType } from './adminApi'

type Badge = { text: string; className: string }

export const auditActionLabels: Record<AuditAction, Badge> = {
  USER_PROMOTED: { text: 'ตั้งเป็น admin', className: 'bg-blue-100 text-blue-700' },
  USER_DEMOTED: { text: 'ถอดสิทธิ์ admin', className: 'bg-amber-100 text-amber-700' },
  USER_SUSPENDED: { text: 'ระงับบัญชี', className: 'bg-red-100 text-red-700' },
  USER_REACTIVATED: { text: 'ปลดระงับ', className: 'bg-green-100 text-green-700' },
  REVIEW_REMOVED: { text: 'ซ่อนรีวิว', className: 'bg-rose-100 text-rose-700' },
  LISTING_APPROVED: { text: 'อนุมัติประกาศ', className: 'bg-slate-100 text-slate-700' },
  LISTING_REJECTED: { text: 'ปฏิเสธประกาศ', className: 'bg-amber-100 text-amber-800' },
  CATALOG_CHANGED: { text: 'แก้เกม/บริษัทเกรด', className: 'bg-blue-100 text-blue-700' },
  TICKET_CLOSED: { text: 'ปิดเรื่องที่แจ้ง', className: 'bg-slate-100 text-slate-700' },
  ESCROW_RELEASED: { text: 'ตัดสินโอนเงินให้ผู้ขาย', className: 'bg-blue-100 text-blue-700' },
  ESCROW_REFUNDED: { text: 'ตัดสินคืนเงินให้ผู้ซื้อ', className: 'bg-amber-100 text-amber-800' },
}

// สีแดง/เหลืองสงวนไว้ให้เหตุการณ์ที่อาจเป็นปัญหา เหตุการณ์ปกติใช้สีเทา
export const eventTypeLabels: Record<EventType, Badge> = {
  LOGIN_SUCCESS: { text: 'ล็อกอินสำเร็จ', className: 'bg-slate-100 text-slate-700' },
  LOGIN_FAILED: { text: 'ล็อกอินไม่สำเร็จ', className: 'bg-amber-100 text-amber-800' },
  REGISTER: { text: 'สมัครสมาชิก', className: 'bg-slate-100 text-slate-700' },
  LOGOUT: { text: 'ออกจากระบบ', className: 'bg-slate-100 text-slate-700' },
  PASSWORD_CHANGED: { text: 'เปลี่ยนรหัสผ่าน', className: 'bg-slate-100 text-slate-700' },
  PASSWORD_RESET_REQUESTED: { text: 'ขอลิงก์ลืมรหัสผ่าน', className: 'bg-slate-100 text-slate-700' },
  PASSWORD_RESET: { text: 'ตั้งรหัสใหม่จากลิงก์', className: 'bg-slate-100 text-slate-700' },
  RATE_LIMITED: { text: 'ส่งคำขอถี่เกิน', className: 'bg-amber-100 text-amber-800' },
  ACCESS_DENIED: { text: 'ไม่มีสิทธิ์เข้าถึง', className: 'bg-red-100 text-red-700' },
  SERVER_ERROR: { text: 'ระบบผิดพลาด', className: 'bg-red-100 text-red-700' },
}

// คำจากมุมทีมงาน OPEN คืองานที่ต้องทำ จึงเด่นกว่าสถานะอื่น
export const ticketStatusLabels: Record<TicketStatus, Badge> = {
  OPEN: { text: 'รอตอบ', className: 'bg-amber-100 text-amber-800' },
  ANSWERED: { text: 'ตอบแล้ว รอผู้ใช้', className: 'bg-blue-100 text-blue-700' },
  CLOSED: { text: 'ปิดแล้ว', className: 'bg-slate-100 text-slate-500' },
}

// ลำดับนี้คือลำดับปุ่มกรองในหน้าเงินวางกลาง ข้อพิพาทเป็นงานที่ต้องทำจึงขึ้นก่อน
export const escrowStatusLabels: Record<EscrowStatus, Badge> = {
  DISPUTED: { text: 'มีข้อพิพาท', className: 'bg-amber-100 text-amber-800' },
  AWAITING_PAYMENT: { text: 'รอชำระเงิน', className: 'bg-slate-100 text-slate-700' },
  HELD: { text: 'ถือเงิน รอส่งของ', className: 'bg-blue-100 text-blue-700' },
  SHIPPED: { text: 'ส่งแล้ว รอยืนยัน', className: 'bg-blue-100 text-blue-700' },
  RELEASED: { text: 'โอนให้ผู้ขายแล้ว', className: 'bg-green-100 text-green-700' },
  REFUNDED: { text: 'คืนผู้ซื้อแล้ว', className: 'bg-slate-100 text-slate-700' },
  CANCELLED: { text: 'ยกเลิก', className: 'bg-slate-100 text-slate-500' },
  EXPIRED: { text: 'เลยกำหนดชำระ', className: 'bg-slate-100 text-slate-500' },
}

export const escrowEventLabels: Record<EscrowEventType, string> = {
  CREATED: 'ตอบรับข้อเสนอ',
  PAID: 'ชำระเงิน (จำลอง)',
  SHIPPED: 'แจ้งส่งของ',
  RECEIVED: 'ยืนยันได้รับของ',
  DISPUTED: 'เปิดข้อพิพาท',
  RELEASED: 'โอนเงินให้ผู้ขาย',
  REFUNDED: 'คืนเงินให้ผู้ซื้อ',
  CANCELLED: 'ยกเลิก',
  EXPIRED: 'เลยกำหนดชำระ',
}

export const formatDateTime = (iso: string) => new Date(iso).toLocaleString('th-TH')
