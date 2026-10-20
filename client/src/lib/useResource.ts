import { useCallback, useEffect, useState } from 'react'

type State<T> = { data?: T; error?: unknown; settledFor?: string }

// โหลดข้อมูลใหม่เมื่อ key เปลี่ยน (เช่น query ของหน้า) หรือเรียก reload หลังแก้ข้อมูล
export function useResource<T>(load: () => Promise<T>, key = '') {
  const [state, setState] = useState<State<T>>({})
  const [version, setVersion] = useState(0)
  const request = `${version}:${key}`

  useEffect(() => {
    // response ที่มาช้าของ key เก่าต้องไม่ทับข้อมูลของ key ใหม่
    let stale = false
    load().then(
      (data) => !stale && setState({ data, settledFor: request }),
      (error: unknown) => !stale && setState((s) => ({ ...s, error, settledFor: request })),
    )
    return () => {
      stale = true
    }
    // ไม่ใส่ load เพราะมักเป็น arrow function ใหม่ทุก render จะโหลดวนไม่จบ ใช้ key บอกว่าเมื่อไรต้องโหลดใหม่แทน
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [request])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  // คำนวณจาก state แทนการ setState ใน effect ข้อมูลเก่ายังแสดงอยู่ระหว่างโหลดหน้าใหม่
  return { data: state.data, error: state.error, loading: state.settledFor !== request, reload }
}
