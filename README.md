# GE175

```
client/   React 19 + Vite + Tailwind CSS 4 (TypeScript)
server/   Express 5 + Prisma 7 + PostgreSQL (TypeScript)
```

ต้องมี **Node.js 22+** และ **PostgreSQL 16+**

## 1. สร้าง database (ทำครั้งเดียว)

เปิด **SQL Shell (psql)** หรือ pgAdmin ล็อกอินด้วย user `postgres` แล้วรัน:

```sql
CREATE ROLE ge175_app WITH LOGIN PASSWORD 'ตั้งรหัสเอง' CREATEDB;
CREATE DATABASE ge175 OWNER ge175_app;
```

> ใช้ user แยกของแอป ไม่ใช้ `postgres` (least privilege)
> `CREATEDB` จำเป็นเพราะ `prisma migrate dev` ต้องสร้าง shadow database ชั่วคราว

## 2. Backend

```powershell
cd server
copy .env.example .env     # แก้ CHANGE_ME ใน DATABASE_URL เป็นรหัสที่ตั้งไว้
npm install
npm run db:generate
npm run dev                # http://localhost:4000/api/health
```

## 3. Frontend (เปิดอีก terminal)

```powershell
cd client
npm install
npm run dev                # http://localhost:5173
```

Vite จะส่งต่อ request ที่ขึ้นต้นด้วย `/api` ไปที่ backend ให้เอง

## คำสั่งที่ใช้บ่อย (ใน `server/`)

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run db:migrate` | สร้าง/อัปเดตตารางตาม `schema.prisma` |
| `npm run db:generate` | สร้าง Prisma Client ใหม่หลังแก้ schema |
| `npm run db:studio` | เปิดหน้าเว็บดูข้อมูลใน DB |
| `npm run typecheck` | ตรวจ type |
