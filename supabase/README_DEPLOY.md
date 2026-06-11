# 🚀 Deploy ฐานข้อมูล EVT ขึ้น Supabase (ฟรี)

ฐานข้อมูลของ **ระบบเบิกของ EVT** ออกแบบมาให้รันบน **Supabase (PostgreSQL)** ฟรีทั้งหมด
ไม่ต้องติดตั้งโปรแกรมใด ๆ บนเครื่อง — ใช้แค่เว็บเบราว์เซอร์

---

## ขั้นที่ 1 — สร้างโปรเจกต์ Supabase (ฟรี)

1. เข้า https://supabase.com → **Sign in** (ใช้ GitHub หรืออีเมล)
2. กด **New project**
   - **Name:** `evt-parts` (หรือชื่อใดก็ได้)
   - **Database Password:** ตั้งรหัสผ่าน → **เก็บไว้ให้ดี**
   - **Region:** เลือก **Southeast Asia (Singapore)** — ใกล้ไทยที่สุด ความเร็วดีสุด
   - **Plan:** Free
3. รอ ~2 นาที จนสถานะขึ้น *Active*

> Free tier: ฐานข้อมูล 500 MB, ผู้ใช้ active 50,000/เดือน — เพียงพอสำหรับงานคลังภายใน

---

## ขั้นที่ 2 — รัน SQL (สร้างตาราง + ข้อมูลตัวอย่าง)

1. ในโปรเจกต์ Supabase → เมนูซ้าย **SQL Editor** → **+ New query**
2. เปิดไฟล์ [`deploy_all.sql`](deploy_all.sql) ในโฟลเดอร์นี้ → คัดลอกทั้งหมด
3. วางลงในช่อง SQL Editor → กด **Run** (หรือ `Ctrl+Enter`)
4. ควรเห็น *Success. No rows returned* — เสร็จเรียบร้อย ✅

> ถ้าอยากรันทีละส่วน ให้รันตามลำดับ:
> `migrations/0001_schema.sql` → `0002_functions.sql` → `0003_rls.sql` → `seed.sql`

ตรวจผลได้ที่เมนู **Table Editor** จะเห็นตาราง: `warehouses, departments, vehicles, parts, prs, pr_items, receipts, issues`

---

## ขั้นที่ 3 — เอา Key ไปต่อกับ Frontend

Frontend ต่อกับ Supabase ให้แล้ว — เหลือแค่ใส่ Key

1. ไปที่ **Project Settings → API** คัดลอก 2 ค่า:

   | ค่า | ตัวอย่าง |
   |---|---|
   | **Project URL** | `https://xxxx.supabase.co` |
   | **anon public key** | `eyJhbGciOiJ...` |

2. เปิดไฟล์ [`web/app/supabase-config.js`](../web/app/supabase-config.js) แล้วแทนค่า 2 บรรทัด:

   ```js
   window.SUPABASE_URL      = "https://xxxx.supabase.co"; // <- Project URL ของคุณ
   window.SUPABASE_ANON_KEY = "eyJhbGciOiJ...";           // <- anon public key
   ```

3. เปิดไฟล์ `web/ระบบเบิกของ EVT.html` ผ่าน static server — แอปจะดึงข้อมูลจริงจาก Supabase อัตโนมัติ
   - ถ้ายังไม่ใส่ Key จะขึ้นหน้า "ยังไม่ได้ตั้งค่า Supabase"
   - ถ้า RLS เปิดอยู่และยังไม่ login จะขึ้น "โหลดข้อมูลไม่สำเร็จ" (ดูหัวข้อ PDPA ด้านล่าง)

> **กลไกที่ทำให้แล้ว** — data layer ใหม่ ([`web/app/supabase-data.js`](../web/app/supabase-data.js))
> โหลดข้อมูลจาก Supabase แปลงเป็นรูปร่าง `window.EVTDATA` เดิม → **ทุกหน้าจอใช้งานได้โดยไม่ต้องแก้**
> ส่วนการบันทึก: `savePR` → insert, `receive` → `rpc('receive_pr')`, `withdraw` → `rpc('withdraw_parts')`
> (อัปเดตหน้าจอแบบ optimistic ทันที แล้ว sync ค่าจริงจากเซิร์ฟเวอร์กลับมา)

---

## 🔐 ความปลอดภัย & PDPA (สำคัญ)

ตาราง `prs` / `issues` / `receipts` มี **ชื่อพนักงาน/ผู้เบิก** = ข้อมูลส่วนบุคคล
ไฟล์ `0003_rls.sql` จึงตั้งค่าให้ **เฉพาะผู้ที่ login แล้ว (`authenticated`) เท่านั้นที่เข้าถึงได้**
— anon key ที่ฝังใน frontend จะอ่านข้อมูลไม่ได้จนกว่าจะมีการ sign-in

**ระบบ login ทำมาให้แล้ว** (หน้าเข้าสู่ระบบ + ปุ่มออกจากระบบใน frontend) — เหลือแค่เปิดใช้ฝั่ง Supabase:

1. Supabase → **Authentication → Sign In / Providers** → เปิด **Email** (เปิดเป็นค่าเริ่มต้นอยู่แล้ว)
2. สร้างผู้ใช้คนแรก — เลือกวิธีใดวิธีหนึ่ง:
   - **Authentication → Users → Add user** (ใส่อีเมล+รหัสผ่าน, ติ๊ก Auto Confirm) — แนะนำสำหรับงานภายใน
   - หรือกด "สมัครสมาชิก" ในหน้า login ของแอป (ถ้าเปิด Confirm email ไว้ ต้องยืนยันอีเมลก่อน — ปิดได้ที่ Authentication → Providers → Email → *Confirm email*)
3. ให้พนักงานคลัง login ด้วยบัญชีที่สร้าง แล้วใช้แอปได้ทันที

> มีบล็อก "โหมดทดสอบ (อนุญาต anon)" คอมเมนต์ไว้ท้ายไฟล์ `0003_rls.sql`
> ⚠ **ห้ามใช้กับข้อมูลจริง** เพราะจะเปิดข้อมูลส่วนบุคคลสู่สาธารณะ ขัดกับ PDPA

---

## 📁 ไฟล์ในโฟลเดอร์นี้

| ไฟล์ | หน้าที่ |
|---|---|
| `deploy_all.sql` | **รวมทุกอย่าง** — วางครั้งเดียวจบ (แนะนำ) |
| `migrations/0001_schema.sql` | ตารางทั้งหมด + index + view |
| `migrations/0002_functions.sql` | ฟังก์ชัน transaction: `receive_pr`, `withdraw_parts`, `next_doc_id` |
| `migrations/0003_rls.sql` | Row-Level Security (PDPA) |
| `seed.sql` | ข้อมูลตัวอย่างจาก `data.js` |

---

## หน่วยวัด
ราคา = บาท (`price`) · ปริมาณ = หน่วยตามอะไหล่ (ก้อน/ตัว/ชุด/เส้น/ดวง/บาน) · ระยะทาง/น้ำหนักทั้งหมดเป็นระบบเมตริก
