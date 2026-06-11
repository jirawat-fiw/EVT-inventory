-- ============================================================
-- EVT — ระบบเบิกของ / EV Bus Parts Requisition System
-- 0001_schema.sql : ตาราง (schema) ทั้งหมด
-- Postgres / Supabase
-- มิเรอร์โครงสร้างจาก app/data.js + schema ที่แนะนำใน README
-- ============================================================

-- ---------- ENUM สถานะ PR ----------
do $$ begin
  create type pr_status as enum ('pending','ordered','partial','received','closed');
exception when duplicate_object then null; end $$;

-- ---------- คลังอะไหล่ (warehouses) ----------
create table if not exists public.warehouses (
  id       text primary key,            -- "WH-01"
  no       text not null,               -- "01"
  name_th  text not null,
  name_en  text not null
);

-- ---------- แผนก (departments) ----------
create table if not exists public.departments (
  id       text primary key,            -- "11", "14-3"
  name_th  text not null,
  detail   text
);

-- ---------- รถบัส (vehicles) ----------
create table if not exists public.vehicles (
  id       text primary key,            -- "EVT-018"
  chassis  text not null,
  plate    text,
  model    text,
  route    text
);

-- ---------- อะไหล่ (parts catalog) ----------
create table if not exists public.parts (
  code         text primary key,        -- "BAT-72V-200"
  name_th      text not null,
  name_en      text,
  unit         text not null,           -- ก้อน / ตัว / ชุด ...
  unit_en      text,
  warehouse_id text references public.warehouses(id),
  stock        integer not null default 0 check (stock >= 0),
  min          integer not null default 0 check (min >= 0),  -- จุดสั่งซื้อ
  price        numeric(12,2) not null default 0,             -- บาท
  category     text
);

-- ---------- ใบขอซื้อ (purchase requests / PR) ----------
create table if not exists public.prs (
  id             text primary key,      -- "PR-2569-0148" (พ.ศ.)
  date           date not null,
  dept_id        text references public.departments(id),
  requester      text,
  requester_unit text,
  status         pr_status not null default 'pending',
  scanned        boolean not null default false,
  note           text,
  created_at     timestamptz not null default now()
);

-- ---------- รายการในใบ PR (pr_items) ----------
create table if not exists public.pr_items (
  id           bigint generated always as identity primary key,
  pr_id        text not null references public.prs(id) on delete cascade,
  part_code    text not null references public.parts(code),
  qty          integer not null check (qty >= 0),       -- จำนวนสั่ง (ordered)
  received     integer not null default 0 check (received >= 0),
  used         integer not null default 0 check (used >= 0),
  warehouse_id text references public.warehouses(id),
  unit         text,
  unique (pr_id, part_code)
);

-- ---------- บันทึกรับของ (receipts / GR) ----------
create table if not exists public.receipts (
  id          text primary key,         -- "GR-2569-0205"
  date        date not null,
  pr_id       text references public.prs(id),
  part_code   text references public.parts(code),
  qty         integer not null check (qty > 0),
  received_by text,
  created_at  timestamptz not null default now()
);

-- ---------- รายการเบิก (issues / WD) ----------
create table if not exists public.issues (
  id           text primary key,        -- "WD-2569-0312"
  date         date not null,
  part_code    text references public.parts(code),
  qty          integer not null check (qty > 0),
  warehouse_id text references public.warehouses(id),
  issued_by    text,
  dept_id      text references public.departments(id),
  vehicle_id   text references public.vehicles(id),     -- NULL = เติมสต็อก/ไม่ระบุรถ
  job_no       text,
  job_title    text,
  pr_ref       text,
  created_at   timestamptz not null default now()
);

-- ---------- Index ที่ใช้บ่อย ----------
create index if not exists idx_parts_warehouse on public.parts(warehouse_id);
create index if not exists idx_parts_category  on public.parts(category);
create index if not exists idx_prs_status      on public.prs(status);
create index if not exists idx_prs_dept        on public.prs(dept_id);
create index if not exists idx_pr_items_pr     on public.pr_items(pr_id);
create index if not exists idx_pr_items_part   on public.pr_items(part_code);
create index if not exists idx_receipts_pr     on public.receipts(pr_id);
create index if not exists idx_receipts_date   on public.receipts(date);
create index if not exists idx_issues_date     on public.issues(date);
create index if not exists idx_issues_part     on public.issues(part_code);
create index if not exists idx_issues_vehicle  on public.issues(vehicle_id);

-- ---------- View ช่วยงาน: อะไหล่ต่ำกว่าจุดสั่งซื้อ ----------
create or replace view public.low_stock_parts as
  select code, name_th, name_en, warehouse_id, stock, min, category
  from public.parts
  where stock < min;

comment on table public.parts    is 'อะไหล่ + สต็อกคงเหลือต่อคลัง (stock = on hand, min = reorder point)';
comment on table public.prs      is 'ใบขอซื้อ (PR) — id ใช้ปี พ.ศ. เช่น PR-2569-0148';
comment on table public.receipts is 'บันทึกการรับของเข้าคลัง (Goods Receipt)';
comment on table public.issues   is 'รายการเบิกอะไหล่ออกจากคลัง (Withdrawal)';
