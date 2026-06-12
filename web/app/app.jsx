/* EVT Parts System — app shell, state, router, tweaks */
(function () {
  const { useState, useEffect, useMemo } = React;
  const { makeT } = window.EVTI18N;
  const D = window.EVTDATA;
  const sb = window.sb;
  const userName = (u) => (u && (u.user_metadata && u.user_metadata.name)) || (u && u.email) || "ผู้ใช้คลัง";

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "dashLayout": "standard",
    "trackerStyle": "bars",
    "reviewLayout": "split",
    "pickerStyle": "list",
    "density": "comfortable",
    "accent": "#00CB5C"
  }/*EDITMODE-END*/;

  // ---- deep clone seed data into mutable app state ----
  function seed(user) {
    return {
      prs: JSON.parse(JSON.stringify(D.prs)),
      parts: JSON.parse(JSON.stringify(D.parts)),
      issues: JSON.parse(JSON.stringify(D.issues)),
      receipts: JSON.parse(JSON.stringify(D.receipts)),
      vehicles: D.vehicles, warehouses: D.warehouses, departments: D.departments,
      currentUser: userName(user),
    };
  }

  const NAV = [
    { group: "nav_main", items: [
      { id: "dashboard", icon: window.IcDashboard, key: "nav_dashboard" },
      { id: "openpr", icon: window.IcScan, key: "nav_openpr" },
      { id: "registry", icon: window.IcFile, key: "nav_registry" },
    ]},
    { group: "nav_ops", items: [
      { id: "receive", icon: window.IcReceive, key: "nav_receive", pip: "await" },
      { id: "withdraw", icon: window.IcWithdraw, key: "nav_withdraw" },
      { id: "stock", icon: window.IcStock, key: "nav_stock", pip: "low" },
    ]},
    { group: "nav_reports", items: [
      { id: "summary", icon: window.IcReport, key: "nav_summary" },
    ]},
    { group: "nav_admin_grp", items: [
      { id: "admin", icon: window.IcEdit, key: "nav_admin" },
    ]},
  ];

  const ADMIN_EMAIL = "jirawat@evthai.com"; // เฉพาะอีเมลนี้แก้ไขข้อมูลได้

  function App({ user }) {
    const isAdmin = !!(user && user.email === ADMIN_EMAIL);
    const navGroups = NAV.filter((g) => g.group !== "nav_admin_grp" || isAdmin);
    const [t, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
    const [lang, setLang] = useState(() => localStorage.getItem("evt_lang") || "th");
    const [role, setRole] = useState("role_store");
    const [view, setView] = useState("dashboard");
    const [db, setDb] = useState(() => seed(user));
    const [detail, setDetail] = useState(null);
    const [toast, setToast] = useState(null);
    const tr = useMemo(() => makeT(lang), [lang]);

    useEffect(() => { localStorage.setItem("evt_lang", lang); }, [lang]);
    useEffect(() => { document.documentElement.style.setProperty("--accent", t.accent); }, [t.accent]);

    function go(v) { setView(v); document.querySelector(".main").scrollTop = 0; }

    // ---------- sync กับ Supabase ----------
    async function refresh() {
      try { await D.reload(); setDb(seed(user)); }
      catch (e) { console.error("refresh failed", e); }
    }
    // ยิงงานบันทึกขึ้น Supabase (ถ้าเชื่อมต่อแล้ว) แล้วดึงข้อมูลจริงกลับมา reconcile
    function persist(factory) {
      if (!D.api) return;            // ยังไม่ตั้งค่า Supabase → ทำงานแบบ local อย่างเดียว
      Promise.resolve().then(factory).then(refresh)
        .catch((e) => { console.error(e); setToast("บันทึกขึ้นเซิร์ฟเวอร์ไม่สำเร็จ"); refresh(); });
    }

    // ---------- actions ----------
    const actions = {
      savePR(pr) {
        setDb((s) => ({ ...s, prs: [pr, ...s.prs] }));
        persist(() => D.api.savePR(pr));
      },
      getPR(id) { return db.prs.find((p) => p.id === id); },
      async adminSave(entity, obj, isNew) {
        const fn = { part: "savePart", vehicle: "saveVehicle", dept: "saveDept", warehouse: "saveWarehouse" }[entity];
        await D.api[fn](obj, isNew);
        await refresh();
      },
      async adminDelete(entity, id) {
        const fn = { part: "deletePart", vehicle: "deleteVehicle", dept: "deleteDept", warehouse: "deleteWarehouse", pr: "deletePR", issue: "deleteIssue" }[entity];
        await D.api[fn](id);
        await refresh();
      },
      async withdrawAndGet(cart, info) {
        const ids = await D.api.withdraw(cart, info);
        await refresh();
        return ids || [];
      },
      async adminImport(entity, rows) {
        const fn = { vehicle: "importVehicles", part: "importParts" }[entity];
        const n = await D.api[fn](rows);
        await refresh();
        return n;
      },
      receive(prId, recv) {
        persist(() => D.api.receive(prId, recv));
        setDb((s) => {
          const prs = s.prs.map((p) => {
            if (p.id !== prId) return p;
            const items = p.items.map((it) => ({ ...it, received: Math.min(it.qty, it.received + (Number(recv[it.code]) || 0)) }));
            const allDone = items.every((it) => it.received >= it.qty);
            const some = items.some((it) => it.received > 0);
            return { ...p, items, status: allDone ? "received" : some ? "partial" : p.status };
          });
          const parts = s.parts.map((pt) => {
            const add = Number(recv[pt.code]) || 0;
            return add ? { ...pt, stock: pt.stock + add } : pt;
          });
          const newReceipts = Object.entries(recv).filter(([, q]) => q > 0).map(([code, q], i) => ({
            id: "GR-2569-0" + (210 + i), date: "2026-06-09", pr: prId, code, qty: Number(q), by: "เจ้าหน้าที่คลัง",
          }));
          return { ...s, prs, parts, receipts: [...newReceipts, ...s.receipts] };
        });
      },
      withdraw(cart, info) {
        const issue = {
          id: "WD-2569-0" + (313 + Math.floor(Math.random() * 80)),
          date: new Date().toISOString().slice(0, 10),
          by: info.by, dept: info.dept || "21", vehicle: info.vehicle || "—", job: info.job || "—",
          jobTitle: info.jobTitle || (info.vehicle ? "" : "เติมสต็อก"),
        };
        setDb((s) => {
          const parts = s.parts.map((pt) => {
            const line = cart.find((c) => c.code === pt.code);
            return line ? { ...pt, stock: Math.max(0, pt.stock - line.qty) } : pt;
          });
          const issues = cart.map((c, i) => ({ ...issue, id: issue.id + "-" + i, code: c.code, qty: c.qty }));
          return { ...s, parts, issues: [...issues, ...s.issues] };
        });
        persist(() => D.api.withdraw(cart, info));
        return issue;
      },
    };

    // ---------- pips ----------
    const awaiting = db.prs.filter((p) => p.status === "ordered" || p.status === "partial").length;
    const lowCount = db.parts.filter((p) => p.stock < p.min).length;
    const pipVal = (k) => k === "await" ? awaiting : k === "low" ? lowCount : 0;

    const common = { t: tr, lang, data: db, go, setDetail, actions, setToast, role };
    let screen;
    if (view === "dashboard") screen = React.createElement(window.Dashboard, { ...common, dashLayout: t.dashLayout, trackerStyle: t.trackerStyle });
    else if (view === "openpr") screen = React.createElement(window.OpenPR, { ...common, reviewLayout: t.reviewLayout });
    else if (view === "registry") screen = React.createElement(window.Registry, common);
    else if (view === "receive") screen = React.createElement(window.Receive, common);
    else if (view === "withdraw") screen = React.createElement(window.Withdraw, { ...common, pickerStyle: t.pickerStyle });
    else if (view === "stock") screen = React.createElement(window.Inventory, common);
    else if (view === "summary") screen = React.createElement(window.Summary, common);
    else if (view === "admin") screen = isAdmin
      ? React.createElement(window.Admin, common)
      : React.createElement(window.Dashboard, { ...common, dashLayout: t.dashLayout, trackerStyle: t.trackerStyle });

    return React.createElement("div", { className: "app" },
      // sidebar
      React.createElement("aside", { className: "sb no-print" },
        React.createElement("div", { className: "sb-brand" },
          React.createElement("img", { src: "assets/logo-evt.png", alt: "EVT" }),
          React.createElement("div", { className: "sb-brand-txt" },
            React.createElement("b", null, tr("appName")),
            React.createElement("span", null, tr("appSub")))),
        navGroups.map((grp) => React.createElement("div", { className: "sb-group", key: grp.group },
          React.createElement("div", { className: "sb-group-label" }, tr(grp.group)),
          grp.items.map((it) => React.createElement("button", {
            key: it.id, className: "sb-link" + (view === it.id ? " is-active" : ""), onClick: () => go(it.id),
          },
            React.createElement(it.icon, { size: 19 }),
            React.createElement("span", { className: "lbl" }, tr(it.key)),
            it.pip && pipVal(it.pip) > 0 ? React.createElement("span", { className: "pip" }, pipVal(it.pip)) : null)))),
        React.createElement("div", { className: "sb-foot" }, tr("company"), React.createElement("br", null), "v1.0 · ระบบเบิกของ")),

      // main
      React.createElement("div", { className: "main", "data-density": t.density },
        React.createElement("div", { className: "topbar no-print" },
          React.createElement("div", { className: "search" },
            React.createElement(window.IcSearch, { size: 17 }),
            React.createElement("input", { placeholder: tr("search") })),
          React.createElement("div", { className: "spacer" }),
          React.createElement("div", { className: "tb-seg" },
            React.createElement("button", { className: lang === "th" ? "on" : "", onClick: () => setLang("th") }, "TH"),
            React.createElement("button", { className: lang === "en" ? "on" : "", onClick: () => setLang("en") }, "EN")),
          React.createElement(RolePicker, { tr, role, setRole }),
          React.createElement("div", { className: "tb-user" },
            React.createElement("div", { className: "tb-avatar" }, React.createElement(window.IcUser, { size: 19 })),
            React.createElement("div", { className: "tb-user-txt" },
              React.createElement("b", null, db.currentUser),
              React.createElement("span", null, tr(role))),
            sb ? React.createElement("button", {
              className: "tb-btn", style: { marginLeft: 8 },
              title: lang === "th" ? "ออกจากระบบ" : "Sign out",
              onClick: () => sb.auth.signOut(),
            }, lang === "th" ? "ออกจากระบบ" : "Sign out") : null)),
        screen),

      // mobile bottom nav
      React.createElement("nav", { className: "bottomnav no-print" },
        navGroups.flatMap((g) => g.items).map((it) => React.createElement("button", {
          key: it.id, className: "bn-item" + (view === it.id ? " on" : ""), onClick: () => go(it.id),
        },
          React.createElement(it.icon, { size: 20 }),
          React.createElement("span", null, tr(it.key)),
          it.pip && pipVal(it.pip) > 0 ? React.createElement("span", { className: "pip" }, pipVal(it.pip)) : null))),

      detail ? React.createElement(window.PRDetail, { t: tr, lang, data: db, prId: detail, onClose: () => setDetail(null), go }) : null,
      toast ? React.createElement(window.Toast, { msg: toast, onDone: () => setToast(null) }) : null,

      // tweaks
      React.createElement(window.TweaksPanel, { title: "Tweaks" },
        React.createElement(window.TweakSection, { label: "แดชบอร์ด / Dashboard" }),
        React.createElement(window.TweakRadio, { label: "เลย์เอาต์", value: t.dashLayout, options: ["standard", "tracker"], onChange: (v) => setTweak("dashLayout", v) }),
        React.createElement(window.TweakRadio, { label: "การ์ดติดตามรับของ", value: t.trackerStyle, options: ["bars", "cards"], onChange: (v) => setTweak("trackerStyle", v) }),
        React.createElement(window.TweakSection, { label: "เปิด PR (สแกน)" }),
        React.createElement(window.TweakRadio, { label: "หน้าตรวจทาน", value: t.reviewLayout, options: ["split", "focus"], onChange: (v) => setTweak("reviewLayout", v) }),
        React.createElement(window.TweakSection, { label: "เบิกของ" }),
        React.createElement(window.TweakRadio, { label: "รายการอะไหล่", value: t.pickerStyle, options: ["list", "grid"], onChange: (v) => setTweak("pickerStyle", v) }),
        React.createElement(window.TweakSection, { label: "ทั่วไป" }),
        React.createElement(window.TweakRadio, { label: "ความหนาแน่น", value: t.density, options: ["comfortable", "compact"], onChange: (v) => setTweak("density", v) }),
        React.createElement(window.TweakColor, { label: "สี Accent", value: t.accent, options: ["#00CB5C", "#C1B742", "#007F3A"], onChange: (v) => setTweak("accent", v) })));
  }

  function RolePicker({ tr, role, setRole }) {
    const roles = ["role_store", "role_tech", "role_acct", "role_exec"];
    const [open, setOpen] = useState(false);
    return React.createElement("div", { style: { position: "relative" } },
      React.createElement("button", { className: "tb-btn", onClick: () => setOpen((o) => !o) },
        tr(role), React.createElement(window.IcChevD, { size: 14 })),
      open ? React.createElement("div", { style: { position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#fff", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow-lg)", padding: 6, zIndex: 40, minWidth: 160 } },
        roles.map((r) => React.createElement("button", {
          key: r, onClick: () => { setRole(r); setOpen(false); },
          style: { display: "block", width: "100%", textAlign: "left", border: 0, background: role === r ? "var(--green-50)" : "transparent", color: role === r ? "var(--evt-green)" : "var(--fg)", padding: "9px 12px", borderRadius: 7, cursor: "pointer", font: "500 13px var(--font-th)" },
        }, tr(r)))) : null);
  }

  // ---------- หน้าจอสถานะ (โหลด / ยังไม่ตั้งค่า / ผิดพลาด) ----------
  const wrap = (children) => React.createElement("div", {
    style: { minHeight: "100vh", display: "grid", placeItems: "center", padding: 24,
             font: "500 15px var(--font-th, sans-serif)", color: "var(--strong-green,#003F1D)" },
  }, React.createElement("div", { style: { maxWidth: 520, textAlign: "center", lineHeight: 1.6 } }, children));

  const Splash = () => wrap(React.createElement("div", null,
    React.createElement("img", { src: "assets/logo-evt.png", alt: "EVT", style: { height: 54, marginBottom: 18 } }),
    React.createElement("div", null, "กำลังโหลดข้อมูลจาก Supabase…")));

  const ConfigNeeded = () => wrap(React.createElement("div", null,
    React.createElement("img", { src: "assets/logo-evt.png", alt: "EVT", style: { height: 54, marginBottom: 18 } }),
    React.createElement("h2", { style: { margin: "0 0 8px" } }, "ยังไม่ได้ตั้งค่า Supabase"),
    React.createElement("p", { style: { color: "var(--neutral-600,#666)" } },
      "เปิดไฟล์ ", React.createElement("code", null, "app/supabase-config.js"),
      " แล้วใส่ Project URL และ anon key ของโปรเจกต์คุณ (ดู supabase/README_DEPLOY.md)")));

  const LoadError = ({ msg }) => wrap(React.createElement("div", null,
    React.createElement("h2", { style: { margin: "0 0 8px", color: "var(--danger,#c0392b)" } }, "โหลดข้อมูลไม่สำเร็จ"),
    React.createElement("p", { style: { color: "var(--neutral-600,#666)" } }, String(msg || "")),
    React.createElement("p", { style: { color: "var(--neutral-600,#666)", fontSize: 13 } },
      "ตรวจว่ารัน deploy_all.sql แล้ว และเปิดสิทธิ์ให้ผู้ใช้เข้าถึง (login หรือเปิดโหมด anon ชั่วคราว)")));

  // ---------- หน้า login (Supabase Auth) ----------
  function Login() {
    const [mode, setMode] = useState("in");        // "in" = เข้าสู่ระบบ, "up" = สมัคร
    const [email, setEmail] = useState("");
    const [pw, setPw] = useState("");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null);

    async function submit(e) {
      e.preventDefault();
      setBusy(true); setMsg(null);
      try {
        if (mode === "in") {
          const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
          if (error) throw error;
          // สำเร็จ → onAuthStateChange จะพาเข้าแอปเอง
        } else {
          const { data, error } = await sb.auth.signUp({ email: email.trim(), password: pw });
          if (error) throw error;
          if (!data.session) setMsg({ ok: true, text: "สร้างบัญชีแล้ว — โปรดยืนยันอีเมลก่อนเข้าสู่ระบบ" });
        }
      } catch (err) {
        setMsg({ ok: false, text: err.message || "ดำเนินการไม่สำเร็จ" });
      } finally { setBusy(false); }
    }

    const input = {
      width: "100%", padding: "11px 13px", borderRadius: 10, marginTop: 6,
      border: "1px solid var(--border,#E8E7DE)", font: "500 15px var(--font-th,sans-serif)", boxSizing: "border-box",
    };
    return wrap(React.createElement("form", { onSubmit: submit, style: { width: 360, maxWidth: "90vw", textAlign: "left" } },
      React.createElement("div", { style: { textAlign: "center", marginBottom: 22 } },
        React.createElement("img", { src: "assets/logo-evt.png", alt: "EVT", style: { height: 50 } }),
        React.createElement("h2", { style: { margin: "14px 0 2px", color: "var(--strong-green,#003F1D)" } }, "ระบบเบิกของ EVT"),
        React.createElement("div", { style: { color: "var(--neutral-600,#888)", fontSize: 13 } },
          mode === "in" ? "เข้าสู่ระบบเพื่อใช้งาน" : "สร้างบัญชีผู้ใช้ใหม่")),
      React.createElement("label", { style: { fontSize: 13, fontWeight: 600 } }, "อีเมล"),
      React.createElement("input", { type: "email", required: true, value: email, autoComplete: "username",
        onChange: (e) => setEmail(e.target.value), style: input }),
      React.createElement("label", { style: { fontSize: 13, fontWeight: 600, display: "block", marginTop: 14 } }, "รหัสผ่าน"),
      React.createElement("input", { type: "password", required: true, value: pw, autoComplete: mode === "in" ? "current-password" : "new-password",
        onChange: (e) => setPw(e.target.value), style: input }),
      msg ? React.createElement("div", {
        style: { marginTop: 12, fontSize: 13, color: msg.ok ? "var(--smart-green,#007F3A)" : "var(--danger,#c0392b)" },
      }, msg.text) : null,
      React.createElement("button", {
        type: "submit", disabled: busy,
        style: { width: "100%", marginTop: 18, padding: "12px", borderRadius: 10, border: 0, cursor: "pointer",
                 background: "var(--evt-green,#00652E)", color: "#fff", font: "600 15px var(--font-th,sans-serif)",
                 opacity: busy ? 0.6 : 1 },
      }, busy ? "กำลังดำเนินการ…" : (mode === "in" ? "เข้าสู่ระบบ" : "สมัครสมาชิก")),
      React.createElement("div", { style: { textAlign: "center", marginTop: 14, fontSize: 13 } },
        React.createElement("button", {
          type: "button", onClick: () => { setMode(mode === "in" ? "up" : "in"); setMsg(null); },
          style: { border: 0, background: "transparent", color: "var(--evt-green,#00652E)", cursor: "pointer", font: "500 13px var(--font-th,sans-serif)" },
        }, mode === "in" ? "ยังไม่มีบัญชี? สมัครสมาชิก" : "มีบัญชีแล้ว? เข้าสู่ระบบ"))));
  }

  // ---------- bootstrap ----------
  const root = ReactDOM.createRoot(document.getElementById("root"));
  let booting = false;
  async function enter(session) {
    if (!session) { root.render(React.createElement(Login)); return; }
    if (booting) return; booting = true;
    root.render(React.createElement(Splash));
    try {
      await D.load();
      root.render(React.createElement(App, { user: session.user }));
    } catch (e) {
      console.error(e);
      root.render(React.createElement(LoadError, { msg: e && e.message }));
    } finally { booting = false; }
  }

  (async function boot() {
    if (!D.configured || !sb) { root.render(React.createElement(ConfigNeeded)); return; }
    const { data } = await sb.auth.getSession();
    sb.auth.onAuthStateChange((_evt, session) => enter(session));
    enter(data.session);
  })();
})();
