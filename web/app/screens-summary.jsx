/* EVT — Monthly report (printable): incoming + outgoing + reasons, no monetary values */
(function () {
  const D = window.EVTDATA;
  const fmtDate = window.fmtDate;
  const { useState } = React;

  function monthLabel(ym, lang) {
    if (!ym) return "—";
    const [y, m] = ym.split("-").map(Number);
    const th = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
    const en = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return lang === "en" ? `${en[m - 1]} ${y}` : `${th[m - 1]} ${y + 543}`;
  }

  function Summary({ t, lang, data, setToast }) {
    // ---- month selection ----
    const allDates = [...data.prs.map((p) => p.date), ...data.issues.map((w) => w.date), ...data.receipts.map((r) => r.date)];
    const months = Array.from(new Set(allDates.filter(Boolean).map((d) => d.slice(0, 7)))).sort().reverse();
    const [month, setMonth] = useState(months[0] || "");
    const inMonth = (d) => d && d.slice(0, 7) === month;
    const prsF = data.prs.filter((p) => inMonth(p.date));
    const receiptsF = data.receipts.filter((r) => inMonth(r.date));
    const issuesF = data.issues.filter((w) => inMonth(w.date));

    // ---- totals (quantities, not money) ----
    const prOpened = prsF.length;
    const receivedQty = receiptsF.reduce((s, r) => s + r.qty, 0);
    const issuedQty = issuesF.reduce((s, w) => s + w.qty, 0);
    const issueLines = issuesF.length;

    // ---- incoming: group receipts by part code ----
    const inMap = {};
    receiptsF.forEach((r) => {
      inMap[r.code] = inMap[r.code] || { qty: 0, prs: new Set() };
      inMap[r.code].qty += r.qty;
      inMap[r.code].prs.add(r.pr);
    });
    const inRows = Object.entries(inMap).sort((a, b) => b[1].qty - a[1].qty);

    // ---- outgoing: each withdrawal line, with reason ----
    const outRows = issuesF.slice().sort((a, b) => (a.date < b.date ? 1 : -1));

    // ---- top parts by qty withdrawn ----
    const byPart = {};
    issuesF.forEach((w) => { byPart[w.code] = (byPart[w.code] || 0) + w.qty; });
    const topParts = Object.entries(byPart).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const partMax = Math.max(...topParts.map((p) => p[1]), 1);

    const reasonOf = (w) => w.jobTitle || (w.vehicle !== "—" ? "" : (lang === "en" ? "Restock" : "เติมสต็อก"));
    const forOf = (w) => {
      if (w.vehicle && w.vehicle !== "—") { const v = D.vehById(w.vehicle); return v ? `${v.id} · ${v.plate}` : w.vehicle; }
      const d = D.deptById(w.dept); return d ? (lang === "en" ? d.en : d.th) : "—";
    };

    return React.createElement("div", { className: "page fadein" },
      React.createElement("div", { className: "page-head no-print" },
        React.createElement("div", null,
          React.createElement("div", { className: "eyebrow" }, "MONTHLY REPORT"),
          React.createElement("h1", null, t("sum_title")),
          React.createElement("p", null, t("sum_sub"))),
        React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center" } },
          React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8, font: "600 13px var(--font-th)", color: "var(--fg-muted)" } },
            t("sum_month"),
            React.createElement("select", {
              className: "input", value: month, onChange: (e) => setMonth(e.target.value),
              style: { width: "auto", minWidth: 160, fontWeight: 600 },
            }, months.map((m) => React.createElement("option", { key: m, value: m }, monthLabel(m, lang))))),
          React.createElement(window.Btn, { variant: "ghost", icon: React.createElement(window.IcPrint, { size: 16 }), onClick: () => window.print() }, t("print")),
          React.createElement(window.Btn, { variant: "primary", icon: React.createElement(window.IcSend, { size: 16 }), onClick: () => { window.print(); setToast(t("sum_send")); } }, t("sum_send")))),
      React.createElement("div", { className: "doc-sheet" },
        React.createElement("div", { className: "doc-head" },
          React.createElement("div", null,
            React.createElement("img", { src: "assets/logo-evt.png", alt: "EVT" }),
            React.createElement("div", { className: "dh-co" }, t("company"), React.createElement("small", null, "Electric Bus (Thailand) Public Co., Ltd."))),
          React.createElement("div", { className: "dh-title" },
            React.createElement("b", null, t("sum_title")),
            React.createElement("span", null, t("sum_period") + " · " + monthLabel(month, lang)))),

        // KPI band — quantities only
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 26 } },
          sumKpi(prOpened, t("sum_pr_opened")),
          sumKpi("+" + D.fmtNum(receivedQty), t("sum_received_v"), "in"),
          sumKpi("−" + D.fmtNum(issuedQty), t("sum_issued_v"), "out"),
          sumKpi(issueLines + " " + t("item"), t("nav_withdraw"))),

        // SECTION 1 — incoming
        React.createElement(SecTitle, { n: 1, title: t("sum_incoming"), icon: "in" }),
        React.createElement("table", { className: "doc-tbl", style: { marginBottom: 28 } },
          React.createElement("thead", null, React.createElement("tr", null,
            React.createElement("th", null, t("code")),
            React.createElement("th", null, t("detail")),
            React.createElement("th", null, t("warehouse")),
            React.createElement("th", null, t("sum_from_pr")),
            React.createElement("th", { className: "num" }, t("qty")))),
          React.createElement("tbody", null,
            inRows.map(([code, v]) => {
              const p = D.partByCode(code);
              const wh = p ? D.whById(p.wh) : null;
              return React.createElement("tr", { key: code },
                React.createElement("td", { className: "mono", style: { fontWeight: 600 } }, code),
                React.createElement("td", null, p ? (lang === "en" ? p.en : p.th) : code),
                React.createElement("td", { style: { color: "var(--fg-muted)" } }, wh ? (lang === "en" ? wh.en : wh.th) : "—"),
                React.createElement("td", { className: "mono", style: { fontSize: 12, color: "var(--fg-subtle)" } }, Array.from(v.prs).join(", ")),
                React.createElement("td", { className: "num mono", style: { fontWeight: 700, color: "var(--smart-green)" } }, "+" + v.qty + " " + (p ? p.unit : "")));
            })),
          React.createElement("tfoot", null, React.createElement("tr", null,
            React.createElement("td", { colSpan: 4, className: "num" }, t("total")),
            React.createElement("td", { className: "num mono", style: { color: "var(--smart-green)" } }, "+" + D.fmtNum(receivedQty) + " " + t("pieces"))))),

        // SECTION 2 — outgoing with reasons
        React.createElement(SecTitle, { n: 2, title: t("sum_outgoing"), icon: "out" }),
        React.createElement("table", { className: "doc-tbl", style: { marginBottom: 28 } },
          React.createElement("thead", null, React.createElement("tr", null,
            React.createElement("th", null, t("date")),
            React.createElement("th", null, t("detail")),
            React.createElement("th", null, t("sum_for_unit")),
            React.createElement("th", null, t("sum_reason")),
            React.createElement("th", { className: "num" }, t("qty")))),
          React.createElement("tbody", null,
            outRows.map((w) => {
              const p = D.partByCode(w.code);
              return React.createElement("tr", { key: w.id },
                React.createElement("td", { className: "mono", style: { fontSize: 12, color: "var(--fg-muted)" } }, fmtDate(w.date, lang)),
                React.createElement("td", null,
                  React.createElement("div", { style: { font: "500 13px var(--font-th)" } }, p ? (lang === "en" ? p.en : p.th) : w.code),
                  React.createElement("div", { className: "mono", style: { fontSize: 11, color: "var(--fg-subtle)" } }, w.code)),
                React.createElement("td", { style: { color: "var(--fg-muted)", fontSize: 13 } }, forOf(w)),
                React.createElement("td", { style: { fontSize: 13 } }, reasonOf(w) || "—"),
                React.createElement("td", { className: "num mono", style: { fontWeight: 700, color: "var(--strong-green)" } }, "−" + w.qty + " " + (p ? p.unit : "")));
            })),
          React.createElement("tfoot", null, React.createElement("tr", null,
            React.createElement("td", { colSpan: 4, className: "num" }, t("total")),
            React.createElement("td", { className: "num mono", style: { color: "var(--strong-green)" } }, "−" + D.fmtNum(issuedQty) + " " + t("pieces"))))),

        // SECTION 3 — top parts by qty
        React.createElement(SecTitle, { n: 3, title: t("sum_top_parts") }),
        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 11, marginBottom: 24 } },
          topParts.map(([code, qty], i) => {
            const p = D.partByCode(code);
            return React.createElement("div", { key: code, style: { display: "flex", alignItems: "center", gap: 12 } },
              React.createElement("span", { style: { width: 22, height: 22, borderRadius: 6, background: i === 0 ? "var(--evt-gold)" : "var(--green-100)", color: "var(--strong-green)", font: "700 12px var(--font-en)", display: "flex", alignItems: "center", justifyContent: "center" } }, i + 1),
              React.createElement("span", { style: { flex: 1, font: "500 13px var(--font-th)" } }, p ? (lang === "en" ? p.en : p.th) : code),
              React.createElement("div", { style: { width: 130, height: 8, borderRadius: 999, background: "var(--neutral-100)", overflow: "hidden" } },
                React.createElement("div", { style: { height: "100%", width: (qty / partMax * 100) + "%", background: "var(--new-day-green)", borderRadius: 999 } })),
              React.createElement("b", { className: "mono", style: { width: 70, textAlign: "right", color: "var(--strong-green)" } }, qty + " " + (p ? p.unit : "")));
          })),

        React.createElement("div", { className: "doc-sign" },
          React.createElement("div", { className: "s" }, React.createElement("div", { className: "line" }), React.createElement("span", null, t("sum_prepared") + " · " + (lang === "en" ? "Warehouse" : "ฝ่ายคลัง"))),
          React.createElement("div", { className: "s" }, React.createElement("div", { className: "line" }), React.createElement("span", null, t("approver")))),
        React.createElement("div", { className: "doc-foot" }, t("tagline"))));
  }

  function sumKpi(val, label, dir) {
    const color = dir === "in" ? "var(--smart-green)" : dir === "out" ? "var(--strong-green)" : "var(--strong-green)";
    return React.createElement("div", { style: { background: "var(--green-50)", borderRadius: 12, padding: "16px 16px" } },
      React.createElement("div", { className: "mono", style: { font: "800 24px var(--font-en)", color, letterSpacing: "-.02em" } }, val),
      React.createElement("div", { style: { font: "500 12px var(--font-th)", color: "var(--fg-muted)", marginTop: 3 } }, label));
  }
  function SecTitle({ n, title, icon }) {
    const bg = icon === "in" ? "var(--smart-green)" : "var(--strong-green)";
    return React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, margin: "8px 0 16px" } },
      React.createElement("span", { style: { width: 24, height: 24, borderRadius: 7, background: bg, color: "var(--evt-gold)", font: "800 12px var(--font-en)", display: "flex", alignItems: "center", justifyContent: "center" } }, n),
      React.createElement("h3", { style: { margin: 0, font: "700 16px var(--font-th)", color: "var(--strong-green)" } }, title));
  }

  Object.assign(window, { Summary });
})();
