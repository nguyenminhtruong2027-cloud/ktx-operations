// server.js
// Proxy backend giữ GEMINI_API_KEY phía server — key không bao giờ có mặt ở client.
// Endpoint: POST /api/extract-menu — gọi Gemini multimodal (ảnh/PDF) với responseSchema JSON, temperature 0.

import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.GEMINI_PROXY_PORT || 3101;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_KEY = process.env.GEMINI_API_KEY;
// Placeholder (VD: từ .env mẫu) coi như chưa có key thật
const isRealKey = Boolean(API_KEY) && !/^(PASTE|MY_|your)/i.test(API_KEY.trim());

const app = express();
app.use(express.json({ limit: '60mb' }));

// ---------- Prompt & responseSchema ----------
const PROMPT = `Bạn là máy trích xuất thực đơn từ tài liệu (ảnh chụp hoặc PDF) của nhà ăn Vincons.
Nhiệm vụ: đọc toàn bộ nội dung và trích xuất thực đơn theo tuần.

QUY TẮC:
- Xuất chính xác những gì có trong tài liệu, KHÔNG bịa thêm món, KHÔNG suy đoán.
- days luôn có đủ 7 phần tử theo thứ tự Thứ 2 -> Chủ nhật, ngay cả khi trống (mảng rỗng).
- Mỗi ngày có 3 bữa: sang (ăn nhẹ/bữa sáng), trua (bữa chính/bữa trưa), toi (bữa tối/tăng ca). Bữa không có trong tài liệu để mảng rỗng.
- Món mặn (có thịt/cá/đạm) vào "man", món chay (rau/rau muống/đậu hũ...) vào "chay" của từng bữa. Tráng miệng đi vào trangMiengMan / trangMiengChay.
- Với mỗi món: "name" là tên món SẠCH (bỏ số thứ tự, định lượng); "raw" là dòng gốc có đủ định lượng nếu hiển thị (VD: "Vịt kho chao (Vịt 55–65g · Nước sốt 15-20g)"); "confidence" là độ tin cậy đọc 0..1 (chữ mờ/nghi ngờ < 0.5).
- supplier: tên nhà cung cấp thực đơn nếu hiện trong tài liệu (VD: Cơm Việt Story, Tám Phương, Hương Ngọc Phát...). Không thấy thì để chuỗi rỗng.
- weekNote: đoạn văn bản ngày/tuần ("duy nhất từ ngày... đến ngày...", "Tuần: ...") hiển thị trong tài liệu, không có thì rỗng.
- Ngày tháng: nếu tài liệu ghi rõ ngày (dd/mm/yyyy) thì điền isoDate sang định dạng yyyy-mm-dd, không có thì rỗng.
- Dùng đúng từ tiếng Việt trong tài liệu, giữ nguyên dấu tiếng Việt.`;

const DISH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    raw: { type: 'STRING' },
    confidence: { type: 'NUMBER' }
  },
  required: ['name', 'raw', 'confidence']
};

const SHIFT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    man: { type: 'ARRAY', items: DISH_SCHEMA },
    chay: { type: 'ARRAY', items: DISH_SCHEMA },
    trangMiengMan: { type: 'STRING' },
    trangMiengChay: { type: 'STRING' }
  },
  required: ['man', 'chay', 'trangMiengMan', 'trangMiengChay']
};

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    supplier: { type: 'STRING' },
    weekNote: { type: 'STRING' },
    days: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          dayLabel: { type: 'STRING' },
          isoDate: { type: 'STRING' },
          shifts: {
            type: 'OBJECT',
            properties: {
              sang: SHIFT_SCHEMA,
              trua: SHIFT_SCHEMA,
              toi: SHIFT_SCHEMA
            },
            required: ['sang', 'trua', 'toi']
          }
        },
        required: ['dayLabel', 'isoDate', 'shifts']
      }
    }
  },
  required: ['supplier', 'weekNote', 'days']
};

// ---------- Endpoint ----------
app.post('/api/extract-menu', async (req, res) => {
  if (!isRealKey) {
    return res.status(503).json({
      error: 'PROXY_NOT_CONFIGURED',
      message: 'Chưa cấu hình GEMINI_API_KEY trên server. Hãy thiết lập trong file .env hoặc Secrets.'
    });
  }

  const { mimeType, data, weekStartDate, supplierHint } = req.body || {};
  if (!mimeType || !data) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Thiếu mimeType hoặc data (base64).' });
  }
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
  if (!ALLOWED.includes(mimeType)) {
    return res.status(400).json({ error: 'UNSUPPORTED_MIME', message: `Loại file không hỗ trợ: ${mimeType}` });
  }

  const prompt = PROMPT +
    (weekStartDate ? `\n- Tuần hiện tại của app bắt đầu vào ${weekStartDate} (dùng làm bối cảnh sắp xếp thứ tự ngày nếu tài liệu thiếu tiêu đề ngày).` : '') +
    (supplierHint ? `\n- Nhà cung cấp dự kiến: ${supplierHint} (chỉ dùng khi tài liệu thực sự tên này).` : '') +
    '\n\nChỉ trả về JSON đúng schema, không thêm giải thích.';

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data } }
        ]
      }],
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const text = result.text || '';
    if (!text) {
      return res.status(502).json({ error: 'EMPTY_RESPONSE', message: 'Gemini trả về nội dung rỗng.' });
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: 'BAD_JSON', message: 'Gemini trả về JSON không hợp lệ.' });
    }
    res.json({ ok: true, model: MODEL, data: parsed });
  } catch (err) {
    const status = err && err.status ? err.status : 500;
    console.error('[gemini-proxy] extract-menu failed:', err && err.message ? err.message : err);
    res.status(status >= 400 ? status : 500).json({
      error: 'GEMINI_ERROR',
      message: (err && err.message) || 'Lỗi gọi Gemini ngoài dự kiến',
      upstreamStatus: status
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, model: MODEL, hasKey: isRealKey });
});

// ---------- Phục vụ bản build tĩnh (dist) khi deploy ----------
const DIST_DIR = path.join(__dirname, 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[gemini-proxy] listening on http://localhost:${PORT} | model=${MODEL} | key=${API_KEY ? 'OK' : 'MISSING'}`);
});
