import { useEffect, useState } from 'react'
import { api, errorMessage } from '../../lib/api'

export default function DashboardPage() {
  const [check, setCheck] = useState<'loading' | 'ok' | string>('loading')

  // เรียก route admin จริงเพื่อยืนยันว่า server ตรวจสิทธิ์ผ่าน ไม่ใช่แค่ client เชื่อ role ใน state
  useEffect(() => {
    api<{ ok: boolean }>('/admin/ping')
      .then(() => setCheck('ok'))
      .catch((err: unknown) => setCheck(errorMessage(err)))
  }, [])

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
      <div className="rounded-xl bg-white p-6 text-sm shadow-sm ring-1 ring-slate-200">
        <p className="text-slate-600">
          สถานะสิทธิ์ admin จาก server:{' '}
          {check === 'loading' ? (
            'กำลังตรวจสอบ...'
          ) : check === 'ok' ? (
            <span className="font-medium text-green-700">ผ่าน</span>
          ) : (
            <span className="font-medium text-red-600">{check}</span>
          )}
        </p>
        <p className="mt-2 text-slate-500">สถิติและรายการรออนุมัติจะแสดงที่นี่เมื่อมีระบบประกาศ</p>
      </div>
    </section>
  )
}
