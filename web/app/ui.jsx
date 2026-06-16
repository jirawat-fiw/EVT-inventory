/* EVT shared UI primitives — window globals */
(function () {
  const { useState, useEffect, useRef } = React;

  // ---- status badge ----
  const ST = {
    pending:  { cls: "badge-pending",  key: "st_pending" },
    ordered:  { cls: "badge-ordered",  key: "st_ordered" },
    partial:  { cls: "badge-partial",  key: "st_partial" },
    received: { cls: "badge-received", key: "st_received" },
    closed:   { cls: "badge-closed",   key: "st_closed" },
  };
  function StatusBadge({ status, t }) {
    const s = ST[status] || ST.pending;
    return React.createElement("span", { className: "badge " + s.cls },
      React.createElement("span", { className: "dot" }), t(s.key));
  }

  function Badge({ kind = "ok", children }) {
    return React.createElement("span", { className: "badge badge-" + kind }, children);
  }

  function Btn({ variant = "primary", size, block, icon, children, ...rest }) {
    const cls = ["btn", "btn-" + variant, size ? "btn-" + size : "", block ? "btn-block" : ""]
      .filter(Boolean).join(" ");
    return React.createElement("button", { className: cls, ...rest },
      icon || null, children != null ? React.createElement("span", null, children) : null);
  }

  function Card({ children, style, className = "" }) {
    return React.createElement("div", { className: "card " + className, style }, children);
  }
  function CardHead({ title, sub, right }) {
    return React.createElement("div", { className: "card-head" },
      React.createElement("div", null,
        React.createElement("h3", null, title),
        sub ? React.createElement("div", { className: "sub" }, sub) : null),
      right || null);
  }

  function KPI({ icon, val, label, delta, deltaDir, accent, tone, onClick }) {
    const clickable = typeof onClick === "function";
    return React.createElement("div", {
      className: "kpi" + (accent ? " kpi-accent" : "") + (tone ? " kpi-tone kpi-tone-" + tone : "") + (clickable ? " kpi-click" : ""),
      onClick: clickable ? onClick : undefined,
      role: clickable ? "button" : undefined,
      tabIndex: clickable ? 0 : undefined,
      onKeyDown: clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined,
    },
      React.createElement("div", { className: "ic" }, icon),
      React.createElement("div", { className: "val mono" }, val),
      React.createElement("div", { className: "lbl" }, label),
      delta ? React.createElement("div", { className: "delta " + (deltaDir || "up") },
        deltaDir === "dn" ? React.createElement(window.IcTrendDn, { size: 14 }) : React.createElement(window.IcTrendUp, { size: 14 }),
        delta) : null,
      clickable ? React.createElement("span", { className: "kpi-go" }, React.createElement(window.IcChevR, { size: 16 })) : null);
  }

  function Field({ label, children }) {
    return React.createElement("div", { className: "field" },
      label ? React.createElement("label", null, label) : null, children);
  }

  function Meter({ value, max, full }) {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
    return React.createElement("div", { className: "meter" + (full || value >= max ? " full" : "") },
      React.createElement("span", { style: { width: pct + "%" } }));
  }

  function Modal({ children, onClose, max }) {
    useEffect(() => {
      const h = (e) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h);
      return () => window.removeEventListener("keydown", h);
    }, []);
    return React.createElement("div", { className: "scrim", onClick: onClose },
      React.createElement("div", { className: "modal", style: max ? { maxWidth: max } : null,
        onClick: (e) => e.stopPropagation() }, children));
  }

  function Toast({ msg, onDone }) {
    useEffect(() => { const id = setTimeout(onDone, 2600); return () => clearTimeout(id); }, []);
    return React.createElement("div", { className: "toast" },
      React.createElement("span", { className: "tc" }, React.createElement(window.IcCheck, { size: 18 })),
      msg);
  }

  // ---- searchable dropdown (combobox) ----
  function SearchSelect({ value, onChange, options, placeholder, noneLabel }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const ref = useRef(null);
    useEffect(() => {
      const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
      document.addEventListener("mousedown", h);
      return () => document.removeEventListener("mousedown", h);
    }, []);
    const sel = options.find((o) => o.value === value);
    const qq = q.trim().toLowerCase();
    const list = options.filter((o) => !qq || (o.label + " " + (o.sub || "") + " " + (o.search || "")).toLowerCase().includes(qq));
    function pick(v) { onChange(v); setOpen(false); setQ(""); }
    return React.createElement("div", { className: "sselect", ref },
      React.createElement("input", {
        className: "input",
        value: open ? q : (sel ? sel.label : ""),
        placeholder: sel && !open ? sel.label : (value === "" && !open && noneLabel ? noneLabel : placeholder),
        onFocus: () => { setOpen(true); setQ(""); },
        onChange: (e) => { setQ(e.target.value); if (!open) setOpen(true); },
      }),
      React.createElement("span", { className: "ss-chev" }, React.createElement(window.IcChevD, { size: 15 })),
      open ? React.createElement("div", { className: "ss-pop" },
        noneLabel ? React.createElement("button", { className: "ss-opt" + (value === "" ? " on" : ""), onMouseDown: (e) => e.preventDefault(), onClick: () => pick("") }, noneLabel) : null,
        list.length === 0
          ? React.createElement("div", { className: "ss-empty" }, "—")
          : list.map((o) => React.createElement("button", {
              key: o.value, className: "ss-opt" + (o.value === value ? " on" : ""),
              onMouseDown: (e) => e.preventDefault(), onClick: () => pick(o.value),
            },
              o.label,
              o.sub ? React.createElement("small", null, o.sub) : null))) : null);
  }

  // ---- warehouse filter (pills) — shows only warehouses that have data ----
  function whWithData(allWh, idSet) {
    return (allWh || []).filter((w) => idSet.has(w.id));
  }
  function WarehouseFilter({ value, onChange, list, lang, allLabel }) {
    if (!list || list.length <= 1) return null; // มีคลังเดียว/ไม่มีข้อมูล → ไม่ต้องโชว์ตัวกรอง
    return React.createElement("div", { className: "cat-row", style: { marginBottom: 4 } },
      React.createElement("button", { className: "cat-pill" + (value === "" ? " on" : ""), onClick: () => onChange("") }, allLabel),
      list.map((w) => React.createElement("button", {
        key: w.id, className: "cat-pill" + (value === w.id ? " on" : ""), onClick: () => onChange(w.id),
      }, lang === "en" ? w.en : w.th)));
  }

  // ---- empty state (no data) ----
  function EmptyState({ icon, title, hint, action }) {
    return React.createElement("div", { className: "empty" },
      icon ? React.createElement("div", { className: "ei" }, icon) : null,
      title ? React.createElement("h4", null, title) : null,
      hint ? React.createElement("p", null, hint) : null,
      action || null);
  }

  // ---- skeleton loaders ----
  function Skeleton({ kind = "line", count = 1, style }) {
    const cls = "skel skel-" + kind;
    return React.createElement(React.Fragment, null,
      Array.from({ length: count }, (_, i) =>
        React.createElement("div", { key: i, className: cls, style })));
  }

  // PR aggregate helpers
  function prTotals(pr) {
    const D = window.EVTDATA;
    let ordered = 0, received = 0, used = 0, value = 0;
    pr.items.forEach((it) => {
      const p = D.partByCode(it.code);
      ordered += it.qty; received += it.received; used += it.used;
      value += (p ? p.price : 0) * it.qty;
    });
    return { ordered, received, used, value, lines: pr.items.length };
  }

  Object.assign(window, { StatusBadge, Badge, Btn, Card, CardHead, KPI, Field, Meter, Modal, Toast, SearchSelect, WarehouseFilter, whWithData, prTotals, EmptyState, Skeleton });
})();
