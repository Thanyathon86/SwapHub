import { adminApi } from '../features/adminApi'
import { CatalogSection } from '../features/CatalogSection'

export default function CatalogPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">เกมและบริษัทเกรด</h1>
        <p className="mt-1 text-sm text-slate-500">
          ลบไม่ได้เพราะประกาศเก่ายังอ้างถึงอยู่ ให้ปิดใช้งานแทน ผู้ใช้จะเลือกรายการที่ปิดอยู่ตอนลงประกาศใหม่ไม่ได้
        </p>
      </div>
      <CatalogSection
        title="เกม"
        withSlug
        load={adminApi.listGames}
        create={adminApi.createGame}
        update={adminApi.updateGame}
      />
      <CatalogSection
        title="บริษัทเกรด"
        withSlug={false}
        load={adminApi.listGradingCompanies}
        create={({ name }) => adminApi.createGradingCompany({ name })}
        update={(id, { name, isActive }) => adminApi.updateGradingCompany(id, { name, isActive })}
      />
    </section>
  )
}
