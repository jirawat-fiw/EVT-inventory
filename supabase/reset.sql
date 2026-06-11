-- ============================================================
-- reset.sql — ล้างข้อมูลเดินเอกสาร เพื่อเริ่มใหม่จาก 0
-- ============================================================
-- ✅ ล้าง:  ใบเบิก (issues) · ใบรับของ (receipts) · รายการในใบ (pr_items) · ใบ PR (prs)
-- 🔒 เก็บไว้: อะไหล่ (parts) · รถ (vehicles) · แผนก (departments) · คลัง (warehouses)
--
-- ⚠️ ลบแล้วกู้คืนไม่ได้ — วางทั้งหมดนี้ใน Supabase > SQL Editor แล้วกด Run
-- ============================================================

truncate table
  public.issues,
  public.receipts,
  public.pr_items,
  public.prs
restart identity cascade;

-- ------------------------------------------------------------
-- (ทางเลือก) ตั้งสต็อกอะไหล่ทุกตัวเป็น 0 เพื่อเริ่มนับสต็อกใหม่
-- ถ้าต้องการ ให้ลบเครื่องหมาย -- หน้าบรรทัดล่างออกแล้วรันพร้อมกัน
-- ------------------------------------------------------------
-- update public.parts set stock = 0;

-- ตรวจผล (ควรได้ 0 ทั้งหมด)
select
  (select count(*) from public.prs)      as prs,
  (select count(*) from public.pr_items) as pr_items,
  (select count(*) from public.receipts) as receipts,
  (select count(*) from public.issues)   as issues;
