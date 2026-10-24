import type { TicketMessage } from './types'

// generic เพื่อให้ฝั่ง admin ที่ทุกข้อความมี author ได้ type นั้นกลับมาใน callback
type Props<M extends TicketMessage> = {
  messages: M[]
  // แต่ละแอปตั้งชื่อผู้เขียนเอง: ฝั่งผู้ใช้เห็นทีมงานเป็นชื่อกลาง ฝั่ง admin เห็นชื่อจริง
  nameOf: (message: M) => string
  // ข้อความฝั่งไหนชิดขวา (ฝั่งของคนที่กำลังดู)
  mine: (message: M) => boolean
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function MessageThread<M extends TicketMessage>({ messages, nameOf, mine }: Props<M>) {
  return (
    <ol className="space-y-4">
      {messages.map((m) => {
        const right = mine(m)
        return (
          <li key={m.id} className={`flex flex-col ${right ? 'items-end' : 'items-start'}`}>
            <div className="mb-1 text-xs text-zinc-500">
              <span className="font-medium text-zinc-700">{nameOf(m)}</span> · {formatTime(m.createdAt)}
            </div>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                right ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-800'
              }`}
            >
              {m.body}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
