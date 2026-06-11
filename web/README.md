# Handoff: ระบบเบิกของ EVT — EV Bus Parts Requisition System

## Overview
An internal web app for **EVT (Electric Bus Thailand)** warehouse operations covering the full parts lifecycle:

1. **เปิด PR (Open PR)** — photograph/upload a paper purchase-requisition form, AI-OCR extracts the data for review, or enter a PR manually
2. **ทะเบียน PR (PR Registry)** — track all PRs and their receiving status
3. **รับของ (Receiving / GR)** — record received quantities against a PR, then **print small QR labels onto A4** to stick on each received piece
4. **เบิกของ (Withdraw)** — issue parts from stock (search by code/name or **scan a QR label with the phone camera**), link to a vehicle/job, and produce a printable issue slip for accounting
5. **คลังอะไหล่ (Inventory)** — on-hand stock vs reorder point per warehouse
6. **สรุปสิ้นเดือน (Monthly Summary)** — printable month-end report

The UI is bilingual (TH default / EN toggle) and responsive — desktop sidebar layout, mobile bottom-tab layout. Built on the **EVT Design System** (Montserrat + IBM Plex Sans Thai, EVT green palette).

## About the Design Files
The files in this bundle are **design references created in HTML/React (Babel-in-browser prototype)** — they show the intended look and behavior, they are **not production code to copy directly**. Your task is to **recreate these designs in the target codebase's environment** using its established patterns. If no codebase exists yet, a sensible default stack is **React (Vite) + a REST/Supabase backend**, but choose what fits the team.

The prototype runs entirely on **mock data** (`app/data.js`, exposed as `window.EVTDATA`). The owner's stated next step is to **connect a real database** — see "Data model → suggested schema" below. The data layer is intentionally isolated: every screen reads through `EVTDATA` / `actions.*`, so the implementation should keep an equivalent clean data-access layer (API client / hooks).

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and interactions are final design intent. Recreate pixel-perfectly using the design tokens below (all defined in `assets/colors_and_type.css`). The only placeholder elements are the mock data and the simulated OCR sample.

## How to run the prototype
Open `ระบบเบิกของ EVT.html` via any static server (files load via relative paths; Babel standalone compiles the `.jsx` files in the browser). Internet is required for React/Babel/qrcode-generator CDN scripts and Montserrat.

## Files
| File | Contents |
|---|---|
| `ระบบเบิกของ EVT.html` | Entry point, script load order |
| `app/app.jsx` | App shell: sidebar nav, topbar, mobile bottom nav, router (view state), global actions (savePR / receive / withdraw), role picker, Tweaks panel |
| `app/data.js` | **Mock data + helpers** — the de-facto data contract (`window.EVTDATA`) |
| `app/i18n.js` | All TH/EN strings (`window.EVTI18N`) — use these keys verbatim |
| `app/ui.jsx` | Primitives: Btn, Card, CardHead, KPI, Field, Meter, Modal, Toast, StatusBadge, Badge, prTotals |
| `app/icons.jsx` | Inline SVG icon set (Lucide-style outline, currentColor) |
| `app/qr.jsx` | **QRBox** (SVG QR via `qrcode-generator`), **ScanQRModal** (camera + BarcodeDetector + manual fallback), **LabelPrintModal / LabelOverlay** (A4 label sheets) |
| `app/screens-pr.jsx` | Open PR flow (upload → OCR via `window.claude.complete` vision → review → save) + PR Registry |
| `app/screens-wh.jsx` | Dashboard, Receiving, Inventory |
| `app/screens-report.jsx` | Withdraw + printable Issue Slip + PR detail modal |
| `app/screens-summary.jsx` | Monthly summary report (printable) |
| `app/prdoc.jsx` | Mock paper-PR rendering used in the scan demo |
| `app/app.css` | Shell styles: layout, sidebar, topbar, bottom nav, cards, buttons, tables, inputs, modal, toast, responsive |
| `app/screens.css` | Screen-specific styles: scan flow, steps, receiving rows, cart, **QR scan modal, A4 label sheets, print rules** |
| `app/tweaks-panel.jsx` | Prototype-only tweaks panel — **do not implement** |
| `assets/colors_and_type.css` | **All design tokens** (colors, type, spacing, radii, shadows, motion) + font-face |
| `assets/logo-evt.png`, `assets/evt-leaf*.svg` | Brand logo + leaf supergraphic |
| `assets/fonts/` | IBM Plex Sans Thai (self-hosted TTFs) |

## Screens / Views

### 1. Layout shell
- Desktop (>860px): CSS grid `248px 1fr`. Left sidebar `--strong-green #003F1D`, white logo block, grouped nav (เมนูหลัก / งานคลัง / รายงาน), active item = `--evt-green #00652E` pill, notification pips (`--new-day-green #00CB5C` rounded badge) for "awaiting receipt" and "low stock" counts. Decorative EVT leaf SVG bottom-left at 6% opacity.
- Topbar 66px, sticky, white 92% + `backdrop-filter: blur(10px)`: global search, TH/EN segmented toggle, role picker dropdown (เจ้าหน้าที่คลัง / ช่าง / บัญชี / ผู้บริหาร), user avatar.
- Mobile (≤860px): sidebar hidden; **fixed bottom tab bar** (`--strong-green`, all 7 nav items, horizontally scrollable, active pill = `--evt-green`, safe-area padding). Topbar shrinks to 58px, search hidden. Page padding 18px 14px with 100px bottom clearance.
- Page container max-width 1320px, padding 28px. Page header: uppercase Montserrat eyebrow in `--evt-green` (11px / 700 / .14em tracking), 26px/700 Thai title in `--strong-green`, muted 14px subtitle.

### 2. ภาพรวม (Dashboard)
- 4 KPI cards (grid g-4): icon chip 40px `--green-50` bg, value 30px/800 Montserrat `--strong-green`, label 13px muted. 4th card inverted (`--strong-green` bg, accent icon). KPIs: open PRs, awaiting pieces, low-stock count, issued-this-month.
- Row 1 (1.5fr 1fr): "ติดตามการรับของ" card — per-PR progress (PR code + status badge + received/ordered + meter bar, accent fill, green when full); "ต่ำกว่าจุดสั่งซื้อ" card — part name, code, stock/min in danger red, "ต่ำ" badge.
- Row 2 (1fr 1fr): recent PRs table; recent withdrawals list with −qty in `--strong-green`.
- Tweak variants exist (tracker layout / card style) — implement the default (`standard` + `bars`) only.

### 3. เปิด PR (Open PR) — scan flow
4-step indicator (อัปโหลดรูป → ดึงข้อมูล → ตรวจทาน → บันทึก): 28px numbered circles, active = `--evt-green`, done = `--new-day-green` with check icon, connecting 2px bars fill on progress.
- **Step 0 Upload:** two-column (1fr 1fr). Left: dashed dropzone (`--green-200` dash on `--green-50`, radius 16) with camera icon chip, "ถ่ายรูป" primary button (mobile: opens rear camera via `capture="environment"`), "เลือกไฟล์" ghost, "ใช้รูปตัวอย่าง" link. Below an "หรือ" divider: full-width soft button "เปิด PR เอง (กรอกข้อมูล)" for manual entry. Right: scanning-tips card.
- **Step 1 Extract:** uploaded photo on a `--strong-green` stage with an animated scan line (gradient `--new-day-green`, 1.5s loop) + status pill; right card shows 3 spinner progress lines. Real implementation: send image to a vision model / OCR service that returns `{prCode, date, deptName, requester, requesterUnit, note, items[{code, desc, qty, unit}]}` (see the prompt in `screens-pr.jsx` → `aiExtractPR`). Thai PR dates are Buddhist-era dd/mm/yy → convert to ISO (BE − 543).
- **Step 2 Review:** form card — PR code, date, department select (full Thai department list in `data.js`), requester; items as editable rows (grid `116px 1fr 64px 84px 78px`): code (mono), description, qty, unit (datalist of Thai units), warehouse select. Low-confidence OCR fields get `--warning` border + "ความมั่นใจ NN% · ควรตรวจสอบ" tag; matched catalog codes get green "ตรงกับคลัง" tag. Add/remove rows. Warning banner counts unclear fields.
- **Step 3 Done:** success hero — 76px `--new-day-green` check circle, PR code in 22px Montserrat, line/piece stats, "สแกนใบใหม่" + "ไปที่ทะเบียน PR".

### 4. ทะเบียน PR (Registry)
Status filter pills (ทั้งหมด / รอสั่งซื้อ / สั่งซื้อแล้ว / รับบางส่วน / รับครบ / ปิดงาน) — pill style: 1.5px border radius 999, active = solid `--evt-green`. Table: PR code (green mono, scan icon if OCR'd), date (Thai BE format e.g. "3 มิ.ย. 2569"), dept, requester, line count, received/ordered + mini meter, status badge, chevron. Rows clickable → PR detail modal.

### 5. รับของ (Receiving)
Two columns (1.6fr 1fr).
- Left card "เลือก PR ที่ของมาถึง": search input filters open PRs by id/unit/requester; selectable PR buttons (active = green border + `--green-50` bg) showing PR code, unit, status badge, remaining pieces in `--warning`.
- Selected PR item rows (grid `1fr 90px 90px 120px`; header row hidden on mobile, name spans full width): part name + code / received-of-ordered / remaining (warning, or "รับครบแล้ว" badge) / **stepper** (−, mono input, +; clamped 0..remaining; 38px touch targets on mobile).
- Footer: total "รับครั้งนี้: N ชิ้น" + ghost button **"ป้าย QR"** (reprint labels anytime) + primary **"ยืนยันรับของ"**.
- **Confirm behavior:** updates stock + PR item.received, sets PR status (partial/received), appends GR records, toast "รับของเข้าคลังแล้ว", then **automatically opens the QR-label modal** pre-filled with the just-received lines.
- Right card: recent receipts list (+qty in `--smart-green`).

### 6. QR label printing (A4) — `app/qr.jsx`
- **LabelPrintModal**: per part row → checkbox, name + code, label-count stepper (defaults to qty received). Size choice pills: **เล็ก 48×25 mm (4×11 = 44/sheet)** or **กลาง 64×34 mm (3×8 = 24/sheet)**. Footer shows total labels + A4 sheet count; buttons "ไว้ทีหลัง" / "พิมพ์ป้าย (A4)". Hint text: works with a normal A4 printer — A4 sticker paper cut along dashed lines, or plain paper + clear tape.
- **LabelOverlay**: full-screen preview of real-size A4 sheets (CSS mm units: sheet 210×297mm, sm padding 11mm 9mm, md 12.5mm 9mm), each label = dashed 1px cut border, QR left (sm 19mm, md 27mm), right column: part code (bold Montserrat 9pt/12pt), Thai name (6.5pt/8.5pt, 2-line clamp), PR ref (5.5pt/7pt grey). Toolbar (hidden in print): back, hint, print button → `window.print()`.
- **QR content = the part code string** (e.g. `BRK-PAD-F`). Generated client-side with `qrcode-generator` (error level M, SVG).
- Print CSS: `@page { size: A4; margin: 0 }`; when label overlay open, body gets `print-labels` class → only `.label-sheet`s print, one per page (`break-after: page`).

### 7. เบิกของ (Withdraw)
Two columns (1.5fr 1fr).
- Left "เลือกอะไหล่ที่จะเบิก": **search input (filters by code / Thai / English name) + soft "สแกน QR" button**, category pills, part rows (name, green mono code, on-hand count — red if below min, add button → turns into a check badge when in cart). Empty state "ไม่พบอะไหล่ที่ตรงกับคำค้น".
- **ScanQRModal**: 4:3 camera stage (`--strong-green` bg, rear camera via getUserMedia, live decode via `BarcodeDetector` formats `['qr_code']`, 350ms poll), centered square viewfinder outlined `--new-day-green` with dimmed surround. On match → add part to cart, toast "เพิ่มลงรายการเบิกแล้ว · CODE", close. Unknown code → inline danger row "ไม่พบรหัสนี้ในคลัง: CODE", keep scanning. Camera unavailable → warning panel + always-present manual code input + sample-code chips. For production consider a jsQR/zxing fallback where BarcodeDetector is unsupported (Safari/iOS).
- Right "รายการเบิก" (cart): line items with stepper + remove; "ผูกกับงาน / รถ" — **vehicle picker is a searchable combobox** (`SearchSelect` in `ui.jsx`: type-to-filter by bus no. / plate / chassis / route, dropdown shows "ID · plate" with route+chassis as a sub-line, first option = "ไม่ระบุ (เติมสต็อก)" to clear), job no. input, "เบิกไปใช้กับ" free text; total pieces; primary block button "บันทึกเบิก + ออกใบเบิก".
- **Issue slip** (after submit): printable A4-style document (794px sheet) — EVT logo + company header over 3px green rule, doc meta grid (slip no., date, dept, vehicle, chassis, job), items table (green-tinted header row), totals row, 3 dotted signature lines (ผู้เบิก / ผู้อนุมัติ / บัญชี), tagline footer "รถพลังงานไฟฟ้า อีวีที — พลังงานสะอาด เพื่อโลกสดใส". Print/download buttons → `window.print()`.

### 8. คลังอะไหล่ (Inventory)
Category pills + table: code, name + category, warehouse, on-hand (red when below min), reorder point, ปกติ/ต่ำ badge.

### 9. สรุปสิ้นเดือน (Monthly Summary)
Month select + printable report sheet: KPI strip, goods-received table, withdrawals table (with reason/vehicle), consumption by department, top parts. Print + "ส่งสรุปให้ผู้บริหาร" actions. See `screens-summary.jsx`.

## Interactions & Behavior
- Navigation = view state (no URL routing in prototype); production should use real routes per screen.
- Toast: bottom-center dark green pill, auto-dismiss 2.6s (on mobile raised above the bottom nav).
- Modals: scrim `--overlay-scrim`, radius 18, pop animation 240ms `cubic-bezier(0.22,1,0.36,1)`, Esc + scrim-click to close; bottom-sheet style on mobile.
- Buttons: hover darkens (primary → `--brand-hover`), press `translateY(1px)`. No scale/bounce animations anywhere.
- Screen transitions: 240ms fade/slide-up (`.fadein`).
- Steppers clamp at bounds; receive stepper additionally clamps to remaining qty.
- All numerals/codes use Montserrat (`.mono`, tabular numerals); Thai text uses IBM Plex Sans Thai.
- Language toggle persists (`localStorage evt_lang`); every string must come from the i18n table.
- Printing: three print surfaces — issue slip, monthly report (both `.doc-sheet`), and QR label sheets (isolated via `body.print-labels`).

## State Management
Prototype state lives in one React tree (`app.jsx`):
- `db` = `{ prs, parts, issues, receipts, vehicles, warehouses, departments }` (cloned from mocks)
- `actions.savePR(pr)` — prepend new PR (status `pending`)
- `actions.receive(prId, {code: qty})` — increment item.received (≤ ordered), add stock, derive PR status (`partial` | `received`), append GR rows
- `actions.withdraw(cart, {vehicle, job, jobTitle, by})` — decrement stock (≥ 0), append issue rows, return slip data
- Derived: low stock = `stock < min`; nav pips; `prTotals(pr)` = sums of ordered/received/used/lines.

## Data model → suggested schema (for the DB the owner plans to add)
Mirror `data.js` shapes:

- `warehouses(id, no, name_th, name_en)`
- `departments(id, name_th, detail)` — full real list already in `data.js`
- `vehicles(id, chassis, plate, model, route)`
- `parts(code PK, name_th, name_en, unit, warehouse_id, stock, min, price, category)`
- `prs(id PK e.g. "PR-2569-0148", date, dept_id, requester, requester_unit, status enum(pending|ordered|partial|received|closed), scanned bool, note)`
- `pr_items(pr_id, part_code, qty, received, used, warehouse_id, unit)`
- `receipts(id "GR-…", date, pr_id, part_code, qty, received_by)`
- `issues(id "WD-…", date, part_code, qty, warehouse_id, issued_by, dept_id, vehicle_id nullable, job_no, job_title, pr_ref)`

ID conventions use Buddhist-era year: `PR-2569-NNNN`, `GR-2569-NNNN`, `WD-2569-NNNN`. Receiving and withdrawal must be transactional (stock + status + log together).

## Design Tokens (from `assets/colors_and_type.css` — import it wholesale)
- **Colors:** EVT Green `#00652E` (primary/brand), New Day Green `#00CB5C` (accent), Smart Green `#007F3A`, Strong Green `#003F1D` (sidebar/inverse), EVT Gold `#C1B742`; warm neutrals (`--neutral-0…900`, bg `#FAFAF7`/white, border `#E8E7DE`); semantic `--danger`, `--warning`, `--info`, `--success`. Usage ratio ≈ 60/15/10/10/5 — most surfaces stay neutral.
- **Type:** Montserrat (EN, numerals, codes — weights 300–900) + IBM Plex Sans Thai (TH — self-hosted, weights 300–700). Body 16/24; eyebrows 11–12px/700/.14em uppercase.
- **Spacing:** 4pt scale (`--s-1…--s-24`).
- **Radii:** xs 4 / sm 6 / md 10 / lg 16 / xl 24 / pill 999. Cards 16, buttons 10, inputs 10.
- **Shadows:** green-tinted (`rgba(0,38,18,*)`), 4 levels — never neutral black.
- **Motion:** 150/240/420ms; ease-out `cubic-bezier(0.22,1,0.36,1)`; fades over slides; no spins/bounces.
- Focus ring: `0 0 0 3px rgba(0,101,46,.18)`.

## Assets
- `assets/logo-evt.png` — EVT oval logo (never recolor)
- `assets/evt-leaf.svg`, `assets/evt-leaf-solid.svg` — brand supergraphic, used at low opacity on dark green surfaces only
- `assets/fonts/IBMPlexSansThai-*.ttf` — self-hosted Thai font
- Icons: inline SVG outline set in `app/icons.jsx` (Lucide-style, 1.5–2.5px stroke, currentColor) — map to Lucide in production
- No emoji anywhere. No photography in this app.

## Out of scope / prototype-only
- `app/tweaks-panel.jsx` and the Tweaks UI (design-review tooling)
- `window.claude.complete` OCR call — replace with your vision/OCR backend
- Sample-code chips inside the scan modal (demo affordance)
- Mock "ocrSample" and seeded data
