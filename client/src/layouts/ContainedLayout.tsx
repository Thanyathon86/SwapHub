import { Outlet, useOutletContext } from 'react-router'

// หน้าที่มีแถบเต็มจอหรือใช้ความกว้างหน้าร้านจัดกรอบเอง หน้าอื่น (ฟอร์ม, บัญชี, support) ใช้กรอบนี้
export function ContainedLayout() {
  const context = useOutletContext()
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-12 sm:px-6 sm:pt-8 sm:pb-16">
      <Outlet context={context} />
    </div>
  )
}
