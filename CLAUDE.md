# CLAUDE.md

คู่มือสำหรับ Claude Code ในโปรเจกต์ GE175 ตอบผู้ใช้เป็นภาษาไทย

## โปรเจกต์นี้คืออะไร

**TCGNexus** (ชื่อเดิม SwapHub, repo บน GitHub ยังใช้ชื่อเดิม) web app ซื้อขายและแลกเปลี่ยน**การ์ดเกม** (TCG marketplace)

- รองรับหลายเกม (Pokémon, Yu-Gi-Oh!, MTG, One Piece ฯลฯ) เก็บเป็นตาราง `Game` ให้ admin เพิ่มเอง ห้าม hardcode ชื่อเกมเป็น enum
- ขายได้ 3 แบบ (`itemKind`): การ์ดใบเดี่ยว `SINGLE`, การ์ดเกรด `GRADED` (PSA/BGS/CGC ฯลฯ), สินค้าซีล `SEALED` (booster, box, deck)
- ผู้ขายกรอกข้อมูลการ์ดเอง ยังไม่มีฐานข้อมูลการ์ดกลาง (catalog)
- มีผู้ใช้ 2 บทบาท:
  - **user**: ลงประกาศขายหรือแลกของ, ส่งคำขอซื้อหรือขอแลกไปที่ประกาศของคนอื่น, ตอบรับหรือปฏิเสธคำขอที่เข้ามา
  - **admin**: ดูข้อมูลหลังบ้าน (dashboard), อนุมัติหรือปฏิเสธประกาศ, จัดการผู้ใช้, ช่วยเหลือและตอบเรื่องที่ user แจ้งมา

### ข้อมูลหลัก

| Entity | หน้าที่ |
|---|---|
| `User` | มี `role`: `USER` / `ADMIN` และโปรไฟล์: `username` (unique ตัวพิมพ์เล็ก, DB สุ่ม `user_xxxxxxxx` ให้ตอนสร้าง), `avatarKey`, `bio`, `location` |
| `Game` | เกมการ์ด admin เพิ่ม/แก้ได้ มีรูปบน tile หน้าแรกได้ (`imageKey`, ไม่มีรูปใช้สีตาม slug) |
| `GradingCompany` | บริษัทเกรด admin เพิ่มได้ |
| `Listing` | ประกาศ มี `type`: `SALE` / `TRADE` / `BOTH`, `itemKind`: `SINGLE` / `GRADED` / `SEALED` และ `status`: `PENDING_REVIEW` → `ACTIVE` / `REJECTED` → `CLOSED` |
| `Offer` | คำขอซื้อหรือขอแลกต่อประกาศ (ใส่เงินเพิ่มได้) มี `status`: `PENDING` / `ACCEPTED` / `DECLINED` / `CANCELLED` |
| `ListingImage` | รูปของประกาศ (สูงสุด 6) เก็บแค่ `key` ไฟล์จริงอยู่ใน storage |
| `Review` | คะแนน 1–5 + ความเห็นที่คู่ดีลให้กันหลัง offer `ACCEPTED` ฝ่ายละหนึ่งรีวิวต่อดีล (unique `offerId + reviewerId`) แก้ได้ภายใน 30 วันหลังตอบรับ admin ซ่อนได้ (`removedAt`, ไม่ลบแถวจริง) |
| `OfferItem` | ประกาศของผู้ขอที่เอามาแลกใน `Offer` |
| `Escrow` | เงินวางกลางของดีลที่มีเงินสด หนึ่งต่อหนึ่งกับ `Offer` มี `status`: `AWAITING_PAYMENT` → `HELD` → `SHIPPED` → `RELEASED`, เปิดข้อพิพาทเป็น `DISPUTED` แล้ว admin ตัดสินเป็น `RELEASED`/`REFUNDED`, ปิดก่อนจ่ายเป็น `CANCELLED`/`EXPIRED` |
| `EscrowEvent` | ประวัติทุกการเปลี่ยนแปลงของ escrow (`actorId` null คือระบบ) ไม่มี API แก้หรือลบ |
| `Conversation` | ห้องแชทหนึ่งห้องต่อหนึ่งประกาศต่อผู้ซื้อหนึ่งคน (unique `listingId + buyerId`) ข้อเสนอของคู่เดียวกันในประกาศนี้ใช้ห้องเดียวกัน เก็บเวลาอ่านล่าสุดของแต่ละฝ่าย |
| `ChatMessage` | ข้อความหรือรูปในห้องแชท แก้/ลบไม่ได้ `imageKey` ไม่ส่งให้ client |
| `ChatBlock` | บล็อกแล้วส่งข้อความหากันไม่ได้ทั้งสองทางทุกห้อง ดีลที่ค้างยังดำเนินต่อได้ |
| `AuditLog` | บันทึกว่า admin คนไหนเปลี่ยนบทบาท/สถานะของใคร ซ่อนรีวิว ตรวจประกาศ แก้เกมหรือบริษัทเกรด ปิดเรื่องที่แจ้ง หรือตัดสินเงินวางกลาง (`AuditAction`, เหตุผลหรือสิ่งที่ถูกแก้อยู่ใน `detail`, `targetUserId` เป็น null เมื่อไม่ได้เจาะจงผู้ใช้คนเดียว) มีแค่ API อ่าน (กรองด้วย `action`) ห้ามเพิ่ม API แก้หรือลบ |
| `EventLog` | log เหตุการณ์ (`EventType`: ล็อกอิน, rate limit, access denied, server error) ลบอัตโนมัติเมื่อเกิน `LOG_RETENTION_DAYS` (default 60) |
| `PasswordResetToken` | ลิงก์ลืมรหัสผ่าน เก็บแค่ sha256, หมดอายุ 30 นาที, ใช้ได้ครั้งเดียว ขอใหม่แล้วอันเก่าใช้ไม่ได้ |
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

แก้ประกาศ (`PATCH /api/listings/:id` ส่งข้อมูลทั้งชุดแบบตอนสร้าง): เปลี่ยน `itemKind` ไม่ได้, `CLOSED` แก้ไม่ได้, `REJECTED` แก้แล้วกลับไป `PENDING_REVIEW`, `ACTIVE` ที่แก้ฟิลด์ตัวการ์ด (`IDENTITY_FIELDS` ใน listings.service) กลับไป `PENDING_REVIEW` และยกเลิก offer ที่ค้าง ส่วนราคา/จำนวน/รายละเอียดแก้ได้ทันที เปลี่ยน `type` ยกเลิกเฉพาะ offer ที่ไม่เข้ากับแบบใหม่

กฎของ offer ที่ตรวจใน service: ของที่เอามาแลกต้องเป็นประกาศของผู้ขอเอง, `ACTIVE`, และประกาศปลายทางต้องเป็น `TRADE`/`BOTH`

กฎของ support ที่ตรวจใน service: ผู้ใช้เห็นเฉพาะเรื่องของตัวเอง (ของคนอื่นตอบ 404), เปิดค้างได้ไม่เกิน 5 เรื่อง, เรื่องที่ปิดแล้วตอบต่อไม่ได้, API ฝั่งผู้ใช้ห้ามส่งชื่อหรือ id ของ admin ที่ตอบ (หน้าเว็บแสดงเป็น "ทีมงาน TCGNexus")

ตัวเลขแจ้งเตือนบนเมนู: `GET /api/me/counts` (รวม `escrowActions`, `unreadMessages`) และ `GET /api/admin/counts` (รวม `openDisputes`) นับเฉพาะสิ่งที่ต้องทำต่อ (มีระบบ "อ่านแล้ว" เฉพาะแชท) หน้าเว็บดึงด้วย `usePolling` ทุก 60 วินาทีและทุกครั้งที่เปลี่ยนหน้า ฝั่ง client ส่งต่อให้หน้าลูกผ่าน `<Outlet context>` (`useCounts`)

รูปประกาศ: `POST /api/listings/:id/images` (ทีละรูป field `image`, ≤ 5MB) รับเฉพาะ JPEG, PNG, WebP (ตรวจลายเซ็นไฟล์ก่อนถึงตัวถอดรหัสใน `lib/images.ts`) ผ่าน `sharp` ทุกครั้ง (ตรวจว่าเป็นรูปจริง, ย่อด้านยาว ≤ 1600px, แปลงเป็น WebP, ตัด EXIF) แล้วเก็บผ่าน `lib/storage.ts` ซึ่งตอนนี้เขียนลง `UPLOAD_DIR` (default `server/uploads`, ไม่ commit และเปิดสาธารณะทั้งโฟลเดอร์ ห้ามเก็บไฟล์ส่วนตัว) และเสิร์ฟที่ `/uploads/*` (Vite proxy ทั้งสองแอป) ย้ายไป S3/R2 ให้แก้แค่ `storage.ts` และ `imageUrl` ใน shared เพิ่ม/ลบรูปนับเป็นการแก้ตัวการ์ด (กลับไปรอตรวจ)

ลืมรหัสผ่าน: `POST /api/auth/forgot-password` ตอบ 204 เสมอ (ไม่บอกว่ามีบัญชีไหม, จำกัด 5 ครั้ง/15 นาที/IP ด้วย `resetLimiter` และ 5 ครั้ง/ชั่วโมง/อีเมลด้วย `resetAccountLimiter`) ลิงก์ชี้ไปเว็บ user หรือ admin ตาม role, `POST /api/auth/reset-password` ตั้งรหัสใหม่และเตะทุก session ส่งอีเมลผ่าน `lib/mailer.ts`: ตั้ง `SMTP_URL` แล้วส่งจริง ไม่ตั้งจะพิมพ์อีเมลลง console ของ server (dev) และเก็บใน `devOutbox` ให้ test อ่าน ส่วน production ต้องตั้งเสมอ ไม่งั้นแอปไม่เริ่มทำงาน

รูปเกม: `POST|DELETE /api/admin/games/:id/image` (field `image`, ≤ 5MB) server บังคับเป็น WebP 960×600 ทุกครั้ง หน้าหลังบ้านเลือกรูปแล้วครอปในเครื่องก่อนส่ง (`GameImageCropper` กรอบ 16:10, ลาก, ซูม, หมุน 90° วาดเองไม่ใช้ library) เปลี่ยนหรือลบรูปแล้วลบไฟล์เก่าทิ้ง

โปรไฟล์: `PATCH /api/me/profile`, `POST|DELETE /api/me/avatar` (ครอป 400×400 WebP), `GET /api/users/:username` ดูได้โดยไม่ล็อกอิน แต่บัญชีที่ถูกระงับและบัญชี admin ตอบ 404 username ห้ามมีคำสงวน (admin, tcgnexus, swaphub, support ฯลฯ ใน `me.service`) ชื่อที่แสดงตรวจด้วย `assertDisplayName` (`lib/names.ts`) ห้ามอักขระที่มองไม่เห็นและคำที่ทำให้เข้าใจผิดว่าเป็นทีมงาน ตรวจเฉพาะตอนเปลี่ยนชื่อ ชื่อเดิมใช้ต่อได้ หน้าเว็บ: `/u/:username` (การ์ดชื่อและตัวเลขความน่าเชื่อถือ ตามด้วยประกาศกับรีวิวโดยไม่มีแท็บ), `/profile/edit` "ดีลสำเร็จ" นับการแลกล้วนที่ตอบรับแล้วและดีลที่โอนเงินแล้ว

รีวิว: `PUT /api/offers/:id/review` (สร้างหรือแก้ของเดิม) ผู้รับรีวิวคืออีกฝ่ายของดีลเสมอ คะแนนเฉลี่ยคิดสดจากตาราง (`ratingSummaries` คิดหลายคนในคิวรีเดียว) แนบใน offer (ทั้งผู้ซื้อและผู้ขาย), หน้ารายละเอียดประกาศ (ผู้ขาย) และโปรไฟล์ หน้ารวมประกาศไม่แนบ รายการรีวิว: `GET /api/users/:username/reviews`

ซ่อนรีวิว: `GET /api/admin/reviews` (`status=VISIBLE|REMOVED`, `q`=username), `POST /api/admin/reviews/:id/remove` (ต้องมี `reason`, ลง audit `REVIEW_REMOVED` โดย target คือคนเขียน) รีวิวที่ซ่อนไม่แสดงในโปรไฟล์ ไม่นับในค่าเฉลี่ย คนเขียนแก้หรือเขียนใหม่ในดีลเดิมไม่ได้ ใน offer ส่งแค่ `removedAt` (rating/comment เป็น null)

แชท: `GET|POST /api/chat/conversations` (เปิดห้องด้วย `listingId` จากหน้าประกาศ หรือ `offerId` จากหน้าข้อเสนอ เปิดซ้ำได้ห้องเดิม ห้องใหม่จาก `listingId` ต้องเป็นประกาศที่อยู่ในตลาด), `GET .../:id`, `GET|POST .../:id/messages` (`before` โหลดของเก่าทีละ 50), `POST .../:id/images`, `POST .../:id/read`, `PUT|DELETE .../:id/block` คนนอกห้อง 404 ส่งไม่ได้เมื่อบล็อกกันหรืออีกฝ่ายถูกระงับ (`CHAT_UNAVAILABLE` ไม่บอกเหตุผล) จำกัด 40 ข้อความ/นาที และ 30 รูป/15 นาทีต่อบัญชี ห้องที่ยังไม่มีข้อความไม่แสดงในกล่องข้อความ ข้อความใหม่ส่งแบบทันทีด้วย Server-Sent Events (`GET /api/chat/events`, `chatEvents.ts` เก็บการเชื่อมต่อใน memory จึงรองรับ server ตัวเดียว) ตรวจ session ทุก 30 วินาทีโดยไม่ต่ออายุ (`isSessionActive`) ระงับบัญชีตัดทันที หน้าเว็บต่อครั้งเดียวทั้งแอป (`chatStream.ts`) ปิดเมื่อแท็บถูกซ่อน และดึงเป็นรอบแทนเมื่อการเชื่อมต่อหลุด รูปในแชทผ่าน `processImage` เหมือนรูปประกาศ เก็บใน `PRIVATE_UPLOAD_DIR` (default `server/uploads-private`, ต้องอยู่นอก `UPLOAD_DIR`) และเปิดผ่าน `GET /api/chat/images/:messageId` เท่านั้น ทีมงานอ่านแชทและรูปของห้องได้เฉพาะดีลที่เคยมีข้อพิพาท (`GET /api/admin/escrows/:id/messages/:messageId/image`) หน้าเว็บ: `/messages`, `/messages/:id` ซ่อนแท็บหมวดกับ footer เพื่อใช้ความสูงเต็มจอ

เงินวางกลาง (escrow): `acceptOffer` สร้างให้เมื่อ `cashAmount` > 0 และล็อกยอดไว้ การแลกล้วนไม่มี escrow ดีลเงินบวกการ์ดแลก (`twoWay`) ทั้งสองฝ่ายต้องแจ้งส่งและยืนยันรับก่อนปล่อยเงิน API: `POST /api/escrow/:id/pay|ship|confirm|dispute|cancel` (คนนอก 404, ผิดฝ่าย `ESCROW_WRONG_PARTY`), หลังบ้าน `GET /api/admin/escrows`, `GET /api/admin/escrows/:id`, `POST /api/admin/escrows/:id/resolve` (`decision`, `reason`, ลง audit, คู่ดีลเองตัดสินไม่ได้) การจ่ายเงินเป็นแบบจำลองใน `lib/payments.ts` ส่วนสถานะและกำหนดเวลาทำงานจริง production ต้องตั้ง `MOCK_PAYMENTS_ENABLED=true` ไม่งั้นแอปไม่เริ่มทำงาน กำหนดเวลา: จ่าย 48 ชม. (เลยแล้ว `EXPIRED`), ส่ง 5 วัน (ไม่มีใครส่งคืนเงิน, ส่งฝั่งเดียวเป็น `DISPUTED`), ยืนยันรับ 7 วัน (เลยแล้วปล่อยเงิน) กวาดรายชั่วโมงใน `index.ts` (`processEscrowDeadlines`) ดีลไม่เกิด (ยกเลิก, เลยกำหนดจ่าย, คืนเงินก่อนมีใครส่ง) offer เป็น `CANCELLED` คืนสต็อกและเปิดประกาศที่ปิดเพราะของหมดกลับมา คืนเงินหลังส่งแล้วคืนสต็อกเฉพาะฝั่งที่ยังไม่ส่ง อีเมลคู่ดีลเปิดหลังจ่าย รีวิวได้หลังเงินจบ (`ESCROW_NOT_SETTLED`) นับ 30 วันจาก `settledAt` ฝั่งผู้ใช้ห้ามส่งชื่อหรือ id ทีมงานและเลขอ้างอิงการเงิน (`toPartyEscrow`) ทีมงานอ่านแชทได้เฉพาะดีลที่เคยมีข้อพิพาท

หน้าเว็บ user: `/` เป็นหน้าร้าน (hero, tile เกม, แถวการ์ด) ส่วนการค้นหาและตัวกรองอยู่ที่ `/browse` (query `q`, `game`, `itemKind`, `type`, `sort`, `page`) ช่องค้นหาอยู่บน header ทุกหน้า แถวเกมบนหน้าแรกแสดง 5 เกมที่มีประกาศเปิดอยู่มากที่สุด (`GET /api/catalog/games/popular`, เท่ากันเรียงตามชื่อ) เลื่อนด้วยปุ่มหรือตุ่มด้านล่าง เกมอื่นหาได้จากหน้าเรียกดู หน้าแรกยิง `GET /api/listings` 4 ครั้ง + เกม 1 ครั้งต่อการเปิด (ตอน dev StrictMode ยิงซ้ำเป็นเท่าตัว ถ้าเจอ 429 ให้ restart server)

ยังไม่ทำ: แจ้งเตือนทางอีเมล (มีแค่ลิงก์ลืมรหัสผ่านกับอีเมลแจ้งเมื่อรหัสเปลี่ยน)

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
| `server/` | `npm run typecheck` | ตรวจ type ทั้ง `src/` และ `test/` |
| `server/` | `npm test` | รัน test (Vitest + Supertest) กับ DB `<ชื่อ DB>_test` ที่สร้างและ migrate ให้อัตโนมัติ |
| `server/` | `npm run build` | compile ไป `dist/` |
| `server/` | `npm run db:migrate` | สร้าง migration และอัปเดตตารางตาม `schema.prisma` (Prisma 7 ไม่สร้าง client ให้ ต้องรัน `db:generate` ต่อ) |
| `server/` | `npm run db:generate` | สร้าง Prisma Client ใหม่ (ไปที่ `src/generated/prisma`, ไม่ commit) |
| `server/` | `npm run db:studio` | เปิดดูข้อมูลใน DB |
| `server/` | `npm run db:seed` | ลงเกม/บริษัทเกรดเริ่มต้น และสร้าง admin ถ้าตั้ง `ADMIN_EMAIL`/`ADMIN_PASSWORD` ไว้ (รันซ้ำได้ ไม่ยกบัญชีผู้ใช้ที่มีอยู่เป็น admin และไม่รับรหัสตัวอย่างหรือรหัสเดาง่าย) |
| `client/` | `npm run dev` | รันหน้าเว็บที่ :5173 |
| `client/` | `npm run build` | `tsc -b` + `vite build` |
| `client/` | `npm run lint` | oxlint |
| `admin/` | `npm run dev` | รันหลังบ้านที่ :5174 |
| `admin/` | `npm run build`, `npm run lint` | เหมือน client |
| root | `npm install` | ติดตั้ง dependency ของ client, admin, shared |
| root | `npm run build`, `npm run lint` | build/lint ทุก workspace |

### รัน production

1. build: `npm run build` ที่ root (ตั้ง `VITE_CLIENT_URL` ตอน build แอป admin ไม่งั้นลิงก์ "ไปหน้าเว็บ" จะชี้ localhost) และ `npm run build` ใน `server/`
2. migrate: `npx prisma migrate deploy` ใน `server/`
3. รัน: `npm start` ใน `server/` โดยตั้ง `NODE_ENV=production`, `CLIENT_ORIGIN` กับ `ADMIN_ORIGIN` เป็น https คนละ hostname, `SMTP_URL`, `WEB_CLIENT_DIR`, `WEB_ADMIN_DIR`, `MOCK_PAYMENTS_ENABLED=true` (ขาดข้อไหนแอปจะไม่เริ่มทำงาน)
4. HTTPS มาจาก host หรือ reverse proxy ด้านหน้า ตั้ง `TRUST_PROXY` เป็นจำนวน proxy และต้องส่ง `Host` หรือ `X-Forwarded-Host` เดิมมา เพราะ server เลือกแอปจาก hostname

### Test (server)

- `server/test/*.test.ts` ยิง `app` ผ่าน supertest ไม่ต้องเปิด server ใช้ DB แยก (`vitest.config.ts` เปลี่ยนชื่อ DB เป็น `_test` และหยุดถ้าชี้ไป DB dev)
- ทุกตารางถูกล้างก่อนแต่ละเคส (`test/setup.ts`) ใช้ helper ใน `test/helpers.ts` (`signedInUser`, `signedInAdmin`, `createListing`, `eventsOf` ฯลฯ) สร้างข้อมูลเอง
- rate limit ปิดตอน `NODE_ENV=test` (`rate-limit.test.ts` เปิดกลับเฉพาะไฟล์ตัวเองด้วยการตั้ง `env.NODE_ENV` และสลับ IP ผ่าน `X-Forwarded-For`) และ event log เขียนแบบไม่รอ ให้ใช้ `eventsOf` / `waitForEventWrites` ก่อนนับ
- ฟีเจอร์ใหม่ฝั่ง server ต้องมี test ด้วย ฝั่ง client ยังไม่มี test และ server ยังไม่มี lint ถ้าจะเพิ่มให้เสนอในแผนก่อน

## โครงสร้างไฟล์

```
server/
  prisma/schema.prisma      User, Session, Game, GradingCompany, Listing, Offer, OfferItem, Conversation, ChatMessage, ChatBlock, Escrow, EscrowEvent, Review, AuditLog, EventLog, SupportTicket, SupportMessage
  prisma.config.ts          ตั้งค่า Prisma 7 (URL อ่านจาก env)
  src/
    index.ts, app.ts        เปิด server + graceful shutdown, Express app + middleware
    routes.ts               รวม router ทุก module ใต้ /api
    config/env.ts           ตรวจ env ด้วย zod ตอนเริ่ม
    lib/                    prisma, session, password + commonPasswords, names (ตรวจชื่อที่แสดง), images, storage, payments (ชำระเงินแบบจำลอง), mailer, errors (AppError), events (logEvent)
    middleware/             requireAuth, requireRole, checkOrigin (กัน CSRF), validate, rateLimit, errorHandler, uploadImage, serveWeb (เสิร์ฟหน้าเว็บตอน production แยกแอปตาม hostname)
    scripts/                seed.ts (เกม/บริษัทเกรดเริ่มต้น), seedAdmin.ts (admin คนแรก แยกไฟล์ให้เขียน test ได้)
    modules/<feature>/      auth, users, listings, offers, catalog (เกม + บริษัทเกรด), support, me (ตัวเลขบนเมนู, แก้โปรไฟล์, รูปโปรไฟล์), profiles (โปรไฟล์สาธารณะ), reviews, escrow (เงินวางกลาง), chat (แชท), audit, events, admin (dashboard, counts)
      <feature>.routes.ts   เส้นทาง + middleware ที่ใช้
      <feature>.service.ts  logic + เรียก Prisma
      <feature>.schema.ts   zod schema ของ request
client/src/                 เว็บ user
  router.tsx                react-router
  pages/                    public/, user/
  layouts/                  UserLayout, ContainedLayout (กรอบหน้าฟอร์ม/บัญชี), StoreTabs, BottomNav (เมนูจอเล็ก), HeaderSearch, SiteFooter
  components/icons.tsx      ไอคอน SVG ที่วาดเอง ไม่ใช้ library
  features/<feature>/       auth (RegisterForm), home (HomeHero, GameTiles, SellBanner), listings (ListingCard, ListingRow, BrowseRow), offers (รวม EscrowPanel), chat (chatApi, chatStream, ConversationList, ChatRoom), support
admin/src/                  เว็บหลังบ้าน route ไม่มี /admin นำหน้า เช่น /login, /users
  router.tsx, layouts/AdminLayout.tsx, components/ (RequireAdmin, AdminTopBar, AuthShell, icons ไอคอนที่วาดเอง)
  pages/                    Login, ForgotPassword, ResetPassword, Dashboard, ListingReview, Users, Catalog, Escrow, EscrowDetail, Reviews, Support, TicketDetail, AuditLog, Events, Account
  features/                 adminApi, labels, CatalogSection, GameImageCropper, dashboard/ (ColumnChart, DonutChart วาดเองไม่ใช้ library)
  lib/env.ts                VITE_CLIENT_URL (ลิงก์ไปเว็บ user)
shared/src/                 import ด้วย '@shared/...' (alias ใน vite.config.ts + paths ใน tsconfig.app.json ของแต่ละแอป)
  lib/                      api.ts (fetch wrapper + แปล error code เป็นข้อความไทย), useResource, usePolling
  auth/                     authApi, AuthProvider, useAuth, LoginForm, ChangePasswordForm, ForgotPasswordForm, ResetPasswordForm
  components/               Spinner, Pagination, FormField, Avatar, CountBadge, RequireAuth, ErrorPage, NotFoundPage
  listings/                 listingsApi (types, imageUrl), labels, gradient (สีประจำเกมตาม slug), ListingArt, ListingCover (รูปปกหรือภาพวาด)
  support/                  types + label หมวด, MessageThread (ใช้กับเรื่องที่แจ้งและแชทของดีลในหลังบ้าน)
  brand/                    Logo (LogoMark, LogoFull) และไฟล์โลโก้
  reviews/                  StarRating (RatingBadge, Stars, StarInput)
  styles.css                theme (สี brand-*) + .btn/.input/.page-title ฯลฯ ทั้งสองแอป import หลัง tailwindcss
```

- route ของ admin อยู่ใต้ `/api/admin/*` และต้องผ่าน `requireRole('ADMIN')` ทุกเส้น ตรวจสิทธิ์ที่ server เสมอ การซ่อนเมนูฝั่ง client ไม่นับเป็นการป้องกัน
- รหัสผ่าน: user อย่างน้อย 8 ตัว, admin อย่างน้อย 12 ตัว เปลี่ยนรหัสผ่านแล้วลบ session อื่นทั้งหมดยกเว้นเครื่องที่กำลังใช้ error ที่ไม่ได้แปลว่า session หลุดห้ามใช้ 401 เพราะ client จะเด้งออกจากระบบ ตั้งรหัสใหม่ทุกทาง (สมัคร, เปลี่ยน, รีเซ็ต) ต้องผ่าน `isGuessablePassword` (รหัสยอดนิยม, รหัสเรียงกัน, มีชื่ออีเมลหรือชื่อเว็บ) เปลี่ยนหรือรีเซ็ตสำเร็จแล้วส่งอีเมลแจ้งเจ้าของ admin ที่รหัสสั้นกว่า 12 ตัวล็อกอินหลังบ้านไม่ได้ (`ADMIN_PASSWORD_TOO_SHORT`) ต้องตั้งใหม่ผ่านลืมรหัสผ่าน
- session ของ admin สั้นกว่าผู้ใช้ทั่วไป (`ADMIN_SESSION_TTL_HOURS` ค่าเริ่มต้น 2, `ADMIN_SESSION_ABSOLUTE_HOURS` ค่าเริ่มต้น 12) ต่ออายุเมื่อเหลือไม่ถึงครึ่งเหมือนกัน แท็บหลังบ้านที่เปิดค้างและมองเห็นอยู่จึงต่ออายุเองจาก polling จนถึงเพดาน
- `authLimiter` นับเฉพาะ request ที่ล้มเหลว (10 ครั้ง / 15 นาที / IP) `registerLimiter` นับทุกการสมัคร (20 ครั้ง / ชั่วโมง / IP) `loginAccountLimiter` นับล็อกอินผิดต่ออีเมล (30 ครั้ง / 15 นาที) กันเดารหัสจากหลาย IP ตัวนับต่ออีเมลต้องอยู่หลัง `validate` ตอนเทสถ้าโดนบล็อก restart server เพื่อล้างตัวนับได้
- หน้า login แยกกัน: เว็บ user ใช้ `POST /api/auth/login`, เว็บ admin ใช้ `POST /api/auth/admin/login` แต่ละเส้นรับเฉพาะ role ของตัวเอง
- `shared/` ห้าม import จาก `client/` หรือ `admin/` ใส่เฉพาะของที่ทั้งสองแอปใช้จริง เพราะแก้ shared พังจะพังทั้งคู่ ของที่ใช้แอปเดียวให้อยู่ในแอปนั้น
- แก้ `shared/` แล้วต้อง build ทั้ง client และ admin
- admin ตั้ง/ถอดสิทธิ์ admin คนอื่นได้ (`PATCH /api/admin/users/:id/role`) แต่แก้บัญชีตัวเองไม่ได้ ทำให้เหลือ admin อย่างน้อย 1 คนเสมอ ระงับ admin ตรง ๆ ไม่ได้ต้องถอดสิทธิ์ก่อน เปลี่ยน role แล้วลบ session ทั้งหมดของคนนั้น
- การกระทำของ admin ที่กระทบผู้ใช้ ให้บันทึกด้วย `recordAudit(tx, ...)` ใน transaction เดียวกับการเปลี่ยนแปลง บันทึกเฉพาะที่เปลี่ยนจริง ถ้ากระทบหลายคนไม่ต้องใส่ `targetUserId` แล้วบอกรายละเอียดใน `detail` การ์ดบน dashboard ไม่นับ `LISTING_APPROVED` เพราะเป็นงานประจำจำนวนมาก
- เหตุการณ์ด้านความปลอดภัยให้บันทึกด้วย `logEvent(req, ...)` จาก `lib/events.ts` (ไม่ await, พลาดแล้ว request ไม่ล้ม) ห้ามใส่รหัสผ่าน, token, body หรือ error message เต็มลง log เหตุการณ์ที่อาจถูกยิงรัว ๆ ใช้ `logEventThrottled`
- งานกวาดข้อมูลเก่า (session หมดอายุ, EventLog เกินกำหนด) อยู่ใน `index.ts` รันทุกชั่วโมง
- อีเมลของผู้ใช้ไม่ส่งให้คนอื่นเห็น ยกเว้น admin และคู่ offer ที่ `ACCEPTED` แล้ว (ไว้ติดต่อนอกระบบหลังตกลงกัน) ถ้าดีลมีเงินต้องจ่ายเข้า escrow ก่อน
- ผลการตรวจประกาศ (`rejectReason`, `reviewedAt`) ส่งให้เฉพาะเจ้าของกับหลังบ้าน หน้าสาธารณะ โปรไฟล์ และ offer ใช้ `publicOmit`, ประกาศของตัวเองใช้ `ownerOmit`
- ระงับบัญชีแล้วยกเลิก offer ที่ค้างทั้งที่ส่งไปและที่เข้ามา และตอบรับ offer ของผู้ขอที่ถูกระงับไม่ได้ (`OFFER_PARTY_UNAVAILABLE`) escrow ที่ค้าง: ยังไม่จ่ายยกเลิก, จ่ายแล้วแต่ยังไม่มีใครส่งคืนเงิน, ส่งแล้วเป็น `DISPUTED` ให้ทีมงานตัดสิน
- ตอบรับ offer จะตัด `quantity` ทั้งประกาศปลายทางและของที่แลก ประกาศที่เหลือ 0 จะกลายเป็น `CLOSED` และ offer ที่ค้างกับประกาศที่ปิดจะถูก `CANCELLED` ดีลที่มีเงินสร้าง `Escrow` ใน transaction เดียวกัน

## หน้าตาและ responsive

- สีหลักใช้ `brand-*` ใน `shared/src/styles.css` (แดง `#E60012`) พื้นขาวกับเทาอ่อน ห้ามใส่ hex ซ้ำในหน้า ปุ่มหลัก `.btn-primary`, ปุ่มอันตราย `.btn-danger` เป็นสีกลางและแดงเฉพาะตอน hover เพราะปุ่มหลักแดงอยู่แล้ว
- ไม่ใช้โลโก้ รูป หรือฟอนต์ของแบรนด์อื่น
- โลโก้: จุดเล็กกว่าประมาณ 56px (header, เมนูหลังบ้าน, ไอคอนแท็บ) ใช้ `LogoMark` ซึ่งครอปเฉพาะการ์ดกับลูกศร ตั้งแต่ 96px ขึ้นไปใช้ `LogoFull` เพราะแบบเต็มย่อแล้วอ่านไม่ออก รูปมีพื้นขาวจึงอยู่ในกรอบขาวมุมมนเสมอ
- ต้องใช้งานได้ตั้งแต่จอกว้าง 320px โดยหน้าไม่ล้นแนวนอน ถ้าแก้หน้าให้ลองทั้งมือถือและจอใหญ่
- เว็บ user: ต่ำกว่า `lg` เมนูอยู่ที่ `BottomNav` ด้านล่าง (คนที่ล็อกอินแล้วเห็นแชทแทนเรียกดู และซ่อนแถบนี้ในห้องแชท) และ header เหลือแค่โลโก้กับช่องค้นหา ตั้งแต่ `lg` เมนูอยู่บน header และแท็บหมวดติดบนสุดตอนเลื่อน
- หลังบ้าน: ต่ำกว่า `lg` เมนูข้างพับเป็นปุ่ม "เมนู" ตารางต้องอยู่ในกรอบ `overflow-x-auto` ใช้สี `brand-*` ชุดเดียวกับหน้าร้าน งานค้างและคำเตือนจึงใช้สีเหลือง (`amber`) พร้อมไอคอน ไม่ใช้แดงอย่างเดียว ส่วนป้ายสถานะปกติใช้สีน้ำเงินหรือเทา
- หน้าที่มีแถบเต็มจอหรือใช้ความกว้างหน้าร้าน (`/`, `/browse`, `/listings/:id`, `/messages`) จัดกรอบเองด้วย `.page-container` หน้าอื่นอยู่ใต้ `ContainedLayout`
- layout ชั้นกลางต้องส่ง `<Outlet context>` ต่อ (ดู `RequireAuth`) ไม่งั้น `useCounts` ในหน้าลูกจะได้ `undefined`
- `.input` ใช้ตัวหนังสือ 16px บนจอเล็กเพราะ iOS ซูมหน้าเมื่อโฟกัสช่องที่เล็กกว่านั้น ข้อความยาวติดกันตัดบรรทัดด้วยกฎที่ `body` แต่ flex/grid item ที่มีข้อความจากผู้ใช้ยังต้องใส่ `min-w-0` หรือ `grid-cols-1` ไม่งั้นจะขยายตามคำยาวสุด

## Conventions

- ESM ทั้งสองฝั่ง ฝั่ง server import ไฟล์ภายในต้องลงท้าย `.js` (NodeNext) เช่น `'./config/env.js'`
- สไตล์โค้ด: single quote, ไม่มี semicolon, indent 2 ช่อง
- comment เขียนภาษาไทย สั้น ๆ อธิบายเหตุผล ไม่ใช่อธิบายว่าโค้ดทำอะไร
- validate ทุก input จาก request ด้วย zod (`validate` ปฏิเสธ NUL ในข้อความทุกช่องให้เอง เพราะ Postgres เก็บไม่ได้) env ใหม่ต้องเพิ่มใน `config/env.ts` และ `.env.example` ค่าที่ production ใช้ค่าเริ่มต้นไม่ได้ให้บังคับใน `envSchema`
- error จาก Express หรือ body-parser ที่มี status 4xx ตอบ `BAD_REQUEST` และไม่ลง `SERVER_ERROR` ทุกเส้นใต้ `/api` ตอบ `Cache-Control: no-store`
- security header ตั้งที่เดียวใน `app.ts` (helmet) ครอบทั้ง API, รูป และหน้าเว็บ CSP ไม่มี `unsafe-inline` และอนุญาตแค่ตัวเอง, Google Fonts กับรูป `blob:` ตอน dev Vite เสิร์ฟหน้าเว็บจึงไม่มี CSP ถ้าเพิ่มของจากภายนอก (รูป, script, iframe) ต้องแก้ CSP ด้วยและลองกับ build จริง ไม่งั้นจะพังเฉพาะบน production (`style={{...}}` ของ React ใช้ได้เพราะไม่ใช่ inline style แบบข้อความ)
- เข้าถึง DB ผ่าน `prisma` จาก `lib/prisma.ts` เท่านั้น
- server `tsconfig` เปิด `strict` + `noUncheckedIndexedAccess`

## Workflow (ทำตามลำดับนี้ทุกงานที่แก้โค้ด)

1. **อ่าน project ก่อน**: อ่านไฟล์ที่เกี่ยวข้องจริง อย่าเดาจากชื่อไฟล์หรือจาก CLAUDE.md อย่างเดียว
2. **อธิบายโครงสร้าง**: สรุปสั้น ๆ ว่าส่วนที่จะแตะอยู่ตรงไหน ทำงานอย่างไร
3. **วางแผนก่อนแก้**: บอกไฟล์ที่จะสร้าง/แก้, schema/migration ที่จะเปลี่ยน, package ที่จะติดตั้ง แล้ว**รอผู้ใช้ยืนยันก่อนลงมือ**
4. **แก้ทีละส่วน**: แบ่งงานเป็นชิ้นเล็ก ทำให้แต่ละชิ้นเสร็จและรันได้ก่อนไปชิ้นถัดไป
5. **รัน build/test/lint**: อย่างน้อย `server: npm run typecheck` และ `npm test`, และที่ root `npm run build` กับ `npm run lint` (ครอบ client, admin, shared) ถ้ามี test ให้รันด้วย ถ้าแก้ schema ให้รัน `db:migrate` ถ้าไม่ผ่านให้แก้หรือรายงานผลตามจริง
6. **สรุป diff**: บอกว่าแก้ไฟล์อะไร เปลี่ยนอะไร เพราะอะไร และสิ่งที่ยังไม่ได้ทำหรือยังไม่ได้ทดสอบ
7. **ช่วย commit**: เสนอ commit message (ภาษาอังกฤษ, รูปแบบ `type: summary` เช่น `feat: add listing model`) แล้ว**ถามก่อน commit** ห้าม push ถ้าไม่ได้สั่ง เช็กว่าไม่มี `.env` หรือ `src/generated` ติดไปด้วย
