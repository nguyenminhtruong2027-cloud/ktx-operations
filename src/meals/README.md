# Module Suất Ăn (`src/meals/`)

Module độc lập quản lý thực đơn tuần, kiểm định định lượng & quy tắc an toàn thực phẩm, và xuất báo cáo Zalo cho từng khu KTX.

## 1. Cách nhúng vào ứng dụng khác

Import và render component mặc định từ `src/meals/index.tsx`:

```tsx
import MealsModule from './meals';

export function App() {
  return (
    <div className="p-4">
      <MealsModule />
    </div>
  );
}
```

- Module không tự tạo header hay thanh điều hướng cấp ứng dụng; bên trong chỉ gồm 3 tab con (**Thực đơn**, **Kiểm định**, **Báo cáo**) và nút **Cài đặt**.
- Toàn bộ dữ liệu lưu trên `localStorage` với tiền tố `meals_v2_` (`meals_v2_menus`, `meals_v2_counts`, `meals_v2_overrides`, `meals_v2_settings`).

## 2. Thư viện npm cần cài

- `react` (`^19.0.0` hoặc `^18.0.0`)
- `react-dom`
- `lucide-react` (biểu tượng giao diện)
- `xlsx` (SheetJS — đọc file Excel `.xlsx`, `.xls`, `.ods` và `.csv` trực tiếp trên trình duyệt)
- Tailwind CSS (để hiển thị giao diện)

## 3. Biến môi trường (Backend Proxy)

- `GEMINI_API_KEY`: Khoá API Google Gemini dùng ở phía server (`server.js`) cho tính năng đọc ảnh/PDF. Không bao giờ đưa khoá này vào mã nguồn client.

## 4. API `/api/extract-menu`

Hàm `extractMenuFromFile(file)` trong `src/meals/extractMenu.ts` gửi `POST /api/extract-menu` khi người dùng tải lên ảnh (`PNG`, `JPG`, `WEBP`) hoặc `PDF`.

### Dữ liệu gửi lên (Request JSON)

```json
{
  "mimeType": "image/jpeg",
  "data": "<base64-encoded-file-content>"
}
```

### Dữ liệu trả về (Response JSON)

```json
{
  "ok": true,
  "data": {
    "ncc": "TP",
    "tuanTu": "09/11/2026",
    "tuanDen": "15/11/2026",
    "loai": "man",
    "ngay": [
      {
        "ma": "T2",
        "ngayThang": "09/11/2026",
        "sang": { "mon": "Bún bò", "thanhPhan": "Bún 150g, thịt bò 50g" },
        "trua": [
          { "ten": "Thịt heo kho củ cải", "tl": "Thịt: 45-50gr, củ cải 40gr" }
        ],
        "toi": [
          { "ten": "Vịt kho chao", "tl": "80gr" }
        ]
      }
    ],
    "batThuongFile": []
  }
}
```
