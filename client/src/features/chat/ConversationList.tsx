import { Link } from 'react-router'
import { Avatar } from '@shared/components/Avatar'
import { CountBadge } from '@shared/components/CountBadge'
import { ListingCover } from '@shared/listings/ListingCover'
import type { Conversation } from './chatApi'

const formatWhen = (iso: string) => {
  const date = new Date(iso)
  const today = new Date().toDateString() === date.toDateString()
  return today
    ? date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

const preview = (c: Conversation, me: string) => {
  const last = c.lastMessage
  if (!last) return ''
  const text = last.body ?? 'ส่งรูปภาพ'
  return last.authorId === me ? `คุณ: ${text}` : text
}

export function ConversationList({ conversations, activeId, me }: { conversations: Conversation[]; activeId?: string | undefined; me: string }) {
  return (
    <ul className="divide-y divide-zinc-100">
      {conversations.map((c) => (
        <li key={c.id}>
          <Link
            to={`/messages/${c.id}`}
            aria-current={c.id === activeId ? 'page' : undefined}
            className={`flex items-center gap-3 px-4 py-3 transition hover:bg-zinc-50 ${c.id === activeId ? 'bg-brand-50' : ''}`}
          >
            <div className="relative shrink-0">
              <Avatar user={c.other} />
              {/* รูปการ์ดเล็กมุมรูปคน บอกว่าห้องนี้คุยเรื่องการ์ดใบไหน */}
              <div className="absolute -right-1.5 -bottom-1.5 w-5 overflow-hidden rounded ring-2 ring-white [&_*]:!rounded-none">
                <ListingCover listing={c.listing} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className={`truncate text-sm ${c.unread > 0 ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-800'}`}>
                  {c.other.displayName}
                </span>
                {c.lastMessageAt && <span className="shrink-0 text-xs text-zinc-500">{formatWhen(c.lastMessageAt)}</span>}
              </div>
              <div className="truncate text-xs text-zinc-500">{c.listing.title}</div>
              <div className="flex items-center justify-between gap-2">
                <span className={`truncate text-sm ${c.unread > 0 ? 'font-medium text-zinc-900' : 'text-zinc-500'}`}>{preview(c, me)}</span>
                <CountBadge count={c.unread} label="ข้อความใหม่" />
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
