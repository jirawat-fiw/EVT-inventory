-- =====================================================================
-- EVT ระบบเบิกของ — DEPLOY ALL (รวมทุกไฟล์ไว้ที่เดียว)
-- วางทั้งหมดนี้ใน Supabase > SQL Editor แล้วกด RUN ครั้งเดียวจบ
-- ลำดับ: schema -> functions -> RLS -> seed
-- =====================================================================


-- >>>>>>>>>>>>>>>>>>>> migrations\0001_schema.sql >>>>>>>>>>>>>>>>>>>>
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


-- >>>>>>>>>>>>>>>>>>>> migrations\0002_functions.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================
-- 0002_functions.sql : ฟังก์ชันแบบ transaction (RPC)
-- รับของ / เบิกของ ต้องอัปเดต สต็อก + สถานะ + log พร้อมกัน
-- เรียกจาก frontend ได้ผ่าน supabase.rpc('...')
-- ============================================================

-- ------------------------------------------------------------
-- ออกเลขรันนิ่งตามชนิดเอกสาร + ปี พ.ศ.  → PR-2569-0001 / GR-... / WD-...
-- ------------------------------------------------------------
create or replace function public.next_doc_id(p_prefix text, p_be_year int)
returns text
language plpgsql
as $$
declare
  v_seq int;
  v_like text := p_prefix || '-' || p_be_year || '-%';
begin
  if p_prefix = 'PR' then
    select coalesce(max((regexp_replace(id, '^[A-Z]+-\d+-', ''))::int), 0) + 1
      into v_seq from public.prs where id like v_like;
  elsif p_prefix = 'GR' then
    select coalesce(max((regexp_replace(id, '^[A-Z]+-\d+-', ''))::int), 0) + 1
      into v_seq from public.receipts where id like v_like;
  elsif p_prefix = 'WD' then
    select coalesce(max((regexp_replace(id, '^[A-Z]+-\d+-', ''))::int), 0) + 1
      into v_seq from public.issues where id like v_like;
  else
    raise exception 'unknown prefix %', p_prefix;
  end if;
  return p_prefix || '-' || p_be_year || '-' || lpad(v_seq::text, 4, '0');
end $$;

-- ------------------------------------------------------------
-- รับของ (Goods Receipt)
--   p_lines = '[{"code":"BRK-PAD-F","qty":8}, ...]'
--   p_received_by = ชื่อผู้รับ, p_be_year = ปี พ.ศ. สำหรับเลข GR
-- เพิ่ม received ใน pr_items (ไม่เกิน qty) + เพิ่ม stock + ออก GR + อัปเดตสถานะ PR
-- คืนค่า: array ของ GR id ที่สร้าง
-- ------------------------------------------------------------
create or replace function public.receive_pr(
  p_pr_id       text,
  p_lines       jsonb,
  p_received_by text default null,
  p_be_year     int  default null
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line       jsonb;
  v_code       text;
  v_qty        int;
  v_remaining  int;
  v_take       int;
  v_gr_id      text;
  v_grs        text[] := '{}';
  v_be         int := coalesce(p_be_year, extract(year from now())::int + 543);
  v_total_ord  int;
  v_total_rec  int;
begin
  if not exists (select 1 from public.prs where id = p_pr_id) then
    raise exception 'ไม่พบ PR: %', p_pr_id;
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_code := v_line->>'code';
    v_qty  := coalesce((v_line->>'qty')::int, 0);
    if v_qty <= 0 then continue; end if;

    select (qty - received) into v_remaining
      from public.pr_items where pr_id = p_pr_id and part_code = v_code;
    if v_remaining is null then
      raise exception 'ไม่พบรายการ % ในใบ %', v_code, p_pr_id;
    end if;

    v_take := least(v_qty, v_remaining);   -- รับได้ไม่เกินที่ค้าง
    if v_take <= 0 then continue; end if;

    update public.pr_items
       set received = received + v_take
     where pr_id = p_pr_id and part_code = v_code;

    update public.parts
       set stock = stock + v_take
     where code = v_code;

    v_gr_id := public.next_doc_id('GR', v_be);
    insert into public.receipts(id, date, pr_id, part_code, qty, received_by)
      values (v_gr_id, current_date, p_pr_id, v_code, v_take, p_received_by);
    v_grs := v_grs || v_gr_id;
  end loop;

  -- อัปเดตสถานะ PR ตามยอดรวมที่รับ
  select sum(qty), sum(received) into v_total_ord, v_total_rec
    from public.pr_items where pr_id = p_pr_id;

  update public.prs
     set status = case
       when v_total_rec >= v_total_ord then 'received'::pr_status
       when v_total_rec > 0           then 'partial'::pr_status
       else status
     end
   where id = p_pr_id and status <> 'closed';

  return v_grs;
end $$;

-- ------------------------------------------------------------
-- เบิกของ (Withdraw / Issue)
--   p_cart = '[{"code":"BAT-72V-200","qty":1}, ...]'
--   p_meta = '{"by":"...","dept":"21","vehicle":"EVT-018","job":"JOB-0451","jobTitle":"...","prRef":"PR-..."}'
--            (vehicle เว้นว่าง/ null = เติมสต็อก/ไม่ระบุรถ)
-- ลด stock (ไม่ต่ำกว่า 0) + ออกใบเบิก WD + (ถ้ามี prRef) บวก used ใน pr_items
-- คืนค่า: array ของ WD id ที่สร้าง
-- ------------------------------------------------------------
create or replace function public.withdraw_parts(
  p_cart    jsonb,
  p_meta    jsonb default '{}'::jsonb,
  p_be_year int   default null
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line     jsonb;
  v_code     text;
  v_qty      int;
  v_stock    int;
  v_wh       text;
  v_wd_id    text;
  v_wds      text[] := '{}';
  v_be       int := coalesce(p_be_year, extract(year from now())::int + 543);
  v_vehicle  text := nullif(nullif(p_meta->>'vehicle',''),'—');
  v_pr_ref   text := nullif(p_meta->>'prRef','');
begin
  for v_line in select * from jsonb_array_elements(p_cart) loop
    v_code := v_line->>'code';
    v_qty  := coalesce((v_line->>'qty')::int, 0);
    if v_qty <= 0 then continue; end if;

    select stock, warehouse_id into v_stock, v_wh from public.parts where code = v_code;
    if v_stock is null then
      raise exception 'ไม่พบอะไหล่: %', v_code;
    end if;
    if v_qty > v_stock then
      raise exception 'สต็อก % ไม่พอ (มี % ขอเบิก %)', v_code, v_stock, v_qty;
    end if;

    update public.parts set stock = stock - v_qty where code = v_code;

    v_wd_id := public.next_doc_id('WD', v_be);
    insert into public.issues(
      id, date, part_code, qty, warehouse_id, issued_by, dept_id,
      vehicle_id, job_no, job_title, pr_ref)
    values (
      v_wd_id, current_date, v_code, v_qty, v_wh,
      p_meta->>'by', nullif(p_meta->>'dept',''),
      v_vehicle, nullif(p_meta->>'job',''),
      nullif(p_meta->>'jobTitle',''), v_pr_ref);
    v_wds := v_wds || v_wd_id;

    -- บันทึก used กลับเข้า PR ถ้ามีอ้างอิง
    if v_pr_ref is not null then
      update public.pr_items
         set used = used + v_qty
       where pr_id = v_pr_ref and part_code = v_code;
    end if;
  end loop;

  return v_wds;
end $$;


-- >>>>>>>>>>>>>>>>>>>> migrations\0003_rls.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================
-- 0003_rls.sql : Row-Level Security
-- ตารางมีชื่อพนักงาน/ผู้เบิก (ข้อมูลส่วนบุคคล) → ปิดกั้นข้อมูลไว้หลัง login
-- ค่าเริ่มต้น: เฉพาะผู้ที่ login แล้ว (role = authenticated) เท่านั้นที่เข้าถึงได้
-- anon key ที่ฝังใน frontend จะ "อ่าน/เขียนไม่ได้" จนกว่าจะมีการ sign-in
-- (สอดคล้องหลัก PDPA — ไม่เปิดข้อมูลส่วนบุคคลสู่สาธารณะ)
-- ============================================================

alter table public.warehouses  enable row level security;
alter table public.departments enable row level security;
alter table public.vehicles    enable row level security;
alter table public.parts       enable row level security;
alter table public.prs         enable row level security;
alter table public.pr_items    enable row level security;
alter table public.receipts    enable row level security;
alter table public.issues      enable row level security;

-- ---------- ผู้ใช้ที่ login แล้ว: เข้าถึงได้เต็ม (read + write) ----------
do $$
declare t text;
begin
  foreach t in array array[
    'warehouses','departments','vehicles','parts','prs','pr_items','receipts','issues'
  ] loop
    execute format('drop policy if exists %I on public.%I;', t||'_auth_all', t);
    execute format($p$
      create policy %I on public.%I
        for all
        to authenticated
        using (true)
        with check (true);
    $p$, t||'_auth_all', t);
  end loop;
end $$;

-- ============================================================
-- ทางเลือก (โหมดทดสอบเท่านั้น — ไม่แนะนำสำหรับข้อมูลจริง):
-- ถ้าต้องการให้ frontend ใช้งานได้ทันทีโดยยังไม่ทำระบบ login
-- ให้ "เอาคอมเมนต์ออก" บล็อกด้านล่าง เพื่ออนุญาต anon เข้าถึง
-- ⚠ ข้อมูลส่วนบุคคล (ชื่อผู้เบิก) จะเปิดสู่สาธารณะผ่าน anon key — ขัดกับ PDPA
-- ============================================================
-- do $$
-- declare t text;
-- begin
--   foreach t in array array[
--     'warehouses','departments','vehicles','parts','prs','pr_items','receipts','issues'
--   ] loop
--     execute format('drop policy if exists %I on public.%I;', t||'_anon_all', t);
--     execute format($p$
--       create policy %I on public.%I for all to anon using (true) with check (true);
--     $p$, t||'_anon_all', t);
--   end loop;
-- end $$;


-- >>>>>>>>>>>>>>>>>>>> seed.sql >>>>>>>>>>>>>>>>>>>>
-- ============================================================
-- seed.sql : ข้อมูลตัวอย่าง (mock) จาก app/data.js
-- รันซ้ำได้ (idempotent) ด้วย ON CONFLICT DO NOTHING
-- หมายเหตุ PDPA: ชื่อผู้เบิก/ผู้รับเป็น "ข้อมูลตัวอย่าง" ไม่ใช่บุคคลจริง
-- ============================================================

-- ---------- คลัง ----------
insert into public.warehouses (id, no, name_th, name_en) values
  ('WH-01','01','คลัง 01','WH 01'),
  ('WH-02','02','คลัง 02','WH 02'),
  ('WH-03','03','คลัง 03','WH 03'),
  ('WH-04','04','คลัง 04','WH 04'),
  ('WH-05','05','คลัง 05','WH 05'),
  ('WH-06','06','คลัง 06','WH 06'),
  ('WH-07','07','คลัง 07','WH 07'),
  ('WH-08','08','คลัง 08','WH 08'),
  ('WH-09','09','คลัง 09','WH 09')
on conflict (id) do nothing;

-- ---------- แผนก ----------
insert into public.departments (id, name_th, detail) values
  ('11','ฝ่ายสำนักงาน','ฝ่ายบริหารส่วนกลาง'),
  ('12','แผนกบุคคล','แผนกบุคคลและธุรการ'),
  ('13','แผนกจัดซื้อ','แผนกจัดซื้อ'),
  ('14','แผนกขาย','แผนกขาย'),
  ('14-3','สวนสัตว์ชม.','โครงการ-สวนสัตว์เชียงใหม่ (สิ้นสุดสัญญา)'),
  ('14-4','มช.','โครงการ-ม.เชียงใหม่-(ค่าใช้จ่ายหลังการขาย)'),
  ('15','โครงการ 1551','โครงการ-สาย 1551'),
  ('16','แผนก IT','แผนกเทคโนโลยีสารสนเทศ'),
  ('17','ฝ่ายบัญชีการเงิน','ฝ่ายบัญชีและการเงิน'),
  ('18','แผนกโครงการ','แผนกบริหารโครงการ'),
  ('21','แผนกผลิตและซ่อม','แผนกผลิตและซ่อมบำรุง'),
  ('22','แผนกบริการ','แผนกบริการหลังการขาย'),
  ('24','โครงการ ม.จุฬา','โครงการ-จุฬาลงกรณ์มหาวิทยาลัย (สิ้นสุดสัญญา)'),
  ('25','โครงการ รพ.รามา','โครงการ-รพ.รามาธิบดี (สิ้นสุดสัญญา)'),
  ('27','สวทช.','สวทช.-(ค่าใช้จ่ายหลังการขาย) (สิ้นสุดสัญญา)'),
  ('28','โครงการ มธ.1','โครงการ-มหาวิทยาลัยธรรมศาสตร์-รังสิต'),
  ('29','โครงการศิริราช','โครงการ-คณะแพทยศาสตร์ รพ.ศิริราช'),
  ('29-1','ศิริราช 12 คัน','โครงการศิริราช 12 คัน'),
  ('29-2','ศิริราช 5 คัน','โครงการศิริราช 5 คัน'),
  ('30','โครงการ กฟน.','โครงการ-การไฟฟ้านครหลวง (1/1/67-31/12/67)'),
  ('31','โครงการ ม.วล','โครงการ-มหาวิทยาลัยวลัยลักษณ์ (สิ้นสุดสัญญา 7/7/67)'),
  ('36','แผนกวิจัย&พัฒนา','แผนกวิจัยและพัฒนาผลิตภัณฑ์-วิศวะ'),
  ('38','แผนกการตลาด','แผนกการตลาด'),
  ('39','โครงการ กฟผ.','โครงการ-การไฟฟ้าฝ่ายผลิต (สิ้นสุดสัญญา)'),
  ('40','โครงการ กทม.1','โครงการ-กทม.ล้อสู้ราง เคหะร่มเกล้า-ARL ลาดกระบัง'),
  ('41','โครงการ กทม.2','โครงการ-กทม.ล้อสู้ราง ดินแดง-BTS สนามเป้า'),
  ('42','สนง.ทรัพย์สิน มธ','โครงการ-สำนักงานทรัพย์สิน ม.ธรรมศาสตร์ (สิ้นสุดสัญญา)'),
  ('43','การบินไทย','โครงการ-การบินไทย'),
  ('44','โครงการ มธ.2','โครงการ ม.ธรรมศาสตร์-ท่าพระจันทร์ (30/9/67)'),
  ('45','โครงการธนารักษ์','โครงการ บริษัท ธนารักษ์พัฒนาสินทรัพย์ จำกัด'),
  ('46','โครงการทวีวัฒนา','โครงการ กทม.ทวีวัฒนา'),
  ('47','ม.มหิดล 15 คัน','โครงการ ม.มหิดล 15 คัน (ภายใน)'),
  ('48','ม.มหิดล 9 คัน','โครงการ ม.มหิดล 9 คัน (ภายนอก)'),
  ('49','กทม.14 คัน','โครงการ กทม.ล้อสู้ราง 14 คัน'),
  ('50','ธนารักษ์ 6 คัน','โครงการธนารักษ์ 6 คัน 10 เดือน'),
  ('51','ว.นานาชาติมหิดล','โครงการวิทยาลัยนานาชาติ ม.มหิดล'),
  ('52','โครงการ จุฬาฯ','โครงการจุฬาฯ (1/7/69-30/6/73)'),
  ('60-1','TGC EMC (GIZ)','องค์กรความร่วมมือไทย-เยอรมัน (1/6/69-31/7/69)')
on conflict (id) do nothing;

-- ---------- รถบัส ----------
insert into public.vehicles (id, chassis, plate, model, route) values
  ('EVT-018','MEVT1A2B3C4D50018','30-1845 กทม.','EVT City Bus 12m','สาย 3 บางนา–สีลม'),
  ('EVT-022','MEVT1A2B3C4D50022','30-1992 กทม.','EVT City Bus 12m','สาย 7 ลาดกระบัง'),
  ('EVT-031','MEVT1A2B3C4D50031','31-0274 กทม.','EVT Shuttle 8m','Shuttle มหาวิทยาลัย'),
  ('EVT-009','MEVT1A2B3C4D50009','30-1102 กทม.','EVT City Bus 12m','สาย 1 สาทร')
on conflict (id) do nothing;

-- ---------- อะไหล่ ----------
insert into public.parts (code, name_th, name_en, unit, unit_en, warehouse_id, stock, min, price, category) values
  ('BAT-72V-200','แบตเตอรี่ลิเธียม 72V 200Ah','Li-ion Battery Pack 72V 200Ah','ก้อน','pack','WH-01',6,4,184000,'ระบบขับเคลื่อน'),
  ('MOT-AC-150','มอเตอร์ไฟฟ้า AC 150kW','AC Traction Motor 150kW','ตัว','unit','WH-01',3,2,268000,'ระบบขับเคลื่อน'),
  ('CTRL-VCU-3','ชุดควบคุม VCU รุ่น 3','Vehicle Control Unit v3','ชุด','set','WH-02',2,3,96000,'อิเล็กทรอนิกส์'),
  ('BRK-PAD-F','ผ้าเบรกหน้า (ชุด)','Front Brake Pad Set','ชุด','set','WH-02',28,12,3200,'ช่วงล่าง/เบรก'),
  ('TIRE-275-70','ยาง 275/70 R22.5','Tire 275/70 R22.5','เส้น','pcs','WH-01',14,16,9800,'ช่วงล่าง/เบรก'),
  ('CHG-CCS2-60','ชุดชาร์จ CCS2 60kW (อะไหล่)','CCS2 Charger Module 60kW','ชุด','set','WH-01',1,2,142000,'ระบบชาร์จ'),
  ('AC-ROOF-12','แอร์หลังคา 12kW','Rooftop A/C Unit 12kW','ตัว','unit','WH-02',5,3,58000,'ตัวถัง/ภายใน'),
  ('LED-HEAD-L','ไฟหน้า LED (ซ้าย)','LED Headlamp (Left)','ดวง','pcs','WH-03',9,6,7400,'ไฟฟ้า/แสงสว่าง'),
  ('DCDC-25A','ตัวแปลงไฟ DC-DC 25A','DC-DC Converter 25A','ตัว','unit','WH-02',7,4,18600,'อิเล็กทรอนิกส์'),
  ('DOOR-PNL-R','บานประตูไฟฟ้า (ขวา)','Electric Door Panel (Right)','บาน','pcs','WH-03',4,2,26500,'ตัวถัง/ภายใน')
on conflict (code) do nothing;

-- ---------- PR ----------
insert into public.prs (id, date, dept_id, requester, requester_unit, status, scanned, note) values
  ('PR-2569-0148','2026-06-03','21','สมชาย ทองดี','หน่วยซ่อมบำรุงระบบขับเคลื่อน','partial',true,'อะไหล่สำหรับซ่อม EVT-018 และสำรองคลัง'),
  ('PR-2569-0151','2026-06-05','22','วิชัย แสงทอง','หน่วยเดินรถสาย 7','ordered',true,'ยางสำรองรอบไตรมาส'),
  ('PR-2569-0153','2026-06-06','21','ประเสริฐ ใจดี','หน่วยซ่อมบำรุงตัวถัง','pending',true,'งานซ่อมประตู EVT-031'),
  ('PR-2569-0140','2026-05-28','21','อนุชา พงษ์ไพร','สายการผลิต EV ไลน์ 2','received',false,'ชุดชาร์จและตัวแปลงไฟสำหรับประกอบรถใหม่'),
  ('PR-2569-0135','2026-05-22','21','สมชาย ทองดี','หน่วยซ่อมบำรุงระบบขับเคลื่อน','closed',false,'มอเตอร์เปลี่ยนทดแทน EVT-009')
on conflict (id) do nothing;

-- ---------- รายการในใบ PR ----------
insert into public.pr_items (pr_id, part_code, qty, received, used, warehouse_id) values
  ('PR-2569-0148','BAT-72V-200',2,2,1,'WH-01'),
  ('PR-2569-0148','CTRL-VCU-3',3,1,0,'WH-02'),
  ('PR-2569-0148','BRK-PAD-F',8,8,4,'WH-02'),
  ('PR-2569-0151','TIRE-275-70',12,0,0,'WH-01'),
  ('PR-2569-0151','LED-HEAD-L',4,0,0,'WH-03'),
  ('PR-2569-0153','DOOR-PNL-R',2,0,0,'WH-03'),
  ('PR-2569-0153','AC-ROOF-12',1,0,0,'WH-02'),
  ('PR-2569-0140','CHG-CCS2-60',3,3,2,'WH-01'),
  ('PR-2569-0140','DCDC-25A',6,6,6,'WH-02'),
  ('PR-2569-0135','MOT-AC-150',2,2,2,'WH-01')
on conflict (pr_id, part_code) do nothing;

-- ---------- บันทึกรับของ (GR) ----------
insert into public.receipts (id, date, pr_id, part_code, qty, received_by) values
  ('GR-2569-0205','2026-06-04','PR-2569-0148','BAT-72V-200',2,'เจ้าหน้าที่คลัง บางนา'),
  ('GR-2569-0207','2026-06-05','PR-2569-0148','BRK-PAD-F',8,'เจ้าหน้าที่คลัง A'),
  ('GR-2569-0209','2026-06-06','PR-2569-0148','CTRL-VCU-3',1,'เจ้าหน้าที่คลัง A'),
  ('GR-2569-0188','2026-05-29','PR-2569-0140','CHG-CCS2-60',3,'เจ้าหน้าที่คลัง บางนา'),
  ('GR-2569-0189','2026-05-29','PR-2569-0140','DCDC-25A',6,'เจ้าหน้าที่คลัง A')
on conflict (id) do nothing;

-- ---------- รายการเบิก (WD)  — vehicle "—" แปลงเป็น NULL ----------
insert into public.issues (id, date, part_code, qty, warehouse_id, issued_by, dept_id, vehicle_id, job_no, job_title, pr_ref) values
  ('WD-2569-0312','2026-06-07','BAT-72V-200',1,'WH-01','สมชาย ทองดี','21','EVT-018','JOB-0451','เปลี่ยนแบตเตอรี่ชุดที่ 2','PR-2569-0148'),
  ('WD-2569-0308','2026-06-06','BRK-PAD-F',4,'WH-02','ประเสริฐ ใจดี','21','EVT-022','JOB-0448','เปลี่ยนผ้าเบรกหน้า','PR-2569-0148'),
  ('WD-2569-0301','2026-06-02','CHG-CCS2-60',2,'WH-01','อนุชา พงษ์ไพร','21',null,'JOB-0440','ประกอบชุดชาร์จรถใหม่','PR-2569-0140'),
  ('WD-2569-0298','2026-05-30','DCDC-25A',6,'WH-02','อนุชา พงษ์ไพร','21',null,'JOB-0440','ประกอบชุดชาร์จรถใหม่','PR-2569-0140'),
  ('WD-2569-0290','2026-05-25','MOT-AC-150',2,'WH-01','สมชาย ทองดี','21','EVT-009','JOB-0431','เปลี่ยนมอเตอร์ขับเคลื่อน','PR-2569-0135')
on conflict (id) do nothing;

