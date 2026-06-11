/* EVT icons — Lucide-style outline, 24x24, currentColor. window globals via Object.assign */
(function () {
  const S = ({ size = 20, sw = 1.8, children, style }) =>
    React.createElement("svg", {
      width: size, height: size, viewBox: "0 0 24 24", fill: "none",
      stroke: "currentColor", strokeWidth: sw, strokeLinecap: "round",
      strokeLinejoin: "round", style, "aria-hidden": true,
    }, children);
  const P = (d) => React.createElement("path", { d, key: d });
  const E = (props) => React.createElement(props.t, props);

  const IcDashboard = (p) => S({ ...p, children: [
    E({ t: "rect", x: 3, y: 3, width: 7, height: 9, rx: 1.5, key: "a" }),
    E({ t: "rect", x: 14, y: 3, width: 7, height: 5, rx: 1.5, key: "b" }),
    E({ t: "rect", x: 14, y: 12, width: 7, height: 9, rx: 1.5, key: "c" }),
    E({ t: "rect", x: 3, y: 16, width: 7, height: 5, rx: 1.5, key: "d" }),
  ]});
  const IcScan = (p) => S({ ...p, children: [
    P("M3 7V5a2 2 0 0 1 2-2h2"), P("M17 3h2a2 2 0 0 1 2 2v2"),
    P("M21 17v2a2 2 0 0 1-2 2h-2"), P("M7 21H5a2 2 0 0 1-2-2v-2"),
    P("M7 12h10"),
  ]});
  const IcFile = (p) => S({ ...p, children: [
    P("M14 3v4a1 1 0 0 0 1 1h4"),
    P("M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"),
    P("M9 13h6"), P("M9 17h6"),
  ]});
  const IcReceive = (p) => S({ ...p, children: [
    P("M12 3v9"), P("M8.5 8.5 12 12l3.5-3.5"),
    P("M20 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6"),
  ]});
  const IcWithdraw = (p) => S({ ...p, children: [
    P("M21 8 12 3 3 8l9 5 9-5Z"), P("M3 8v8l9 5 9-5V8"), P("M12 13v8"),
  ]});
  const IcStock = (p) => S({ ...p, children: [
    E({ t: "rect", x: 3, y: 3, width: 7, height: 7, rx: 1.2, key: "a" }),
    E({ t: "rect", x: 14, y: 3, width: 7, height: 7, rx: 1.2, key: "b" }),
    E({ t: "rect", x: 3, y: 14, width: 7, height: 7, rx: 1.2, key: "c" }),
    E({ t: "rect", x: 14, y: 14, width: 7, height: 7, rx: 1.2, key: "d" }),
  ]});
  const IcReport = (p) => S({ ...p, children: [
    P("M4 20h16"), P("M7 20V11"), P("M12 20V5"), P("M17 20v-6"),
  ]});
  const IcSearch = (p) => S({ ...p, children: [
    E({ t: "circle", cx: 11, cy: 11, r: 7, key: "a" }), P("m20 20-3.2-3.2"),
  ]});
  const IcChevR = (p) => S({ ...p, children: [P("m9 6 6 6-6 6")] });
  const IcChevD = (p) => S({ ...p, children: [P("m6 9 6 6 6-6")] });
  const IcArrowR = (p) => S({ ...p, children: [P("M5 12h14"), P("m13 6 6 6-6 6")] });
  const IcPlus = (p) => S({ ...p, children: [P("M12 5v14"), P("M5 12h14")] });
  const IcCheck = (p) => S({ ...p, children: [P("m5 13 4 4L19 7")] });
  const IcX = (p) => S({ ...p, children: [P("M6 6l12 12"), P("M18 6 6 18")] });
  const IcUpload = (p) => S({ ...p, children: [
    P("M12 16V4"), P("m7 9 5-5 5 5"), P("M4 20h16"),
  ]});
  const IcCamera = (p) => S({ ...p, children: [
    P("M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"),
    E({ t: "circle", cx: 12, cy: 12.5, r: 3.2, key: "a" }),
  ]});
  const IcAlert = (p) => S({ ...p, children: [
    P("M10.3 3.8 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"),
    P("M12 9v4"), P("M12 17h.01"),
  ]});
  const IcDownload = (p) => S({ ...p, children: [
    P("M12 4v12"), P("m7 11 5 5 5-5"), P("M4 20h16"),
  ]});
  const IcPrint = (p) => S({ ...p, children: [
    P("M6 9V3h12v6"), P("M6 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1"),
    E({ t: "rect", x: 6, y: 14, width: 12, height: 7, rx: 1, key: "a" }),
  ]});
  const IcClock = (p) => S({ ...p, children: [
    E({ t: "circle", cx: 12, cy: 12, r: 9, key: "a" }), P("M12 7v5l3 2"),
  ]});
  const IcEdit = (p) => S({ ...p, children: [
    P("M12 20h9"), P("M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"),
  ]});
  const IcBus = (p) => S({ ...p, children: [
    P("M5 17V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11"),
    P("M4 11h16"), P("M3 17h18"),
    E({ t: "circle", cx: 8, cy: 18.5, r: 1.6, key: "a" }),
    E({ t: "circle", cx: 16, cy: 18.5, r: 1.6, key: "b" }),
    P("M7 4v3"), P("M17 4v3"),
  ]});
  const IcUser = (p) => S({ ...p, children: [
    E({ t: "circle", cx: 12, cy: 8, r: 3.5, key: "a" }),
    P("M5 20a7 7 0 0 1 14 0"),
  ]});
  const IcGlobe = (p) => S({ ...p, children: [
    E({ t: "circle", cx: 12, cy: 12, r: 9, key: "a" }),
    P("M3 12h18"), P("M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"),
  ]});
  const IcTrendUp = (p) => S({ ...p, children: [P("m3 17 6-6 4 4 8-8"), P("M21 10V7h-3")] });
  const IcTrendDn = (p) => S({ ...p, children: [P("m3 7 6 6 4-4 8 8"), P("M21 14v3h-3")] });
  const IcSparkle = (p) => S({ ...p, children: [
    P("M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"),
  ]});
  const IcSend = (p) => S({ ...p, children: [
    P("M21 4 3 11l7 3 3 7 8-17Z"), P("M10 14 21 4"),
  ]});
  const IcBox = (p) => S({ ...p, children: [
    P("M21 8 12 3 3 8v8l9 5 9-5Z"), P("m3 8 9 5 9-5"), P("M12 13v8"),
  ]});
  const IcMenu = (p) => S({ ...p, children: [P("M4 7h16"), P("M4 12h16"), P("M4 17h16")] });

  Object.assign(window, {
    IcDashboard, IcScan, IcFile, IcReceive, IcWithdraw, IcStock, IcReport,
    IcSearch, IcChevR, IcChevD, IcArrowR, IcPlus, IcCheck, IcX, IcUpload,
    IcCamera, IcAlert, IcDownload, IcPrint, IcClock, IcEdit, IcBus, IcUser,
    IcGlobe, IcTrendUp, IcTrendDn, IcSparkle, IcSend, IcBox, IcMenu,
  });
})();
