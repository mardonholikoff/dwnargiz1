import React, { useState, useMemo } from 'react';
import {
  Search,
  Trash2,
  Edit3,
  Calendar,
  User,
  Phone,
  Car,
  Wrench,
  Droplet,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  Save,
  Database,
  Filter,
  RefreshCw
} from 'lucide-react';
import { ServiceRecord, RecordStatus } from '../types';
import { createAdminLog } from '../lib/adminSession';

interface AdminRecordsManagerProps {
  records: ServiceRecord[];
  currentUsername: string;
  onSaveRecord: (record: ServiceRecord) => Promise<void> | void;
  onDeleteRecord: (id: string) => Promise<void> | void;
  onClearAllRecords: () => Promise<void> | void;
}

export const AdminRecordsManager: React.FC<AdminRecordsManagerProps> = ({
  records,
  currentUsername,
  onSaveRecord,
  onDeleteRecord,
  onClearAllRecords,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'cost_high' | 'cost_low'>('newest');

  // Edit record state
  const [editingRecord, setEditingRecord] = useState<ServiceRecord | null>(null);
  const [editForm, setEditForm] = useState<Partial<ServiceRecord>>({});

  // Confirm delete states
  const [recordToDelete, setRecordToDelete] = useState<ServiceRecord | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Unique customers count
  const uniqueCustomersCount = useMemo(() => {
    const plates = new Set(records.map((r) => r.carPlate.toUpperCase().trim()));
    return plates.size;
  }, [records]);

  // Total revenue
  const totalRevenue = useMemo(() => {
    return records.reduce((sum, r) => sum + (Number(r.costUzs) || 0), 0);
  }, [records]);

  // Filtered and sorted records (SHOWS ALL RECORDS WITHOUT DATE RESTRICTION)
  const filteredRecords = useMemo(() => {
    return records
      .filter((record) => {
        // Status filter
        if (statusFilter !== 'all' && record.status !== statusFilter) {
          return false;
        }

        // Search term filter
        if (!searchTerm.trim()) return true;

        const term = searchTerm.toLowerCase().trim();
        const customer = (record.customerName || '').toLowerCase();
        const plate = (record.carPlate || '').toLowerCase();
        const model = (record.carModel || '').toLowerCase();
        const phone = (record.phoneNumber || '').toLowerCase();
        const oil = (record.replacedOil || '').toLowerCase();
        const parts = (record.replacedParts || '').toLowerCase();
        const toReplace = (record.partsToReplace || '').toLowerCase();
        const notes = (record.notes || '').toLowerCase();
        const cost = String(record.costUzs || '');

        return (
          customer.includes(term) ||
          plate.includes(term) ||
          model.includes(term) ||
          phone.includes(term) ||
          oil.includes(term) ||
          parts.includes(term) ||
          toReplace.includes(term) ||
          notes.includes(term) ||
          cost.includes(term)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (sortBy === 'cost_high') {
          return (Number(b.costUzs) || 0) - (Number(a.costUzs) || 0);
        }
        if (sortBy === 'cost_low') {
          return (Number(a.costUzs) || 0) - (Number(b.costUzs) || 0);
        }
        return 0;
      });
  }, [records, searchTerm, statusFilter, sortBy]);

  // Handle open edit
  const handleStartEdit = (record: ServiceRecord) => {
    setEditingRecord(record);

    // Format date for datetime-local input (YYYY-MM-DDTHH:mm)
    let dateStr = '';
    try {
      const d = new Date(record.createdAt);
      if (!isNaN(d.getTime())) {
        const iso = d.toISOString();
        dateStr = iso.slice(0, 16);
      }
    } catch {
      dateStr = new Date().toISOString().slice(0, 16);
    }

    setEditForm({
      ...record,
      createdAt: dateStr || record.createdAt,
    });
  };

  // Save edit submission
  const handleSaveEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !editForm.customerName || !editForm.carPlate) return;

    setIsSaving(true);
    try {
      let finalCreatedAt = editForm.createdAt;
      if (editForm.createdAt && editForm.createdAt.length === 16) {
        finalCreatedAt = new Date(editForm.createdAt).toISOString();
      }

      const updated: ServiceRecord = {
        id: editingRecord.id,
        customerName: (editForm.customerName || '').trim(),
        phoneNumber: (editForm.phoneNumber || '').trim(),
        carPlate: (editForm.carPlate || '').toUpperCase().trim(),
        carModel: (editForm.carModel || '').trim(),
        mileageKm: editForm.mileageKm ? Number(editForm.mileageKm) : 0,
        replacedOil: (editForm.replacedOil || '').trim(),
        replacedParts: (editForm.replacedParts || '').trim(),
        partsToReplace: (editForm.partsToReplace || '').trim(),
        status: (editForm.status as RecordStatus) || 'bajarildi',
        costUzs: editForm.costUzs ? Number(editForm.costUzs) : 0,
        notes: (editForm.notes || '').trim(),
        createdAt: finalCreatedAt || editingRecord.createdAt,
        isOffline: false,
        syncedAt: new Date().toISOString(),
      };

      await onSaveRecord(updated);

      await createAdminLog(
        "Super Admin Xizmatni Tahrirladi",
        `Mijoz: ${updated.customerName}, Avto: ${updated.carPlate}, Summa: ${updated.costUzs.toLocaleString()} so'm`,
        currentUsername
      );

      showToast(`✅ "${updated.customerName}" xizmat ma'lumotlari tahrirlandi va bazada yangilandi!`);
      setEditingRecord(null);
    } catch (err) {
      console.error('Error saving record edit:', err);
      showToast("❌ Saqlashda xatolik yuz berdi!");
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm single record delete
  const handleConfirmSingleDelete = async () => {
    if (!recordToDelete) return;
    try {
      await onDeleteRecord(recordToDelete.id);
      await createAdminLog(
        "Super Admin Xizmatni O'chirdi",
        `Mijoz: ${recordToDelete.customerName}, Avto: ${recordToDelete.carPlate} yozuvi o'chirildi`,
        currentUsername
      );
      showToast(`🗑️ "${recordToDelete.customerName}" yozuvi bazadan o'chirildi.`);
      setRecordToDelete(null);
    } catch (err) {
      console.error('Error deleting record:', err);
      showToast("❌ O'chirishda xatolik yuz berdi!");
    }
  };

  // Confirm clear all database
  const handleConfirmClearAll = async () => {
    try {
      await onClearAllRecords();
      await createAdminLog(
        "Super Admin Barcha Xizmatlarni O'chirdi",
        `Super Admin tomonidan daewoonargiz profiliga tegishli barcha (${records.length} ta) yozuvlar tozalandi`,
        currentUsername
      );
      showToast("🔥 Barcha xizmat yozuvlari va mijozlar bazasi to'liq tozalandi!");
      setShowClearAllModal(false);
    } catch (err) {
      console.error('Error clearing database:', err);
      showToast("❌ Bazani tozalashda xatolik yuz berdi!");
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast floating in tab */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 border border-purple-500/50 text-purple-200 px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold animate-bounce flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Summary Cards & Clear All Button */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-purple-950/80 border border-purple-800/80 text-purple-400 rounded-xl">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Jami Xizmatlar</div>
            <div className="text-xl font-extrabold text-white mt-0.5">{records.length} ta</div>
          </div>
        </div>

        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-blue-950/80 border border-blue-800/80 text-blue-400 rounded-xl">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Noyob Mijozlar</div>
            <div className="text-xl font-extrabold text-white mt-0.5">{uniqueCustomersCount} ta</div>
          </div>
        </div>

        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold">Jami Tushum</div>
            <div className="text-lg font-extrabold text-emerald-400 mt-0.5">
              {totalRevenue.toLocaleString()} so'm
            </div>
          </div>
        </div>

        <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-2xl shadow-sm flex items-center justify-between gap-2">
          <div>
            <div className="text-xs text-red-300 font-extrabold">Baza Boshqaruvi</div>
            <div className="text-[11px] text-red-400/80">daewoonargiz yozuvlari</div>
          </div>
          <button
            type="button"
            onClick={() => setShowClearAllModal(true)}
            disabled={records.length === 0}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              records.length === 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40 border border-red-400/30 cursor-pointer active:scale-95'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Bazani Tozalash</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Qidiruv: Mijoz ismi, Avto raqam, Model, Telefon, Moy, Zapchast..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filters & Sorting */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-xl">
              <Filter className="w-3.5 h-3.5 text-purple-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-300 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900 text-slate-200">Barcha Statuslar</option>
                <option value="bajarildi" className="bg-slate-900 text-emerald-400">✅ Bajarildi</option>
                <option value="jarayonda" className="bg-slate-900 text-blue-400">⏳ Jarayonda</option>
                <option value="kutilmoqda" className="bg-slate-900 text-amber-400">⚠️ Kutilmoqda</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-xl">
              <span className="text-xs text-slate-400">Saralash:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs text-slate-300 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="newest" className="bg-slate-900 text-slate-200">Eng Yangilar</option>
                <option value="oldest" className="bg-slate-900 text-slate-200">Eng Eskilar</option>
                <option value="cost_high" className="bg-slate-900 text-slate-200">Narx: Yuqoridan</option>
                <option value="cost_low" className="bg-slate-900 text-slate-200">Narx: Pastdan</option>
              </select>
            </div>
          </div>
        </div>

        {/* Counter indicator */}
        <div className="text-[11px] text-slate-400 font-medium flex items-center justify-between pt-1 border-t border-slate-800/60">
          <span>
            Ko'rsatilmoqda: <strong className="text-purple-300">{filteredRecords.length} ta</strong> / Jami: {records.length} ta yozuv
          </span>
          <span className="text-purple-400 font-semibold">
            (Barcha sanalardagi xizmatlar Super Admin uchun tahrirlashga ochiq)
          </span>
        </div>
      </div>

      {/* Main Records List / Table */}
      {filteredRecords.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl space-y-3">
          <Database className="w-12 h-12 text-slate-600 mx-auto animate-pulse" />
          <h3 className="text-base font-bold text-slate-300">Xizmat va mijoz yozuvlari topilmadi</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {records.length === 0
              ? "Hozirda daewoonargiz bazasida birorta ham xizmat yozuvi yo'q."
              : "Qidiruv yoki filtr mezonlariga mos keladigan yozuvlar topilmadi."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((record) => {
            const formattedDate = new Date(record.createdAt).toLocaleString('uz-UZ', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={record.id}
                className="p-4 bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 rounded-2xl transition-all shadow-md hover:shadow-purple-950/20 space-y-3"
              >
                {/* Top Row: Customer info, plate, status & action buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-3">
                    {/* License Plate Badge */}
                    <div className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl font-mono text-sm font-extrabold text-amber-300 tracking-wider shadow-inner shrink-0">
                      {record.carPlate}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-white">{record.customerName}</span>
                        {record.carModel && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                            {record.carModel}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-500" />
                          {record.phoneNumber || 'Tel ko\'rsatilmadi'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {formattedDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {/* Status Pill */}
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wide flex items-center gap-1 ${
                        record.status === 'bajarildi'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : record.status === 'jarayonda'
                          ? 'bg-blue-950 text-blue-300 border border-blue-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {record.status === 'bajarildi' ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      <span>{record.status}</span>
                    </span>

                    {/* Cost */}
                    <span className="px-3 py-1 rounded-xl bg-purple-950/80 border border-purple-800 text-purple-300 font-extrabold text-xs">
                      {(Number(record.costUzs) || 0).toLocaleString()} so'm
                    </span>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => handleStartEdit(record)}
                      className="p-2 bg-blue-900/50 hover:bg-blue-800/80 border border-blue-700/60 text-blue-200 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-md"
                      title="Tahrirlash"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => setRecordToDelete(record)}
                      className="p-2 bg-red-900/50 hover:bg-red-800/80 border border-red-700/60 text-red-200 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-md"
                      title="O'chirish"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                  {/* Mileage & Replaced Oil */}
                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/60 space-y-1">
                    <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                      <Droplet className="w-3.5 h-3.5 text-amber-400" />
                      <span>Almashtirilgan Moy & Bosgan Yoli</span>
                    </div>
                    <div className="text-slate-200 font-semibold">
                      {record.replacedOil ? (
                        <span className="text-amber-300 font-bold">{record.replacedOil}</span>
                      ) : (
                        <span className="text-slate-500 font-normal">Moy almashtirilmadi</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Probeg: <strong className="text-slate-200">{record.mileageKm ? `${Number(record.mileageKm).toLocaleString()} km` : 'Ko\'rsatilmadi'}</strong>
                    </div>
                  </div>

                  {/* Replaced Parts */}
                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/60 space-y-1">
                    <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5 text-blue-400" />
                      <span>Almashtirilgan Ehtiyot Qismlar</span>
                    </div>
                    <div className="text-slate-200 font-semibold">
                      {record.replacedParts ? (
                        <span className="text-blue-300 font-bold">{record.replacedParts}</span>
                      ) : (
                        <span className="text-slate-500 font-normal">Qismlar ko'rsatilmadi</span>
                      )}
                    </div>
                  </div>

                  {/* Notes & Scheduled */}
                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/60 space-y-1">
                    <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-purple-400" />
                      <span>Reja va Izohlar</span>
                    </div>
                    <div className="text-slate-300">
                      {record.partsToReplace && (
                        <div className="text-[11px] text-amber-300">
                          Reja: <strong>{record.partsToReplace}</strong>
                        </div>
                      )}
                      {record.notes ? (
                        <div className="text-[11px] text-slate-400 italic mt-0.5">"{record.notes}"</div>
                      ) : (
                        !record.partsToReplace && <span className="text-slate-500">Izoh yo'q</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUPER ADMIN EDIT RECORD MODAL */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-purple-500/50 rounded-2xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-purple-950 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-600/30 border border-purple-500/50 rounded-xl text-purple-300">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Xizmat Yozuvini Tahrirlash (Super Admin)</h3>
                  <p className="text-xs text-purple-300/80">O'zgartirishlar bevosita bazaga va daewoonargizga ta'sir qiladi</p>
                </div>
              </div>
              <button
                onClick={() => setEditingRecord(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEditSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Customer Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Mijoz Ismi *</label>
                  <input
                    type="text"
                    required
                    value={editForm.customerName || ''}
                    onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Telefon Raqami</label>
                  <input
                    type="text"
                    value={editForm.phoneNumber || ''}
                    onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                    placeholder="+998 90 123 45 67"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Car Plate */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Avtomobil Raqami *</label>
                  <input
                    type="text"
                    required
                    value={editForm.carPlate || ''}
                    onChange={(e) => setEditForm({ ...editForm, carPlate: e.target.value.toUpperCase() })}
                    placeholder="01 A 777 AA"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-purple-500 uppercase"
                  />
                </div>

                {/* Car Model */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Avtomobil Modeli</label>
                  <input
                    type="text"
                    value={editForm.carModel || ''}
                    onChange={(e) => setEditForm({ ...editForm, carModel: e.target.value })}
                    placeholder="Gentra, Cobalt, Captiva..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Mileage Km */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Bosgan Masofasi (Km)</label>
                  <input
                    type="number"
                    value={editForm.mileageKm || ''}
                    onChange={(e) => setEditForm({ ...editForm, mileageKm: e.target.value })}
                    placeholder="125000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Service Cost */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Xizmat Summasi (so'm)</label>
                  <input
                    type="number"
                    value={editForm.costUzs || ''}
                    onChange={(e) => setEditForm({ ...editForm, costUzs: e.target.value })}
                    placeholder="250000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-emerald-400 font-extrabold focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Status</label>
                  <select
                    value={editForm.status || 'bajarildi'}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as RecordStatus })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="bajarildi">✅ Bajarildi</option>
                    <option value="jarayonda">⏳ Jarayonda</option>
                    <option value="kutilmoqda">⚠️ Kutilmoqda</option>
                  </select>
                </div>

                {/* Date & Time */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Sana va Vaqt</label>
                  <input
                    type="datetime-local"
                    value={editForm.createdAt || ''}
                    onChange={(e) => setEditForm({ ...editForm, createdAt: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-purple-300 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Replaced Oil */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Almashtirilgan Moy</label>
                <input
                  type="text"
                  value={editForm.replacedOil || ''}
                  onChange={(e) => setEditForm({ ...editForm, replacedOil: e.target.value })}
                  placeholder="Shell Helix Ultra 5W-30"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Replaced Parts */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Almashtirilgan Ehtiyot Qismlar</label>
                <input
                  type="text"
                  value={editForm.replacedParts || ''}
                  onChange={(e) => setEditForm({ ...editForm, replacedParts: e.target.value })}
                  placeholder="Moy filtri, Havo filtri, Nakladka..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Scheduled Parts & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Rejadagi Qismlar</label>
                  <input
                    type="text"
                    value={editForm.partsToReplace || ''}
                    onChange={(e) => setEditForm({ ...editForm, partsToReplace: e.target.value })}
                    placeholder="Keyingi safar almashtirish..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Qo'shimcha Izoh</label>
                  <input
                    type="text"
                    value={editForm.notes || ''}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    placeholder="Mijozga bildirishnoma..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-purple-900/40 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saqlanmoqda...' : 'O\'zgartirishni Saqlash'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE SINGLE RECORD MODAL */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-red-500/50 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-950 border border-red-800 rounded-xl text-red-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Yozuvni O'chirishni Tasdiqlang</h3>
                <p className="text-xs text-slate-400">Ushbu amal ma'lumotlar bazasidan butunlay o'chiradi</p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
              <div>Mijoz: <strong className="text-white">{recordToDelete.customerName}</strong></div>
              <div>Avto raqam: <strong className="text-amber-300 font-mono">{recordToDelete.carPlate}</strong></div>
              <div>Summa: <strong className="text-emerald-400">{Number(recordToDelete.costUzs || 0).toLocaleString()} so'm</strong></div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-900/40 cursor-pointer"
              >
                O'chirib tashlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM CLEAR ALL DATABASE MODAL */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-red-600/80 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-950 border border-red-800 rounded-2xl text-red-400 animate-pulse">
                <Trash2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Barcha Bazani Tozalash!</h3>
                <p className="text-xs text-red-400 font-bold">⚠️ Diqqat! Bu o'ta xavfli amal.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-red-950/40 p-3 rounded-xl border border-red-900/50">
              <strong className="text-white">daewoonargiz</strong> profiliga tegishli barcha (<strong className="text-amber-300">{records.length} ta</strong>) xizmat va mijoz yozuvlari Firestore bulutli bazasidan hamda foydalanuvchi xotirasidan buttunlay o'chiriladi. Ushbu amalni ortga qaytarib bo'lmaydi.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearAllModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Yo'q, Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-lg shadow-red-900/50 border border-red-400/40 cursor-pointer"
              >
                Ha, Barchasini Tozalansin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
