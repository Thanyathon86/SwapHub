import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage } from '@shared/lib/api'
import { chatApi, type Conversation } from '../../features/chat/chatApi'
import { ChatRoom } from '../../features/chat/ChatRoom'
import { useChatEvents, useFallbackPolling } from '../../features/chat/chatStream'
import { ConversationList } from '../../features/chat/ConversationList'

const POLL_MS = 20_000

// จอใหญ่เห็นรายการคู่กับห้อง จอเล็กเห็นทีละอย่างตาม URL ปุ่มย้อนกลับของเครื่องจึงพากลับมารายการได้เอง
export default function MessagesPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[] | null>(null)
  const [error, setError] = useState<unknown>(undefined)
  const load = useCallback(() => {
    chatApi.list().then(setConversations, (err: unknown) => setError(err))
  }, [])

  useEffect(load, [load])
  useFallbackPolling(load, POLL_MS)

  const clearUnread = useCallback((roomId: string) => {
    setConversations((rows) => rows && rows.map((c) => (c.id === roomId ? { ...c, unread: 0 } : c)))
  }, [])

  // อัปเดตรายการจาก event เลย ไม่ดึงใหม่ทุกข้อความ คุยรัว ๆ จะยิงจนชน apiLimiter (300 ครั้ง / 15 นาที)
  useChatEvents((event) => {
    if (event.type === 'resync') return load()
    if (event.type === 'read' && event.readerId === user?.id) return clearUnread(event.conversationId)
    if (event.type !== 'message') return
    const row = conversations?.find((c) => c.id === event.conversationId)
    // ห้องใหม่ที่ยังไม่อยู่ในรายการ ต้องดึงข้อมูลคู่สนทนาและการ์ดจาก server
    if (!row) return load()
    const fromOther = event.message.authorId !== user?.id
    const updated = {
      ...row,
      lastMessage: event.message,
      lastMessageAt: event.message.createdAt,
      unread: row.unread + (fromOther && row.id !== id ? 1 : 0),
    }
    setConversations((rows) => rows && [updated, ...rows.filter((c) => c.id !== row.id)])
  })

  if (!user) return null

  return (
    <div className="page-container flex h-full min-h-0 !px-0 lg:!px-8 lg:py-4">
      <div className="flex min-h-0 w-full overflow-hidden bg-white lg:rounded-2xl lg:ring-1 lg:ring-zinc-200">
        <aside className={`${id ? 'hidden lg:flex' : 'flex'} min-h-0 w-full flex-col lg:w-80 lg:shrink-0 lg:border-r lg:border-zinc-200`}>
          <h1 className="border-b border-zinc-100 px-4 py-3 text-lg font-semibold">แชท</h1>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!conversations ? (
              error !== undefined ? (
                <p className="p-4 text-sm text-red-600">{errorMessage(error)}</p>
              ) : (
                <Spinner />
              )
            ) : conversations.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-zinc-500">
                <p className="font-medium text-zinc-700">ยังไม่มีแชท</p>
                <p className="mt-1">กด "แชทกับผู้ขาย" ในหน้าประกาศเพื่อเริ่มคุย</p>
                <Link to="/browse" className="btn btn-secondary mt-4">
                  ดูการ์ดทั้งหมด
                </Link>
              </div>
            ) : (
              <ConversationList conversations={conversations} activeId={id} me={user.id} />
            )}
          </div>
        </aside>

        <section aria-label="บทสนทนา" className={`${id ? 'flex' : 'hidden lg:flex'} min-h-0 min-w-0 flex-1`}>
          {id ? (
            // key: เปลี่ยนห้องแล้วเริ่มใหม่ทั้งหมด ข้อความและคำที่พิมพ์ค้างจะไม่ปนกันระหว่างห้อง
            <ChatRoom key={id} id={id} me={user.id} onRead={clearUnread} />
          ) : (
            <p className="m-auto p-6 text-sm text-zinc-500">เลือกแชทจากรายการด้านซ้าย</p>
          )}
        </section>
      </div>
    </div>
  )
}
