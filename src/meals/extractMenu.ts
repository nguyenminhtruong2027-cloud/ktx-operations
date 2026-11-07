import { WeeklyMenu } from './types';

function normNFC(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).normalize('NFC').replace(/\s+/g, ' ').trim();
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      const idx = res.indexOf(',');
      resolve(idx >= 0 ? res.slice(idx + 1) : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Hàm duy nhất gọi AI trích xuất thực đơn từ ảnh (PNG/JPG/WEBP) hoặc PDF.
 * Gửi POST tới `/api/extract-menu` để có thể thay đổi endpoint/backend mà không sửa module.
 */
export async function extractMenuFromFile(
  file: File,
  endpoint = '/api/extract-menu'
): Promise<WeeklyMenu> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const mimeType = file.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg');
  const data = await fileToBase64(file);

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mimeType, data })
  });

  const json = await resp.json();
  if (!resp.ok || !json.ok || !json.data) {
    throw new Error(json.message || `Lỗi trích xuất file ${file.name}`);
  }

  const d = json.data;
  return {
    id: `menu-${d.ncc || 'UNKNOWN'}-${d.loai || 'man'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ncc: normNFC(d.ncc),
    tuanTu: normNFC(d.tuanTu),
    tuanDen: normNFC(d.tuanDen),
    loai: d.loai === 'chay' ? 'chay' : 'man',
    ngay: (d.ngay || []).map((day: any) => ({
      ma: day.ma,
      ngayThang: normNFC(day.ngayThang),
      sang: {
        mon: normNFC(day.sang?.mon),
        thanhPhan: normNFC(day.sang?.thanhPhan)
      },
      trua: (day.trua || []).map((r: any) => ({
        ten: normNFC(r.ten),
        tl: normNFC(r.tl)
      })),
      toi: (day.toi || []).map((r: any) => ({
        ten: normNFC(r.ten),
        tl: normNFC(r.tl)
      }))
    })),
    batThuongFile: (d.batThuongFile || []).map(normNFC),
    fileName: file.name,
    uploadedAt: new Date().toISOString()
  };
}
