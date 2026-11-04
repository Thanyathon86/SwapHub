import { randomUUID } from 'node:crypto'
import type { Prisma } from '../generated/prisma/client.js'

// ผู้ให้บริการชำระเงินแบบจำลอง ไม่มีเงินจริงวิ่งผ่านระบบ คืนแค่เลขอ้างอิงให้ escrow เก็บไว้กระทบยอด
// ย้ายไป gateway จริงให้แก้ไฟล์นี้ และย้ายขั้น charge ไปรอ webhook เพราะเรียกระบบนอกค้างใน transaction ไม่ได้
type PaymentRequest = { escrowId: string; amount: Prisma.Decimal }

const reference = (kind: string) => `mock_${kind}_${randomUUID()}`

export const payments = {
  charge: async (_request: PaymentRequest) => ({ reference: reference('charge') }),
  payout: async (_request: PaymentRequest) => ({ reference: reference('payout') }),
  refund: async (_request: PaymentRequest) => ({ reference: reference('refund') }),
}
