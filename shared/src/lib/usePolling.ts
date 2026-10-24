import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { useResource } from './useResource'

// ดึงข้อมูลใหม่ทุก intervalMs และทุกครั้งที่เปลี่ยนหน้า (หลังกดตอบรับหรือตอบเรื่องแล้วกลับมา ตัวเลขจะตรงทันที)
// enabled = false จะไม่ยิง request เลย เช่น ตอนยังไม่ได้ล็อกอิน
export function usePolling<T>(load: () => Promise<T>, intervalMs: number, enabled: boolean) {
  const { pathname } = useLocation()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => {
      // แท็บที่ซ่อนอยู่ไม่ต้องดึง ประหยัด request ตอนเปิดทิ้งไว้
      if (document.visibilityState === 'visible') setTick((n) => n + 1)
    }, intervalMs)
    return () => clearInterval(timer)
  }, [enabled, intervalMs])

  const { data } = useResource(async () => (enabled ? load() : null), `${enabled}:${pathname}:${tick}`)
  return data ?? null
}
