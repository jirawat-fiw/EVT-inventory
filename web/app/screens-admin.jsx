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
    const [imp, setImp] = useState(null);      // { text } เมื่อเปิดหน้านำเข้า
    const [busy, setBusy] = useState(false);

    // แปลงข้อความวาง (Excel = คั่นด้วย Tab, CSV = คั่นด้วย ,) เป็นแถวข้อมูล
    function parseRows(text, cols) {
      const lines = (text || "").split(/\r?\n/).filter((l) => l.trim() !== "");
      if (!lines.length) return [];
      const delim = lines[0].indexOf("\t") >= 0 ? "\t" : ",";
      const first = lines[0].toLowerCase();
      const isHeader = ["รหัส", "ทะเบียน", "ชื่อ", "เลขตัวถัง", "code", "plate", "chassis", "name"].some((k) => first.includes(k));
      const out = [];
      for (let i = isHeader ? 1 : 0; i < lines.length; i++) {
        const cells = lines[i].split(delim).map((s) => s.trim());
        const obj = {};
        cols.forEach((c, idx) => { obj[c.k] = cells[idx] != null ? cells[idx] : ""; });
        out.push(obj);
      }
      return out;
    }
    const impValid = (r, cols) => cols.filter((c) => c.req).every((c) => String(r[c.k] || "").trim());

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
        importCols: [
          { k: "code", label: L(lang, "รหัส", "Code"), req: true },
          { k: "th", label: L(lang, "ชื่อ (ไทย)", "Name TH"), req: true },
          { k: "en", label: L(lang, "ชื่อ (อังกฤษ)", "Name EN") },
          { k: "cat", label: L(lang, "หมวด", "Category") },
          { k: "unit", label: L(lang, "หน่วย (ไทย)", "Unit TH") },
          { k: "unitEn", label: L(lang, "หน่วย (EN)", "Unit EN") },
          { k: "wh", label: L(lang, "รหัสคลัง", "WH ID") },
          { k: "stock", label: L(lang, "คงเหลือ", "Stock"), num: true },
          { k: "min", label: L(lang, "ขั้นต่ำ", "Min"), num: true },
          { k: "price", label: L(lang, "ราคา", "Price"), num: true },
        ],
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
        importCols: [
          { k: "id", label: L(lang, "รหัสรถ", "ID"), req: true },
          { k: "plate", label: L(lang, "ทะเบียน", "Plate") },
          { k: "model", label: L(lang, "รุ่น", "Model") },
          { k: "route", label: L(lang, "เส้นทาง", "Route") },
          { k: "chassis", label: L(lang, "เลขตัวถัง", "Chassis") },
        ],
      },
      charger: {
        label: L(lang, "ตู้ชาร์จ", "Chargers"), pk: "id", list: data.chargers || [],
        cols: [
          { k: "id", h: "ID", mono: true },
          { k: "kw", h: "kW", num: true },
          { k: "model", h: L(lang, "รุ่น", "Model"), main: true },
          { k: "modelTh", h: L(lang, "ชื่อไทย", "Name TH") },
          { k: "location", h: L(lang, "ที่ตั้ง", "Location") },
          { k: "imported", h: L(lang, "ปีนำเข้า", "Imported") },
        ],
        fields: [
          { k: "id", label: L(lang, "รหัสตู้ชาร์จ", "Charger ID"), req: true, pkLock: true, ph: "เช่น CHG-01" },
          { k: "no", label: L(lang, "ลำดับ", "No."), num: true },
          { k: "kw", label: L(lang, "กำลัง (kW)", "Power (kW)"), num: true },
          { k: "model", label: L(lang, "รุ่น", "Model"), ph: "เช่น ATRESS" },
          { k: "modelTh", label: L(lang, "ชื่อ (ไทย)", "Name (TH)"), ph: "โกรวัตต์" },
          { k: "imported", label: L(lang, "ปีนำเข้า", "Imported"), ph: "ก.ค.-2021" },
          { k: "location", label: L(lang, "ที่ตั้ง", "Location"), ph: "อู่พระราม8" },
        ],
        blank: () => ({ id: "", no: "", kw: 0, model: "", modelTh: "", imported: "", location: "" }),
        importCols: [
          { k: "id", label: "ID", req: true },
          { k: "no", label: L(lang, "ลำดับ", "No."), num: true },
          { k: "kw", label: "kW", num: true },
          { k: "model", label: L(lang, "รุ่น", "Model") },
          { k: "modelTh", label: L(lang, "ชื่อไทย", "Name TH") },
          { k: "imported", label: L(lang, "ปีนำเข้า", "Imported") },
          { k: "location", label: L(lang, "ที่ตั้ง", "Location") },
        ],
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
      pr: {
        label: L(lang, "ใบ PR", "PRs"), pk: "id", list: data.prs, noAdd: true, noEdit: true,
        delWarn: L(lang, "จะลบรายการในใบ + ใบรับของ(GR) ที่ผูกกับ PR นี้ด้วย (สต็อกไม่ถูกย้อนกลับ)",
                        "Also removes its line items + linked receipts (stock is NOT reverted)"),
        cols: [
          { k: "id", h: L(lang, "รหัส PR", "PR No."), mono: true },
          { k: "date", h: L(lang, "วันที่", "Date") },
          { k: "dept", h: L(lang, "แผนก", "Dept"), map: (v) => { const d = D.deptById(v); return d ? d.th : (v || "—"); } },
          { k: "requester", h: L(lang, "ผู้ขอ", "Requester"), main: true },
          { k: "status", h: L(lang, "สถานะ", "Status") },
          { k: "items", h: L(lang, "รายการ", "Lines"), map: (v) => (v ? v.length : 0) + L(lang, " รายการ", " lines") },
        ],
        fields: [],
        blank: () => ({}),
      },
      issue: {
        label: L(lang, "เบิก (WD)", "Issues"), pk: "id", list: data.issues, noAdd: true, noEdit: true,
        delWarn: L(lang, "จะคืนจำนวนที่เบิกกลับเข้าสต็อกอะไหล่ และปรับยอดใช้ใน PR (ถ้ามีอ้างอิง)",
                        "Returns the issued qty back to stock and adjusts PR usage (if linked)"),
        cols: [
          { k: "id", h: L(lang, "เลขที่", "WD No."), mono: true },
          { k: "date", h: L(lang, "วันที่", "Date") },
          { k: "code", h: L(lang, "อะไหล่", "Part"), mono: true },
          { k: "qty", h: L(lang, "จำนวน", "Qty"), num: true },
          { k: "vehicle", h: L(lang, "รถ", "Vehicle"), main: true },
          { k: "by", h: L(lang, "ผู้เบิก", "By") },
        ],
        fields: [],
        blank: () => ({}),
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
    async function doImport() {
      const rows = parseRows(imp.text, cur.importCols).filter((r) => impValid(r, cur.importCols));
      if (!rows.length) { setToast(L(lang, "ไม่พบข้อมูลที่นำเข้าได้", "No valid rows")); return; }
      setBusy(true);
      try {
        const n = await actions.adminImport(tab, rows);
        setToast(L(lang, "นำเข้าแล้ว ", "Imported ") + n + L(lang, " รายการ", " rows")); setImp(null);
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
        cur.delWarn ? e("p", { style: { color: "var(--warning,#b8860b)", fontSize: 13, lineHeight: 1.55,
          background: "var(--green-50,#f0f7f2)", padding: "10px 12px", borderRadius: 8 } }, "⚠ " + cur.delWarn) : null,
        e("div", { style: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 } },
          e(window.Btn, { variant: "ghost", onClick: () => setDel(null) }, t("cancel")),
          e(window.Btn, { variant: "primary", disabled: busy, onClick: doDelete,
            style: { background: "var(--danger,#c0392b)" } }, busy ? "…" : L(lang, "ลบ", "Delete"))))) : null;

    // ---- นำเข้า (import modal) ----
    const parsed = imp ? parseRows(imp.text, cur.importCols || []) : [];
    const validRows = parsed.filter((r) => impValid(r, cur.importCols || []));
    const importModal = imp ? e(window.Modal, { onClose: () => setImp(null), max: 660 },
      e("div", { style: { padding: 22 } },
        e("h3", { style: { margin: "0 0 4px", color: "var(--strong-green,#003F1D)" } },
          L(lang, "นำเข้า", "Import ") + cur.label + L(lang, " จาก Excel/CSV", "")),
        e("p", { style: { color: "var(--fg-muted,#555)", fontSize: 13, lineHeight: 1.6, margin: "4px 0 10px" } },
          L(lang, "คัดลอกหลายแถวจาก Excel มาวาง หรือเลือกไฟล์ CSV · ลำดับคอลัมน์: ", "Paste rows from Excel or pick a CSV · columns: "),
          e("b", null, (cur.importCols || []).map((c) => c.label + (c.req ? "*" : "")).join("  |  "))),
        e("input", { type: "file", accept: ".csv,.txt,.tsv",
          onChange: (ev) => { const f = ev.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => setImp({ text: String(rd.result || "") }); rd.readAsText(f); },
          style: { marginBottom: 10, fontSize: 13 } }),
        e("textarea", { value: imp.text, onChange: (ev) => setImp({ text: ev.target.value }),
          placeholder: (cur.importCols || []).map((c) => c.label).join("\t"),
          rows: 7, style: { width: "100%", boxSizing: "border-box", borderRadius: 10, padding: "10px 12px",
            border: "1px solid var(--border,#E8E7DE)", font: "500 13px var(--font-en,monospace)", resize: "vertical" } }),
        e("div", { style: { margin: "10px 0", fontSize: 13, color: "var(--fg-muted,#555)" } },
          L(lang, "พบ ", "Found ") + parsed.length + L(lang, " แถว · นำเข้าได้ ", " rows · valid ") + validRows.length +
          (parsed.length > validRows.length ? L(lang, " (บางแถวขาดข้อมูลที่จำเป็น)", " (some rows missing required fields)") : "")),
        validRows.length ? e("div", { style: { maxHeight: 170, overflow: "auto", border: "1px solid var(--border,#E8E7DE)", borderRadius: 8, marginBottom: 14 } },
          e("table", { className: "tbl", style: { margin: 0 } },
            e("thead", null, e("tr", null, (cur.importCols || []).map((c) => e("th", { key: c.k, className: c.num ? "num" : "" }, c.label)))),
            e("tbody", null, validRows.slice(0, 6).map((r, i) => e("tr", { key: i },
              (cur.importCols || []).map((c) => e("td", { key: c.k, className: (c.k === "id" || c.k === "code" ? "code " : "") + (c.num ? "num" : "") }, r[c.k] || "—"))))))) : null,
        e("div", { style: { display: "flex", justifyContent: "flex-end", gap: 10 } },
          e(window.Btn, { variant: "ghost", onClick: () => setImp(null) }, t("cancel")),
          e(window.Btn, { variant: "primary", disabled: busy || !validRows.length, onClick: doImport },
            busy ? "…" : (L(lang, "นำเข้า ", "Import ") + validRows.length + L(lang, " รายการ", " rows")))))) : null;

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
                    cur.noEdit ? null : e(window.Btn, { variant: "ghost", size: "sm", icon: e(window.IcEdit, { size: 15 }),
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
        e("div", { style: { display: "flex", gap: 10 } },
          cur.importCols ? e(window.Btn, { variant: "soft", icon: e(window.IcUpload, { size: 16 }),
            onClick: () => setImp({ text: "" }) }, L(lang, "นำเข้า", "Import")) : null,
          cur.noAdd ? null : e(window.Btn, { variant: "primary", icon: e(window.IcPlus, { size: 16 }),
            onClick: () => setEdit({ entity: tab, obj: cur.blank(), isNew: true }) }, L(lang, "เพิ่ม", "Add ") + cur.label))),
      e("div", { className: "cat-row" },
        Object.keys(ENT).map((k) => e("button", { key: k, className: "cat-pill" + (tab === k ? " on" : ""),
          onClick: () => setTab(k) }, ENT[k].label + " (" + ENT[k].list.length + ")"))),
      table, formModal, delModal, importModal);
  }

  window.Admin = Admin;
})();
