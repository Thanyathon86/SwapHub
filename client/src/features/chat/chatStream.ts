import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ChatMessage } from './chatApi'

export type ChatStreamEvent =
  | { type: 'message'; conversationId: string; message: ChatMessage }
  | { type: 'read'; conversationId: string; readerId: string; readAt: string }
  // การเชื่อมต่อกลับมาหลังหลุด อาจพลาดข้อความระหว่างนั้น ให้โหลดใหม่
  | { type: 'resync' }
  // เราเพิ่งเปิดอ่าน ตัวเลขบนเมนูต้องลดลง
  | { type: 'local-read' }

// ต่อครั้งเดียวทั้งแอป ทุกหน้าใช้ร่วมกัน ถ้าแต่ละหน้าต่อเองจะกิน connection ซึ่ง HTTP/1.1 ให้แค่ 6 เส้นต่อเว็บ
const RETRY_MS = 30_000

const listeners = new Set<(event: ChatStreamEvent) => void>()
const connectionListeners = new Set<() => void>()
let source: EventSource | null = null
let wanted = false
let connected = false
let hadConnection = false
let retryTimer: ReturnType<typeof setTimeout> | undefined

export const emitChatEvent = (event: ChatStreamEvent) => {
  for (const listener of listeners) listener(event)
}

const setConnected = (value: boolean) => {
  if (connected === value) return
  connected = value
  for (const listener of connectionListeners) listener()
}

const open = () => {
  if (source || !wanted || document.visibilityState !== 'visible') return
  const stream = new EventSource('/api/chat/events')
  source = stream
  stream.onopen = () => {
    setConnected(true)
    if (hadConnection) emitChatEvent({ type: 'resync' })
    hadConnection = true
  }
  stream.onerror = () => {
    setConnected(false)
    // CONNECTING = browser ต่อใหม่ให้เอง, CLOSED = ถูกปฏิเสธ เช่น 401 หรือ 429 ต้องลองเองแบบไม่ถี่
    if (stream.readyState === EventSource.CLOSED) {
      source = null
      retryTimer = setTimeout(open, RETRY_MS)
    }
  }
  stream.addEventListener('chat', (e) => {
    emitChatEvent(JSON.parse((e as MessageEvent<string>).data) as ChatStreamEvent)
  })
}

const close = () => {
  clearTimeout(retryTimer)
  source?.close()
  source = null
  setConnected(false)
}

// แท็บที่ซ่อนอยู่ไม่ต้องต่อ เปิดหลายแท็บจะได้ไม่กิน connection จนหน้าเว็บค้าง
const onVisibilityChange = () => {
  if (document.visibilityState === 'visible') open()
  else close()
}

// UserLayout เรียกครั้งเดียวตอนล็อกอินอยู่
export function useChatStreamConnection(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    wanted = true
    document.addEventListener('visibilitychange', onVisibilityChange)
    open()
    return () => {
      wanted = false
      hadConnection = false
      document.removeEventListener('visibilitychange', onVisibilityChange)
      close()
    }
  }, [enabled])
}

// handler เปลี่ยนได้ทุก render โดยไม่ต้องลงทะเบียนใหม่
export function useChatEvents(handler: (event: ChatStreamEvent) => void) {
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })
  useEffect(() => {
    const listener = (event: ChatStreamEvent) => latest.current(event)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
}

const subscribeConnection = (listener: () => void) => {
  connectionListeners.add(listener)
  return () => {
    connectionListeners.delete(listener)
  }
}

export const useChatConnected = () => useSyncExternalStore(subscribeConnection, () => connected)

// สำรองตอนการเชื่อมต่อหลุด ดึงเป็นรอบแทน พอต่อได้แล้วหยุดเอง
export function useFallbackPolling(reload: () => void, intervalMs: number) {
  const isConnected = useChatConnected()
  const latest = useRef(reload)
  useEffect(() => {
    latest.current = reload
  })
  useEffect(() => {
    if (isConnected) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') latest.current()
    }, intervalMs)
    return () => clearInterval(timer)
  }, [isConnected, intervalMs])
}

// เปลี่ยนค่าเมื่อควรดึงตัวเลขบนเมนูใหม่ เว้นระยะไว้เพราะคุยรัว ๆ จะยิงจนชน apiLimiter (300 ครั้ง / 15 นาที)
const COUNTS_THROTTLE_MS = 15_000

export function useCountsRefreshKey(myId: string | undefined) {
  const [key, setKey] = useState(0)
  const lastAt = useRef(0)
  const trailing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(trailing.current), [])

  useChatEvents((event) => {
    const relevant =
      event.type === 'local-read' || event.type === 'resync' || (event.type === 'message' && event.message.authorId !== myId)
    if (!relevant) return
    const wait = lastAt.current + COUNTS_THROTTLE_MS - Date.now()
    const fire = () => {
      lastAt.current = Date.now()
      setKey((k) => k + 1)
    }
    if (wait <= 0) {
      fire()
    } else if (trailing.current === undefined) {
      trailing.current = setTimeout(() => {
        trailing.current = undefined
        fire()
      }, wait)
    }
  })

  return key
}
