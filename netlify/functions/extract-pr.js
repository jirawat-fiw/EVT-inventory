/* ============================================================
   Netlify Function: extract-pr
   รับรูปใบ PR (base64) → เรียก Claude วิชัน → คืน JSON มีโครงสร้าง
   API key อยู่ใน env var ANTHROPIC_API_KEY (ตั้งใน Netlify, ไม่อยู่ในโค้ด)
   ============================================================ */

// โครงสร้าง JSON ที่ต้องการ (structured outputs — การันตีว่าพาร์สได้)
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    prCode: { type: "string" },
    date: { type: "string" }, // ISO YYYY-MM-DD
    deptId: { type: "string" },
    deptName: { type: "string" },
    requester: { type: "string" },
    requesterUnit: { type: "string" },
    note: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          code: { type: "string" },
          desc: { type: "string" },
          qty: { type: "number" },
          unit: { type: "string" },
          wh: { type: "string" },
        },
        required: ["code", "desc", "qty", "unit", "wh"],
      },
    },
  },
  required: ["prCode", "date", "deptId", "deptName", "requester", "requesterUnit", "note", "items"],
};

const PROMPT = [
  "อ่านใบขอซื้อ (PR / ใบขอซื้อ) ภาษาไทยจากภาพ แล้วดึงข้อมูลเป็น JSON ตาม schema ที่กำหนด",
  "กฎ:",
  "- prCode: เลขที่ใบขอ/ใบขออนุมัติซื้อ (มุมขวาบน มักขึ้นต้นด้วย PR) คัดลอกมาตามจริง ห้ามใช้เบอร์โทร เลขผู้เสียภาษี หรือเลขที่อยู่",
  "- date: วันที่บนเอกสาร (ไม่ใช่วันที่รับของ) วันที่ไทยเป็น dd/mm/yy โดย yy คือปี พ.ศ. สองหลักท้าย แปลงเป็น ค.ศ. ISO (YYYY-MM-DD) โดยลบ 543 จากปี พ.ศ. เต็ม เช่น 15/05/69 -> 2026-05-15",
  "- deptId: รหัสแผนกที่เป็นตัวเลข (ช่อง 'แผนก' เช่น 52) คัดเฉพาะรหัส",
  "- deptName: ข้อความชื่อแผนก/โครงการ ถ้ามี",
  "- requester: ชื่อผู้จัดทำ/ผู้ขอ ถ้าไม่มีให้เป็นค่าว่าง",
  "- requesterUnit: หน่วยงาน/รายละเอียดแผนก ถ้าไม่มีให้เป็นค่าว่าง",
  "- note: ข้อความหมายเหตุ ถ้าไม่มีให้เป็นค่าว่าง",
  "- items: หนึ่งแถวต่อหนึ่งรายการในตาราง",
  "    code = รหัสสินค้า (ตัวเลข/รหัสในคอลัมน์ รหัสสินค้า)",
  "    desc = ชื่อ/รายละเอียดสินค้า",
  "    qty  = จำนวนขอซื้อ (เฉพาะตัวเลข)",
  "    unit = หน่วย (เช่น ตัว ชุด เส้น)",
  "    wh   = 'WH-' ตามด้วยเลขคลัง 2 หลักจากคอลัมน์ 'คลัง' เช่นคลัง 04 -> 'WH-04' ถ้าไม่ระบุใช้ 'WH-01'",
  "ตอบเป็น JSON ที่ถูกต้องตาม schema เท่านั้น",
].join("\n");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "method_not_allowed" }) };
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { statusCode: 500, body: JSON.stringify({ error: "ANTHROPIC_API_KEY ยังไม่ได้ตั้งค่าใน Netlify" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "bad_json" }) }; }

  const image = body.image;
  const mediaType = body.mediaType || "image/jpeg";
  if (!image) return { statusCode: 400, body: JSON.stringify({ error: "no_image" }) };

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 2048,
        output_config: { format: { type: "json_schema", schema: SCHEMA } },
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: PROMPT },
          ],
        }],
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return { statusCode: 502, body: JSON.stringify({ error: "anthropic_error", status: resp.status, detail }) };
    }

    const data = await resp.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (!textBlock) {
      return { statusCode: 502, body: JSON.stringify({ error: "no_text_block" }) };
    }
    let parsed;
    try { parsed = JSON.parse(textBlock.text); }
    catch { return { statusCode: 502, body: JSON.stringify({ error: "parse_failed", raw: textBlock.text }) }; }

    return { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify(parsed) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "function_error", detail: String(e && e.message || e) }) };
  }
};
