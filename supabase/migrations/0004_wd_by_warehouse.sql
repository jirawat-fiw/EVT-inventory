-- ============================================================
-- 0004_wd_by_warehouse.sql
-- รหัสใบเบิก (WD) ให้มีเลขคลัง + รันเลขแยกแต่ละคลัง
-- รูปแบบใหม่:  WD-04-2569-0001  (04 = เลขคลัง, รันแยกต่อคลังต่อปี)
-- วางใน Supabase > SQL Editor แล้วกด Run
-- ============================================================

-- ออกเลขรันนิ่งของใบเบิกแยกตามคลัง + ปี พ.ศ.
create or replace function public.next_wd_id(p_wh_no text, p_be_year int)
returns text
language plpgsql
as $$
declare
  v_seq  int;
  v_no   text := coalesce(nullif(p_wh_no, ''), '00');
  v_like text := 'WD-' || v_no || '-' || p_be_year || '-%';
begin
  select coalesce(max((regexp_replace(id, '^WD-[0-9]+-[0-9]+-', ''))::int), 0) + 1
    into v_seq
    from public.issues
   where id like v_like;
  return 'WD-' || v_no || '-' || p_be_year || '-' || lpad(v_seq::text, 4, '0');
end $$;

-- เบิกของ (เวอร์ชันออกเลขแยกคลัง)
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
  v_line    jsonb;
  v_code    text;
  v_qty     int;
  v_stock   int;
  v_wh      text;
  v_wh_no   text;
  v_wd_id   text;
  v_wds     text[] := '{}';
  v_be      int := coalesce(p_be_year, extract(year from now())::int + 543);
  v_vehicle text := nullif(nullif(p_meta->>'vehicle',''),'—');
  v_pr_ref  text := nullif(p_meta->>'prRef','');
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

    -- เลขคลังจาก warehouse_id เช่น 'WH-04' -> '04'
    v_wh_no := coalesce(nullif(replace(coalesce(v_wh, ''), 'WH-', ''), ''), '00');
    v_wd_id := public.next_wd_id(v_wh_no, v_be);

    insert into public.issues(
      id, date, part_code, qty, warehouse_id, issued_by, dept_id,
      vehicle_id, job_no, job_title, pr_ref)
    values (
      v_wd_id, current_date, v_code, v_qty, v_wh,
      p_meta->>'by', nullif(p_meta->>'dept',''),
      v_vehicle, nullif(p_meta->>'job',''),
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
