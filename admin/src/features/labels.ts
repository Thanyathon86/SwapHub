import type { AuditAction, EventType } from './adminApi'

type Badge = { text: string; className: string }

export const auditActionLabels: Record<AuditAction, Badge> = {
  USER_PROMOTED: { text: 'ตั้งเป็น admin', className: 'bg-indigo-100 text-indigo-700' },
  USER_DEMOTED: { text: 'ถอดสิทธิ์ admin', className: 'bg-amber-100 text-amber-700' },
  USER_SUSPENDED: { text: 'ระงับบัญชี', className: 'bg-red-100 text-red-700' },
  USER_REACTIVATED: { text: 'ปลดระงับ', className: 'bg-green-100 text-green-700' },
}

// สีแดง/เหลืองสงวนไว้ให้เหตุการณ์ที่อาจเป็นปัญหา เหตุการณ์ปกติใช้สีเทา
export const eventTypeLabels: Record<EventType, Badge> = {
  LOGIN_SUCCESS: { text: 'ล็อกอินสำเร็จ', className: 'bg-slate-100 text-slate-700' },
  LOGIN_FAILED: { text: 'ล็อกอินไม่สำเร็จ', className: 'bg-amber-100 text-amber-800' },
  REGISTER: { text: 'สมัครสมาชิก', className: 'bg-slate-100 text-slate-700' },
  LOGOUT: { text: 'ออกจากระบบ', className: 'bg-slate-100 text-slate-700' },
  RATE_LIMITED: { text: 'ส่งคำขอถี่เกิน', className: 'bg-amber-100 text-amber-800' },
  ACCESS_DENIED: { text: 'ไม่มีสิทธิ์เข้าถึง', className: 'bg-red-100 text-red-700' },
  SERVER_ERROR: { text: 'ระบบผิดพลาด', className: 'bg-red-100 text-red-700' },
}

export const formatDateTime = (iso: string) => new Date(iso).toLocaleString('th-TH')
