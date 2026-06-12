/* ============================================================
   EVT — Data layer (Supabase)
   แทนที่ app/data.js เดิม — โหลด/บันทึกข้อมูลจริงจาก Supabase
   แต่คง "รูปร่างข้อมูล" (window.EVTDATA) เหมือนเดิมทุกประการ
   ทุกหน้าจอจึงใช้งานได้โดยไม่ต้องแก้
   ============================================================ */
(function () {
  const URL = window.SUPABASE_URL;
  const KEY = window.SUPABASE_ANON_KEY;
  const configured =
    !!URL && !!KEY && !URL.includes("YOUR-PROJECT") && !KEY.includes("YOUR-ANON");

  let sb = null;
  if (configured && window.supabase) {
    sb = window.supabase.createClient(URL, KEY);
  }
  window.sb = sb;

  // ---- อาเรย์สถานะ (mutate ในที่เดิม เพื่อให้ helper อ้างอิงได้ตลอด) ----
  const state = {
    warehouses: [], departments: [], vehicles: [],
    parts: [], prs: [], issues: [], receipts: [],
  };

  // ---- ตัวอย่าง OCR (เดโม สแกนใบ PR) — คงไว้เป็น mock ----
  const ocrSample = {
    prCode: "PR-2569-0156", date: "2026-06-09",
    deptName: "ฝ่ายซ่อมบำรุง", deptId: "21",
    requester: "สมชาย ทองดี", requesterUnit: "หน่วยซ่อมบำรุงระบบขับเคลื่อน",
    note: "อะไหล่ซ่อม EVT-022 และเติมสต็อก",
    items: [
      { code: "BRK-PAD-F", desc: "ผ้าเบรกหน้า (ชุด)", qty: 6, unit: "ชุด", wh: "WH-02", conf: 0.98 },
      { code: "TIRE-275-70", desc: "ยาง 275/70 R22.5", qty: 8, unit: "เส้น", wh: "WH-01", conf: 0.93 },
      { code: "LED-HEAD-L", desc: "ไฟหน้า LED (ซ้าย)", qty: 2, unit: "ดวง", wh: "WH-03", conf: 0.71 },
      { code: "DCDC-25A", desc: "ตัวแปลงไฟ DC-DC 25A", qty: 3, unit: "ตัว", wh: "WH-02", conf: 0.88 },
    ],
  };

  // ---- helpers (เหมือน data.js เดิม) ----
  const partByCode = (code) => state.parts.find((p) => p.code === code);
  const whById = (id) => state.warehouses.find((w) => w.id === id);
  const deptById = (id) => state.departments.find((d) => d.id === id) || state.departments[0];
  const vehById = (id) => state.vehicles.find((v) => v.id === id);
  const fmtBaht = (n) => "฿" + (n || 0).toLocaleString("en-US");
  const fmtNum = (n) => (n || 0).toLocaleString("en-US");

  const replace = (arr, items) => { arr.length = 0; (items || []).forEach((x) => arr.push(x)); };

  // ---- โหลดข้อมูลทั้งหมดจาก Supabase แล้วแปลงเป็นรูปร่างของ prototype ----
  async function load() {
    if (!sb) throw new Error("SUPABASE_NOT_CONFIGURED");
    const r = await Promise.all([
      sb.from("warehouses").select("*").order("id"),
      sb.from("departments").select("*").order("id"),
      sb.from("vehicles").select("*").order("id"),
      sb.from("parts").select("*").order("code"),
      sb.from("prs").select("*").order("date", { ascending: false }),
      sb.from("pr_items").select("*").order("id"),
      sb.from("issues").select("*").order("date", { ascending: false }),
      sb.from("receipts").select("*").order("date", { ascending: false }),
    ]);
    const bad = r.find((x) => x.error);
    if (bad) throw bad.error;
    const [wh, dept, veh, parts, prs, prItems, issues, receipts] = r;

    replace(state.warehouses, wh.data.map((w) => ({ id: w.id, no: w.no, th: w.name_th, en: w.name_en })));
    replace(state.departments, dept.data.map((d) => ({ id: d.id, th: d.name_th, detail: d.detail, en: d.name_th })));
    replace(state.vehicles, veh.data.map((v) => ({ id: v.id, chassis: v.chassis, plate: v.plate, model: v.model, route: v.route })));
    replace(state.parts, parts.data.map((p) => ({
      code: p.code, th: p.name_th, en: p.name_en, unit: p.unit, unitEn: p.unit_en,
      wh: p.warehouse_id, stock: p.stock, min: p.min, price: Number(p.price), cat: p.category,
    })));

    const byPr = {};
    prItems.data.forEach((it) => {
      (byPr[it.pr_id] = byPr[it.pr_id] || []).push({
        code: it.part_code, qty: it.qty, received: it.received, used: it.used, wh: it.warehouse_id, unit: it.unit,
      });
    });
    replace(state.prs, prs.data.map((p) => ({
      id: p.id, date: p.date, dept: p.dept_id, requester: p.requester, requesterUnit: p.requester_unit,
      status: p.status, scanned: p.scanned, note: p.note, items: byPr[p.id] || [],
    })));

    replace(state.issues, issues.data.map((i) => ({
      id: i.id, date: i.date, code: i.part_code, qty: i.qty, wh: i.warehouse_id, by: i.issued_by,
      dept: i.dept_id, vehicle: i.vehicle_id || "—", job: i.job_no, jobTitle: i.job_title, prRef: i.pr_ref,
    })));
    replace(state.receipts, receipts.data.map((r2) => ({
      id: r2.id, date: r2.date, pr: r2.pr_id, code: r2.part_code, qty: r2.qty, by: r2.received_by,
    })));

    return window.EVTDATA;
  }

  // ---- การบันทึก (เรียกจาก actions ใน app.jsx) ----
  const api = {
    async savePR(pr) {
      // ผ่าน RPC (security definer) เพื่อให้ผู้ใช้ทั่วไปเปิด PR ได้ แม้ RLS จะล็อกการเขียนตรงไว้ที่แอดมิน
      const { error } = await sb.rpc("save_pr", {
        p_pr: {
          id: pr.id, date: pr.date, dept: pr.dept, requester: pr.requester,
          requesterUnit: pr.requesterUnit, status: pr.status || "pending",
          scanned: !!pr.scanned, note: pr.note,
        },
        p_items: (pr.items || []).map((it) => ({
          code: it.code, desc: it.desc, qty: it.qty,
          received: it.received || 0, used: it.used || 0, wh: it.wh, unit: it.unit,
        })),
      });
      if (!error) return;
      // ยังไม่ได้รัน migration 0005 (ไม่มีฟังก์ชัน save_pr) → ใช้วิธีเขียนตรง (เหมือนเดิม)
      if (error.code === "PGRST202" || error.code === "42883" || /save_pr|function/i.test(error.message || "")) {
        return await this._savePRDirect(pr);
      }
      throw error;
    },
    async _savePRDirect(pr) {
      let e1 = (await sb.from("prs").insert({
        id: pr.id, date: pr.date, dept_id: pr.dept, requester: pr.requester,
        requester_unit: pr.requesterUnit, status: pr.status || "pending",
        scanned: !!pr.scanned, note: pr.note,
      })).error;
      if (e1) throw e1;
      const seen = new Set();
      const items = (pr.items || []).filter((it) => {
        const c = (it.code || "").trim();
        if (!c || seen.has(c)) return false;
        seen.add(c); return true;
      });
      if (!items.length) return;
      const codes = items.map((it) => it.code.trim());
      const { data: existing } = await sb.from("parts").select("code").in("code", codes);
      const have = new Set((existing || []).map((p) => p.code));
      const stubs = items.filter((it) => !have.has(it.code.trim())).map((it) => ({
        code: it.code.trim(), name_th: (it.desc || "").trim() || it.code.trim(), name_en: null,
        unit: it.unit || "ชิ้น", unit_en: null, warehouse_id: it.wh || null,
        stock: 0, min: 0, price: 0, category: "จาก PR (สแกน)",
      }));
      if (stubs.length) { let e2 = (await sb.from("parts").insert(stubs)).error; if (e2) throw e2; }
      let e3 = (await sb.from("pr_items").insert(items.map((it) => ({
        pr_id: pr.id, part_code: it.code.trim(), qty: it.qty,
        received: it.received || 0, used: it.used || 0, warehouse_id: it.wh, unit: it.unit,
      })))).error;
      if (e3) throw e3;
    },
    async receive(prId, recv) {
      const lines = Object.entries(recv)
        .filter(([, q]) => Number(q) > 0)
        .map(([code, q]) => ({ code, qty: Number(q) }));
      if (!lines.length) return;
      const { error } = await sb.rpc("receive_pr", {
        p_pr_id: prId, p_lines: lines, p_received_by: "เจ้าหน้าที่คลัง",
      });
      if (error) throw error;
    },
    async withdraw(cart, info) {
      const { data, error } = await sb.rpc("withdraw_parts", {
        p_cart: cart.map((c) => ({ code: c.code, qty: c.qty })),
        p_meta: {
          by: info.by || "", dept: info.dept || "21",
          vehicle: info.vehicle || "", job: info.job || "",
          jobTitle: info.jobTitle || "", prRef: info.prRef || "",
        },
      });
      if (error) throw error;
      return data || []; // array ของเลขใบเบิก (WD ids) ที่ออกให้
    },

    // ---- จัดการข้อมูลหลัก (admin CRUD) ----
    async savePart(p, isNew) {
      const row = {
        code: (p.code || "").trim(), name_th: p.th, name_en: p.en, unit: p.unit, unit_en: p.unitEn,
        warehouse_id: p.wh || null, stock: Number(p.stock) || 0, min: Number(p.min) || 0,
        price: Number(p.price) || 0, category: p.cat,
      };
      const { error } = isNew
        ? await sb.from("parts").insert(row)
        : await sb.from("parts").update(row).eq("code", row.code);
      if (error) throw error;
    },
    async deletePart(code) { const { error } = await sb.from("parts").delete().eq("code", code); if (error) throw error; },

    async saveVehicle(v, isNew) {
      const row = { id: (v.id || "").trim(), chassis: v.chassis, plate: v.plate, model: v.model, route: v.route };
      const { error } = isNew
        ? await sb.from("vehicles").insert(row)
        : await sb.from("vehicles").update(row).eq("id", row.id);
      if (error) throw error;
    },
    async deleteVehicle(id) { const { error } = await sb.from("vehicles").delete().eq("id", id); if (error) throw error; },

    async saveDept(d, isNew) {
      const row = { id: (d.id || "").trim(), name_th: d.th, detail: d.detail };
      const { error } = isNew
        ? await sb.from("departments").insert(row)
        : await sb.from("departments").update(row).eq("id", row.id);
      if (error) throw error;
    },
    async deleteDept(id) { const { error } = await sb.from("departments").delete().eq("id", id); if (error) throw error; },

    async saveWarehouse(w, isNew) {
      const row = { id: (w.id || "").trim(), no: w.no, name_th: w.th, name_en: w.en };
      const { error } = isNew
        ? await sb.from("warehouses").insert(row)
        : await sb.from("warehouses").update(row).eq("id", row.id);
      if (error) throw error;
    },
    async deleteWarehouse(id) { const { error } = await sb.from("warehouses").delete().eq("id", id); if (error) throw error; },

    // ลบ PR ทั้งใบ: ลบใบรับของ (GR) ที่ผูกกับ PR นี้ก่อน → แล้วลบ PR
    // (รายการในใบ pr_items ถูกลบอัตโนมัติด้วย ON DELETE CASCADE)
    // หมายเหตุ: ใบเบิก (issues) อ้าง PR แบบ text เท่านั้น จะไม่ถูกลบ และสต็อกไม่ถูกย้อนกลับ
    async deletePR(id) {
      let e1 = (await sb.from("receipts").delete().eq("pr_id", id)).error;
      if (e1) throw e1;
      let e2 = (await sb.from("prs").delete().eq("id", id)).error;
      if (e2) throw e2;
    },

    // ลบรายการเบิก (WD): คืนสต็อกกลับเข้าคลัง + ปรับยอดใช้ใน PR + ลบใบเบิก
    async deleteIssue(id) {
      const { data: iss } = await sb.from("issues")
        .select("part_code, qty, pr_ref").eq("id", id).maybeSingle();
      if (iss) {
        const { data: part } = await sb.from("parts")
          .select("stock").eq("code", iss.part_code).maybeSingle();
        if (part) {
          let e1 = (await sb.from("parts")
            .update({ stock: (part.stock || 0) + (iss.qty || 0) })
            .eq("code", iss.part_code)).error;
          if (e1) throw e1;
        }
        if (iss.pr_ref) {
          const { data: pi } = await sb.from("pr_items")
            .select("used").eq("pr_id", iss.pr_ref).eq("part_code", iss.part_code).maybeSingle();
          if (pi) {
            await sb.from("pr_items")
              .update({ used: Math.max(0, (pi.used || 0) - (iss.qty || 0)) })
              .eq("pr_id", iss.pr_ref).eq("part_code", iss.part_code);
          }
        }
      }
      let e2 = (await sb.from("issues").delete().eq("id", id)).error;
      if (e2) throw e2;
    },

    // ---- นำเข้าทีละหลายรายการ (bulk import, upsert ตาม PK) ----
    async importVehicles(rows) {
      const clean = rows.filter((r) => (r.id || "").trim());
      if (!clean.length) return 0;
      const { error } = await sb.from("vehicles").upsert(
        clean.map((r) => ({
          id: r.id.trim(), chassis: (r.chassis || "").trim(),
          plate: r.plate || null, model: r.model || null, route: r.route || null,
        })),
        { onConflict: "id" });
      if (error) throw error;
      return clean.length;
    },
    async importParts(rows) {
      const clean = rows.filter((r) => (r.code || "").trim());
      if (!clean.length) return 0;
      const { error } = await sb.from("parts").upsert(
        clean.map((r) => ({
          code: r.code.trim(), name_th: r.th || "", name_en: r.en || null,
          unit: r.unit || "ชิ้น", unit_en: r.unitEn || null,
          warehouse_id: (r.wh || "").trim() || null,
          stock: Number(r.stock) || 0, min: Number(r.min) || 0, price: Number(r.price) || 0,
          category: r.cat || null,
        })),
        { onConflict: "code" });
      if (error) throw error;
      return clean.length;
    },
  };

  window.EVTDATA = Object.assign(state, {
    ocrSample, partByCode, whById, deptById, vehById, fmtBaht, fmtNum,
    load, reload: load, configured: !!sb, api,
  });
})();
