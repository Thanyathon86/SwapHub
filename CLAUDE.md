# CLAUDE.md

คู่มือสำหรับ Claude Code ในโปรเจกต์ GE175 ตอบผู้ใช้เป็นภาษาไทย

## โปรเจกต์นี้คืออะไร

Web app ซื้อขายและแลกเปลี่ยน**การ์ดเกม** (TCG marketplace)

- รองรับหลายเกม (Pokémon, Yu-Gi-Oh!, MTG, One Piece ฯลฯ) เก็บเป็นตาราง `Game` ให้ admin เพิ่มเอง ห้าม hardcode ชื่อเกมเป็น enum
- ขายได้ 3 แบบ (`itemKind`): การ์ดใบเดี่ยว `SINGLE`, การ์ดเกรด `GRADED` (PSA/BGS/CGC ฯลฯ), สินค้าซีล `SEALED` (booster, box, deck)
- ผู้ขายกรอกข้อมูลการ์ดเอง ยังไม่มีฐานข้อมูลการ์ดกลาง (catalog)
- มีผู้ใช้ 2 บทบาท:
  - **user**: ลงประกาศขายหรือแลกของ, ส่งคำขอซื้อหรือขอแลกไปที่ประกาศของคนอื่น, ตอบรับหรือปฏิเสธคำขอที่เข้ามา
  - **admin**: ดูข้อมูลหลังบ้าน (dashboard), อนุมัติหรือปฏิเสธประกาศ, จัดการผู้ใช้, ช่วยเหลือและตอบเรื่องที่ user แจ้งมา

### ข้อมูลหลัก

| Entity | หน้าที่ |
|---|---|
| `User` | มี `role`: `USER` / `ADMIN` |
| `Game` | เกมการ์ด admin เพิ่ม/แก้ได้ |
| `GradingCompany` | บริษัทเกรด admin เพิ่มได้ |
| `Listing` | ประกาศ มี `type`: `SALE` / `TRADE` / `BOTH`, `itemKind`: `SINGLE` / `GRADED` / `SEALED` และ `status`: `PENDING_REVIEW` → `ACTIVE` / `REJECTED` → `CLOSED` |
| `Offer` | คำขอซื้อหรือขอแลกต่อประกาศ (ใส่เงินเพิ่มได้) มี `status`: `PENDING` / `ACCEPTED` / `DECLINED` / `CANCELLED` |
| `OfferItem` | ประกาศของผู้ขอที่เอามาแลกใน `Offer` |
| `SupportTicket` | เรื่องที่ user แจ้ง admin (ยังไม่ได้สร้าง) |

ฟิลด์ใน `Listing` ใช้ตาม `itemKind` (DB เป็น nullable, บังคับด้วย zod ใน service):

| ฟิลด์ | SINGLE | GRADED | SEALED |
|---|---|---|---|
| `title`, `setName`, `language` | ✓ | ✓ | ✓ |
| `cardNumber?`, `rarity?` | ✓ | ✓ | – |
| `condition` (NM/LP/MP/HP/DMG) | ✓ | – | – |
| `gradingCompanyId`, `grade`, `certNumber` | – | ✓ | – |
| `quantity` | ≥ 1 | 1 เสมอ | ≥ 1 |

กฎของ offer ที่ตรวจใน service: ของที่เอามาแลกต้องเป็นประกาศของผู้ขอเอง, `ACTIVE`, และประกาศปลายทางต้องเป็น `TRADE`/`BOTH`

ยังไม่ทำ: อัปโหลดรูป (ต้องเลือกที่เก็บไฟล์ก่อน), `SupportTicket`

## Stack

```
client/   React 19 + Vite 8 + Tailwind CSS 4 + TypeScript 6
server/   Express 5 + Prisma 7 (adapter-pg) + PostgreSQL 18 + zod 4 + TypeScript 6
```

- Node 24, Windows, ใช้ npm (มี `package-lock.json` แยกในแต่ละโฟลเดอร์)
- Database: `ge175` บน `localhost:5432` ต่อด้วย user `ge175_app` (ค่าอยู่ใน `server/.env` ห้าม commit ห้ามพิมพ์รหัสผ่านออกมาใน output)
- Vite proxy `/api` → `http://localhost:4000` ตอน dev

## คำสั่ง

| ที่ | คำสั่ง | ทำอะไร |
|---|---|---|
| `server/` | `npm run dev` | รัน API ที่ :4000 (tsx watch) |
| `server/` | `npm run typecheck` | ตรวจ type |
| `server/` | `npm run build` | compile ไป `dist/` |
| `server/` | `npm run db:migrate` | สร้าง migration และอัปเดตตารางตาม `schema.prisma` |
| `server/` | `npm run db:generate` | สร้าง Prisma Client ใหม่ (ไปที่ `src/generated/prisma`, ไม่ commit) |
| `server/` | `npm run db:studio` | เปิดดูข้อมูลใน DB |
| `server/` | `npm run db:seed` | ลงเกม/บริษัทเกรดเริ่มต้น และสร้าง admin ถ้าตั้ง `ADMIN_EMAIL`/`ADMIN_PASSWORD` ไว้ (รันซ้ำได้) |
| `client/` | `npm run dev` | รันหน้าเว็บที่ :5173 |
| `client/` | `npm run build` | `tsc -b` + `vite build` |
| `client/` | `npm run lint` | oxlint |

ยังไม่มี test framework และฝั่ง server ยังไม่มี lint ถ้าจะเพิ่มให้เสนอในแผนก่อน

## โครงสร้างไฟล์

### ปัจจุบัน

```
server/
  prisma/schema.prisma      User, Session, Game, GradingCompany, Listing, Offer, OfferItem
  prisma.config.ts          ตั้งค่า Prisma 7 (URL อ่านจาก env)
  src/index.ts              เปิด server + graceful shutdown
  src/app.ts                Express app, middleware (helmet, cors, rate limit), /api/health
  src/config/env.ts         ตรวจ env ด้วย zod ตอนเริ่ม
  src/lib/prisma.ts         PrismaClient ตัวเดียวทั้งแอป
client/
  src/main.tsx, App.tsx     หน้าเดียว ยังไม่มี routing
```

### เป้าหมาย (ค่อย ๆ ย้ายไปตามนี้เมื่อเริ่มทำแต่ละฟีเจอร์)

```
server/src/
  modules/<feature>/        auth, users, listings, offers, catalog (เกม + บริษัทเกรด), support, admin
    <feature>.routes.ts     เส้นทาง + middleware ที่ใช้
    <feature>.service.ts    logic + เรียก Prisma
    <feature>.schema.ts     zod schema ของ request
  middleware/               requireAuth, requireRole('ADMIN'), validate, errorHandler
  config/, lib/
client/src/
  pages/                    public/, user/, admin/
  layouts/                  UserLayout, AdminLayout
  features/<feature>/       component + hook ของแต่ละฟีเจอร์
  components/               UI ที่ใช้ร่วมกัน
  lib/api.ts                fetch wrapper เรียก /api
```

- route ของ admin อยู่ใต้ `/api/admin/*` และต้องผ่าน `requireRole('ADMIN')` ทุกเส้น ตรวจสิทธิ์ที่ server เสมอ การซ่อนเมนูฝั่ง client ไม่นับเป็นการป้องกัน
- ฝั่ง client ยังไม่มี router ต้องติดตั้งเพิ่ม (เสนอในแผนก่อน)

## Conventions

- ESM ทั้งสองฝั่ง ฝั่ง server import ไฟล์ภายในต้องลงท้าย `.js` (NodeNext) เช่น `'./config/env.js'`
- สไตล์โค้ด: single quote, ไม่มี semicolon, indent 2 ช่อง
- comment เขียนภาษาไทย สั้น ๆ อธิบายเหตุผล ไม่ใช่อธิบายว่าโค้ดทำอะไร
- validate ทุก input จาก request ด้วย zod, env ใหม่ต้องเพิ่มใน `config/env.ts` และ `.env.example`
- เข้าถึง DB ผ่าน `prisma` จาก `lib/prisma.ts` เท่านั้น
- server `tsconfig` เปิด `strict` + `noUncheckedIndexedAccess`

## Workflow (ทำตามลำดับนี้ทุกงานที่แก้โค้ด)

1. **อ่าน project ก่อน**: อ่านไฟล์ที่เกี่ยวข้องจริง อย่าเดาจากชื่อไฟล์หรือจาก CLAUDE.md อย่างเดียว
2. **อธิบายโครงสร้าง**: สรุปสั้น ๆ ว่าส่วนที่จะแตะอยู่ตรงไหน ทำงานอย่างไร
3. **วางแผนก่อนแก้**: บอกไฟล์ที่จะสร้าง/แก้, schema/migration ที่จะเปลี่ยน, package ที่จะติดตั้ง แล้ว**รอผู้ใช้ยืนยันก่อนลงมือ**
4. **แก้ทีละส่วน**: แบ่งงานเป็นชิ้นเล็ก ทำให้แต่ละชิ้นเสร็จและรันได้ก่อนไปชิ้นถัดไป
5. **รัน build/test/lint**: อย่างน้อย `server: npm run typecheck`, `client: npm run build` และ `npm run lint` ถ้ามี test ให้รันด้วย ถ้าแก้ schema ให้รัน `db:migrate` ถ้าไม่ผ่านให้แก้หรือรายงานผลตามจริง
6. **สรุป diff**: บอกว่าแก้ไฟล์อะไร เปลี่ยนอะไร เพราะอะไร และสิ่งที่ยังไม่ได้ทำหรือยังไม่ได้ทดสอบ
7. **ช่วย commit**: เสนอ commit message (ภาษาอังกฤษ, รูปแบบ `type: summary` เช่น `feat: add listing model`) แล้ว**ถามก่อน commit** ห้าม push ถ้าไม่ได้สั่ง เช็กว่าไม่มี `.env` หรือ `src/generated` ติดไปด้วย
