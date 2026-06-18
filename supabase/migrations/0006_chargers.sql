-- ============================================================
-- 0006_chargers.sql
-- เพิ่ม "ตู้ชาร์จ" เป็นเป้าหมายการเบิกอีกประเภท (นอกจากรถ)
--   - ตาราง chargers + seed 12 ตัว
--   - issues.charger_id (อ้างถึง chargers, NULL ได้)
--   - RLS: อ่านได้ทุกคนที่ login / เขียนเฉพาะแอดมิน
--   - อัปเดต withdraw_parts ให้บันทึก charger จาก meta
-- วางใน Supabase > SQL Editor แล้วกด Run
-- ============================================================

-- ---------- ตาราง ตู้ชาร์จ ----------
create table if not exists public.chargers (
  id         text primary key,        -- "CHG-01"
  no         int,
  kw         int,
  model      text,                     -- ATRESS / TIMXON ...
  model_th   text,                     -- โกรวัตต์ / ทิมซอน ...
  imported   text,                     -- "ก.ค.-2021"
  location   text,
  created_at timestamptz not null default now()
);
comment on table public.chargers is 'ตู้ชาร์จ (EV charger) — เป้าหมายการเบิกอีกประเภทนอกจากรถ';

-- ---------- seed 12 ตู้ ----------
insert into public.chargers (id, no, kw, model, model_th, imported, location) values
  ('CHG-01', 1, 150, 'ATRESS',      'โกรวัตต์', 'ก.ค.-2021', 'อู่พระราม8'),
  ('CHG-02', 2, 120, 'TIMXON',      'ทิมซอน',  'ม.ค.-2022', 'อู่พระราม8'),
  ('CHG-03', 3, 120, 'TIMXON (D)',  'ทิมซอน',  'ส.ค.-2024', 'อู่พระราม8'),
  ('CHG-04', 4, 120, 'TIMXON',      'ทิมซอน',  'พ.ค.-2021', 'โรงงาน EVT'),
  ('CHG-05', 5, 120, 'TIMXON',      'ทิมซอน',  'ก.ย.-2021', 'โรงงาน EVT'),
  ('CHG-06', 6, 120, 'SUNMUE',      'ซัลมิล',   'เม.ย.-2024', 'โรงงาน EVT'),
  ('CHG-07', 7, 120, 'EA',          'อีเอ',     'ธ.ค.-2017', 'มธ รังสิต'),
  ('CHG-08', 8, 120, 'TIMXON',      'ทิมซอน',  'ม.ค.-2022', 'มธ รังสิต'),
  ('CHG-09', 9, 150, 'B-CHARGE',    'บี-ชาร์จ', 'ม.ค.-2024', 'ธนารักษ์'),
  ('CHG-10', 10, 120, 'TIMXON (B)', 'ทิมซอน',  'ส.ค.-2024', 'ธนารักษ์'),
  ('CHG-11', 11, 150, 'ATRESS',     'โกรวัตต์', 'มิ.ย.-2023', 'ดอนเมือง'),
  ('CHG-12', 12, 150, 'ATRESS',     'โกรวัตต์', 'มิ.ย.-2021', 'สวนรถไฟ')
on conflict (id) do nothing;

-- ---------- ผูกกับใบเบิก ----------
alter table public.issues add column if not exists charger_id text references public.chargers(id);
create index if not exists idx_issues_charger on public.issues(charger_id);

-- ---------- RLS: อ่านทุกคน / เขียนเฉพาะแอดมิน ----------
alter table public.chargers enable row level security;
drop policy if exists chargers_read  on public.chargers;
drop policy if exists chargers_write on public.chargers;
create policy chargers_read  on public.chargers for select to authenticated using (true);
create policy chargers_write on public.chargers for all to authenticated
  using ((auth.jwt()->>'email') = 'jirawat@evthai.com')
  with check ((auth.jwt()->>'email') = 'jirawat@evthai.com');

-- ---------- อัปเดต RPC เบิกของ: บันทึก charger_id เพิ่ม ----------
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
  v_charger  text := nullif(p_meta->>'charger','');
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
      vehicle_id, charger_id, job_no, job_title, pr_ref)
    values (
      v_wd_id, current_date, v_code, v_qty, v_wh,
      p_meta->>'by', nullif(p_meta->>'dept',''),
      v_vehicle, v_charger, nullif(p_meta->>'job',''),
      nullif(p_meta->>'jobTitle',''), v_pr_ref);
    v_wds := v_wds || v_wd_id;

    if v_pr_ref is not null then
      update public.pr_items
         set used = used + v_qty
       where pr_id = v_pr_ref and part_code = v_code;
    end if;
  end loop;

  return v_wds;
end $$;
