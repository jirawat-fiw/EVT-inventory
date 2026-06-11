/* EVT — Mock scanned PR document (stands in for the user's real PR photo) */
(function () {
  function MockPRPaper({ small }) {
    const o = window.EVTDATA.ocrSample;
    const rows = o.items.map((it, i) =>
      React.createElement("tr", { key: i },
        React.createElement("td", { style: { textAlign: "center" } }, i + 1),
        React.createElement("td", { className: "pp-code" }, it.code),
        React.createElement("td", null, it.desc),
        React.createElement("td", { style: { textAlign: "center" } }, it.qty),
        React.createElement("td", { style: { textAlign: "center" } }, it.unit),
        React.createElement("td", { style: { textAlign: "center" } }, it.wh.replace("WH-", "C")),
      ));
    return React.createElement("div", { className: "ppaper" + (small ? " ppaper-sm" : "") },
      React.createElement("div", { className: "pp-grain" }),
      React.createElement("div", { className: "pp-head" },
        React.createElement("div", null,
          React.createElement("div", { className: "pp-co" }, "บริษัท รถไฟฟ้า (ประเทศไทย) จำกัด (มหาชน)"),
          React.createElement("div", { className: "pp-co-en" }, "Electric Bus (Thailand) Public Co., Ltd."),
        ),
        React.createElement("div", { className: "pp-title" },
          React.createElement("b", null, "ใบขอซื้อ"),
          React.createElement("span", null, "PURCHASE REQUISITION"),
        ),
      ),
      React.createElement("div", { className: "pp-meta" },
        React.createElement("div", null, React.createElement("span", null, "เลขที่ PR"), React.createElement("b", { className: "pp-code" }, o.prCode)),
        React.createElement("div", null, React.createElement("span", null, "วันที่"), React.createElement("b", null, "09/06/2569")),
        React.createElement("div", null, React.createElement("span", null, "แผนก"), React.createElement("b", null, o.deptName)),
        React.createElement("div", null, React.createElement("span", null, "ผู้ขอ"), React.createElement("b", null, o.requester)),
        React.createElement("div", { style: { gridColumn: "1 / -1" } }, React.createElement("span", null, "หน่วยเรียก"), React.createElement("b", null, o.requesterUnit)),
      ),
      React.createElement("table", { className: "pp-tbl" },
        React.createElement("thead", null, React.createElement("tr", null,
          ["ที่", "รหัสขอซื้อ", "รายละเอียดรายการ", "จำนวน", "หน่วย", "คลัง"].map((h, i) =>
            React.createElement("th", { key: i }, h)))),
        React.createElement("tbody", null, rows),
      ),
      React.createElement("div", { className: "pp-note" }, "หมายเหตุ: ", o.note),
      React.createElement("div", { className: "pp-sign" },
        React.createElement("div", null, React.createElement("div", { className: "pp-sigline" }), "ผู้ขอซื้อ"),
        React.createElement("div", null, React.createElement("div", { className: "pp-sigline" }), "ผู้อนุมัติ"),
      ),
    );
  }
  Object.assign(window, { MockPRPaper });
})();
