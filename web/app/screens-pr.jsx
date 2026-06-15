/* EVT — Open PR (scan + OCR) and PR Registry screens */
(function () {
  const { useState, useRef, useEffect } = React;
  const D = window.EVTDATA;

  // ---- normalise image before OCR: upscale small scans to ~1700px and JPEG-compress under the request limit ----
  async function prepImage(dataUrl) {
    const img = await new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = dataUrl; });
    const W = img.naturalWidth || 1200, H = img.naturalHeight || 1600;
    const scale = Math.min(2.6, 1700 / W) || 1;
    const w = Math.max(1, Math.round(W * scale)), h = Math.max(1, Math.round(H * scale));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d"); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
    x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
    let q = 0.82, b64 = c.toDataURL("image/jpeg", q).split(",")[1];
    while (b64.length * 0.75 > 240000 && q > 0.38) { q -= 0.12; b64 = c.toDataURL("image/jpeg", q).split(",")[1]; }
    return { b64, mediaType: "image/jpeg" };
  }

  // ---- OCR ฟรีในเบราว์เซอร์ (Tesseract.js) — รูปไม่ออกจากเครื่อง ----
  async function ocrExtractPR(dataUrl) {
    if (!window.Tesseract) throw new Error("no-ai");
    const { data } = await window.Tesseract.recognize(dataUrl, "tha+eng");
    return parseThaiPR((data && data.text) || "");
  }

  function beToIso(d, m, yy) {
    const beYear = 2500 + Number(yy);          // 69 -> 2569
    const pad = (n) => String(n).padStart(2, "0");
    return (beYear - 543) + "-" + pad(m) + "-" + pad(d);  // -> 2026-05-15
  }

  // แยกข้อความดิบจาก OCR เป็นโครงสร้าง PR แบบ best-effort (ผู้ใช้ตรวจ/แก้ต่อ)
  function parseThaiPR(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const all = lines.join("\n");

    // เลขที่ PR — เผื่อ OCR สับสน O↔0, I/l↔1, S↔5, B↔8
    const deOcr = (s) => s.replace(/[Oo]/g, "0").replace(/[Il]/g, "1")
      .replace(/[Ss]/g, "5").replace(/[Bb]/g, "8").replace(/\D/g, "");
    let prCode = "", prDigits = "";
    // หาในบรรทัดส่วนหัวที่มีคำว่า PR / เลขที่ใบขอ / อนุมัติ
    for (const ln of lines.slice(0, 14)) {
      if (!/PR|เลขที่ใบ|อนุมัติ|ใบขอซื้อ/i.test(ln)) continue;
      const cand = ln.match(/([0-9OoIlSsBb]{5,9})\b/);
      if (cand) {
        const num = deOcr(cand[1]);
        if (num.length >= 5 && num.length <= 9) { prDigits = num; prCode = "PR" + num; break; }
      }
    }
    if (!prCode) {
      const pm = all.match(/P\s*R\s*[:.\-]?\s*([0-9OoIlSsBb]{5,9})/);
      if (pm) { const num = deOcr(pm[1]); if (num.length >= 5) { prDigits = num; prCode = "PR" + num; } }
    }

    // วันที่ (พ.ศ. dd/mm/yy -> ISO)
    let date = new Date().toISOString().slice(0, 10);
    const dm = all.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})\b/);
    if (dm) { try { date = beToIso(+dm[1], +dm[2], dm[3]); } catch (e) {} }

    // แผนก
    let deptId = "";
    const de = all.match(/แผนก[^0-9]{0,8}(\d{1,3}(?:-\d)?)/);
    if (de) deptId = de[1];

    // หมายเหตุ — ดึงจากบล็อกท้ายเอกสาร (occurrence สุดท้ายของคำว่า "หมายเหตุ")
    let note = "", noteIdx = -1;
    for (let i = 0; i < lines.length; i++) if (/หมายเหตุ/.test(lines[i])) noteIdx = i;
    if (noteIdx >= 0) {
      const parts = [];
      for (let i = noteIdx; i < lines.length && parts.join(" ").length < 240; i++) {
        let ln = lines[i].replace(/^.*?หมายเหตุ\s*[:：]?\s*/, "");
        if (/ผู้ขอ|ผู้อนุมัติ|ผู้รับ|อนุมัติโดย|ลงชื่อ|ลายเซ็น|ผู้จัดทำ/.test(ln)) break;
        ln = ln.trim();
        if (ln) parts.push(ln);
      }
      note = parts.join(" ").trim();
    }

    // รายการ — บรรทัดที่มี "จำนวน + หน่วย" (กันบรรทัดที่อยู่/เบอร์โทร/ภาษี)
    const unitRe = "(?:ตัว|ชุด|ชิ้น|เส้น|อัน|ดวง|บาน|ก้อน|กล่อง|ม้วน|คู่|แผ่น|ตลับ|หลอด|แผง|ใบ|ลูก|เมตร|ม\\.|กก\\.|กิโลกรัม|ลิตร|แกลลอน|ขวด|ถุง|ห่อ|แพ็ค|แพค|แท่ง|โหล)";
    const items = [];
    lines.forEach((ln, idx) => {
      if (noteIdx >= 0 && idx >= noteIdx) return;       // ไม่เอาบล็อกหมายเหตุมาเป็นรายการ
      if (/รหัสสินค้า|จำนวนขอ|เลขที่ใบ|อนุมัติ|ภาษี|เลขประจำตัว|ใบขอซื้อ|ผู้จำหน่าย|สถานที่|แขวง|เขต/.test(ln)) return;
      // รหัส = ตัวเลข 3–8 หลัก อาจมีขีด เช่น 0032010 หรือ 5120-21
      const code = ln.match(/\b\d{3,8}(?:-\d{1,3})?\b/);
      const codeStr = code ? code[0] : "";
      if (prDigits && codeStr === prDigits) return;     // กันเลขที่ PR หลุดมาเป็นรายการ
      const after = codeStr ? ln.slice(ln.indexOf(codeStr) + codeStr.length) : ln;
      // จำนวน+หน่วย จากข้อความ "หลังรหัส" — หน่วยต้องไม่ตามด้วยอักษรไทยอื่น
      // (กัน "แผง" ในคำว่า "แผงคอยล์" และกันเลขในรหัส/วันที่)
      const qtyU = after.match(new RegExp("(\\d+(?:\\.\\d{1,2})?)\\s*(" + unitRe + ")(?![ก-๙])"));
      if (!qtyU) return;
      // คลัง = เลข 0X ตัวแรก "ก่อนคอลัมน์จำนวน" (กันไปจับเลขเดือนจากวันที่ เช่น 10/06/69)
      const beforeQty = after.split(qtyU[0])[0] || "";
      const whm = beforeQty.match(/\b(0[1-9])\b/);
      const wh = whm ? ("WH-" + whm[1]) : "WH-01";
      let desc = (after.split(/\s+\d/)[0] || "").replace(/[\/\\|]+/g, " ").replace(/\s+/g, " ").trim();
      items.push({ code: codeStr, desc, qty: Number(qtyU[1]) || 1, unit: qtyU[2], wh });
    });
    if (!items.length) items.push({ code: "", desc: "", qty: 1, unit: "ชิ้น", wh: "WH-01" });

    return {
      prCode, date, deptId, deptName: "", requester: "", requesterUnit: "",
      note,
      items,
    };
  }

  // ============================================================
  //  OPEN PR — scan + OCR
  // ============================================================
  function OpenPR({ t, lang, actions, go, reviewLayout }) {
    const [phase, setPhase] = useState(0); // 0 upload, 1 scan, 2 review, 3 done
    const [drag, setDrag] = useState(false);
    const [form, setForm] = useState(null);
    const [savedId, setSavedId] = useState(null);
    const [imgUrl, setImgUrl] = useState(null);
    const [scanErr, setScanErr] = useState(null);
    const [manual, setManual] = useState(false);
    const fileRef = useRef(null);
    const PR_DRAFT = "evt_draft_pr";
    const readDraft = () => { try { return JSON.parse(localStorage.getItem(PR_DRAFT) || "null"); } catch (e) { return null; } };
    const [draftAvail, setDraftAvail] = useState(() => !!readDraft());
    function clearDraft() { try { localStorage.removeItem(PR_DRAFT); } catch (e) {} setDraftAvail(false); }
    function continueDraft() { const d = readDraft(); if (d && d.form) { setForm(d.form); setManual(!!d.manual); setPhase(2); } }

    // เก็บร่างฟอร์มตรวจทานอัตโนมัติ (กันหายตอนรีโหลด/มือถือล้างแท็บ)
    useEffect(() => {
      try { if (form && phase === 2) localStorage.setItem(PR_DRAFT, JSON.stringify({ form, manual })); } catch (e) {}
    }, [form, phase, manual]);

    function resetAll() { setPhase(0); setForm(null); setImgUrl(null); setScanErr(null); setManual(false); clearDraft(); }

    function startBlank() {
      const yr = new Date().getFullYear() + 543;
      const seq = String(D.prs.length + 1).padStart(4, "0");
      setImgUrl(null); setScanErr(null); setManual(true);
      setForm({
        prCode: `PR-${yr}-${seq}`,
        date: new Date().toISOString().slice(0, 10),
        deptId: D.departments[0].id,
        requester: "",
        requesterUnit: "",
        note: "",
        items: [{ code: "", desc: "", qty: 1, unit: "\u0e0a\u0e34\u0e49\u0e19", wh: "WH-01", conf: 1 }],
      });
      setPhase(2);
    }

    function useSample() {
      setImgUrl(null); setScanErr(null); setPhase(1);
      setTimeout(() => {
        const o = D.ocrSample;
        setForm({
          prCode: o.prCode, date: o.date, deptId: o.deptId, requester: o.requester,
          requesterUnit: o.requesterUnit, note: o.note,
          items: o.items.map((it) => ({ ...it })),
        });
        setPhase(2);
      }, 1600);
    }

    async function scanFile(file) {
      if (!file) return;
      setScanErr(null);
      const mt = file.type || "image/jpeg";
      const dataUrl = await new Promise((ok) => { const r = new FileReader(); r.onloadend = () => ok(r.result); r.readAsDataURL(file); });
      setImgUrl(dataUrl);
      setPhase(1);
      try {
        const ex = await ocrExtractPR(dataUrl);
        const ids = D.departments.map((d) => d.id);
        const deptId = ids.indexOf(ex.deptId) >= 0 ? ex.deptId : D.departments[0].id;
        setForm({
          prCode: ex.prCode || "",
          date: ex.date || new Date().toISOString().slice(0, 10),
          deptId,
          requester: ex.requester || "",
          requesterUnit: ex.requesterUnit || ex.deptName || "",
          note: ex.note || "",
          items: (ex.items || []).map((it) => {
            const p = D.partByCode((it.code || "").trim());
            return {
              code: it.code || "",
              desc: p ? (lang === "en" ? p.en : p.th) : (it.desc || ""),
              qty: Number(it.qty) || 1,
              unit: p ? p.unit : (it.unit || "\u0e0a\u0e34\u0e49\u0e19"),
              wh: p ? p.wh : (it.wh || "WH-01"),
              conf: p ? 1 : 0.7,
            };
          }),
        });
        setPhase(2);
      } catch (e) {
        setScanErr(e && e.message === "no-ai" ? "no-ai" : "parse");
      }
    }

    function setItem(i, key, val) {
      setForm((f) => {
        const items = f.items.slice();
        items[i] = { ...items[i], [key]: val, ...(key === "qty" || key === "desc" ? { conf: 1 } : {}) };
        return { ...f, items };
      });
    }
    function addRow() {
      setForm((f) => ({ ...f, items: [...f.items, { code: "", desc: "", qty: 1, unit: "ชิ้น", wh: "WH-01", conf: 1 }] }));
    }
    function removeRow(i) { setForm((f) => ({ ...f, items: f.items.filter((_, x) => x !== i) })); }

    function save() {
      const pr = {
        id: form.prCode, date: form.date, dept: form.deptId, requester: form.requester,
        requesterUnit: form.requesterUnit, status: "pending", scanned: !manual, note: form.note,
        items: form.items.map((it) => ({ code: it.code, desc: it.desc, qty: Number(it.qty) || 0, received: 0, used: 0, wh: it.wh, unit: it.unit })),
      };
      actions.savePR(pr);
      clearDraft();
      setSavedId(form.prCode);
      setPhase(3);
    }

    const stepDefs = [
      { n: 1, key: "step_upload" }, { n: 2, key: "step_extract" },
      { n: 3, key: "step_review" }, { n: 4, key: "step_done" },
    ];
    const Steps = React.createElement("div", { className: "steps no-print" },
      stepDefs.map((s, i) => [
        React.createElement("div", { key: "s" + i, className: "step " + (phase === i ? "on" : phase > i ? "done" : "") },
          React.createElement("div", { className: "n" }, phase > i ? React.createElement(window.IcCheck, { size: 15 }) : s.n),
          React.createElement("div", { className: "t" }, t(s.key))),
        i < stepDefs.length - 1 ? React.createElement("div", { key: "b" + i, className: "step-bar " + (phase > i ? "fill" : "") }) : null,
      ]));

    // ---- phase 3: done ----
    if (phase === 3) {
      const pr = actions.getPR(savedId);
      const tot = window.prTotals(pr);
      return React.createElement("div", { className: "page fadein" },
        Steps,
        React.createElement(window.Card, { style: { maxWidth: 560, margin: "0 auto" } },
          React.createElement("div", { className: "success-hero" },
            React.createElement("div", { className: "check" }, React.createElement(window.IcCheck, { size: 38 })),
            React.createElement("h2", null, t("pr_saved")),
            React.createElement("p", null, t("pr_saved_sub")),
            React.createElement("div", { className: "mono", style: { font: "800 22px var(--font-en)", color: "var(--evt-green)", margin: "8px 0 18px" } }, savedId),
            React.createElement("div", { style: { display: "flex", gap: 24, justifyContent: "center", marginBottom: 22 } },
              statBit(tot.lines, t("item")), statBit(tot.ordered + " " + t("pieces"), t("qty"))),
            React.createElement("div", { style: { display: "flex", gap: 10, justifyContent: "center" } },
              React.createElement(window.Btn, { variant: "ghost", icon: React.createElement(window.IcScan, { size: 16 }), onClick: resetAll }, t("scan_again")),
              React.createElement(window.Btn, { variant: "primary", icon: React.createElement(window.IcArrowR, { size: 16 }), onClick: () => go("registry") }, t("goto_registry"))))));
    }

    return React.createElement("div", { className: "page fadein" },
      React.createElement("div", { className: "page-head" },
        React.createElement("div", null,
          React.createElement("div", { className: "eyebrow" }, "EVT · PURCHASE REQUISITION"),
          React.createElement("h1", null, t("openpr_title")),
          React.createElement("p", null, t("openpr_sub")))),
      Steps,
      (draftAvail && phase === 0) ? React.createElement("div", { className: "card", style: { padding: "12px 16px", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--green-50,#f0f7f2)", border: "1px solid var(--green-200,#cde9d8)" } },
        React.createElement("span", { style: { flex: 1, font: "500 13px var(--font-th)", color: "var(--strong-green,#003F1D)" } }, "มีร่าง PR ที่กรอกค้างไว้ — กรอกต่อไหม?"),
        React.createElement(window.Btn, { variant: "primary", size: "sm", onClick: continueDraft }, "กรอกต่อ"),
        React.createElement(window.Btn, { variant: "ghost", size: "sm", onClick: clearDraft }, "ลบร่าง")) : null,
      (phase === 2 && (reviewLayout === "focus" || manual))
      ? React.createElement("div", { style: { maxWidth: 720, margin: "0 auto" } },
          React.createElement(ReviewForm, {
            t, lang, form, setForm, setItem, addRow, removeRow, save, manual,
            onRescan: resetAll,
          }))
      : React.createElement("div", { className: "scan-wrap" },
        // LEFT — image stage
        React.createElement("div", null,
          (phase === 0)
            ? React.createElement(Dropzone, { t, drag, setDrag, onFile: scanFile, onSample: useSample, onBlank: startBlank, fileRef })
            : React.createElement("div", { className: "scan-stage" },
                imgUrl
                  ? React.createElement("img", { src: imgUrl, alt: "PR", style: { width: "100%", borderRadius: 12, display: "block", boxShadow: "var(--shadow-md)" } })
                  : React.createElement(window.MockPRPaper, null),
                (phase === 1 && !scanErr) ? React.createElement("div", { className: "scan-line" }) : null,
                (phase === 1 && !scanErr) ? React.createElement("div", { className: "scan-tag" },
                  React.createElement("span", { className: "spin" }), t("scanning")) : null)),
        // RIGHT — instructions or review
        React.createElement("div", null,
          phase === 0 ? React.createElement(UploadHint, { t }) : null,
          phase === 1 ? React.createElement(ScanningHint, { t, lang, scanErr, onSample: useSample, onRetry: resetAll }) : null,
          phase === 2 ? React.createElement(ReviewForm, {
            t, lang, form, setForm, setItem, addRow, removeRow, save, manual,
            onRescan: resetAll,
          }) : null)));
  }

  function statBit(v, l) {
    return React.createElement("div", { style: { textAlign: "center" } },
      React.createElement("div", { className: "mono", style: { font: "800 22px var(--font-en)", color: "var(--strong-green)" } }, v),
      React.createElement("div", { style: { font: "500 12px var(--font-th)", color: "var(--fg-subtle)" } }, l));
  }

  function Dropzone({ t, drag, setDrag, onFile, onSample, onBlank, fileRef }) {
    const camRef = useRef(null);
    const pick = () => fileRef.current && fileRef.current.click();
    const snap = () => camRef.current && camRef.current.click();
    return React.createElement("div", null,
      React.createElement("div", {
        className: "dropzone" + (drag ? " drag" : ""),
        onDragOver: (e) => { e.preventDefault(); setDrag(true); },
        onDragLeave: () => setDrag(false),
        onDrop: (e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files && e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); },
      },
        React.createElement("input", { ref: fileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: (e) => { if (e.target.files && e.target.files[0]) onFile(e.target.files[0]); } }),
        React.createElement("input", { ref: camRef, type: "file", accept: "image/*", capture: "environment", style: { display: "none" }, onChange: (e) => { if (e.target.files && e.target.files[0]) onFile(e.target.files[0]); } }),
        React.createElement("div", { className: "dz-ic" }, React.createElement(window.IcCamera, { size: 32 })),
        React.createElement("p", null, t("drop_here")),
        React.createElement("div", { className: "dz-actions" },
          React.createElement(window.Btn, { variant: "primary", icon: React.createElement(window.IcCamera, { size: 16 }), onClick: snap }, t("take_photo")),
          React.createElement(window.Btn, { variant: "ghost", icon: React.createElement(window.IcUpload, { size: 16 }), onClick: pick }, t("choose_file"))),
        React.createElement("button", { className: "linkbtn", onClick: onSample }, t("use_sample"))),
      React.createElement("div", { className: "dz-or" },
        React.createElement("span", null, t("or"))),
      React.createElement(window.Btn, { variant: "soft", icon: React.createElement(window.IcPlus, { size: 16 }), onClick: onBlank, style: { width: "100%", justifyContent: "center" } }, t("open_manual")));
  }

  function UploadHint({ t }) {
    const tips = [
      { th: "วางใบ PR บนพื้นเรียบ แสงสว่างพอ", en: "Lay the PR flat with good lighting" },
      { th: "ให้เห็นหัวกระดาษ เลข PR และตารางครบ", en: "Capture the header, PR no. and full table" },
      { th: "ระบบจะดึงข้อมูลให้ตรวจทานก่อนบันทึก", en: "Data is extracted for your review before saving" },
    ];
    return React.createElement(window.Card, { className: "card-pad" },
      React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", marginBottom: 14 } },
        React.createElement("div", { className: "kpi-ic", style: { width: 34, height: 34, borderRadius: 9, background: "var(--green-50)", color: "var(--evt-green)", display: "flex", alignItems: "center", justifyContent: "center" } },
          React.createElement(window.IcSparkle, { size: 18 })),
        React.createElement("b", { style: { font: "700 16px var(--font-th)", color: "var(--strong-green)" } }, "เคล็ดลับการสแกน")),
      React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
        tips.map((tip, i) => React.createElement("div", { key: i, style: { display: "flex", gap: 10, alignItems: "flex-start" } },
          React.createElement("span", { style: { width: 22, height: 22, borderRadius: 999, background: "var(--green-100)", color: "var(--evt-green)", font: "700 12px var(--font-en)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, i + 1),
          React.createElement("span", { style: { font: "400 14px var(--font-th)", color: "var(--fg-muted)" } }, tip.th)))));
  }

  function ScanningHint({ t, lang, scanErr, onSample, onRetry }) {
    if (scanErr) {
      const msg = scanErr === "no-ai" ? t("scan_no_ai") : t("scan_err");
      return React.createElement(window.Card, { className: "card-pad" },
        React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16 } },
          React.createElement(window.IcAlert, { size: 20, style: { color: "var(--danger)", flexShrink: 0 } }),
          React.createElement("div", { style: { font: "500 14px var(--font-th)", color: "var(--fg)" } }, msg)),
        React.createElement("div", { style: { display: "flex", gap: 10 } },
          React.createElement(window.Btn, { variant: "soft", icon: React.createElement(window.IcUpload, { size: 15 }), onClick: onRetry }, t("rescan")),
          React.createElement(window.Btn, { variant: "ghost", onClick: onSample }, t("use_sample"))));
    }
    return React.createElement(window.Card, { className: "card-pad" },
      React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
        [0, 1, 2].map((i) => React.createElement("div", { key: i, style: { display: "flex", gap: 10, alignItems: "center" } },
          React.createElement("span", { className: "spin", style: { width: 16, height: 16, border: "2px solid var(--neutral-200)", borderTopColor: "var(--evt-green)", borderRadius: "50%", display: "inline-block" } }),
          React.createElement("span", { style: { font: "400 14px var(--font-th)", color: "var(--fg-muted)" } },
            (lang === "en"
              ? ["Locating the PR header\u2026", "Reading the PR number and department\u2026", "Extracting the parts table\u2026"]
              : ["กำลังหาตำแหน่งหัวใบ PR…", "กำลังอ่านเลข PR และแผนก…", "กำลังแยกตารางรายการอะไหล่…"])[i])))));
  }

  function ReviewForm({ t, lang, form, setItem, addRow, removeRow, save, onRescan, setForm, manual }) {
    const lowCount = manual ? 0 : form.items.filter((it) => it.conf < 0.85).length;
    const head = (k, key, val, full) => React.createElement(window.Field, { label: t(k) },
      React.createElement("input", { className: "input", value: val, onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })) }));
    return React.createElement(window.Card, null,
      React.createElement(window.CardHead, {
        title: manual ? t("manual_title") : t("step_review"),
        sub: manual ? t("manual_sub") : (lowCount > 0 ? t("review_hint") : t("ocr_done")),
        right: manual ? null : React.createElement("button", { className: "linkbtn", onClick: onRescan },
          React.createElement(window.IcUpload, { size: 14 }), t("rescan")),
      }),
      React.createElement("div", { className: "card-pad" },
        lowCount > 0 ? React.createElement("div", { style: { display: "flex", gap: 9, alignItems: "center", background: "#FEFBF0", border: "1px solid var(--warning)", borderRadius: 10, padding: "10px 13px", marginBottom: 16, color: "#9a7b18", font: "500 13px var(--font-th)" } },
          React.createElement(window.IcAlert, { size: 17 }), `มี ${lowCount} ช่องที่ระบบอ่านไม่ชัด — โปรดตรวจสอบ`) : null,
        React.createElement("div", { className: "grid g-2", style: { marginBottom: 16 } },
          head("code", "prCode", form.prCode),
          head("date", "date", form.date),
          React.createElement(window.Field, { label: t("dept") },
            React.createElement("select", { className: "input", value: form.deptId, onChange: (e) => setForm((f) => ({ ...f, deptId: e.target.value })) },
              D.departments.map((d) => React.createElement("option", { key: d.id, value: d.id, title: d.detail }, `${d.id} · ${d.th}`)))),
          head("requester", "requester", form.requester)),
        React.createElement("div", { style: { marginBottom: 16 } },
          React.createElement(window.Field, { label: t("dept_detail") },
            React.createElement("div", { className: "dept-detail" }, (D.deptById(form.deptId) || {}).detail || "—"))),
        React.createElement("div", { style: { marginBottom: 16 } },
          React.createElement(window.Field, { label: t("note") },
            React.createElement("textarea", {
              className: "input", rows: 2, value: form.note || "",
              placeholder: lang === "en" ? "Notes / details (e.g. plates, model)" : "หมายเหตุ / รายละเอียด เช่น ทะเบียน รุ่นรถ",
              onChange: (e) => setForm((f) => ({ ...f, note: e.target.value })),
              style: { width: "100%", resize: "vertical", boxSizing: "border-box", font: "400 14px var(--font-th)" },
            }))),
        React.createElement("div", { style: { font: "600 11px var(--font-en)", letterSpacing: ".07em", textTransform: "uppercase", color: "var(--fg-muted)", marginBottom: 10 } }, t("item")),
        React.createElement("datalist", { id: "evt-units" },
          ["ชิ้น", "อัน", "แพค", "ชุด", "กล่อง", "ตัว", "เส้น", "ม้วน", "คู่", "ลิตร", "เมตร", "ถุง"].map((u) =>
            React.createElement("option", { key: u, value: u }))),
        form.items.map((it, i) => React.createElement(ReviewItem, { key: i, it, i, t, lang, setItem, removeRow, manual })),
        React.createElement("button", { className: "linkbtn", onClick: addRow, style: { marginTop: 4 } },
          React.createElement(window.IcPlus, { size: 15 }), t("add_row")),
        React.createElement("hr", { className: "hr", style: { margin: "18px 0" } }),
        React.createElement("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" } },
          React.createElement(window.Btn, { variant: "ghost", onClick: onRescan }, t("cancel")),
          React.createElement(window.Btn, { variant: "primary", icon: React.createElement(window.IcCheck, { size: 17 }), onClick: save }, t("save_pr")))));
  }

  function ReviewItem({ it, i, t, lang, setItem, removeRow, manual }) {
    const low = !manual && it.conf < 0.85;
    const matched = D.partByCode(it.code);
    return React.createElement("div", { className: "review-item" + (low ? " warn" : "") },
      React.createElement(window.Field, { label: t("code") },
        React.createElement("input", { className: "input mono" + (low ? " flag" : ""), value: it.code, onChange: (e) => setItem(i, "code", e.target.value) })),
      React.createElement(window.Field, { label: t("detail") },
        React.createElement("input", { className: "input", value: it.desc, onChange: (e) => setItem(i, "desc", e.target.value) })),
      React.createElement(window.Field, { label: t("qty") },
        React.createElement("input", { className: "input mono", type: "number", value: it.qty, onChange: (e) => setItem(i, "qty", e.target.value) })),
      React.createElement(window.Field, { label: t("unit") },
        React.createElement("input", { className: "input", list: "evt-units", value: it.unit || "", placeholder: "ชิ้น", onChange: (e) => setItem(i, "unit", e.target.value) })),
      React.createElement(window.Field, { label: t("warehouse") },
        React.createElement("select", { className: "input", value: it.wh, onChange: (e) => setItem(i, "wh", e.target.value) },
          D.warehouses.map((w) => React.createElement("option", { key: w.id, value: w.id }, w.no || w.id)))),
      React.createElement("div", { style: { gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: -2 } },
        manual
          ? (matched ? React.createElement("span", { className: "conf-tag conf-ok" }, React.createElement(window.IcCheck, { size: 13 }), t("matched")) : React.createElement("span"))
          : (low ? React.createElement("span", { className: "conf-tag" }, React.createElement(window.IcAlert, { size: 13 }), `${t("confidence")} ${Math.round(it.conf * 100)}% · ${t("low_conf")}`)
            : React.createElement("span", { className: "conf-tag conf-ok" }, React.createElement(window.IcCheck, { size: 13 }), matched ? t("matched") : `${t("confidence")} ${Math.round(it.conf * 100)}%`)),
        React.createElement("button", { className: "linkbtn", style: { color: "var(--danger)" }, onClick: () => removeRow(i) },
          React.createElement(window.IcX, { size: 14 }))));
  }

  // ============================================================
  //  PR REGISTRY
  // ============================================================
  function Registry({ t, lang, data, go, setDetail }) {
    const [filter, setFilter] = useState("all");
    const statuses = ["all", "pending", "ordered", "partial", "received", "closed"];
    const rows = data.prs.filter((p) => filter === "all" || p.status === filter);
    return React.createElement("div", { className: "page fadein" },
      React.createElement("div", { className: "page-head" },
        React.createElement("div", null,
          React.createElement("div", { className: "eyebrow" }, "REGISTRY"),
          React.createElement("h1", null, t("reg_title")),
          React.createElement("p", null, t("reg_sub"))),
        React.createElement(window.Btn, { variant: "primary", icon: React.createElement(window.IcScan, { size: 16 }), onClick: () => go("openpr") }, t("nav_openpr"))),
      React.createElement("div", { className: "cat-row" },
        statuses.map((s) => React.createElement("button", { key: s, className: "cat-pill" + (filter === s ? " on" : ""), onClick: () => setFilter(s) },
          s === "all" ? t("all") : t("st_" + s)))),
      React.createElement(window.Card, null,
        React.createElement("table", { className: "tbl" },
          React.createElement("thead", null, React.createElement("tr", null,
            [t("code"), t("date"), t("dept"), t("requester"), t("item"), t("ordered_vs"), t("status"), ""].map((h, i) =>
              React.createElement("th", { key: i, className: i === 4 || i === 5 ? "num" : "" }, h)))),
          React.createElement("tbody", null,
            rows.map((pr) => {
              const tot = window.prTotals(pr);
              const dep = D.deptById(pr.dept);
              return React.createElement("tr", { key: pr.id, className: "clickable", onClick: () => setDetail(pr.id) },
                React.createElement("td", { className: "code" }, pr.id, pr.scanned ? React.createElement("span", { title: "สแกนจากใบ PR", style: { marginLeft: 6, color: "var(--new-day-green)", verticalAlign: "middle", display: "inline-flex" } }, React.createElement(window.IcScan, { size: 13 })) : null),
                React.createElement("td", { className: "mono", style: { color: "var(--fg-muted)" } }, fmtDate(pr.date, lang)),
                React.createElement("td", null, lang === "en" ? dep.en : dep.th),
                React.createElement("td", null, pr.requester),
                React.createElement("td", { className: "num" }, tot.lines),
                React.createElement("td", { className: "num" },
                  React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" } },
                    React.createElement("span", { className: "mono", style: { color: "var(--fg-muted)", fontSize: 13 } }, `${tot.received}/${tot.ordered}`),
                    React.createElement("div", { style: { width: 54 } }, React.createElement(window.Meter, { value: tot.received, max: tot.ordered })))),
                React.createElement("td", null, React.createElement(window.StatusBadge, { status: pr.status, t })),
                React.createElement("td", null, React.createElement(window.IcChevR, { size: 16, style: { color: "var(--fg-subtle)" } })));
            })))));
  }

  function fmtDate(iso, lang) {
    const d = new Date(iso + "T00:00:00");
    const m = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const me = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (lang === "en") return `${me[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear() + 543}`;
  }

  Object.assign(window, { OpenPR, Registry, fmtDate });
})();
