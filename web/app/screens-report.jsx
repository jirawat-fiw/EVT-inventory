/* EVT — Withdraw + issue slip, PR detail modal, Monthly report */
(function () {
  const { useState, useEffect } = React;
  const D = window.EVTDATA;
  const fmtDate = window.fmtDate;

  // ============================================================
  //  WITHDRAW
  // ============================================================
  function Withdraw({ t, lang, data, actions, setToast, role, pickerStyle }) {
    const WD_DRAFT = "evt_draft_wd";
    const _wd = (() => { try { return JSON.parse(localStorage.getItem(WD_DRAFT) || "null") || {}; } catch (e) { return {}; } })();
    const [cart, setCart] = useState(() => _wd.cart || []); // [{code, qty}]
    const [vehicle, setVehicle] = useState(() => _wd.vehicle || "");
    const [job, setJob] = useState(() => _wd.job || "");
    const [jobTitle, setJobTitle] = useState(() => _wd.jobTitle || "");
    const [slip, setSlip] = useState(null);
    const [cat, setCat] = useState("ทั้งหมด");
    const [q, setQ] = useState("");
    const [scan, setScan] = useState(false);
    const [wh, setWh] = useState("");
    const [busy, setBusy] = useState(false);
    const cats = ["ทั้งหมด", ...Array.from(new Set(data.parts.map((p) => p.cat)))];
    const whList = window.whWithData(data.warehouses, new Set(data.parts.map((p) => p.wh)));
    // เก็บร่างตะกร้าเบิกอัตโนมัติ (กันหายตอนรีโหลด/มือถือล้างแท็บ)
    useEffect(() => {
      try { localStorage.setItem(WD_DRAFT, JSON.stringify({ cart, vehicle, job, jobTitle })); } catch (e) {}
    }, [cart, vehicle, job, jobTitle]);

    function add(code) { setCart((c) => c.find((x) => x.code === code) ? c : [...c, { code, qty: 1 }]); }
    function setQty(code, q) { setCart((c) => c.map((x) => x.code === code ? { ...x, qty: Math.max(1, q) } : x)); }
    function remove(code) { setCart((c) => c.filter((x) => x.code !== code)); }

    async function submit() {
      if (!cart.length || busy) return;
      // กันเบิกเกินสต็อก
      const over = cart.find((c) => { const p = D.partByCode(c.code); return p && c.qty > p.stock; });
      if (over) { setToast(lang === "en" ? "Over stock — please adjust qty" : "มีรายการเบิกเกินสต็อก โปรดแก้ไขจำนวน"); return; }
      // เตือนจำนวนมากผิดปกติ (กันพิมพ์เกิน เช่น 100 แทน 10)
      const big = cart.find((c) => c.qty >= 100);
      if (big && !window.confirm((lang === "en" ? "Confirm large withdrawal of " : "ยืนยันเบิกจำนวนมาก ") + big.qty + (lang === "en" ? " units?" : " หน่วย?"))) return;
      setBusy(true);
      try {
        const lines = cart.map((c) => ({ code: c.code, qty: c.qty, part: D.partByCode(c.code) }));
        const ids = await actions.withdrawAndGet(cart, { vehicle, job, jobTitle, by: data.currentUser });
        setSlip({
          id: (ids && ids.length ? ids.join(", ") : "—"),
          date: new Date().toISOString().slice(0, 10), by: data.currentUser,
          vehicle, job, jobTitle, lines,
        });
        setToast(t("wd_done"));
        setCart([]); setVehicle(""); setJob(""); setJobTitle("");
      } catch (e) {
        setToast((lang === "en" ? "Withdraw failed: " : "เบิกไม่สำเร็จ: ") + (e && e.message || ""));
      } finally { setBusy(false); }
    }

    // จัดกลุ่มประวัติการเบิกเป็น "ครั้งที่เบิกจริง" (แต่ละครั้งที่กดบันทึก = 1 ใบ)
    // ใช้ created_at (เวลา transaction) เป็นตัวแยก batch — เบิกของเดิมซ้ำในวัน/งานเดียวกันจึงไม่ถูกยุบรวม
    const histGroups = [];
    const _gmap = {};
    (data.issues || []).forEach((iss) => {
      const key = iss.createdAt || iss.id;
      let g = _gmap[key];
      if (!g) { g = _gmap[key] = { key, date: iss.date, job: iss.job, vehicle: iss.vehicle, by: iss.by, jobTitle: iss.jobTitle, dept: iss.dept, ids: [], lines: [], qty: 0 }; histGroups.push(g); }
      g.ids.push(iss.id); g.qty += (iss.qty || 0);
      g.lines.push({ code: iss.code, qty: iss.qty, part: D.partByCode(iss.code) || { th: iss.code, en: iss.code, unit: "" } });
    });
    function reprint(g) {
      setSlip({ id: g.ids[0], date: g.date, by: g.by, dept: g.dept,
        vehicle: (g.vehicle && g.vehicle !== "—") ? g.vehicle : "", job: g.job, jobTitle: g.jobTitle, lines: g.lines });
    }

    if (slip) return React.createElement(IssueSlip, { t, lang, slip, role, onBack: () => setSlip(null) });

    const qq = q.trim().toLowerCase();
    const list = data.parts.filter((p) =>
      (cat === "ทั้งหมด" || p.cat === cat)
      && (wh === "" || p.wh === wh)
      && (!qq || p.code.toLowerCase().includes(qq) || (p.th || "").toLowerCase().includes(qq) || (p.en || "").toLowerCase().includes(qq)));

    function handleScan(code) {
      const parsed = window.parseLabelQR ? window.parseLabelQR(code) : { code: String(code).trim(), pr: null, unit: null };
      const norm = parsed.code;
      const p = D.partByCode(norm) || data.parts.find((x) => x.code.toLowerCase() === norm.toLowerCase());
      if (!p) return false;
      add(p.code);
      setToast(t("scan_added") + " · " + p.code
        + (parsed.pr ? " · " + parsed.pr : "")
        + (parsed.unit ? " · " + (lang === "en" ? "pc " : "ชิ้น ") + parsed.unit : ""));
      setScan(false);
      return true;
    }

    return React.createElement("div", { className: "page fadein" },
      React.createElement("div", { className: "page-head" },
        React.createElement("div", null,
          React.createElement("div", { className: "eyebrow" }, "WITHDRAW"),
          React.createElement("h1", null, t("wd_title")),
          React.createElement("p", null, t("wd_sub")))),
      React.createElement("div", { className: "grid resp-grid", style: { gridTemplateColumns: "1.5fr 1fr", alignItems: "start" } },
        // picker
        React.createElement(window.Card, null,
          React.createElement(window.CardHead, { title: t("wd_pick") }),
          React.createElement("div", { className: "card-pad" },
            React.createElement("div", { style: { display: "flex", gap: 10, marginBottom: 14 } },
              React.createElement("div", { className: "search", style: { flex: 1, border: "1.5px solid var(--border)", background: "#fff" } },
                React.createElement(window.IcSearch, { size: 17 }),
                React.createElement("input", { value: q, onChange: (e) => setQ(e.target.value), placeholder: t("wd_search") })),
              React.createElement(window.Btn, { variant: "soft", icon: React.createElement(window.IcScan, { size: 16 }), onClick: () => setScan(true) }, t("scan_qr"))),
            React.createElement(window.WarehouseFilter, { value: wh, onChange: setWh, list: whList, lang, allLabel: lang === "en" ? "All warehouses" : "ทุกคลัง" }),
            React.createElement("div", { className: "cat-row" },
              cats.map((c) => React.createElement("button", { key: c, className: "cat-pill" + (cat === c ? " on" : ""), onClick: () => setCat(c) }, c === "ทั้งหมด" ? t("all") : c))),
            React.createElement("div", { className: pickerStyle === "grid" ? "grid g-2" : "", style: pickerStyle === "grid" ? { gap: 10 } : { display: "flex", flexDirection: "column", gap: 8 } },
              list.length === 0
                ? React.createElement("div", { style: { padding: "22px 4px", textAlign: "center", font: "400 13px var(--font-th)", color: "var(--fg-subtle)" } }, t("wd_no_result"))
                : list.map((p) => {
                const inCart = cart.find((x) => x.code === p.code);
                return React.createElement("div", { key: p.code, style: { display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 11, background: inCart ? "var(--green-50)" : "#fff" } },
                  React.createElement("div", { style: { flex: 1 } },
                    React.createElement("div", { style: { font: "500 14px var(--font-th)" } }, lang === "en" ? p.en : p.th),
                    React.createElement("div", { className: "mono", style: { font: "600 11px var(--font-en)", color: "var(--evt-green)" } }, p.code)),
                  React.createElement("span", { style: { font: "400 12px var(--font-th)", color: p.stock < p.min ? "var(--danger)" : "var(--fg-subtle)" } }, t("wd_onhand") + " ", React.createElement("b", { className: "mono" }, p.stock)),
                  inCart ? React.createElement(window.Badge, { kind: "received" }, React.createElement(window.IcCheck, { size: 13 }))
                    : React.createElement(window.Btn, { variant: "soft", size: "sm", icon: React.createElement(window.IcPlus, { size: 14 }), onClick: () => add(p.code) }, ""));
              })))),
        // cart
        React.createElement(window.Card, null,
          React.createElement(window.CardHead, { title: t("wd_cart"), sub: cart.length + " " + t("item") }),
          React.createElement("div", { className: "card-pad" },
            cart.length === 0
              ? React.createElement("div", { style: { textAlign: "center", padding: "30px 0", color: "var(--fg-subtle)" } },
                  React.createElement(window.IcWithdraw, { size: 30, style: { opacity: .4 } }),
                  React.createElement("p", { style: { font: "400 14px var(--font-th)", marginTop: 8 } }, t("wd_empty")))
              : React.createElement(React.Fragment, null,
                  cart.map((c) => {
                    const p = D.partByCode(c.code);
                    const over = p && c.qty > p.stock;
                    return React.createElement("div", { key: c.code, className: "cart-item" },
                      React.createElement("div", { className: "ci-main" },
                        React.createElement("b", null, lang === "en" ? p.en : p.th),
                        React.createElement("small", { className: "mono" }, c.code),
                        over ? React.createElement("small", { style: { color: "var(--danger)", fontWeight: 600 } }, (lang === "en" ? "Over stock! left " : "เกินสต็อก! เหลือ ") + p.stock) : null),
                      React.createElement("div", { className: "rcv-stepper" },
                        React.createElement("button", { onClick: () => setQty(c.code, c.qty - 1) }, "−"),
                        React.createElement("input", { className: "mono", value: c.qty, onChange: (e) => setQty(c.code, parseInt(e.target.value) || 1) }),
                        React.createElement("button", { onClick: () => setQty(c.code, c.qty + 1) }, "+")),
                      React.createElement("button", { className: "linkbtn", style: { color: "var(--danger)" }, onClick: () => remove(c.code) }, React.createElement(window.IcX, { size: 15 })));
                  }),
                  React.createElement("hr", { className: "hr", style: { margin: "8px 0 16px" } }),
                  React.createElement("div", { style: { font: "600 12px var(--font-th)", color: "var(--fg-muted)", marginBottom: 10 } }, t("wd_link_job")),
                  React.createElement("div", { className: "grid g-2", style: { gap: 12, marginBottom: 12 } },
                    React.createElement(window.Field, { label: t("wd_vehicle") },
                      React.createElement(window.SearchSelect, {
                        value: vehicle,
                        onChange: setVehicle,
                        noneLabel: t("wd_no_job"),
                        placeholder: t("veh_search"),
                        options: data.vehicles.map((v) => ({
                          value: v.id,
                          label: `${v.id} · ${v.plate}`,
                          sub: [v.route, v.chassis].filter(Boolean).join(" · "),
                          search: `${v.chassis} ${v.model || ""}`,
                        })),
                      })),
                    React.createElement(window.Field, { label: t("wd_job") },
                      React.createElement("input", { className: "input mono", placeholder: "JOB-____", value: job, onChange: (e) => setJob(e.target.value) }))),
                  React.createElement(window.Field, { label: t("wd_for") },
                    React.createElement("input", { className: "input", placeholder: lang === "en" ? "e.g. Replace front brake pads" : "เช่น เปลี่ยนผ้าเบรกหน้า", value: jobTitle, onChange: (e) => setJobTitle(e.target.value) })),
                  React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0" } },
                    React.createElement("span", { style: { font: "400 13px var(--font-th)", color: "var(--fg-subtle)" } }, t("item")),
                    React.createElement("b", { className: "mono", style: { font: "800 22px var(--font-en)", color: "var(--strong-green)" } }, cart.reduce((s, c) => s + c.qty, 0) + " " + t("pieces"))),
                  React.createElement(window.Btn, { variant: "primary", block: true, disabled: busy, icon: React.createElement(window.IcFile, { size: 17 }), onClick: submit }, busy ? (lang === "en" ? "Saving…" : "กำลังบันทึก…") : t("wd_submit")))))),
      React.createElement(window.Card, { style: { marginTop: 18 } },
        React.createElement(window.CardHead, { title: t("wd_history"), sub: histGroups.length + " " + t("item") }),
        React.createElement("div", { className: "card-pad" },
          histGroups.length === 0
            ? React.createElement("div", { style: { textAlign: "center", padding: "20px 0", color: "var(--fg-subtle)", font: "400 13px var(--font-th)" } }, t("wd_empty"))
            : histGroups.slice(0, 40).map((g, gi) => {
                const veh = (g.vehicle && g.vehicle !== "—") ? D.vehById(g.vehicle) : null;
                const last = Math.min(histGroups.length, 40) - 1;
                return React.createElement("div", { key: g.key, style: { display: "flex", alignItems: "center", gap: 12, padding: "11px 2px", borderBottom: gi < last ? "1px solid var(--neutral-100)" : "0" } },
                  React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                    React.createElement("div", { style: { font: "600 13px var(--font-th)" } }, fmtDate(g.date, lang) + (g.job ? " · " + g.job : "") + (veh ? " · " + veh.id : "")),
                    React.createElement("div", { className: "mono", style: { font: "500 11px var(--font-en)", color: "var(--fg-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, g.lines.length + " " + t("item") + " · " + g.ids.join(", "))),
                  React.createElement("span", { className: "mono", style: { font: "700 14px var(--font-en)", color: "var(--strong-green)", flexShrink: 0 } }, g.qty + " " + t("pieces")),
                  React.createElement(window.Btn, { variant: "ghost", size: "sm", icon: React.createElement(window.IcPrint, { size: 14 }), onClick: () => reprint(g) }, t("wd_reprint")));
              }))),
      scan ? React.createElement(window.ScanQRModal, {
        t,
        onClose: () => setScan(false),
        onCode: handleScan,
        samples: data.parts.slice(0, 4).map((p) => p.code),
      }) : null);
  }

  // ---- Issue slip (printable) ----
  function IssueSlip({ t, lang, slip, role, onBack }) {
    const deptLabel = lang === "en" ? "Maintenance Dept." : "แผนกซ่อมบำรุง"; // ป้ายคงที่บนใบปริ้น
    const veh = slip.vehicle ? D.vehById(slip.vehicle) : null;
    return React.createElement("div", { className: "page fadein" },
      React.createElement("div", { className: "page-head no-print" },
        React.createElement("div", null,
          React.createElement("div", { className: "eyebrow" }, "ISSUE SLIP"),
          React.createElement("h1", null, t("wd_done"))),
        React.createElement("div", { style: { display: "flex", gap: 10 } },
          React.createElement(window.Btn, { variant: "ghost", icon: React.createElement(window.IcArrowR, { size: 16, style: { transform: "rotate(180deg)" } }), onClick: onBack }, t("back")),
          React.createElement(window.Btn, { variant: "ghost", icon: React.createElement(window.IcPrint, { size: 16 }), onClick: () => window.print() }, t("print")),
          React.createElement(window.Btn, { variant: "primary", icon: React.createElement(window.IcDownload, { size: 16 }), onClick: () => window.print() }, t("download")))),
      React.createElement("div", { className: "doc-sheet" },
        React.createElement("div", { className: "doc-head" },
          React.createElement("div", null,
            React.createElement("img", { src: "assets/logo-evt.png", alt: "EVT" }),
            React.createElement("div", { className: "dh-co" }, t("company"), React.createElement("small", null, "Electric Bus (Thailand) Public Co., Ltd."))),
          React.createElement("div", { className: "dh-title" },
            React.createElement("b", null, t("wd_slip")),
            React.createElement("span", null, "PARTS ISSUE SLIP"))),
        React.createElement("div", { className: "doc-meta" },
          docM(t("issue_no"), slip.id, true),
          docM(t("date"), fmtDate(slip.date, lang)),
          docM(t("dept"), deptLabel),
          docM(t("wd_vehicle"), veh ? `${veh.id} (${veh.plate})` : t("wd_no_job")),
          docM(t("chassis"), veh ? veh.chassis : "—", true),
          docM(t("wd_job"), slip.job || "—", true)),
        slip.jobTitle ? React.createElement("div", { style: { background: "var(--green-50)", borderRadius: 10, padding: "10px 14px", marginBottom: 18, font: "500 13px var(--font-th)", color: "var(--strong-green)" } }, t("wd_for") + ": " + slip.jobTitle) : null,
        React.createElement("table", { className: "doc-tbl" },
          React.createElement("thead", null, React.createElement("tr", null,
            React.createElement("th", null, "#"), React.createElement("th", null, t("code")), React.createElement("th", null, t("detail")),
            React.createElement("th", { className: "num" }, t("qty")))),
          React.createElement("tbody", null,
            slip.lines.map((l, i) => {
              const part = l.part || { th: l.code, en: l.code, unit: "" };
              return React.createElement("tr", { key: l.code },
                React.createElement("td", null, i + 1),
                React.createElement("td", { className: "mono", style: { fontWeight: 600 } }, l.code),
                React.createElement("td", null, lang === "en" ? part.en : part.th),
                React.createElement("td", { className: "num" }, l.qty + " " + part.unit));
            })),
          React.createElement("tfoot", null, React.createElement("tr", null,
            React.createElement("td", { colSpan: 3, className: "num" }, t("total")),
            React.createElement("td", { className: "num" }, slip.lines.reduce((s, l) => s + l.qty, 0) + " " + t("pieces"))))),
        React.createElement("div", { className: "doc-sign" },
          docSign(t("issued_by"), slip.by),
          docSign(t("receiver"), ""),
          docSign(t("approver"), ""),
          docSign(t("role_acct"), "")),
        React.createElement("div", { className: "doc-foot" }, t("tagline"))));
  }
  function docM(label, val, mono) {
    return React.createElement("div", { className: "m" }, React.createElement("span", null, label),
      React.createElement("b", { className: mono ? "mono" : "", style: { fontWeight: 600 } }, val));
  }
  function docSign(label, name) {
    return React.createElement("div", { className: "s" },
      React.createElement("div", { className: "line" }), React.createElement("span", null, label, name ? " · " + name : ""));
  }

  // ============================================================
  //  PR DETAIL MODAL
  // ============================================================
  function PRDetail({ t, lang, data, prId, onClose, go, actions, isAdmin, setToast }) {
    const pr = data.prs.find((p) => p.id === prId);
    const [edit, setEdit] = useState(false);
    if (!pr) return null;
    const dep = D.deptById(pr.dept);
    const tot = window.prTotals(pr);

    if (edit && isAdmin) {
      return React.createElement(PREditForm, {
        t, lang, pr, onCancel: () => setEdit(false),
        onSave: async (draft) => {
          await actions.updatePR(draft);
          setToast && setToast(lang === "en" ? "PR updated" : "บันทึกการแก้ไขแล้ว");
          onClose();
        },
      });
    }

    return React.createElement(window.Modal, { onClose, max: 680 },
      React.createElement("div", { className: "card-head", style: { position: "sticky", top: 0, background: "#fff", zIndex: 2 } },
        React.createElement("div", null,
          React.createElement("h3", { style: { display: "flex", alignItems: "center", gap: 10 } }, React.createElement("span", { className: "mono", style: { color: "var(--evt-green)" } }, pr.id), React.createElement(window.StatusBadge, { status: pr.status, t })),
          React.createElement("div", { className: "sub" }, fmtDate(pr.date, lang) + " · " + (lang === "en" ? dep.en : dep.th))),
        React.createElement("button", { className: "linkbtn", onClick: onClose }, React.createElement(window.IcX, { size: 18 }))),
      React.createElement("div", { className: "card-pad" },
        React.createElement("div", { className: "grid g-2", style: { gap: 10, marginBottom: 16 } },
          metaBit(t("requester"), pr.requester), metaBit(t("unit"), pr.requesterUnit),
          metaBit(t("item"), tot.lines + " " + t("item")), metaBit(t("qty"), tot.ordered + " " + t("pieces"))),
        pr.note ? React.createElement("div", { style: { background: "var(--neutral-50)", borderRadius: 10, padding: "10px 13px", marginBottom: 16, font: "400 13px var(--font-th)", color: "var(--fg-muted)" } }, t("note") + ": " + pr.note) : null,
        React.createElement("table", { className: "tbl" },
          React.createElement("thead", null, React.createElement("tr", null,
            [t("code"), t("detail"), t("warehouse"), t("ordered_vs"), t("used_qty")].map((h, i) => React.createElement("th", { key: i, className: i >= 3 ? "num" : "" }, h)))),
          React.createElement("tbody", null,
            pr.items.map((it) => {
              const p = D.partByCode(it.code);
              return React.createElement("tr", { key: it.code },
                React.createElement("td", { className: "code" }, it.code),
                React.createElement("td", null, p ? (lang === "en" ? p.en : p.th) : it.code),
                React.createElement("td", { style: { color: "var(--fg-muted)", fontSize: 13 } }, it.wh),
                React.createElement("td", { className: "num" },
                  React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 7, justifyContent: "flex-end" } },
                    React.createElement("span", { className: "mono", style: { fontSize: 13, color: "var(--fg-muted)" } }, `${it.received}/${it.qty}`),
                    React.createElement("div", { style: { width: 44 } }, React.createElement(window.Meter, { value: it.received, max: it.qty })))),
                React.createElement("td", { className: "num mono", style: { color: it.used > 0 ? "var(--strong-green)" : "var(--fg-subtle)" } }, it.used));
            }))),
        React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", marginTop: 18 } },
          isAdmin ? React.createElement(window.Btn, { variant: "ghost", icon: React.createElement(window.IcEdit, { size: 16 }), onClick: () => setEdit(true) }, lang === "en" ? "Edit" : "แก้ไข") : null,
          React.createElement("div", { style: { flex: 1 } }),
          (pr.status === "ordered" || pr.status === "partial") ? React.createElement(window.Btn, { variant: "primary", icon: React.createElement(window.IcReceive, { size: 16 }), onClick: () => { onClose(); go("receive"); } }, t("nav_receive")) : null,
          React.createElement(window.Btn, { variant: "ghost", onClick: onClose }, t("close")))));
  }

  // ---- แก้ไขใบ PR (แอดมิน) — หัวเอกสาร + รายการ (คงยอดรับ/เบิก) ----
  function PREditForm({ t, lang, pr, onCancel, onSave }) {
    const nameOf = (code) => { const p = D.partByCode(code); return p ? (lang === "en" ? p.en : p.th) : code; };
    const [f, setF] = useState(() => ({
      date: pr.date, dept: pr.dept, requester: pr.requester || "", requesterUnit: pr.requesterUnit || "", note: pr.note || "",
      items: pr.items.map((it) => ({ code: it.code, desc: nameOf(it.code), qty: it.qty, received: it.received || 0, used: it.used || 0, wh: it.wh, unit: it.unit || "" })),
    }));
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);
    const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
    const setItem = (i, k, v) => setF((s) => { const items = s.items.slice(); items[i] = { ...items[i], [k]: v }; return { ...s, items }; });
    const removeItem = (i) => setF((s) => ({ ...s, items: s.items.filter((_, x) => x !== i) }));
    const addItem = (code) => setF((s) => {
      if (!code || s.items.some((it) => it.code === code)) return s;
      const p = D.partByCode(code) || {};
      return { ...s, items: [...s.items, { code, desc: nameOf(code), qty: 1, received: 0, used: 0, wh: p.wh || "WH-01", unit: p.unit || "ชิ้น" }] };
    });
    // เพิ่มบรรทัดเปล่า — กรอกรหัสใหม่เองได้ (เหมือนตอนเปิด PR) ระบบจะสร้างอะไหล่ให้อัตโนมัติตอนบันทึก
    const addBlank = () => setF((s) => ({ ...s, items: [...s.items, { code: "", desc: "", qty: 1, received: 0, used: 0, wh: "WH-01", unit: "ชิ้น", isNew: true }] }));

    const whOpts = (D.warehouses || []).map((w) => ({ value: w.id, label: w.no || w.id, sub: lang === "en" ? w.en : w.th }));
    const partOpts = (D.parts || []).map((p) => ({ value: p.code, label: p.code, sub: lang === "en" ? p.en : p.th, search: (p.th || "") + " " + (p.en || "") }));

    async function submit() {
      if (!f.requester.trim()) { setErr(lang === "en" ? "Requester is required" : "กรุณากรอกผู้ขอเบิก"); return; }
      if (!f.items.length) { setErr(lang === "en" ? "Add at least one item" : "ต้องมีอย่างน้อย 1 รายการ"); return; }
      setErr(null); setBusy(true);
      try {
        await onSave({
          id: pr.id, date: f.date, dept: f.dept, requester: f.requester.trim(),
          requesterUnit: f.requesterUnit.trim(), note: f.note.trim(),
          items: f.items.map((it) => ({ code: it.code, desc: it.desc, qty: Number(it.qty) || 0, wh: it.wh, unit: it.unit })),
        });
      } catch (e) { setErr((e && e.message) || String(e)); setBusy(false); }
    }

    const fieldLbl = { font: "600 11px var(--font-en)", letterSpacing: ".06em", textTransform: "uppercase", color: "var(--fg-muted)", marginBottom: 5, display: "block" };
    const cols = "1fr 62px 78px 96px 30px"; // อะไหล่ · จำนวน · หน่วย · คลัง · ลบ
    const colHead = { font: "600 10px var(--font-en)", letterSpacing: ".04em", textTransform: "uppercase", color: "var(--fg-subtle)", textAlign: "center" };

    return React.createElement(window.Modal, { onClose: onCancel, max: 720 },
      React.createElement("div", { className: "card-head", style: { position: "sticky", top: 0, background: "#fff", zIndex: 2 } },
        React.createElement("div", null,
          React.createElement("h3", { style: { display: "flex", alignItems: "center", gap: 10 } },
            (lang === "en" ? "Edit PR " : "แก้ไข PR "), React.createElement("span", { className: "mono", style: { color: "var(--evt-green)" } }, pr.id)),
          React.createElement("div", { className: "sub" }, lang === "en" ? "Received quantities stay locked" : "ยอดที่รับ/เบิกไปแล้วจะถูกล็อกไว้")),
        React.createElement("button", { className: "linkbtn", onClick: onCancel }, React.createElement(window.IcX, { size: 18 }))),
      React.createElement("div", { className: "card-pad" },
        // ---- header fields ----
        React.createElement("div", { className: "grid g-2", style: { gap: 12, marginBottom: 12 } },
          React.createElement("div", null, React.createElement("label", { style: fieldLbl }, t("date")),
            React.createElement("input", { type: "date", className: "input", value: f.date || "", onChange: (e) => set("date", e.target.value) })),
          React.createElement("div", null, React.createElement("label", { style: fieldLbl }, t("dept")),
            React.createElement("select", { className: "input", value: f.dept || "", onChange: (e) => set("dept", e.target.value) },
              (D.departments || []).map((d) => React.createElement("option", { key: d.id, value: d.id }, d.id + " · " + d.th))))),
        React.createElement("div", { style: { marginBottom: 12 } },
          React.createElement("label", { style: fieldLbl }, t("requester")),
          React.createElement("input", { className: "input", value: f.requester, onChange: (e) => set("requester", e.target.value) })),
        React.createElement("div", { style: { marginBottom: 18 } }, React.createElement("label", { style: fieldLbl }, t("note")),
          React.createElement("textarea", { className: "input", rows: 2, value: f.note, onChange: (e) => set("note", e.target.value) })),

        // ---- items ----
        React.createElement("label", { style: fieldLbl }, lang === "en" ? "Items" : "รายการอะไหล่"),
        // หัวคอลัมน์ให้รู้ว่าช่องไหนคืออะไร
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: cols, gap: 8, padding: "0 10px 6px", alignItems: "end" } },
          React.createElement("span", { style: { font: "600 10px var(--font-en)", letterSpacing: ".04em", textTransform: "uppercase", color: "var(--fg-subtle)" } }, lang === "en" ? "Item" : "อะไหล่"),
          React.createElement("span", { style: colHead }, t("qty")),
          React.createElement("span", { style: colHead }, lang === "en" ? "Unit" : "หน่วย"),
          React.createElement("span", { style: colHead }, t("warehouse")),
          React.createElement("span", null)),
        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 } },
          f.items.map((it, i) => {
            const locked = (it.received || 0) > 0 || (it.used || 0) > 0;
            const nameCell = it.isNew
              ? React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 } },
                  React.createElement("input", { className: "input mono", value: it.code, placeholder: lang === "en" ? "New code" : "รหัสใหม่", style: { padding: "6px 8px" }, onChange: (e) => setItem(i, "code", e.target.value) }),
                  React.createElement("input", { className: "input", value: it.desc, placeholder: lang === "en" ? "Description" : "รายละเอียด", style: { padding: "6px 8px" }, onChange: (e) => setItem(i, "desc", e.target.value) }))
              : React.createElement("div", { style: { minWidth: 0 } },
                  React.createElement("div", { style: { font: "500 13px var(--font-th)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, it.desc),
                  React.createElement("div", { className: "mono", style: { font: "600 11px var(--font-en)", color: "var(--evt-green)" } }, it.code + (locked ? (lang === "en" ? " · received " : " · รับแล้ว ") + it.received : "")));
            return React.createElement("div", { key: i, style: { display: "grid", gridTemplateColumns: cols, gap: 8, alignItems: it.isNew ? "start" : "center", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 10, background: it.isNew ? "var(--green-50)" : "var(--neutral-50)" } },
              nameCell,
              React.createElement("input", { className: "input mono", type: "number", min: it.received || 0, value: it.qty, title: locked ? (lang === "en" ? "Min = received qty" : "ต่ำกว่ายอดรับไม่ได้") : "", style: { padding: "8px 6px", textAlign: "center" }, onChange: (e) => setItem(i, "qty", Math.max(Number(e.target.value) || 0, it.received || 0)) }),
              React.createElement("input", { className: "input", list: "evt-edit-units", value: it.unit || "", placeholder: "ชิ้น", style: { padding: "8px 6px", textAlign: "center" }, onChange: (e) => setItem(i, "unit", e.target.value) }),
              React.createElement("select", { className: "input", value: it.wh || "", style: { padding: "8px 6px" }, onChange: (e) => setItem(i, "wh", e.target.value) },
                (D.warehouses || []).map((w) => React.createElement("option", { key: w.id, value: w.id }, w.no || w.id))),
              React.createElement("button", {
                className: "linkbtn", disabled: locked, title: locked ? (lang === "en" ? "Already received/issued — cannot remove" : "รับ/เบิกไปแล้ว ลบไม่ได้") : (lang === "en" ? "Remove" : "ลบ"),
                style: { justifySelf: "center", alignSelf: it.isNew ? "start" : "center", marginTop: it.isNew ? 7 : 0, color: locked ? "var(--neutral-300)" : "var(--danger)", cursor: locked ? "not-allowed" : "pointer" },
                onClick: () => { if (!locked) removeItem(i); },
              }, React.createElement(window.IcX, { size: 16 })));
          })),
        React.createElement("datalist", { id: "evt-edit-units" },
          ["ชิ้น", "อัน", "แพค", "ชุด", "กล่อง", "ตัว", "เส้น", "ม้วน", "คู่", "ลิตร", "เมตร", "ถุง"].map((u) =>
            React.createElement("option", { key: u, value: u }))),
        React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" } },
          React.createElement("div", { style: { flex: 1, minWidth: 220 } },
            React.createElement(window.SearchSelect, { value: "", onChange: addItem, options: partOpts, placeholder: lang === "en" ? "+ Add from catalog…" : "+ เพิ่มจากคลัง…" })),
          React.createElement(window.Btn, { variant: "soft", size: "sm", icon: React.createElement(window.IcPlus, { size: 15 }), onClick: addBlank }, lang === "en" ? "New code" : "เพิ่มรหัสใหม่")),

        err ? React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", color: "var(--danger)", font: "500 13px var(--font-th)", marginBottom: 12 } },
          React.createElement(window.IcAlert, { size: 16 }), err) : null,

        React.createElement("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end" } },
          React.createElement(window.Btn, { variant: "ghost", onClick: onCancel, disabled: busy }, lang === "en" ? "Cancel" : "ยกเลิก"),
          React.createElement(window.Btn, { variant: "primary", icon: React.createElement(window.IcCheck, { size: 16 }), onClick: submit, disabled: busy }, busy ? (lang === "en" ? "Saving…" : "กำลังบันทึก…") : (lang === "en" ? "Save" : "บันทึก")))));
  }
  function metaBit(label, val) {
    return React.createElement("div", null,
      React.createElement("div", { style: { font: "600 10px var(--font-en)", letterSpacing: ".07em", textTransform: "uppercase", color: "var(--fg-subtle)", marginBottom: 3 } }, label),
      React.createElement("div", { style: { font: "500 14px var(--font-th)", color: "var(--fg)" } }, val));
  }

  Object.assign(window, { Withdraw, PRDetail });
})();
