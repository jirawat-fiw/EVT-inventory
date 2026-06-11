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
      let e1 = (await sb.from("prs").insert({
        id: pr.id, date: pr.date, dept_id: pr.dept, requester: pr.requester,
        requester_unit: pr.requesterUnit, status: pr.status || "pending",
        scanned: !!pr.scanned, note: pr.note,
      })).error;
      if (e1) throw e1;
      if (pr.items && pr.items.length) {
        let e2 = (await sb.from("pr_items").insert(pr.items.map((it) => ({
          pr_id: pr.id, part_code: it.code, qty: it.qty,
          received: it.received || 0, used: it.used || 0, warehouse_id: it.wh, unit: it.unit,
        })))).error;
        if (e2) throw e2;
      }
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
      const { error } = await sb.rpc("withdraw_parts", {
        p_cart: cart.map((c) => ({ code: c.code, qty: c.qty })),
        p_meta: {
          by: info.by || "", dept: info.dept || "21",
          vehicle: info.vehicle || "", job: info.job || "",
          jobTitle: info.jobTitle || "", prRef: info.prRef || "",
        },
      });
      if (error) throw error;
    },
  };

  window.EVTDATA = Object.assign(state, {
    ocrSample, partByCode, whById, deptById, vehById, fmtBaht, fmtNum,
    load, reload: load, configured: !!sb, api,
  });
})();
