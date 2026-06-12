/* EVT — Withdraw + issue slip, PR detail modal, Monthly report */
(function () {
  const { useState } = React;
  const D = window.EVTDATA;
  const fmtDate = window.fmtDate;

  // ============================================================
  //  WITHDRAW
  // ============================================================
  function Withdraw({ t, lang, data, actions, setToast, role, pickerStyle }) {
    const [cart, setCart] = useState([]); // [{code, qty}]
    const [vehicle, setVehicle] = useState("");
    const [job, setJob] = useState("");
    const [jobTitle, setJobTitle] = useState("");
    const [slip, setSlip] = useState(null);
    const [cat, setCat] = useState("ทั้งหมด");
    const [q, setQ] = useState("");
    const [scan, setScan] = useState(false);
    const cats = ["ทั้งหมด", ...Array.from(new Set(data.parts.map((p) => p.cat)))];

    function add(code) { setCart((c) => c.find((x) => x.code === code) ? c : [...c, { code, qty: 1 }]); }
    function setQty(code, q) { setCart((c) => c.map((x) => x.code === code ? { ...x, qty: Math.max(1, q) } : x)); }
    function remove(code) { setCart((c) => c.filter((x) => x.code !== code)); }

    function submit() {
      const issue = actions.withdraw(cart, { vehicle, job, jobTitle, by: data.currentUser });
      setSlip({ ...issue, lines: cart.map((c) => ({ ...c, part: D.partByCode(c.code) })), vehicle, job, jobTitle });
      setToast(t("wd_done"));
      setCart([]); setVehicle(""); setJob(""); setJobTitle("");
    }

    // จัดกลุ่มประวัติการเบิกเป็น "ครั้ง" (วันที่+งาน+รถ+ผู้เบิก) เพื่อพิมพ์ใบเบิกย้อนหลัง
    const histGroups = [];
    const _gmap = {};
    (data.issues || []).forEach((iss) => {
      const key = [iss.date, iss.job || "", iss.vehicle || "", iss.by || ""].join("|");
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
      && (!qq || p.code.toLowerCase().includes(qq) || (p.th || "").toLowerCase().includes(qq) || (p.en || "").toLowerCase().includes(qq)));

    function handleScan(code) {
      const norm = String(code).trim();
      const p = D.partByCode(norm) || data.parts.find((x) => x.code.toLowerCase() === norm.toLowerCase());
      if (!p) return false;
      add(p.code);
      setToast(t("scan_added") + " · " + p.code);
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
                    return React.createElement("div", { key: c.code, className: "cart-item" },
                      React.createElement("div", { className: "ci-main" },
                        React.createElement("b", null, lang === "en" ? p.en : p.th),
                        React.createElement("small", { className: "mono" }, c.code)),
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
                  React.createElement(window.Btn, { variant: "primary", block: true, icon: React.createElement(window.IcFile, { size: 17 }), onClick: submit }, t("wd_submit")))))),
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
  function PRDetail({ t, lang, data, prId, onClose, go }) {
    const pr = data.prs.find((p) => p.id === prId);
    if (!pr) return null;
    const dep = D.deptById(pr.dept);
    const tot = window.prTotals(pr);
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
        React.createElement("div", { style: { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 } },
          (pr.status === "ordered" || pr.status === "partial") ? React.createElement(window.Btn, { variant: "primary", icon: React.createElement(window.IcReceive, { size: 16 }), onClick: () => { onClose(); go("receive"); } }, t("nav_receive")) : null,
          React.createElement(window.Btn, { variant: "ghost", onClick: onClose }, t("close")))));
  }
  function metaBit(label, val) {
    return React.createElement("div", null,
      React.createElement("div", { style: { font: "600 10px var(--font-en)", letterSpacing: ".07em", textTransform: "uppercase", color: "var(--fg-subtle)", marginBottom: 3 } }, label),
      React.createElement("div", { style: { font: "500 14px var(--font-th)", color: "var(--fg)" } }, val));
  }

  Object.assign(window, { Withdraw, PRDetail });
})();
