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
