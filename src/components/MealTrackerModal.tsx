import { useState } from 'react';
import { MealRecord, TaskItem } from '../types';
import { formatDateVN } from '../utils/helpers';
import { Utensils, CheckCircle2, AlertTriangle, Plus, X, Save, ShieldCheck, FileSpreadsheet } from 'lucide-react';

interface MealTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: string;
  mealRecords: MealRecord[];
  onSaveMealRecord: (record: MealRecord) => void;
  onSyncWithTasks: (mealRecords: MealRecord[]) => void;
}

export default function MealTrackerModal({
  isOpen,
  onClose,
  currentDate,
  mealRecords,
  onSaveMealRecord,
  onSyncWithTasks
}: MealTrackerModalProps) {
  const [editingRecord, setEditingRecord] = useState<MealRecord | null>(null);

  if (!isOpen) return null;

  const dateMeals = mealRecords.filter(m => m.date === currentDate);
  const totalOrdered = dateMeals.reduce((acc, m) => acc + m.orderedCount, 0);
  const totalReceived = dateMeals.reduce((acc, m) => acc + m.receivedCount, 0);
  const totalDistributed = dateMeals.reduce((acc, m) => acc + m.distributedCount, 0);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl">
              <Utensils className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">Sổ Đối chiếu & Kiểm soát Suất ăn VINCONS</h3>
              <p className="text-xs text-slate-500">Giám sát số lượng đặt, thực nhận, phát sinh và lưu mẫu thực phẩm • Ngày {formatDateVN(currentDate)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Tổng suất báo đặt NCC</span>
            <div className="text-xl font-bold text-slate-900 mt-1">{totalOrdered} suất</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <span className="text-xs text-(--vc-brand-2) font-medium">Thực nhận từ NCC</span>
            <div className="text-xl font-bold text-(--vc-brand-2) mt-1">{totalReceived} suất</div>
          </div>
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
            <span className="text-xs text-emerald-700 font-medium">Đã phát cho Tổ đội</span>
            <div className="text-xl font-bold text-emerald-700 mt-1">{totalDistributed} suất</div>
          </div>
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
            <span className="text-xs text-amber-800 font-medium">Lưu mẫu thức ăn 24h</span>
            <div className="text-sm font-bold text-amber-800 mt-1 flex items-center space-x-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Đạt tiêu chuẩn y tế</span>
            </div>
          </div>
        </div>

        {/* Meal Records Table */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-sm text-slate-900">Chi tiết các bữa ăn trong ngày</h4>
            <button
              onClick={() => {
                setEditingRecord({
                  id: `meal-${Date.now()}`,
                  date: currentDate,
                  mealType: 'Trưa',
                  orderedCount: 250,
                  receivedCount: 250,
                  distributedCount: 250,
                  diffCount: 0,
                  sampleStored: true,
                  qualityStatus: 'Đạt chuẩn',
                  supplierName: 'Công ty Suất ăn Công nghiệp Hưng Phát',
                  inspectedBy: 'Chuyên viên vận hành',
                  notes: ''
                });
              }}
              className="px-3 py-1.5 bg-(--vc-brand-2) text-white text-xs font-semibold rounded-lg hover:bg-blue-900 flex items-center space-x-1 transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm ghi nhận bữa ăn</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <th className="p-3">Bữa ăn</th>
                  <th className="p-3">Báo đặt</th>
                  <th className="p-3">Thực nhận</th>
                  <th className="p-3">Đã phát</th>
                  <th className="p-3">Lưu mẫu 24h</th>
                  <th className="p-3">Chất lượng</th>
                  <th className="p-3">Người kiểm tra</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dateMeals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400">
                      Chưa có dữ liệu suất ăn cho ngày này. Hãy bấm "Thêm ghi nhận bữa ăn" để bắt đầu.
                    </td>
                  </tr>
                ) : (
                  dateMeals.map(meal => (
                    <tr key={meal.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-(--vc-brand-2)">Bữa {meal.mealType}</td>
                      <td className="p-3 font-semibold">{meal.orderedCount}</td>
                      <td className="p-3 font-semibold text-blue-700">{meal.receivedCount}</td>
                      <td className="p-3 font-semibold text-emerald-700">{meal.distributedCount}</td>
                      <td className="p-3">
                        {meal.sampleStored ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-semibold text-[10px] flex items-center w-fit space-x-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Đã lưu mẫu</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold text-[10px]">
                            Chưa lưu mẫu!
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${
                          meal.qualityStatus === 'Đạt chuẩn' ? 'bg-emerald-100 text-emerald-800' :
                          meal.qualityStatus === 'Cần lưu ý' ? 'bg-amber-100 text-amber-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {meal.qualityStatus}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">{meal.inspectedBy}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setEditingRecord(meal)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium text-[11px]"
                        >
                          Chỉnh sửa
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Modal sub-view */}
        {editingRecord && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-300 space-y-4">
            <h5 className="font-bold text-sm text-(--vc-brand-2)">Cập nhật thông tin Bữa {editingRecord.mealType}</h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Loại bữa ăn:</label>
                <select
                  value={editingRecord.mealType}
                  onChange={(e) => setEditingRecord({ ...editingRecord, mealType: e.target.value as any })}
                  className="w-full p-2 border rounded-lg bg-white"
                >
                  <option value="Sáng">Sáng</option>
                  <option value="Trưa">Trưa</option>
                  <option value="Tối">Tối</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Số lượng báo đặt NCC:</label>
                <input
                  type="number"
                  value={editingRecord.orderedCount}
                  onChange={(e) => setEditingRecord({ ...editingRecord, orderedCount: Number(e.target.value) })}
                  className="w-full p-2 border rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Số lượng thực nhận:</label>
                <input
                  type="number"
                  value={editingRecord.receivedCount}
                  onChange={(e) => setEditingRecord({ ...editingRecord, receivedCount: Number(e.target.value) })}
                  className="w-full p-2 border rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Số lượng phát cho công nhân:</label>
                <input
                  type="number"
                  value={editingRecord.distributedCount}
                  onChange={(e) => setEditingRecord({ ...editingRecord, distributedCount: Number(e.target.value) })}
                  className="w-full p-2 border rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Nhà cung cấp:</label>
                <input
                  type="text"
                  value={editingRecord.supplierName}
                  onChange={(e) => setEditingRecord({ ...editingRecord, supplierName: e.target.value })}
                  className="w-full p-2 border rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Chất lượng cảm quan:</label>
                <select
                  value={editingRecord.qualityStatus}
                  onChange={(e) => setEditingRecord({ ...editingRecord, qualityStatus: e.target.value as any })}
                  className="w-full p-2 border rounded-lg bg-white"
                >
                  <option value="Đạt chuẩn">Đạt chuẩn</option>
                  <option value="Cần lưu ý">Cần lưu ý</option>
                  <option value="Không đạt">Không đạt</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-3 text-xs pt-1">
              <label className="flex items-center space-x-2 cursor-pointer font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={editingRecord.sampleStored}
                  onChange={(e) => setEditingRecord({ ...editingRecord, sampleStored: e.target.checked })}
                  className="w-4 h-4 text-(--vc-brand-2) rounded"
                />
                <span>Đã lưu mẫu thực phẩm trong tủ bảo quản 24 giờ theo quy định</span>
              </label>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setEditingRecord(null)}
                className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs rounded-lg font-medium"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  onSaveMealRecord(editingRecord);
                  setEditingRecord(null);
                }}
                className="px-4 py-1.5 bg-(--vc-brand-2) text-white text-xs font-bold rounded-lg hover:bg-blue-900 transition flex items-center space-x-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu thông tin suất ăn</span>
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-[11px] text-slate-500 italic">
            * Dữ liệu đối chiếu suất ăn liên kết chặt chẽ với các phiếu việc kiểm soát suất ăn sáng, trưa, tối hằng ngày.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 text-white font-bold text-xs rounded-xl hover:bg-slate-900 transition"
          >
            Đóng bảng đối chiếu
          </button>
        </div>
      </div>
    </div>
  );
}
