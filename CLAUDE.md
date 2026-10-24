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
| `AuditLog` | บันทึกว่า admin คนไหนเปลี่ยนบทบาท/สถานะของใคร (`AuditAction`) มีแค่ API อ่าน ห้ามเพิ่ม API แก้หรือลบ |
| `EventLog` | log เหตุการณ์ (`EventType`: ล็อกอิน, rate limit, access denied, server error) ลบอัตโนมัติเมื่อเกิน `LOG_RETENTION_DAYS` (default 60) |
| `SupportTicket` | เรื่องที่ user แจ้ง admin มี `status`: `OPEN` (รอทีมงาน) ⇄ `ANSWERED` (รอผู้ใช้) → `CLOSED` และ `assigneeId` (admin ที่รับเรื่อง) |
| `SupportMessage` | ข้อความในเรื่อง `fromStaff` บันทึกตอนเขียน แก้/ลบไม่ได้ |

ฟิลด์ใน `Listing` ใช้ตาม `itemKind` (DB เป็น nullable, บังคับด้วย zod ใน service):

| ฟิลด์ | SINGLE | GRADED | SEALED |
|---|---|---|---|
| `title`, `setName`, `language` | ✓ | ✓ | ✓ |
| `cardNumber?`, `rarity?` | ✓ | ✓ | – |
| `condition` (NM/LP/MP/HP/DMG) | ✓ | – | – |
| `gradingCompanyId`, `grade`, `certNumber` | – | ✓ | – |
| `quantity` | ≥ 1 | 1 เสมอ | ≥ 1 |

กฎของ offer ที่ตรวจใน service: ของที่เอามาแลกต้องเป็นประกาศของผู้ขอเอง, `ACTIVE`, และประกาศปลายทางต้องเป็น `TRADE`/`BOTH`

กฎของ support ที่ตรวจใน service: ผู้ใช้เห็นเฉพาะเรื่องของตัวเอง (ของคนอื่นตอบ 404), เปิดค้างได้ไม่เกิน 5 เรื่อง, เรื่องที่ปิดแล้วตอบต่อไม่ได้, API ฝั่งผู้ใช้ห้ามส่งชื่อหรือ id ของ admin ที่ตอบ (หน้าเว็บแสดงเป็น "ทีมงาน SwapHub")

ยังไม่ทำ: ลืมรหัสผ่าน (ต้องมีระบบส่งอีเมลก่อน), อัปโหลดรูป (ต้องเลือกที่เก็บไฟล์ก่อน), แจ้งเตือน (อีเมล/ตัวเลขบนเมนู), แชทระหว่างผู้ซื้อกับผู้ขาย

## Stack

```
client/   เว็บ user   React 19 + Vite 8 + Tailwind CSS 4 + TypeScript 6
admin/    เว็บหลังบ้าน stack เดียวกับ client
shared/   โค้ด frontend ที่ client กับ admin ใช้ร่วมกัน (ไม่มี build ของตัวเอง)
server/   Express 5 + Prisma 7 (adapter-pg) + PostgreSQL 18 + zod 4 + TypeScript 6
```

- Node 24, Windows, ใช้ npm
- `client`, `admin`, `shared` เป็น npm workspaces มี `package-lock.json` และ `node_modules` อันเดียวที่ root (ติดตั้งด้วย `npm install` ที่ root เท่านั้น ห้ามรันใน `client/` หรือ `admin/` จะได้ React สองชุด) ส่วน `server/` ไม่อยู่ใน workspace มี lockfile ของตัวเอง
- Database: `ge175` บน `localhost:5432` ต่อด้วย user `ge175_app` (ค่าอยู่ใน `server/.env` ห้าม commit ห้ามพิมพ์รหัสผ่านออกมาใน output)
- Vite ของทั้ง client (:5173) และ admin (:5174) proxy `/api` → `http://localhost:4000` ใช้ API server ตัวเดียวกัน server รับทั้งสอง origin (`CLIENT_ORIGIN`, `ADMIN_ORIGIN`)
- บน localhost browser แชร์ cookie ข้าม port ถ้าจะ login user กับ admin พร้อมกันให้ใช้ incognito แยก

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
| `admin/` | `npm run dev` | รันหลังบ้านที่ :5174 |
| `admin/` | `npm run build`, `npm run lint` | เหมือน client |
| root | `npm install` | ติดตั้ง dependency ของ client, admin, shared |
| root | `npm run build`, `npm run lint` | build/lint ทุก workspace |

ยังไม่มี test framework และฝั่ง server ยังไม่มี lint ถ้าจะเพิ่มให้เสนอในแผนก่อน

## โครงสร้างไฟล์

```
server/
  prisma/schema.prisma      User, Session, Game, GradingCompany, Listing, Offer, OfferItem, AuditLog, EventLog, SupportTicket, SupportMessage
  prisma.config.ts          ตั้งค่า Prisma 7 (URL อ่านจาก env)
  src/
    index.ts, app.ts        เปิด server + graceful shutdown, Express app + middleware
    routes.ts               รวม router ทุก module ใต้ /api
    config/env.ts           ตรวจ env ด้วย zod ตอนเริ่ม
    lib/                    prisma, session, password, errors (AppError), events (logEvent)
    middleware/             requireAuth, requireRole, checkOrigin (กัน CSRF), validate, rateLimit, errorHandler
    scripts/seed.ts         เกม/บริษัทเกรดเริ่มต้น + admin
    modules/<feature>/      auth, users, listings, offers, catalog (เกม + บริษัทเกรด), support, audit, events, admin (dashboard)
      <feature>.routes.ts   เส้นทาง + middleware ที่ใช้
      <feature>.service.ts  logic + เรียก Prisma
      <feature>.schema.ts   zod schema ของ request
client/src/                 เว็บ user
  router.tsx                react-router
  pages/                    public/, user/
  layouts/UserLayout.tsx
  features/<feature>/       auth (RegisterForm), listings (ListingCard), offers, support
admin/src/                  เว็บหลังบ้าน route ไม่มี /admin นำหน้า เช่น /login, /users
  router.tsx, layouts/AdminLayout.tsx, components/RequireAdmin.tsx
  pages/                    Login, Dashboard, ListingReview, Users, Catalog, Support, TicketDetail, AuditLog, Events, Account
  features/                 adminApi, labels, CatalogSection, dashboard/ (ColumnChart, BarList วาดเองไม่ใช้ library)
  lib/env.ts                VITE_CLIENT_URL (ลิงก์ไปเว็บ user)
shared/src/                 import ด้วย '@shared/...' (alias ใน vite.config.ts + paths ใน tsconfig.app.json ของแต่ละแอป)
  lib/                      api.ts (fetch wrapper + แปล error code เป็นข้อความไทย), useResource
  auth/                     authApi, AuthProvider, useAuth, LoginForm, ChangePasswordForm
  components/               Spinner, Pagination, FormField, RequireAuth, ErrorPage, NotFoundPage
  listings/                 listingsApi (types), labels, ListingArt
  support/                  types + label หมวด, MessageThread
  styles.css                theme + .btn/.input ฯลฯ ทั้งสองแอป import หลัง tailwindcss
```

- route ของ admin อยู่ใต้ `/api/admin/*` และต้องผ่าน `requireRole('ADMIN')` ทุกเส้น ตรวจสิทธิ์ที่ server เสมอ การซ่อนเมนูฝั่ง client ไม่นับเป็นการป้องกัน
- รหัสผ่าน: user อย่างน้อย 8 ตัว, admin อย่างน้อย 12 ตัว เปลี่ยนรหัสผ่านแล้วลบ session อื่นทั้งหมดยกเว้นเครื่องที่กำลังใช้ error ที่ไม่ได้แปลว่า session หลุดห้ามใช้ 401 เพราะ client จะเด้งออกจากระบบ
- `authLimiter` นับเฉพาะ request ที่ล้มเหลว (10 ครั้ง / 15 นาที / IP) ตอนเทสถ้าโดนบล็อก restart server เพื่อล้างตัวนับได้
- หน้า login แยกกัน: เว็บ user ใช้ `POST /api/auth/login`, เว็บ admin ใช้ `POST /api/auth/admin/login` แต่ละเส้นรับเฉพาะ role ของตัวเอง
- `shared/` ห้าม import จาก `client/` หรือ `admin/` ใส่เฉพาะของที่ทั้งสองแอปใช้จริง เพราะแก้ shared พังจะพังทั้งคู่ ของที่ใช้แอปเดียวให้อยู่ในแอปนั้น
- แก้ `shared/` แล้วต้อง build ทั้ง client และ admin
- admin ตั้ง/ถอดสิทธิ์ admin คนอื่นได้ (`PATCH /api/admin/users/:id/role`) แต่แก้บัญชีตัวเองไม่ได้ ทำให้เหลือ admin อย่างน้อย 1 คนเสมอ ระงับ admin ตรง ๆ ไม่ได้ต้องถอดสิทธิ์ก่อน เปลี่ยน role แล้วลบ session ทั้งหมดของคนนั้น
- การกระทำของ admin ที่กระทบผู้ใช้ ให้บันทึกด้วย `recordAudit(tx, ...)` ใน transaction เดียวกับการเปลี่ยนแปลง
- เหตุการณ์ด้านความปลอดภัยให้บันทึกด้วย `logEvent(req, ...)` จาก `lib/events.ts` (ไม่ await, พลาดแล้ว request ไม่ล้ม) ห้ามใส่รหัสผ่าน, token, body หรือ error message เต็มลง log เหตุการณ์ที่อาจถูกยิงรัว ๆ ใช้ `logEventThrottled`
- งานกวาดข้อมูลเก่า (session หมดอายุ, EventLog เกินกำหนด) อยู่ใน `index.ts` รันทุกชั่วโมง
- อีเมลของผู้ใช้ไม่ส่งให้คนอื่นเห็น ยกเว้น admin และคู่ offer ที่ `ACCEPTED` แล้ว (ไว้ติดต่อกันเพราะยังไม่มีแชท)
- ตอบรับ offer จะตัด `quantity` ทั้งประกาศปลายทางและของที่แลก ประกาศที่เหลือ 0 จะกลายเป็น `CLOSED` และ offer ที่ค้างกับประกาศที่ปิดจะถูก `CANCELLED`

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
5. **รัน build/test/lint**: อย่างน้อย `server: npm run typecheck`, และที่ root `npm run build` กับ `npm run lint` (ครอบ client, admin, shared) ถ้ามี test ให้รันด้วย ถ้าแก้ schema ให้รัน `db:migrate` ถ้าไม่ผ่านให้แก้หรือรายงานผลตามจริง
6. **สรุป diff**: บอกว่าแก้ไฟล์อะไร เปลี่ยนอะไร เพราะอะไร และสิ่งที่ยังไม่ได้ทำหรือยังไม่ได้ทดสอบ
7. **ช่วย commit**: เสนอ commit message (ภาษาอังกฤษ, รูปแบบ `type: summary` เช่น `feat: add listing model`) แล้ว**ถามก่อน commit** ห้าม push ถ้าไม่ได้สั่ง เช็กว่าไม่มี `.env` หรือ `src/generated` ติดไปด้วย
