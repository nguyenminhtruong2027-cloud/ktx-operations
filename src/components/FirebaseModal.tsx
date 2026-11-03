import { Database, CheckCircle2, Shield, ArrowRight, X, Check } from 'lucide-react';
import { isFirebaseConfigured, firebaseConfig } from '../utils/firebase';

interface FirebaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FirebaseModal({ isOpen, onClose }: FirebaseModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">Cấu hình Firebase & Firestore</h3>
              <p className="text-xs text-slate-500">Đồng bộ dữ liệu thời gian thực cho hệ thống vận hành VINCONS</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
          {isFirebaseConfigured ? (
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-emerald-900 space-y-2">
              <div className="flex items-center space-x-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Đã nạp thành công cấu hình Firebase (vanhanh-lantrai)</span>
              </div>
              <p className="text-xs text-emerald-800">
                Các biến môi trường Firebase đã được thiết lập đầy đủ trong tệp <code className="bg-emerald-100 px-1 py-0.5 rounded font-mono">.env</code>.
              </p>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono bg-white p-3 rounded-lg border border-emerald-200">
                <div><strong>Project ID:</strong> {firebaseConfig.projectId}</div>
                <div><strong>Auth Domain:</strong> {firebaseConfig.authDomain}</div>
                <div><strong>Storage Bucket:</strong> {firebaseConfig.storageBucket}</div>
                <div><strong>Sender ID:</strong> {firebaseConfig.messagingSenderId}</div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-(--vc-brand-2) space-y-1">
              <p className="font-bold text-sm">💡 Trạng thái hiện tại:</p>
              <p>
                Ứng dụng đang hoạt động ở chế độ <strong>Bộ nhớ cục bộ thông minh (Local Persistence)</strong>. Mọi thao tác thêm/sửa/xóa và cập nhật trạng thái hoạt động ngay lập tức.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-sm">Thông số cấu hình hiện hành trong dự án:</h4>
            <div className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] space-y-1">
              <div>VITE_FIREBASE_PROJECT_ID="{firebaseConfig.projectId}"</div>
              <div>VITE_FIREBASE_AUTH_DOMAIN="{firebaseConfig.authDomain}"</div>
              <div>VITE_FIREBASE_STORAGE_BUCKET="{firebaseConfig.storageBucket}"</div>
              <div>VITE_FIREBASE_MESSAGING_SENDER_ID="{firebaseConfig.messagingSenderId}"</div>
              <div>VITE_FIREBASE_APP_ID="{firebaseConfig.appId}"</div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                <Shield className="w-4 h-4 text-teal-600" />
                <span>Cơ chế đồng bộ kép (Dual-Sync Architecture):</span>
              </div>
              <p className="text-slate-600">
                Hệ thống tự động lưu trữ dữ liệu tại máy khách (LocalStorage) để đảm bảo tốc độ phản hồi tức thì và không bị gián đoạn khi kết nối mạng chập chờn tại công trường/lán trại, đồng thời sẵn sàng đẩy dữ liệu lên Firestore <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">vanhanh-lantrai</code>.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-(--vc-brand-2) text-white font-bold rounded-xl text-xs hover:bg-blue-900 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
