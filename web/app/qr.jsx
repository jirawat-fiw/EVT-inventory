/* EVT — QR utilities: QR svg box, camera scan modal, A4 label printing */
(function () {
  const { useState, useEffect, useRef } = React;
  const D = window.EVTDATA;

  // ---- QR svg (uses qrcode-generator lib; falls back to text box) ----
  function qrSvg(value) {
    try {
      if (typeof qrcode !== "function") return null;
      const qr = qrcode(0, "M");
      qr.addData(String(value));
      qr.make();
      return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } catch (e) { return null; }
  }

  // ---- รูปแบบค่าใน QR: "รหัส|PR|ชิ้นที่/ทั้งหมด" (เช่น BRK-PAD-F|PR-2569-0148|3/4) ----
  // เข้ากันได้ย้อนหลัง: QR เดิมที่เป็นรหัสล้วน (ไม่มี "|") ยังอ่านได้เหมือนเดิม
  function buildLabelQR(code, prId, idx, total) {
    if (!prId && (!total || total <= 1)) return code;
    return code + "|" + (prId || "") + "|" + (total > 1 ? idx + "/" + total : "");
  }
  function parseLabelQR(raw) {
    const s = String(raw || "").trim();
    if (s.indexOf("|") < 0) return { code: s, pr: null, unit: null };
    const p = s.split("|");
    return { code: (p[0] || "").trim(), pr: (p[1] || "").trim() || null, unit: (p[2] || "").trim() || null };
  }

  function QRBox({ value, className, style }) {
    const svg = qrSvg(value);
    if (!svg) {
      return (
        <div className={"qrbox " + (className || "")} style={{ display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #ccc", font: "700 8px var(--font-en)", textAlign: "center", padding: 2, ...style }}>{value}</div>
      );
    }
    return <div className={"qrbox " + (className || "")} style={style} dangerouslySetInnerHTML={{ __html: svg }}></div>;
  }

  // ============================================================
  //  SCAN QR MODAL — camera + BarcodeDetector, manual fallback
  // ============================================================
  function ScanQRModal({ t, onClose, onCode, samples }) {
    const videoRef = useRef(null);
    const [err, setErr] = useState(null);
    const [bad, setBad] = useState(null);
    const [manual, setManual] = useState("");

    function submit(code) {
      const c = String(code || "").trim();
      if (!c) return;
      const ok = onCode(c);
      if (!ok) setBad(c);
    }

    useEffect(() => {
      let stream = null, timer = null, stopped = false;
      async function start() {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          if (stopped) { stream.getTracks().forEach((x) => x.stop()); return; }
          if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
          // ใช้ jsQR เป็นหลัก (ทำงานได้ทุกเบราว์เซอร์ รวมถึงเครื่องที่ BarcodeDetector เสีย)
          if (window.jsQR) {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            timer = setInterval(() => {
              const v = videoRef.current;
              if (!v || v.readyState < 2) return;
              const w = v.videoWidth, h = v.videoHeight;
              if (!w || !h) return;
              canvas.width = w; canvas.height = h;
              ctx.drawImage(v, 0, 0, w, h);
              let img;
              try { img = ctx.getImageData(0, 0, w, h); } catch (e) { return; }
              const res = window.jsQR(img.data, w, h, { inversionAttempts: "attemptBoth" });
              if (res && res.data) submit(res.data);
            }, 250);
          } else if ("BarcodeDetector" in window) {
            const det = new window.BarcodeDetector({ formats: ["qr_code"] });
            timer = setInterval(async () => {
              try {
                if (!videoRef.current || videoRef.current.readyState < 2) return;
                const codes = await det.detect(videoRef.current);
                if (codes && codes[0] && codes[0].rawValue) submit(codes[0].rawValue);
              } catch (e) { /* keep scanning */ }
            }, 350);
          }
        } catch (e) { setErr("cam"); }
      }
      start();
      return () => {
        stopped = true;
        if (timer) clearInterval(timer);
        if (stream) stream.getTracks().forEach((x) => x.stop());
      };
    }, []);

    const Modal = window.Modal, Btn = window.Btn;
    return (
      <Modal onClose={onClose} max={460}>
        <div className="card-head">
          <div>
            <h3>{t("scan_qr_title")}</h3>
            <div className="sub">{t("scan_qr_hint")}</div>
          </div>
          <button className="linkbtn" onClick={onClose}><window.IcX size={18}></window.IcX></button>
        </div>
        <div className="card-pad">
          {err === "cam"
            ? <div className="qr-fallback"><window.IcAlert size={19}></window.IcAlert><span>{t("scan_cam_err")}</span></div>
            : <div className="qr-stage">
                <video ref={videoRef} muted={true} playsInline={true}></video>
                <div className="qr-frame"></div>
              </div>}
          {bad ? <div className="qr-bad"><window.IcAlert size={15}></window.IcAlert> {t("scan_notfound")}: <b className="mono">{bad}</b></div> : null}
          <div className="qr-manual">
            <input className="input mono" placeholder={t("scan_manual")} value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(manual); }} />
            <Btn variant="soft" onClick={() => submit(manual)}>{t("confirm")}</Btn>
          </div>
          {samples && samples.length
            ? <div className="qr-samples">
                <span>{t("scan_try")}</span>
                {samples.map((c) => <button key={c} className="cat-pill mono" onClick={() => submit(c)}>{c}</button>)}
              </div>
            : null}
        </div>
      </Modal>
    );
  }

  // ============================================================
  //  LABEL PRINT — choose codes + counts, print A4 sheets
  // ============================================================
  function LabelPrintModal({ t, lang, prId, items, onClose }) {
    const [rows, setRows] = useState(() => items.map((it) => ({ code: it.code, on: true, n: Math.max(1, Number(it.qty) || 1) })));
    const [size, setSize] = useState("sm");
    const [printing, setPrinting] = useState(false);
    const CAP = { sm: 44, md: 24 };

    function setRow(i, patch) { setRows((rs) => rs.map((r, x) => (x === i ? { ...r, ...patch } : r))); }

    const labels = [];
    rows.forEach((r) => {
      if (r.on && r.n > 0) {
        const part = D.partByCode(r.code);
        for (let i = 0; i < r.n; i++) labels.push({ code: r.code, part, idx: i + 1, total: r.n });
      }
    });
    const nSheets = Math.ceil(labels.length / CAP[size]) || 0;

    if (printing) {
      return <LabelOverlay t={t} labels={labels} size={size} prId={prId} onBack={() => setPrinting(false)}></LabelOverlay>;
    }

    const Modal = window.Modal, Btn = window.Btn;
    return (
      <Modal onClose={onClose} max={620}>
        <div className="card-head" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 2 }}>
          <div>
            <h3>{t("lb_title")}</h3>
            <div className="sub">{(prId ? prId + " · " : "") + t("lb_sub")}</div>
          </div>
          <button className="linkbtn" onClick={onClose}><window.IcX size={18}></window.IcX></button>
        </div>
        <div className="card-pad">
          <div className="lb-rows">
            {rows.map((r, i) => {
              const p = D.partByCode(r.code);
              return (
                <div key={r.code} className={"lb-row" + (r.on ? "" : " off")}>
                  <input type="checkbox" checked={r.on} onChange={(e) => setRow(i, { on: e.target.checked })} />
                  <div className="lb-nm">
                    <b>{p ? (lang === "en" ? p.en : p.th) : r.code}</b>
                    <small className="mono">{r.code}</small>
                  </div>
                  <div className="rcv-stepper">
                    <button onClick={() => setRow(i, { n: Math.max(0, r.n - 1) })}>−</button>
                    <input className="mono" value={r.n} onChange={(e) => setRow(i, { n: Math.max(0, parseInt(e.target.value) || 0) })} />
                    <button onClick={() => setRow(i, { n: r.n + 1 })}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="lb-sizes">
            <span className="lb-lbl">{t("lb_size")}</span>
            <button className={"cat-pill" + (size === "sm" ? " on" : "")} onClick={() => setSize("sm")}>{t("lb_sm")}</button>
            <button className={"cat-pill" + (size === "md" ? " on" : "")} onClick={() => setSize("md")}>{t("lb_md")}</button>
          </div>
          <p className="lb-hintp">{t("lb_hint")}</p>
          <hr className="hr" style={{ margin: "14px 0" }} />
          <div className="lb-foot">
            <div className="lb-tot"><b className="mono">{labels.length}</b> {t("lb_count_unit")} · <b className="mono">{nSheets}</b> {t("lb_sheets")}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="ghost" onClick={onClose}>{t("lb_skip")}</Btn>
              <Btn variant="primary" disabled={labels.length === 0} icon={<window.IcPrint size={16}></window.IcPrint>} onClick={() => setPrinting(true)}>{t("lb_print")}</Btn>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  // ---- full-screen A4 preview + print (portal so print CSS can isolate it) ----
  function LabelOverlay({ t, labels, size, prId, onBack }) {
    useEffect(() => {
      document.body.classList.add("print-labels");
      return () => document.body.classList.remove("print-labels");
    }, []);
    const cap = size === "sm" ? 44 : 24;
    const sheets = [];
    for (let i = 0; i < labels.length; i += cap) sheets.push(labels.slice(i, i + cap));
    const Btn = window.Btn;
    return ReactDOM.createPortal(
      <div className="label-overlay">
        <div className="lo-bar no-print">
          <button className="linkbtn" onClick={onBack}>← {t("lb_back")}</button>
          <span className="lo-hint">{t("lb_hint")}</span>
          <Btn variant="primary" icon={<window.IcPrint size={16}></window.IcPrint>} onClick={() => window.print()}>{t("lb_print")}</Btn>
        </div>
        {sheets.map((sh, i) => (
          <div key={i} className={"label-sheet ls-" + size}>
            {sh.map((l, j) => (
              <div key={j} className="label">
                <QRBox value={buildLabelQR(l.code, prId, l.idx, l.total)} className="lq"></QRBox>
                <div className="lt">
                  <b className="mono">{l.code}</b>
                  <span>{l.part ? l.part.th : ""}</span>
                  <small className="mono">{(prId ? prId : "EVT") + (l.total > 1 ? " · " + l.idx + "/" + l.total : "")}</small>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>,
      document.body
    );
  }

  Object.assign(window, { QRBox, ScanQRModal, LabelPrintModal, buildLabelQR, parseLabelQR });
})();
