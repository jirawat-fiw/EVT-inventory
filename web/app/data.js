/* ============================================================
   EVT ระบบเบิกของ / อะไหล่รถบัส — Mock data
   Plain JS, attaches to window.EVTDATA
   ============================================================ */
(function () {
  // ---------- Warehouses / คลัง (01–09) ----------
  const warehouses = [
    { id: "WH-01", no: "01", th: "คลัง 01", en: "WH 01" },
    { id: "WH-02", no: "02", th: "คลัง 02", en: "WH 02" },
    { id: "WH-03", no: "03", th: "คลัง 03", en: "WH 03" },
    { id: "WH-04", no: "04", th: "คลัง 04", en: "WH 04" },
    { id: "WH-05", no: "05", th: "คลัง 05", en: "WH 05" },
    { id: "WH-06", no: "06", th: "คลัง 06", en: "WH 06" },
    { id: "WH-07", no: "07", th: "คลัง 07", en: "WH 07" },
    { id: "WH-08", no: "08", th: "คลัง 08", en: "WH 08" },
    { id: "WH-09", no: "09", th: "คลัง 09", en: "WH 09" },
  ];

  // ---------- Departments / แผนก (รหัส · คำย่อ · รายละเอียด) ----------
  const departments = [
    { id: "11",   th: "ฝ่ายสำนักงาน",      detail: "ฝ่ายบริหารส่วนกลาง" },
    { id: "12",   th: "แผนกบุคคล",         detail: "แผนกบุคคลและธุรการ" },
    { id: "13",   th: "แผนกจัดซื้อ",        detail: "แผนกจัดซื้อ" },
    { id: "14",   th: "แผนกขาย",           detail: "แผนกขาย" },
    { id: "14-3", th: "สวนสัตว์ชม.",        detail: "โครงการ-สวนสัตว์เชียงใหม่ (สิ้นสุดสัญญา)" },
    { id: "14-4", th: "มช.",               detail: "โครงการ-ม.เชียงใหม่-(ค่าใช้จ่ายหลังการขาย)" },
    { id: "15",   th: "โครงการ 1551",      detail: "โครงการ-สาย 1551" },
    { id: "16",   th: "แผนก IT",           detail: "แผนกเทคโนโลยีสารสนเทศ" },
    { id: "17",   th: "ฝ่ายบัญชีการเงิน",    detail: "ฝ่ายบัญชีและการเงิน" },
    { id: "18",   th: "แผนกโครงการ",       detail: "แผนกบริหารโครงการ" },
    { id: "21",   th: "แผนกผลิตและซ่อม",    detail: "แผนกผลิตและซ่อมบำรุง" },
    { id: "22",   th: "แผนกบริการ",        detail: "แผนกบริการหลังการขาย" },
    { id: "24",   th: "โครงการ ม.จุฬา",     detail: "โครงการ-จุฬาลงกรณ์มหาวิทยาลัย (สิ้นสุดสัญญา)" },
    { id: "25",   th: "โครงการ รพ.รามา",    detail: "โครงการ-รพ.รามาธิบดี (สิ้นสุดสัญญา)" },
    { id: "27",   th: "สวทช.",             detail: "สวทช.-(ค่าใช้จ่ายหลังการขาย) (สิ้นสุดสัญญา)" },
    { id: "28",   th: "โครงการ มธ.1",      detail: "โครงการ-มหาวิทยาลัยธรรมศาสตร์-รังสิต" },
    { id: "29",   th: "โครงการศิริราช",      detail: "โครงการ-คณะแพทยศาสตร์ รพ.ศิริราช" },
    { id: "29-1", th: "ศิริราช 12 คัน",      detail: "โครงการศิริราช 12 คัน" },
    { id: "29-2", th: "ศิริราช 5 คัน",       detail: "โครงการศิริราช 5 คัน" },
    { id: "30",   th: "โครงการ กฟน.",      detail: "โครงการ-การไฟฟ้านครหลวง (1/1/67-31/12/67)" },
    { id: "31",   th: "โครงการ ม.วล",      detail: "โครงการ-มหาวิทยาลัยวลัยลักษณ์ (สิ้นสุดสัญญา 7/7/67)" },
    { id: "36",   th: "แผนกวิจัย&พัฒนา",    detail: "แผนกวิจัยและพัฒนาผลิตภัณฑ์-วิศวะ" },
    { id: "38",   th: "แผนกการตลาด",      detail: "แผนกการตลาด" },
    { id: "39",   th: "โครงการ กฟผ.",      detail: "โครงการ-การไฟฟ้าฝ่ายผลิต (สิ้นสุดสัญญา)" },
    { id: "40",   th: "โครงการ กทม.1",     detail: "โครงการ-กทม.ล้อสู้ราง เคหะร่มเกล้า-ARL ลาดกระบัง" },
    { id: "41",   th: "โครงการ กทม.2",     detail: "โครงการ-กทม.ล้อสู้ราง ดินแดง-BTS สนามเป้า" },
    { id: "42",   th: "สนง.ทรัพย์สิน มธ",    detail: "โครงการ-สำนักงานทรัพย์สิน ม.ธรรมศาสตร์ (สิ้นสุดสัญญา)" },
    { id: "43",   th: "การบินไทย",         detail: "โครงการ-การบินไทย" },
    { id: "44",   th: "โครงการ มธ.2",      detail: "โครงการ ม.ธรรมศาสตร์-ท่าพระจันทร์ (30/9/67)" },
    { id: "45",   th: "โครงการธนารักษ์",     detail: "โครงการ บริษัท ธนารักษ์พัฒนาสินทรัพย์ จำกัด" },
    { id: "46",   th: "โครงการทวีวัฒนา",     detail: "โครงการ กทม.ทวีวัฒนา" },
    { id: "47",   th: "ม.มหิดล 15 คัน",     detail: "โครงการ ม.มหิดล 15 คัน (ภายใน)" },
    { id: "48",   th: "ม.มหิดล 9 คัน",      detail: "โครงการ ม.มหิดล 9 คัน (ภายนอก)" },
    { id: "49",   th: "กทม.14 คัน",        detail: "โครงการ กทม.ล้อสู้ราง 14 คัน" },
    { id: "50",   th: "ธนารักษ์ 6 คัน",      detail: "โครงการธนารักษ์ 6 คัน 10 เดือน" },
    { id: "51",   th: "ว.นานาชาติมหิดล",     detail: "โครงการวิทยาลัยนานาชาติ ม.มหิดล" },
    { id: "52",   th: "โครงการ จุฬาฯ",      detail: "โครงการจุฬาฯ (1/7/69-30/6/73)" },
    { id: "60-1", th: "TGC EMC (GIZ)",     detail: "องค์กรความร่วมมือไทย-เยอรมัน (1/6/69-31/7/69)" },
  ].map((d) => ({ ...d, en: d.th }));

  // ---------- Buses (chassis) / รถบัส ----------
  const vehicles = [
    { id: "EVT-018", chassis: "MEVT1A2B3C4D50018", plate: "30-1845 กทม.", model: "EVT City Bus 12m", route: "สาย 3 บางนา–สีลม" },
    { id: "EVT-022", chassis: "MEVT1A2B3C4D50022", plate: "30-1992 กทม.", model: "EVT City Bus 12m", route: "สาย 7 ลาดกระบัง" },
    { id: "EVT-031", chassis: "MEVT1A2B3C4D50031", plate: "31-0274 กทม.", model: "EVT Shuttle 8m", route: "Shuttle มหาวิทยาลัย" },
    { id: "EVT-009", chassis: "MEVT1A2B3C4D50009", plate: "30-1102 กทม.", model: "EVT City Bus 12m", route: "สาย 1 สาทร" },
  ];

  // ---------- Master parts catalog / อะไหล่ ----------
  // stock = qty on hand; min = reorder point
  const parts = [
    { code: "BAT-72V-200", th: "แบตเตอรี่ลิเธียม 72V 200Ah", en: "Li-ion Battery Pack 72V 200Ah", unit: "ก้อน", unitEn: "pack", wh: "WH-01", stock: 6, min: 4, price: 184000, cat: "ระบบขับเคลื่อน" },
    { code: "MOT-AC-150", th: "มอเตอร์ไฟฟ้า AC 150kW", en: "AC Traction Motor 150kW", unit: "ตัว", unitEn: "unit", wh: "WH-01", stock: 3, min: 2, price: 268000, cat: "ระบบขับเคลื่อน" },
    { code: "CTRL-VCU-3", th: "ชุดควบคุม VCU รุ่น 3", en: "Vehicle Control Unit v3", unit: "ชุด", unitEn: "set", wh: "WH-02", stock: 2, min: 3, price: 96000, cat: "อิเล็กทรอนิกส์" },
    { code: "BRK-PAD-F", th: "ผ้าเบรกหน้า (ชุด)", en: "Front Brake Pad Set", unit: "ชุด", unitEn: "set", wh: "WH-02", stock: 28, min: 12, price: 3200, cat: "ช่วงล่าง/เบรก" },
    { code: "TIRE-275-70", th: "ยาง 275/70 R22.5", en: "Tire 275/70 R22.5", unit: "เส้น", unitEn: "pcs", wh: "WH-01", stock: 14, min: 16, price: 9800, cat: "ช่วงล่าง/เบรก" },
    { code: "CHG-CCS2-60", th: "ชุดชาร์จ CCS2 60kW (อะไหล่)", en: "CCS2 Charger Module 60kW", unit: "ชุด", unitEn: "set", wh: "WH-01", stock: 1, min: 2, price: 142000, cat: "ระบบชาร์จ" },
    { code: "AC-ROOF-12", th: "แอร์หลังคา 12kW", en: "Rooftop A/C Unit 12kW", unit: "ตัว", unitEn: "unit", wh: "WH-02", stock: 5, min: 3, price: 58000, cat: "ตัวถัง/ภายใน" },
    { code: "LED-HEAD-L", th: "ไฟหน้า LED (ซ้าย)", en: "LED Headlamp (Left)", unit: "ดวง", unitEn: "pcs", wh: "WH-03", stock: 9, min: 6, price: 7400, cat: "ไฟฟ้า/แสงสว่าง" },
    { code: "DCDC-25A", th: "ตัวแปลงไฟ DC-DC 25A", en: "DC-DC Converter 25A", unit: "ตัว", unitEn: "unit", wh: "WH-02", stock: 7, min: 4, price: 18600, cat: "อิเล็กทรอนิกส์" },
    { code: "DOOR-PNL-R", th: "บานประตูไฟฟ้า (ขวา)", en: "Electric Door Panel (Right)", unit: "บาน", unitEn: "pcs", wh: "WH-03", stock: 4, min: 2, price: 26500, cat: "ตัวถัง/ภายใน" },
  ];

  // ---------- Purchase Requests / PR ----------
  // status: pending | ordered | partial | received | closed
  // each item: code, qty (ordered), received, used, unit, wh
  const prs = [
    {
      id: "PR-2569-0148", date: "2026-06-03", dept: "21", requester: "สมชาย ทองดี",
      requesterUnit: "หน่วยซ่อมบำรุงระบบขับเคลื่อน", status: "partial", scanned: true,
      note: "อะไหล่สำหรับซ่อม EVT-018 และสำรองคลัง",
      items: [
        { code: "BAT-72V-200", qty: 2, received: 2, used: 1, wh: "WH-01" },
        { code: "CTRL-VCU-3", qty: 3, received: 1, used: 0, wh: "WH-02" },
        { code: "BRK-PAD-F", qty: 8, received: 8, used: 4, wh: "WH-02" },
      ],
    },
    {
      id: "PR-2569-0151", date: "2026-06-05", dept: "22", requester: "วิชัย แสงทอง",
      requesterUnit: "หน่วยเดินรถสาย 7", status: "ordered", scanned: true,
      note: "ยางสำรองรอบไตรมาส",
      items: [
        { code: "TIRE-275-70", qty: 12, received: 0, used: 0, wh: "WH-01" },
        { code: "LED-HEAD-L", qty: 4, received: 0, used: 0, wh: "WH-03" },
      ],
    },
    {
      id: "PR-2569-0153", date: "2026-06-06", dept: "21", requester: "ประเสริฐ ใจดี",
      requesterUnit: "หน่วยซ่อมบำรุงตัวถัง", status: "pending", scanned: true,
      note: "งานซ่อมประตู EVT-031",
      items: [
        { code: "DOOR-PNL-R", qty: 2, received: 0, used: 0, wh: "WH-03" },
        { code: "AC-ROOF-12", qty: 1, received: 0, used: 0, wh: "WH-02" },
      ],
    },
    {
      id: "PR-2569-0140", date: "2026-05-28", dept: "21", requester: "อนุชา พงษ์ไพร",
      requesterUnit: "สายการผลิต EV ไลน์ 2", status: "received", scanned: false,
      note: "ชุดชาร์จและตัวแปลงไฟสำหรับประกอบรถใหม่",
      items: [
        { code: "CHG-CCS2-60", qty: 3, received: 3, used: 2, wh: "WH-01" },
        { code: "DCDC-25A", qty: 6, received: 6, used: 6, wh: "WH-02" },
      ],
    },
    {
      id: "PR-2569-0135", date: "2026-05-22", dept: "21", requester: "สมชาย ทองดี",
      requesterUnit: "หน่วยซ่อมบำรุงระบบขับเคลื่อน", status: "closed", scanned: false,
      note: "มอเตอร์เปลี่ยนทดแทน EVT-009",
      items: [
        { code: "MOT-AC-150", qty: 2, received: 2, used: 2, wh: "WH-01" },
      ],
    },
  ];

  // ---------- Withdrawals / รายการเบิก (issue) ----------
  // links a part qty to a job / vehicle
  const issues = [
    { id: "WD-2569-0312", date: "2026-06-07", code: "BAT-72V-200", qty: 1, wh: "WH-01", by: "สมชาย ทองดี", dept: "21", vehicle: "EVT-018", job: "JOB-0451", jobTitle: "เปลี่ยนแบตเตอรี่ชุดที่ 2", prRef: "PR-2569-0148" },
    { id: "WD-2569-0308", date: "2026-06-06", code: "BRK-PAD-F", qty: 4, wh: "WH-02", by: "ประเสริฐ ใจดี", dept: "21", vehicle: "EVT-022", job: "JOB-0448", jobTitle: "เปลี่ยนผ้าเบรกหน้า", prRef: "PR-2569-0148" },
    { id: "WD-2569-0301", date: "2026-06-02", code: "CHG-CCS2-60", qty: 2, wh: "WH-01", by: "อนุชา พงษ์ไพร", dept: "21", vehicle: "—", job: "JOB-0440", jobTitle: "ประกอบชุดชาร์จรถใหม่", prRef: "PR-2569-0140" },
    { id: "WD-2569-0298", date: "2026-05-30", code: "DCDC-25A", qty: 6, wh: "WH-02", by: "อนุชา พงษ์ไพร", dept: "21", vehicle: "—", job: "JOB-0440", jobTitle: "ประกอบชุดชาร์จรถใหม่", prRef: "PR-2569-0140" },
    { id: "WD-2569-0290", date: "2026-05-25", code: "MOT-AC-150", qty: 2, wh: "WH-01", by: "สมชาย ทองดี", dept: "21", vehicle: "EVT-009", job: "JOB-0431", jobTitle: "เปลี่ยนมอเตอร์ขับเคลื่อน", prRef: "PR-2569-0135" },
  ];

  // ---------- Receiving log / บันทึกการรับของ (GR) ----------
  const receipts = [
    { id: "GR-2569-0205", date: "2026-06-04", pr: "PR-2569-0148", code: "BAT-72V-200", qty: 2, by: "เจ้าหน้าที่คลัง บางนา" },
    { id: "GR-2569-0207", date: "2026-06-05", pr: "PR-2569-0148", code: "BRK-PAD-F", qty: 8, by: "เจ้าหน้าที่คลัง A" },
    { id: "GR-2569-0209", date: "2026-06-06", pr: "PR-2569-0148", code: "CTRL-VCU-3", qty: 1, by: "เจ้าหน้าที่คลัง A" },
    { id: "GR-2569-0188", date: "2026-05-29", pr: "PR-2569-0140", code: "CHG-CCS2-60", qty: 3, by: "เจ้าหน้าที่คลัง บางนา" },
    { id: "GR-2569-0189", date: "2026-05-29", pr: "PR-2569-0140", code: "DCDC-25A", qty: 6, by: "เจ้าหน้าที่คลัง A" },
  ];

  // ---------- The "scanned PR" OCR payload for the demo ----------
  // This is what the OCR pretends to extract from the uploaded image.
  const ocrSample = {
    prCode: "PR-2569-0156",
    date: "2026-06-09",
    deptName: "ฝ่ายซ่อมบำรุง",
    deptId: "21",
    requester: "สมชาย ทองดี",
    requesterUnit: "หน่วยซ่อมบำรุงระบบขับเคลื่อน",
    note: "อะไหล่ซ่อม EVT-022 และเติมสต็อก",
    items: [
      { code: "BRK-PAD-F", desc: "ผ้าเบรกหน้า (ชุด)", qty: 6, unit: "ชุด", wh: "WH-02", conf: 0.98 },
      { code: "TIRE-275-70", desc: "ยาง 275/70 R22.5", qty: 8, unit: "เส้น", wh: "WH-01", conf: 0.93 },
      { code: "LED-HEAD-L", desc: "ไฟหน้า LED (ซ้าย)", qty: 2, unit: "ดวง", wh: "WH-03", conf: 0.71 },
      { code: "DCDC-25A", desc: "ตัวแปลงไฟ DC-DC 25A", qty: 3, unit: "ตัว", wh: "WH-02", conf: 0.88 },
    ],
  };

  // ---------- helpers ----------
  const partByCode = (code) => parts.find((p) => p.code === code);
  const whById = (id) => warehouses.find((w) => w.id === id);
  const deptById = (id) => departments.find((d) => d.id === id) || departments[0];
  const vehById = (id) => vehicles.find((v) => v.id === id);

  const fmtBaht = (n) => "฿" + (n || 0).toLocaleString("en-US");
  const fmtNum = (n) => (n || 0).toLocaleString("en-US");

  window.EVTDATA = {
    warehouses, departments, vehicles, parts, prs, issues, receipts, ocrSample,
    partByCode, whById, deptById, vehById, fmtBaht, fmtNum,
  };
})();
