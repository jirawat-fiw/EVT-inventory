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
