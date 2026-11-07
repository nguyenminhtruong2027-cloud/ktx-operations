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
const PROMPT = `Bạn là máy trích xuất thực đơn từ tài liệu (ảnh chụp hoặc PDF) của nhà ăn VINCONS.
Chỉ trả JSON theo schema, không bịa món, ô không đọc được để rỗng.

QUY TẮC:
- ncc: mã nhà cung cấp nếu nhận ra (TP=Tám Phương, LD=Lim Dương, ML=Minh Long Food, VS=Vina Story, NS=Nguyên Sài Gòn, HN=Hương Ngọc Phát, TH=Thiên Hồng Phúc), không rõ để "TP".
- tuanTu, tuanDen: ngày bắt đầu (Thứ 2) và kết thúc (Chủ nhật) định dạng "dd/mm/yyyy".
- loai: "chay" nếu là thực đơn chay, ngược lại "man".
- ngay: luôn có đủ 7 phần tử theo thứ tự T2, T3, T4, T5, T6, T7, CN.
  * ma: "T2" | "T3" | "T4" | "T5" | "T6" | "T7" | "CN"
  * ngayThang: "dd/mm/yyyy"
  * sang: { mon: "tên món", thanhPhan: "nguyên văn các thành phần và gram" }
  * trua: mảng 7 phần tử { ten, tl } (r1,r2=món chính; r3=món phụ; r4=rau; r5=canh; r6=cơm; r7=tráng miệng). "tl" giữ NGUYÊN VĂN chuỗi trọng lượng.
  * toi: mảng 7 phần tử { ten, tl } tương tự.
- batThuongFile: mảng các ghi chú bất thường nếu có (ngày sai, chữ mờ, lỗi chính tả).`;

const DISH_ROW_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ten: { type: 'STRING' },
    tl: { type: 'STRING' }
  },
  required: ['ten', 'tl']
};

const DAY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ma: { type: 'STRING' },
    ngayThang: { type: 'STRING' },
    sang: {
      type: 'OBJECT',
      properties: {
        mon: { type: 'STRING' },
        thanhPhan: { type: 'STRING' }
      },
      required: ['mon', 'thanhPhan']
    },
    trua: { type: 'ARRAY', items: DISH_ROW_SCHEMA },
    toi: { type: 'ARRAY', items: DISH_ROW_SCHEMA }
  },
  required: ['ma', 'ngayThang', 'sang', 'trua', 'toi']
};

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ncc: { type: 'STRING' },
    tuanTu: { type: 'STRING' },
    tuanDen: { type: 'STRING' },
    loai: { type: 'STRING' },
    ngay: { type: 'ARRAY', items: DAY_SCHEMA },
    batThuongFile: { type: 'ARRAY', items: { type: 'STRING' } }
  },
  required: ['ncc', 'tuanTu', 'tuanDen', 'loai', 'ngay', 'batThuongFile']
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
