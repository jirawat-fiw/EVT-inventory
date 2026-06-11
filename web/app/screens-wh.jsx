/* EVT — Dashboard, Receiving, Withdraw, Inventory, PR detail */
(function () {
  const { useState } = React;
  const D = window.EVTDATA;
  const fmtDate = window.fmtDate;

  // ============================================================
  //  DASHBOARD
  // ============================================================
  function Dashboard({ t, lang, data, go, setDetail, dashLayout, trackerStyle }) {
    const openPRs = data.prs.filter((p) => p.status !== "closed" && p.status !== "received");
    const awaiting = data.prs.reduce((s, p) => s + p.items.reduce((a, it) => a + (it.qty - it.received), 0), 0);
    const low = data.parts.filter((p) => p.stock < p.min);
    const issuedCount = data.issues.reduce((s, w) => s + w.qty, 0);
    const tracking = data.prs.filter((p) => p.status === "ordered" || p.status === "partial");

    const kpis = React.createElement("div", { className: "grid g-4" },
      React.createElement(window.KPI, { icon: React.createElement(window.IcFile, { size: 20 }), val: openPRs.length, label: t("kpi_open_pr"), delta: "+2", deltaDir: "up" }),
      React.createElement(window.KPI, { icon: React.createElement(window.IcReceive, { size: 20 }), val: D.fmtNum(awaiting) + " " + t("pieces"), label: t("kpi_await") }),
      React.createElement(window.KPI, { icon: React.createElement(window.IcAlert, { size: 20 }), val: low.length, label: t("kpi_low"), delta: low.length ? "ต้องสั่ง" : "", deltaDir: "dn" }),
      React.createElement(window.KPI, { icon: React.createElement(window.IcBox, { size: 20 }), val: D.fmtNum(issuedCount) + " " + t("pieces"), label: t("kpi_issued"), accent: true }));

    const recentPR = React.createElement(window.Card, null,
      React.createElement(window.CardHead, { title: t("pr_recent"), right: React.createElement("button", { className: "linkbtn", onClick: () => go("registry") }, t("viewall"), React.createElement(window.IcChevR, { size: 14 })) }),
      React.createElement("table", { className: "tbl" },
        React.createElement("tbody", null,
          data.prs.slice(0, 5).map((pr) => {
            const tot = window.prTotals(pr);
            return React.createElement("tr", { key: pr.id, className: "clickable", onClick: () => setDetail(pr.id) },
              React.createElement("td", { className: "code" }, pr.id),
              React.createElement("td", null, pr.requester),
              React.createElement("td", { className: "num", style: { color: "var(--fg-muted)" } }, tot.lines + " " + t("item")),
              React.createElement("td", null, React.createElement(window.StatusBadge, { status: pr.status, t })));
          }))));

    const tracker = React.createElement(window.Card, null,
      React.createElement(window.CardHead, { title: t("receiving_track"), sub: tracking.length + " PR", right: React.createElement("button", { className: "linkbtn", onClick: () => go("receive") }, t("nav_receive"), React.createElement(window.IcChevR, { size: 14 })) }),
      React.createElement("div", { className: "card-pad", style: { paddingTop: 16 } },
        trackerStyle === "cards"
          ? React.createElement("div", { className: "grid g-2" }, tracking.map((pr) => React.createElement(TrackCard, { key: pr.id, pr, t, lang, onClick: () => setDetail(pr.id) })))
          : React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 16 } },
              tracking.map((pr) => React.createElement(TrackBar, { key: pr.id, pr, t, lang, onClick: () => setDetail(pr.id) })))));

    const lowStock = React.createElement(window.Card, null,
      React.createElement(window.CardHead, { title: t("low_stock"), sub: low.length + " " + t("item"), right: React.createElement("button", { className: "linkbtn", onClick: () => go("stock") }, t("viewall"), React.createElement(window.IcChevR, { size: 14 })) }),
      React.createElement("div", { className: "card-pad", style: { display: "flex", flexDirection: "column", gap: 12 } },
        low.length === 0 ? React.createElement("div", { style: { color: "var(--fg-subtle)", font: "400 14px var(--font-th)" } }, "อะไหล่ทุกรายการอยู่เหนือจุดสั่งซื้อ")
        : low.map((p) => React.createElement("div", { key: p.code, style: { display: "flex", alignItems: "center", gap: 12 } },
            React.createElement("div", { style: { flex: 1 } },
              React.createElement("div", { style: { font: "500 14px var(--font-th)" } }, lang === "en" ? p.en : p.th),
              React.createElement("div", { className: "mono", style: { font: "600 11px var(--font-en)", color: "var(--evt-green)" } }, p.code)),
            React.createElement("span", { className: "mono", style: { font: "700 15px var(--font-en)", color: "var(--danger)" } }, p.stock),
            React.createElement("span", { style: { font: "400 12px var(--font-th)", color: "var(--fg-subtle)" } }, "/ " + p.min),
            React.createElement(window.Badge, { kind: "low" }, t("stk_status_low"))))));

    const recentIssue = React.createElement(window.Card, null,
      React.createElement(window.CardHead, { title: t("recent_issue"), right: React.createElement("button", { className: "linkbtn", onClick: () => go("withdraw") }, t("nav_withdraw"), React.createElement(window.IcChevR, { size: 14 })) }),
      React.createElement("table", { className: "tbl" },
        React.createElement("tbody", null,
          data.issues.slice(0, 5).map((w) => {
            const p = D.partByCode(w.code);
            return React.createElement("tr", { key: w.id },
              React.createElement("td", null,
                React.createElement("div", { style: { font: "500 13px var(--font-th)" } }, p ? (lang === "en" ? p.en : p.th) : w.code),
                React.createElement("div", { style: { font: "400 12px var(--font-th)", color: "var(--fg-subtle)" } }, w.vehicle !== "—" ? t("chassis").replace(":", "") + " " + D.vehById(w.vehicle).id + " · " + w.jobTitle : w.jobTitle)),
              React.createElement("td", { className: "num mono", style: { fontWeight: 700, color: "var(--strong-green)" } }, "−" + w.qty),
              React.createElement("td", { className: "mono", style: { color: "var(--fg-subtle)", fontSize: 12 } }, fmtDate(w.date, lang)));
          }))));

    return React.createElement("div", { className: "page fadein" },
      React.createElement("div", { className: "page-head" },
        React.createElement("div", null,
          React.createElement("div", { className: "eyebrow" }, "DASHBOARD"),
          React.createElement("h1", null, t("dash_title")),
          React.createElement("p", null, t("dash_sub"))),
        React.createElement(window.Btn, { variant: "primary", icon: React.createElement(window.IcScan, { size: 16 }), onClick: () => go("openpr") }, t("nav_openpr"))),
      kpis,
      dashLayout === "tracker"
        ? React.createElement("div", { className: "grid resp-grid", style: { gridTemplateColumns: "1.4fr 1fr", marginTop: 18 } }, tracker, React.createElement("div", { className: "grid", style: { gridTemplateRows: "auto auto", gap: 18 } }, lowStock, recentIssue))
        : React.createElement(React.Fragment, null,
            React.createElement("div", { className: "grid resp-grid", style: { gridTemplateColumns: "1.5fr 1fr", marginTop: 18 } }, tracker, lowStock),
            React.createElement("div", { className: "grid resp-grid", style: { gridTemplateColumns: "1fr 1fr", marginTop: 18 } }, recentPR, recentIssue)));
  }

  function TrackBar({ pr, t, lang, onClick }) {
    const tot = window.prTotals(pr);
    return React.createElement("div", { style: { cursor: "pointer" }, onClick },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 } },
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 9 } },
          React.createElement("span", { className: "code", style: { font: "700 13px var(--font-en)", color: "var(--evt-green)" } }, pr.id),
          React.createElement(window.StatusBadge, { status: pr.status, t })),
        React.createElement("span", { className: "mono", style: { font: "600 13px var(--font-en)", color: "var(--fg-muted)" } }, `${tot.received}/${tot.ordered} ${t("pieces")}`)),
      React.createElement(window.Meter, { value: tot.received, max: tot.ordered }),
      React.createElement("div", { style: { font: "400 12px var(--font-th)", color: "var(--fg-subtle)", marginTop: 5 } }, pr.requesterUnit));
  }

  function TrackCard({ pr, t, lang, onClick }) {
    const tot = window.prTotals(pr);
    const pct = Math.round((tot.received / tot.ordered) * 100);
    return React.createElement("div", { style: { cursor: "pointer", border: "1px solid var(--border)", borderRadius: 14, padding: 16, transition: "border-color .15s" }, onClick },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 } },
        React.createElement("div", null,
          React.createElement("div", { className: "code", style: { font: "700 14px var(--font-en)", color: "var(--evt-green)" } }, pr.id),
          React.createElement("div", { style: { font: "400 12px var(--font-th)", color: "var(--fg-subtle)", marginTop: 2 } }, fmtDate(pr.date, lang))),
        React.createElement(window.StatusBadge, { status: pr.status, t })),
      React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 } },
        React.createElement("span", { className: "mono", style: { font: "800 26px var(--font-en)", color: "var(--strong-green)" } }, pct + "%"),
        React.createElement("span", { className: "mono", style: { font: "500 13px var(--font-en)", color: "var(--fg-subtle)" } }, `${tot.received}/${tot.ordered} ${t("pieces")}`)),
      React.createElement(window.Meter, { value: tot.received, max: tot.ordered }));
  }

  // ============================================================
  //  RECEIVING
  // ============================================================
  function Receive({ t, lang, data, actions, setToast }) {
    const openish = data.prs.filter((p) => p.items.some((it) => it.received < it.qty));
    const [sel, setSel] = useState(openish[0] ? openish[0].id : "");
    const [recv, setRecv] = useState({});
    const [labelReq, setLabelReq] = useState(null); // { pr, lines: [{code, qty}] }
    const [q, setQuery] = useState("");
    const pr = data.prs.find((p) => p.id === sel);

    const qq = (q || "").trim().toLowerCase();
    const matches = openish.filter((p) => !qq
      || p.id.toLowerCase().includes(qq)
      || (p.requesterUnit || "").toLowerCase().includes(qq)
      || (p.requester || "").toLowerCase().includes(qq));

    function setQ(code, v, max) { setRecv((r) => ({ ...r, [code]: Math.max(0, Math.min(max, v)) })); }
    function confirm() {
      const lines = Object.entries(recv).filter(([, v]) => Number(v) > 0).map(([code, v]) => ({ code, qty: Number(v) }));
      actions.receive(sel, recv);
      setToast(t("rcv_done"));
      setRecv({});
      if (lines.length) setLabelReq({ pr: sel, lines });
    }
    const totalNow = Object.values(recv).reduce((a, b) => a + (Number(b) || 0), 0);

    return React.createElement("div", { className: "page fadein" },
      React.createElement("div", { className: "page-head" },
        React.createElement("div", null,
          React.createElement("div", { className: "eyebrow" }, "GOODS RECEIPT"),
          React.createElement("h1", null, t("rcv_title")),
          React.createElement("p", null, t("rcv_sub")))),
      React.createElement("div", { className: "grid resp-grid", style: { gridTemplateColumns: "1.6fr 1fr" } },
        React.createElement(window.Card, null,
          React.createElement(window.CardHead, { title: t("rcv_enter_pr") }),
          React.createElement("div", { className: "card-pad" },
            React.createElement("div", { className: "search", style: { width: "100%", marginBottom: 12 } },
              React.createElement(window.IcSearch, { size: 17 }),
              React.createElement("input", { value: q, onChange: (e) => setQuery(e.target.value), placeholder: t("rcv_search") })),
            React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto", marginBottom: pr ? 6 : 0 } },
              matches.length === 0
                ? React.createElement("div", { style: { padding: "14px 4px", font: "400 13px var(--font-th)", color: "var(--fg-subtle)" } }, openish.length === 0 ? "— ไม่มี PR ที่รอรับ —" : t("rcv_no_match"))
                : matches.map((p) => {
                    const remain = p.items.reduce((a, it) => a + (it.qty - it.received), 0);
                    const active = p.id === sel;
                    return React.createElement("button", {
                      key: p.id, onClick: () => { setSel(p.id); setRecv({}); },
                      style: { display: "flex", alignItems: "center", gap: 10, textAlign: "left", width: "100%", cursor: "pointer", padding: "10px 12px", borderRadius: 10, border: "1.5px solid " + (active ? "var(--evt-green)" : "var(--border)"), background: active ? "var(--green-50)" : "#fff" },
                    },
                      React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                        React.createElement("div", { className: "mono", style: { font: "700 13px var(--font-en)", color: "var(--evt-green)" } }, p.id),
                        React.createElement("div", { style: { font: "400 12px var(--font-th)", color: "var(--fg-subtle)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, p.requesterUnit)),
                      React.createElement(window.StatusBadge, { status: p.status, t }),
                      React.createElement("span", { className: "mono", style: { font: "700 14px var(--font-en)", color: "var(--warning)" } }, remain),
                      React.createElement("span", { style: { font: "400 11px var(--font-th)", color: "var(--fg-subtle)" } }, t("rcv_remain_pcs")));
                  })),
            pr ? React.createElement("div", { style: { marginTop: 18 } },
              React.createElement("div", { className: "rcv-head", style: { display: "grid", gridTemplateColumns: "1fr 90px 90px 120px", gap: 14, padding: "0 16px 8px", font: "700 11px var(--font-en)", letterSpacing: ".05em", textTransform: "uppercase", color: "var(--fg-subtle)" } },
                React.createElement("div", null, t("detail")),
                React.createElement("div", { style: { textAlign: "center" } }, t("ordered_vs")),
                React.createElement("div", { style: { textAlign: "center" } }, t("rcv_remaining")),
                React.createElement("div", { style: { textAlign: "center" } }, t("rcv_recv_now"))),
              pr.items.map((it) => {
                const p = D.partByCode(it.code);
                const remain = it.qty - it.received;
                return React.createElement("div", { key: it.code, className: "rcv-row" },
                  React.createElement("div", { className: "nm" }, p ? (lang === "en" ? p.en : p.th) : it.code,
                    React.createElement("small", { className: "mono" }, it.code)),
                  React.createElement("div", { style: { textAlign: "center" } },
                    React.createElement("span", { className: "mono", style: { color: "var(--fg-muted)" } }, `${it.received}/${it.qty}`)),
                  React.createElement("div", { style: { textAlign: "center" } },
                    remain === 0 ? React.createElement(window.Badge, { kind: "received" }, t("rcv_full"))
                    : React.createElement("span", { className: "mono", style: { font: "700 15px var(--font-en)", color: "var(--warning)" } }, remain)),
                  remain === 0 ? React.createElement("div", { style: { textAlign: "center", color: "var(--fg-subtle)" } }, "—")
                  : React.createElement("div", { className: "rcv-stepper", style: { justifyContent: "center" } },
                      React.createElement("button", { onClick: () => setQ(it.code, (recv[it.code] || 0) - 1, remain) }, "−"),
                      React.createElement("input", { className: "mono", value: recv[it.code] || 0, onChange: (e) => setQ(it.code, parseInt(e.target.value) || 0, remain) }),
                      React.createElement("button", { onClick: () => setQ(it.code, (recv[it.code] || 0) + 1, remain) }, "+")));
              }),
              React.createElement("hr", { className: "hr", style: { margin: "16px 0" } }),
              React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" } },
                React.createElement("div", null,
                  React.createElement("span", { style: { font: "400 13px var(--font-th)", color: "var(--fg-subtle)" } }, t("rcv_recv_now") + ": "),
                  React.createElement("b", { className: "mono", style: { font: "700 18px var(--font-en)", color: "var(--strong-green)" } }, totalNow + " " + t("pieces"))),
                React.createElement("div", { style: { display: "flex", gap: 10 } },
                  React.createElement(window.Btn, { variant: "ghost", icon: React.createElement(window.IcPrint, { size: 16 }), onClick: () => setLabelReq({ pr: sel, lines: pr.items.map((it) => ({ code: it.code, qty: it.received || it.qty })) }) }, t("lb_open")),
                  React.createElement(window.Btn, { variant: "primary", disabled: totalNow === 0, icon: React.createElement(window.IcReceive, { size: 17 }), onClick: confirm }, t("rcv_confirm"))))) : null)),
        React.createElement(window.Card, null,
          React.createElement(window.CardHead, { title: t("rcv_history") }),
          React.createElement("div", { className: "card-pad", style: { display: "flex", flexDirection: "column", gap: 0 } },
            data.receipts.slice(0, 7).map((r, i) => {
              const p = D.partByCode(r.code);
              return React.createElement("div", { key: r.id, style: { display: "flex", gap: 11, padding: "11px 0", borderBottom: i < 6 ? "1px solid var(--neutral-100)" : "0" } },
                React.createElement("div", { style: { width: 32, height: 32, borderRadius: 9, background: "var(--green-50)", color: "var(--smart-green)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, React.createElement(window.IcReceive, { size: 16 })),
                React.createElement("div", { style: { flex: 1 } },
                  React.createElement("div", { style: { font: "500 13px var(--font-th)" } }, p ? (lang === "en" ? p.en : p.th) : r.code),
                  React.createElement("div", { className: "mono", style: { font: "500 11px var(--font-en)", color: "var(--fg-subtle)" } }, r.pr + " · " + fmtDate(r.date, lang))),
                React.createElement("span", { className: "mono", style: { font: "700 15px var(--font-en)", color: "var(--smart-green)" } }, "+" + r.qty));
            })))),
      labelReq ? React.createElement(window.LabelPrintModal, {
        t, lang,
        prId: labelReq.pr,
        items: labelReq.lines,
        onClose: () => setLabelReq(null),
      }) : null);
  }

  // ============================================================
  //  INVENTORY
  // ============================================================
  function Inventory({ t, lang, data, go }) {
    const cats = ["ทั้งหมด", ...Array.from(new Set(data.parts.map((p) => p.cat)))];
    const [cat, setCat] = useState("ทั้งหมด");
    const rows = data.parts.filter((p) => cat === "ทั้งหมด" || p.cat === cat);
    return React.createElement("div", { className: "page fadein" },
      React.createElement("div", { className: "page-head" },
        React.createElement("div", null,
          React.createElement("div", { className: "eyebrow" }, "INVENTORY"),
          React.createElement("h1", null, t("stk_title")),
          React.createElement("p", null, t("stk_sub"))),
        React.createElement(window.Btn, { variant: "soft", icon: React.createElement(window.IcWithdraw, { size: 16 }), onClick: () => go("withdraw") }, t("nav_withdraw"))),
      React.createElement("div", { className: "cat-row" },
        cats.map((c) => React.createElement("button", { key: c, className: "cat-pill" + (cat === c ? " on" : ""), onClick: () => setCat(c) }, c === "ทั้งหมด" ? t("all") : c))),
      React.createElement(window.Card, null,
        React.createElement("table", { className: "tbl" },
          React.createElement("thead", null, React.createElement("tr", null,
            [t("code"), t("detail"), t("warehouse"), t("stk_onhand"), t("stk_min"), t("status")].map((h, i) =>
              React.createElement("th", { key: i, className: i >= 3 && i <= 4 ? "num" : "" }, h)))),
          React.createElement("tbody", null,
            rows.map((p) => {
              const lowS = p.stock < p.min;
              const wh = D.whById(p.wh);
              return React.createElement("tr", { key: p.code },
                React.createElement("td", { className: "code" }, p.code),
                React.createElement("td", null,
                  React.createElement("div", { style: { font: "500 14px var(--font-th)" } }, lang === "en" ? p.en : p.th),
                  React.createElement("div", { style: { font: "400 12px var(--font-th)", color: "var(--fg-subtle)" } }, p.cat)),
                React.createElement("td", { style: { color: "var(--fg-muted)" } }, lang === "en" ? wh.en : wh.th),
                React.createElement("td", { className: "num mono", style: { fontWeight: 700, color: lowS ? "var(--danger)" : "var(--strong-green)" } }, p.stock + " " + p.unit),
                React.createElement("td", { className: "num mono", style: { color: "var(--fg-subtle)" } }, p.min),
                React.createElement("td", null, React.createElement(window.Badge, { kind: lowS ? "low" : "ok" }, lowS ? t("stk_status_low") : t("stk_status_ok"))));
            })))));
  }

  Object.assign(window, { Dashboard, Receive, Inventory });
})();
