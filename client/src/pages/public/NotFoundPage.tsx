import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <section className="py-16 text-center">
      <h1 className="text-4xl font-bold text-slate-800">404</h1>
      <p className="mt-2 text-slate-600">ไม่พบหน้าที่คุณต้องการ</p>
      <Link to="/" className="mt-6 inline-block text-indigo-600 hover:underline">
        กลับหน้าแรก
      </Link>
    </section>
  )
}
