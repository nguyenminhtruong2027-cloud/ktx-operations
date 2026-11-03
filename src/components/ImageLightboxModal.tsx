import { X, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { useState } from 'react';

interface ImageLightboxModalProps {
  imageUrl: string | null;
  title?: string;
  onClose: () => void;
}

export default function ImageLightboxModal({ imageUrl, title, onClose }: ImageLightboxModalProps) {
  const [scale, setScale] = useState(1);

  if (!imageUrl) return null;

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
      <div className="relative max-w-4xl w-full flex flex-col items-center">
        {/* Top bar */}
        <div className="w-full flex justify-between items-center text-white mb-3 px-2">
          <div className="text-sm font-semibold truncate">{title || 'Ảnh minh chứng hiện trường VINCONS'}</div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setScale(s => Math.min(s + 0.25, 2.5))}
              className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition"
              title="Phóng to"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setScale(s => Math.max(s - 0.25, 0.75))}
              className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition"
              title="Thu nhỏ"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <a
              href={imageUrl}
              download="minh_chung_vincons.jpg"
              className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition"
              title="Tải ảnh về máy"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 bg-red-600/80 hover:bg-red-600 rounded-lg transition"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image Display */}
        <div className="overflow-auto max-h-[80vh] flex items-center justify-center rounded-xl bg-black/40 p-2">
          <img
            src={imageUrl}
            alt="Minh chứng hiện trường"
            style={{ transform: `scale(${scale})`, transition: 'transform 0.2s ease-out' }}
            className="max-h-[75vh] w-auto object-contain rounded-lg shadow-2xl"
          />
        </div>
      </div>
    </div>
  );
}
