-- ============================================================
-- 0007_wd_id_by_warehouse.sql
-- เปลี่ยนรูปแบบเลขใบเบิก (WD) ให้ฝัง "เลขคลัง" และเดินเลขแยกตามคลัง
--   เดิม:  WD-2569-0001
--   ใหม่:  WD-09-2569-0002   (WD-<เลขคลัง>-<ปี พ.ศ.>-<ลำดับในคลังนั้น>)
-- หมายเหตุ: อัปเดตเฉพาะ "ฟังก์ชัน" — ใบเบิกใหม่จะได้รูปแบบใหม่ และระบบ
--   จะหาลำดับถัดไปของคลังนั้นให้เอง (ไม่ชนเลขเดิมที่มีอยู่)
--   ใบเก่ารูปแบบเดิม: แนะนำให้ลบแล้วเบิกใหม่ (จัดการข้อมูล → เบิก WD → ลบ
--   ระบบคืนสต็อกให้อัตโนมัติ) — ไม่ใช้ backfill เพื่อเลี่ยงเลขซ้ำ
-- วางใน Supabase > SQL Editor แล้วกด Run
-- ============================================================

-- ---------- RPC เบิกของ: ออกเลข WD แบบมีคลัง + เดินเลขต่อคลัง ----------
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
  v_wh_no    text;
  v_seq      int;
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

    -- เลขคลังของอะไหล่ (เช่น '09'); ถ้าไม่มีคลังใช้ '00'
    select no into v_wh_no from public.warehouses where id = v_wh;
    v_wh_no := coalesce(nullif(v_wh_no, ''), '00');

    -- ลำดับถัดไป "เฉพาะคลังนั้น + ปีนั้น"
    select coalesce(max((split_part(id, '-', 4))::int), 0) + 1
      into v_seq
      from public.issues
      where id like 'WD-' || v_wh_no || '-' || v_be || '-%';

    v_wd_id := 'WD-' || v_wh_no || '-' || v_be || '-' || lpad(v_seq::text, 4, '0');

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
