/* ============================================================
   EVT — หน้าจัดการข้อมูลหลัก (Admin)
   เพิ่ม/แก้/ลบ: อะไหล่ · รถ · แผนก · คลัง  → บันทึกลง Supabase
   window.Admin
   ============================================================ */
(function () {
  const { useState } = React;
  const e = React.createElement;
  const D = window.EVTDATA;
  const L = (lang, th, en) => (lang === "en" ? en : th);

  function Admin({ t, lang, data, actions, setToast }) {
    const [tab, setTab] = useState("part");
    const [edit, setEdit] = useState(null);   // { entity, obj, isNew }
    const [del, setDel] = useState(null);      // { entity, id, label }
    const [busy, setBusy] = useState(false);

    // ---- นิยามแต่ละชนิดข้อมูล ----
    const whOpts = data.warehouses.map((w) => ({ value: w.id, label: (w.th || w.id) }));
    const ENT = {
      part: {
        label: L(lang, "อะไหล่", "Parts"), pk: "code", list: data.parts,
        cols: [
          { k: "code", h: L(lang, "รหัส", "Code"), mono: true },
          { k: "th", h: L(lang, "ชื่อ", "Name"), main: true },
          { k: "cat", h: L(lang, "หมวด", "Category") },
          { k: "wh", h: L(lang, "คลัง", "WH"), map: (v) => { const w = D.whById(v); return w ? w.th : (v || "—"); } },
          { k: "stock", h: L(lang, "คงเหลือ", "Stock"), num: true },
          { k: "min", h: L(lang, "ขั้นต่ำ", "Min"), num: true },
        ],
        fields: [
          { k: "code", label: L(lang, "รหัสอะไหล่", "Part code"), req: true, pkLock: true, ph: "เช่น BRK-PAD-F" },
          { k: "th", label: L(lang, "ชื่อ (ไทย)", "Name (TH)"), req: true },
          { k: "en", label: L(lang, "ชื่อ (อังกฤษ)", "Name (EN)") },
          { k: "cat", label: L(lang, "หมวดหมู่", "Category"), ph: "เช่น ช่วงล่าง/เบรก" },
          { k: "unit", label: L(lang, "หน่วย (ไทย)", "Unit (TH)"), ph: "ชุด" },
          { k: "unitEn", label: L(lang, "หน่วย (อังกฤษ)", "Unit (EN)"), ph: "set" },
          { k: "wh", label: L(lang, "คลัง", "Warehouse"), opts: whOpts },
          { k: "stock", label: L(lang, "คงเหลือ", "On hand"), num: true },
          { k: "min", label: L(lang, "จุดสั่งซื้อ (ขั้นต่ำ)", "Reorder min"), num: true },
          { k: "price", label: L(lang, "ราคา (บาท)", "Price (THB)"), num: true },
        ],
        blank: () => ({ code: "", th: "", en: "", cat: "", unit: "ชิ้น", unitEn: "pcs", wh: (data.warehouses[0] || {}).id || "", stock: 0, min: 0, price: 0 }),
      },
      vehicle: {
        label: L(lang, "รถบัส", "Vehicles"), pk: "id", list: data.vehicles,
        cols: [
          { k: "id", h: "ID", mono: true },
          { k: "plate", h: L(lang, "ทะเบียน", "Plate"), main: true },
          { k: "model", h: L(lang, "รุ่น", "Model") },
          { k: "route", h: L(lang, "เส้นทาง", "Route") },
        ],
        fields: [
          { k: "id", label: L(lang, "รหัสรถ", "Vehicle ID"), req: true, pkLock: true, ph: "เช่น EVT-018" },
          { k: "plate", label: L(lang, "ทะเบียน", "Plate") },
          { k: "model", label: L(lang, "รุ่น", "Model") },
          { k: "route", label: L(lang, "เส้นทาง/สาย", "Route") },
          { k: "chassis", label: L(lang, "เลขตัวถัง (chassis)", "Chassis") },
        ],
        blank: () => ({ id: "", chassis: "", plate: "", model: "", route: "" }),
      },
      dept: {
        label: L(lang, "แผนก", "Departments"), pk: "id", list: data.departments,
        cols: [
          { k: "id", h: L(lang, "รหัส", "Code"), mono: true },
          { k: "th", h: L(lang, "ชื่อแผนก", "Name"), main: true },
          { k: "detail", h: L(lang, "รายละเอียด", "Detail") },
        ],
        fields: [
          { k: "id", label: L(lang, "รหัสแผนก", "Dept code"), req: true, pkLock: true, ph: "เช่น 21" },
          { k: "th", label: L(lang, "ชื่อแผนก", "Name"), req: true },
          { k: "detail", label: L(lang, "รายละเอียด", "Detail") },
        ],
        blank: () => ({ id: "", th: "", detail: "" }),
      },
      warehouse: {
        label: L(lang, "คลัง", "Warehouses"), pk: "id", list: data.warehouses,
        cols: [
          { k: "id", h: "ID", mono: true },
          { k: "no", h: L(lang, "เลขคลัง", "No.") },
          { k: "th", h: L(lang, "ชื่อ (ไทย)", "Name TH"), main: true },
          { k: "en", h: L(lang, "ชื่อ (อังกฤษ)", "Name EN") },
        ],
        fields: [
          { k: "id", label: L(lang, "รหัสคลัง", "WH ID"), req: true, pkLock: true, ph: "เช่น WH-01" },
          { k: "no", label: L(lang, "เลขคลัง", "No.") , ph: "01" },
          { k: "th", label: L(lang, "ชื่อ (ไทย)", "Name TH"), req: true },
          { k: "en", label: L(lang, "ชื่อ (อังกฤษ)", "Name EN") },
        ],
        blank: () => ({ id: "", no: "", th: "", en: "" }),
      },
    };
    const cur = ENT[tab];

    function errMsg(err) {
      if (err && (err.code === "23503" || /foreign key/i.test(err.message || "")))
        return L(lang, "ลบไม่ได้ — มีรายการอื่นอ้างอิงข้อมูลนี้อยู่", "Can't delete — referenced by other records");
      if (err && (err.code === "23505" || /duplicate/i.test(err.message || "")))
        return L(lang, "รหัสนี้มีอยู่แล้ว", "Code already exists");
      return (err && err.message) || L(lang, "ดำเนินการไม่สำเร็จ", "Operation failed");
    }

    async function doSave() {
      // ตรวจช่องบังคับ
      for (const f of cur.fields) {
        if (f.req && !String(edit.obj[f.k] || "").trim()) {
          setToast(L(lang, "กรุณากรอก: ", "Required: ") + f.label); return;
        }
      }
      setBusy(true);
      try {
        await actions.adminSave(tab, edit.obj, edit.isNew);
        setToast(L(lang, "บันทึกแล้ว", "Saved")); setEdit(null);
      } catch (err) { setToast(errMsg(err)); }
      finally { setBusy(false); }
    }
    async function doDelete() {
      setBusy(true);
      try {
        await actions.adminDelete(tab, del.id);
        setToast(L(lang, "ลบแล้ว", "Deleted")); setDel(null);
      } catch (err) { setToast(errMsg(err)); }
      finally { setBusy(false); }
    }

    // ---- ฟอร์ม (modal) ----
    function setF(k, v) { setEdit((s) => ({ ...s, obj: { ...s.obj, [k]: v } })); }
    const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 10, boxSizing: "border-box",
      border: "1px solid var(--border,#E8E7DE)", font: "500 14px var(--font-th,sans-serif)" };

    const formModal = edit ? e(window.Modal, { onClose: () => setEdit(null), max: 560 },
      e("div", { className: "modal-pad", style: { padding: 22 } },
        e("h3", { style: { margin: "0 0 4px", color: "var(--strong-green,#003F1D)" } },
          (edit.isNew ? L(lang, "เพิ่ม", "Add ") : L(lang, "แก้ไข", "Edit ")) + cur.label),
        e("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 } },
          cur.fields.map((f) => e("div", { key: f.k, style: f.opts || f.k === "th" || f.k === "detail" || f.k === "route" || f.k === "model" ? null : null },
            e(window.Field, { label: f.label + (f.req ? " *" : "") },
              f.opts
                ? e("select", { value: edit.obj[f.k] || "", onChange: (ev) => setF(f.k, ev.target.value), style: inputStyle },
                    f.opts.map((o) => e("option", { key: o.value, value: o.value }, o.label)))
                : e("input", {
                    type: f.num ? "number" : "text",
                    value: edit.obj[f.k] == null ? "" : edit.obj[f.k],
                    placeholder: f.ph || "",
                    disabled: f.pkLock && !edit.isNew,
                    onChange: (ev) => setF(f.k, ev.target.value),
                    style: { ...inputStyle, opacity: (f.pkLock && !edit.isNew) ? 0.55 : 1 },
                  }))))),
        e("div", { style: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 } },
          e(window.Btn, { variant: "ghost", onClick: () => setEdit(null) }, t("cancel")),
          e(window.Btn, { variant: "primary", disabled: busy, onClick: doSave }, busy ? "…" : t("save"))))) : null;

    // ---- กล่องยืนยันลบ ----
    const delModal = del ? e(window.Modal, { onClose: () => setDel(null), max: 420 },
      e("div", { style: { padding: 24 } },
        e("h3", { style: { margin: "0 0 8px", color: "var(--danger,#c0392b)" } }, L(lang, "ยืนยันการลบ", "Confirm delete")),
        e("p", { style: { color: "var(--fg-muted,#555)", lineHeight: 1.6 } },
          L(lang, "ต้องการลบ ", "Delete "), e("b", null, del.label), L(lang, " ใช่ไหม? การลบนี้ย้อนกลับไม่ได้", "? This cannot be undone")),
        e("div", { style: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 } },
          e(window.Btn, { variant: "ghost", onClick: () => setDel(null) }, t("cancel")),
          e(window.Btn, { variant: "primary", disabled: busy, onClick: doDelete,
            style: { background: "var(--danger,#c0392b)" } }, busy ? "…" : L(lang, "ลบ", "Delete"))))) : null;

    // ---- ตาราง ----
    const table = e(window.Card, null,
      e("div", { style: { overflowX: "auto" } },
        e("table", { className: "tbl" },
          e("thead", null, e("tr", null,
            cur.cols.map((c) => e("th", { key: c.k, className: c.num ? "num" : "" }, c.h)),
            e("th", { style: { textAlign: "right" } }, t("action")))),
          e("tbody", null,
            cur.list.length === 0
              ? e("tr", null, e("td", { colSpan: cur.cols.length + 1, style: { textAlign: "center", color: "var(--fg-subtle)", padding: 24 } }, "—"))
              : cur.list.map((row) => e("tr", { key: row[cur.pk] },
                  cur.cols.map((c) => e("td", { key: c.k, className: (c.mono ? "code " : "") + (c.num ? "num" : ""),
                      style: c.main ? { font: "600 14px var(--font-th)" } : null },
                    c.map ? c.map(row[c.k]) : (row[c.k] == null || row[c.k] === "" ? "—" : String(row[c.k])))),
                  e("td", { style: { textAlign: "right", whiteSpace: "nowrap" } },
                    e(window.Btn, { variant: "ghost", size: "sm", icon: e(window.IcEdit, { size: 15 }),
                      onClick: () => setEdit({ entity: tab, obj: { ...row }, isNew: false }) }, L(lang, "แก้ไข", "Edit")),
                    e(window.Btn, { variant: "ghost", size: "sm",
                      onClick: () => setDel({ entity: tab, id: row[cur.pk], label: (row.th || row.plate || row[cur.pk]) }),
                      style: { color: "var(--danger,#c0392b)", marginLeft: 4 } }, L(lang, "ลบ", "Delete")))))))));

    return e("div", { className: "page fadein" },
      e("div", { className: "page-head" },
        e("div", null,
          e("div", { className: "eyebrow" }, "ADMIN"),
          e("h1", null, L(lang, "จัดการข้อมูล", "Manage Data")),
          e("p", null, L(lang, "เพิ่ม แก้ไข และลบข้อมูลหลักของระบบ", "Add, edit and delete master data"))),
        e(window.Btn, { variant: "primary", icon: e(window.IcPlus, { size: 16 }),
          onClick: () => setEdit({ entity: tab, obj: cur.blank(), isNew: true }) }, L(lang, "เพิ่ม", "Add ") + cur.label)),
      e("div", { className: "cat-row" },
        Object.keys(ENT).map((k) => e("button", { key: k, className: "cat-pill" + (tab === k ? " on" : ""),
          onClick: () => setTab(k) }, ENT[k].label + " (" + ENT[k].list.length + ")"))),
      table, formModal, delModal);
  }

  window.Admin = Admin;
})();
