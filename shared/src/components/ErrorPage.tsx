import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import NotFoundPage from './NotFoundPage'

// แสดงข้อความกลาง ๆ ไม่โชว์ stack ให้ผู้ใช้เห็น รายละเอียดดูได้จาก console ตอน dev
export default function ErrorPage() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />
  if (import.meta.env.DEV) console.error(error)

  return (
    <section className="py-16 text-center">
      <h1 className="text-2xl font-bold text-slate-800">เกิดข้อผิดพลาด</h1>
      <p className="mt-2 text-slate-600">ลองรีเฟรชหน้านี้อีกครั้ง</p>
      <Link to="/" className="btn btn-primary mt-6">
        กลับหน้าแรก
      </Link>
    </section>
  )
}
