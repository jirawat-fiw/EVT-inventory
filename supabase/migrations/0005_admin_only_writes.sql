-- ============================================================
-- 0005_admin_only_writes.sql
-- ให้ "แก้ไขข้อมูล" ได้เฉพาะ jirawat@evthai.com
--   - อ่าน (SELECT): ผู้ที่ login แล้วทุกคน
--   - เขียน (INSERT/UPDATE/DELETE) ตรงตาราง: เฉพาะอีเมลแอดมิน
--   - งานปฏิบัติ (เปิด PR / รับของ / เบิกของ) ทำผ่านฟังก์ชัน RPC ที่ข้าม RLS
--     จึงยังทำได้ทุกคน
-- วางใน Supabase > SQL Editor แล้วกด Run
-- เปลี่ยนอีเมลแอดมินได้ที่บรรทัด v_admin ด้านล่าง + ในนโยบาย RLS
-- ============================================================

-- ---------- RPC เปิด PR (ย้ายจากการเขียนตารางตรง ๆ มาเป็น security definer) ----------
create or replace function public.save_pr(p_pr jsonb, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_code text;
  v_seen text[] := '{}';
begin
  insert into public.prs(id, date, dept_id, requester, requester_unit, status, scanned, note)
  values (
    p_pr->>'id', (p_pr->>'date')::date, nullif(p_pr->>'dept',''), p_pr->>'requester',
    p_pr->>'requesterUnit',
    coalesce(nullif(p_pr->>'status','')::pr_status, 'pending'::pr_status),
    coalesce((p_pr->>'scanned')::boolean, false), p_pr->>'note');

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_code := trim(coalesce(v_item->>'code',''));
    if v_code = '' or v_code = any(v_seen) then continue; end if;
    v_seen := v_seen || v_code;

    -- สร้างอะไหล่ใหม่อัตโนมัติ ถ้ายังไม่มีในคลัง
    insert into public.parts(code, name_th, unit, warehouse_id, stock, min, price, category)
    values (
      v_code, coalesce(nullif(trim(v_item->>'desc'),''), v_code),
      coalesce(nullif(v_item->>'unit',''), 'ชิ้น'),
      nullif(v_item->>'wh',''), 0, 0, 0, 'จาก PR (สแกน)')
    on conflict (code) do nothing;

    insert into public.pr_items(pr_id, part_code, qty, received, used, warehouse_id, unit)
    values (
      p_pr->>'id', v_code, coalesce((v_item->>'qty')::int, 0),
      coalesce((v_item->>'received')::int, 0), coalesce((v_item->>'used')::int, 0),
      nullif(v_item->>'wh',''), v_item->>'unit')
    on conflict (pr_id, part_code) do nothing;
  end loop;
end $$;

-- ---------- RLS: อ่านทุกคน / เขียนเฉพาะแอดมิน ----------
do $$
declare
  t text;
  v_admin text := 'jirawat@evthai.com';   -- << เปลี่ยนอีเมลแอดมินได้ที่นี่
  tables text[] := array['warehouses','departments','vehicles','parts','prs','pr_items','receipts','issues'];
begin
  foreach t in array tables loop
    -- ลบนโยบายเดิมทั้งหมด
    execute format('drop policy if exists %I on public.%I;', t||'_auth_all', t);
    execute format('drop policy if exists %I on public.%I;', t||'_read', t);
    execute format('drop policy if exists %I on public.%I;', t||'_write', t);

    -- อ่าน: ผู้ที่ login แล้วทุกคน
    execute format('create policy %I on public.%I for select to authenticated using (true);', t||'_read', t);

    -- เขียน: เฉพาะอีเมลแอดมิน
    execute format(
      'create policy %I on public.%I for all to authenticated using ((auth.jwt()->>''email'') = %L) with check ((auth.jwt()->>''email'') = %L);',
      t||'_write', t, v_admin, v_admin);
  end loop;
end $$;
