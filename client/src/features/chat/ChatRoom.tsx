import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { Avatar } from '@shared/components/Avatar'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage } from '@shared/lib/api'
import { formatPrice } from '@shared/listings/labels'
import { ListingCover } from '@shared/listings/ListingCover'
import { ChevronIcon, ImageIcon } from '../../components/icons'
import { chatApi, chatImageUrl, type ChatMessage, type ConversationDetail } from './chatApi'
import { emitChatEvent, useChatEvents, useFallbackPolling } from './chatStream'

const POLL_MS = 15_000
const READ_DEBOUNCE_MS = 1500
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
// อยู่ห่างจากท้ายไม่เกินนี้ถือว่ากำลังอ่านล่าสุด ข้อความใหม่จะเลื่อนลงให้ ถ้าเลื่อนขึ้นไปอ่านของเก่าจะไม่กระชากลงมา
const STICK_PX = 120

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
const formatDay = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

// รวมข้อความจากหลายทาง (โหลดหน้า, response ตอนส่ง, event) ข้อความเดียวกันมาได้มากกว่าหนึ่งทาง
const merge = (current: ChatMessage[], incoming: ChatMessage[]) => {
  const byId = new Map(current.map((m) => [m.id, m]))
  for (const m of incoming) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

export function ChatRoom({ id, me, onRead }: { id: string; me: string; onRead: (id: string) => void }) {
  const [room, setRoom] = useState<ConversationDetail | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  // จำตำแหน่งก่อนอัปเดตรายการ useLayoutEffect ด้านล่างใช้ตัดสินว่าจะเลื่อนอย่างไร
  const scrollPlan = useRef<{ kind: 'bottom' } | { kind: 'keep'; height: number; top: number } | null>({ kind: 'bottom' })

  const planFollow = () => {
    const el = scroller.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX) scrollPlan.current = { kind: 'bottom' }
  }

  useLayoutEffect(() => {
    const el = scroller.current
    const plan = scrollPlan.current
    if (!el || !plan || messages.length === 0) return
    el.scrollTop = plan.kind === 'bottom' ? el.scrollHeight : el.scrollHeight - plan.height + plan.top
    scrollPlan.current = null
  }, [messages])

  const markRead = useCallback(() => {
    // ส่งข้อความเข้ามาแต่แท็บถูกซ่อนอยู่ ยังไม่นับว่าอ่าน
    if (document.visibilityState !== 'visible') return
    chatApi.read(id).then(() => {
      emitChatEvent({ type: 'local-read' })
      onRead(id)
    }, () => undefined)
  }, [id, onRead])

  // ข้อความมารัว ๆ รวมเป็นการอ่านครั้งเดียว ไม่ยิงทุกข้อความ
  const readTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(readTimer.current), [])
  const markReadSoon = () => {
    clearTimeout(readTimer.current)
    readTimer.current = setTimeout(markRead, READ_DEBOUNCE_MS)
  }

  const load = useCallback(() => {
    Promise.all([chatApi.get(id), chatApi.messages(id)]).then(
      ([conversation, page]) => {
        setRoom(conversation)
        planFollow()
        setMessages((current) => merge(current, page.messages))
        // โหลดซ้ำตอนต่อกลับต้องไม่ลบปุ่มโหลดของเก่าที่โหลดไปแล้วบางส่วน
        setHasMore((current) => current || page.hasMore)
        if (conversation.unread > 0) markRead()
      },
      (err: unknown) => setLoadError(err),
    )
  }, [id, markRead])

  useEffect(load, [load])
  useFallbackPolling(load, POLL_MS)

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') markRead()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [markRead])

  useChatEvents((event) => {
    if (event.type === 'resync') return load()
    if (event.type === 'local-read' || event.conversationId !== id) return
    if (event.type === 'message') {
      planFollow()
      setMessages((current) => merge(current, [event.message]))
      if (event.message.authorId !== me) markReadSoon()
    } else if (event.readerId !== me) {
      setRoom((current) => current && { ...current, otherLastReadAt: event.readAt })
    }
  })

  const appendMine = (message: ChatMessage) => {
    scrollPlan.current = { kind: 'bottom' }
    setMessages((current) => merge(current, [message]))
  }

  const submit = async () => {
    const body = draft.trim()
    if (!body || busy) return
    setBusy(true)
    setError(null)
    try {
      appendMine(await chatApi.send(id, body))
      setDraft('')
    } catch (err) {
      // เก็บข้อความที่พิมพ์ไว้ ให้กดส่งซ้ำได้
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void submit()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // isComposing: กำลังเลือกคำจาก IME Enter ยังไม่ใช่การส่ง จอสัมผัสใช้ปุ่มส่ง Enter เป็นการขึ้นบรรทัดใหม่
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) {
      e.preventDefault()
      void submit()
    }
  }

  const onPickImage = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = ''
    if (!file) return
    if (file.size > MAX_IMAGE_BYTES) {
      setError(new Error('too large'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      appendMine(await chatApi.sendImage(id, file))
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const loadOlder = async () => {
    const first = messages[0]
    const el = scroller.current
    if (!first || !el || loadingOlder) return
    setLoadingOlder(true)
    try {
      const page = await chatApi.messages(id, first.id)
      scrollPlan.current = { kind: 'keep', height: el.scrollHeight, top: el.scrollTop }
      setMessages((current) => merge(current, page.messages))
      setHasMore(page.hasMore)
    } catch (err) {
      setError(err)
    } finally {
      setLoadingOlder(false)
    }
  }

  const toggleBlock = async () => {
    if (!room) return
    const blocking = !room.blockedByMe
    if (blocking && !window.confirm(`บล็อก ${room.other.displayName}? จะส่งข้อความหากันไม่ได้ทุกห้อง แต่ดีลที่ค้างอยู่ยังดำเนินต่อได้`)) return
    setError(null)
    try {
      setRoom(await (blocking ? chatApi.block(id) : chatApi.unblock(id)))
    } catch (err) {
      setError(err)
    }
  }

  if (!room) {
    return loadError !== null ? (
      <div className="m-auto p-6 text-center text-sm">
        <p className="text-red-600">{errorMessage(loadError)}</p>
        <Link to="/messages" className="btn btn-secondary mt-4">
          กลับไปกล่องข้อความ
        </Link>
      </div>
    ) : (
      <div className="m-auto">
        <Spinner />
      </div>
    )
  }

  const price = formatPrice(room.listing.price)
  const myLast = [...messages].reverse().find((m) => m.authorId === me)
  const seen = myLast && room.otherLastReadAt !== null && myLast.createdAt <= room.otherLastReadAt
  const isTooLarge = error instanceof Error && error.message === 'too large'

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
          <Link to="/messages" aria-label="กลับไปกล่องข้อความ" className="-ml-1 p-1 text-zinc-500 lg:hidden">
            <ChevronIcon direction="left" className="size-6" />
          </Link>
          <Link to={`/u/${room.other.username}`} className="flex min-w-0 flex-1 items-center gap-2 hover:opacity-80">
            <Avatar user={room.other} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{room.other.displayName}</span>
              <span className="block truncate text-xs text-zinc-500">@{room.other.username}</span>
            </span>
          </Link>
          <Link to="/support/new" className="shrink-0 text-xs text-zinc-500 hover:underline">
            แจ้งปัญหา
          </Link>
          <button type="button" onClick={toggleBlock} className="shrink-0 text-xs text-zinc-500 hover:underline">
            {room.blockedByMe ? 'เลิกบล็อก' : 'บล็อก'}
          </button>
        </div>
        <div className="flex items-center gap-3 border-t border-zinc-100 bg-zinc-50 px-3 py-2 sm:px-4">
          <Link to={`/listings/${room.listing.id}`} className="w-8 shrink-0">
            <ListingCover listing={room.listing} />
          </Link>
          <div className="min-w-0 flex-1 text-sm">
            <Link to={`/listings/${room.listing.id}`} className="block truncate font-medium hover:underline">
              {room.listing.title}
            </Link>
            <span className="text-xs text-zinc-500">{price ?? 'รับแลกเท่านั้น'}</span>
          </div>
          {room.latestOffer && (
            <Link to={`/offers?tab=${room.role === 'BUYER' ? 'outgoing' : 'incoming'}`} className="btn btn-secondary shrink-0 text-xs">
              ดูข้อเสนอ
            </Link>
          )}
        </div>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto bg-white px-3 py-4 sm:px-4">
        <p className="mx-auto mb-4 max-w-md rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
          เพื่อความปลอดภัย ชำระเงินผ่านระบบเงินวางกลางเท่านั้น อย่าโอนเงินนอกระบบ
        </p>
        {hasMore && (
          <div className="mb-4 text-center">
            <button type="button" disabled={loadingOlder} onClick={loadOlder} className="btn btn-secondary text-xs">
              โหลดข้อความเก่า
            </button>
          </div>
        )}
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">ยังไม่มีข้อความ ถามรายละเอียดหรือขอดูรูปเพิ่มจาก {room.other.displayName} ได้เลย</p>
        ) : (
          <ol className="space-y-2">
            {messages.map((m, i) => {
              const mine = m.authorId === me
              const previous = messages[i - 1]
              const newDay = !previous || formatDay(previous.createdAt) !== formatDay(m.createdAt)
              return (
                <li key={m.id}>
                  {newDay && <div className="my-4 text-center text-xs text-zinc-500">{formatDay(m.createdAt)}</div>}
                  <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    {m.image ? (
                      // กรอบต้องกว้างตายตัว รูปจึงจองความสูงได้ก่อนโหลดเสร็จ ไม่งั้นการเลื่อนลงข้อความล่าสุดจะคำนวณผิด
                      <a href={chatImageUrl(m.id)} target="_blank" rel="noreferrer" className="block w-[min(75%,18rem)] overflow-hidden rounded-2xl bg-zinc-100">
                        <img src={chatImageUrl(m.id)} alt="รูปที่ส่งในแชท" width={m.image.width} height={m.image.height} loading="lazy" className="h-auto w-full" />
                      </a>
                    ) : (
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-line sm:max-w-[70%] ${
                          mine ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-800'
                        }`}
                      >
                        {m.body}
                      </div>
                    )}
                    <div className="mt-0.5 px-1 text-[11px] text-zinc-500">
                      {formatTime(m.createdAt)}
                      {m.id === myLast?.id && seen && ' · อ่านแล้ว'}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <div className="border-t border-zinc-200 bg-white px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:px-4 lg:pb-2">
        {error !== null && (
          <p className="mb-2 text-sm text-red-600">{isTooLarge ? 'รูปต้องมีขนาดไม่เกิน 5MB' : errorMessage(error)}</p>
        )}
        {room.canSend ? (
          <form onSubmit={onSubmit} className="flex items-end gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="เลือกรูป"
              className="hidden"
              onChange={(e) => void onPickImage(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
              aria-label="ส่งรูป"
              className="btn btn-secondary shrink-0 px-3"
            >
              <ImageIcon className="size-5" />
            </button>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={2000}
              placeholder="พิมพ์ข้อความ"
              aria-label="ข้อความ"
              className="input min-w-0 flex-1 resize-none"
            />
            <button type="submit" disabled={busy || draft.trim() === ''} className="btn btn-primary shrink-0">
              ส่ง
            </button>
          </form>
        ) : (
          <p className="py-2 text-center text-sm text-zinc-500">
            {room.blockedByMe ? 'คุณบล็อกผู้ใช้นี้อยู่ เลิกบล็อกเพื่อคุยต่อ' : 'ส่งข้อความในห้องนี้ไม่ได้ อ่านข้อความเดิมได้อย่างเดียว'}
          </p>
        )}
      </div>
    </div>
  )
}
