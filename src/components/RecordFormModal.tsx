import React, { useState, useEffect, useMemo } from 'react';
import { ServiceRecord } from '../types';
import { subscribeToCatalog } from '../lib/firebase';
import { X, Save, Car, User, Phone, Gauge, Wrench, AlertCircle, Sparkles, DollarSign, Search, CheckCircle2, History, Droplet, ShoppingBag, Calendar } from 'lucide-react';

interface RecordFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: Omit<ServiceRecord, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) => void;
  initialData?: ServiceRecord | null;
  existingRecords?: ServiceRecord[];
}

const POPULAR_CAR_MODELS = [
  'Gentra 1.5',
  'Cobalt LTZ',
  'Nexia 3',
  'Damas DLX',
  'Matiz Best',
  'Tracker Turbo',
  'Malibu 2 Turbo',
  'Onix Premier',
  'Lacetti 1.8',
  'Spark 1.2',
];

const POPULAR_OILS = [
  'Shell Helix Ultra 5W-30',
  'Castrol EDGE 5W-30',
  'Mannol Classic 10W-40',
  'ZIC X7 5W-30',
  'Lukoil Genesis 5W-40',
  'Kixx G1 5W-30',
  'Mobil 1 ESP 5W-30',
  'Chevrolet Genuine 5W-30',
  'Hyundai XTeer 10W-40',
  'Total Quartz 5W-40',
];

const POPULAR_PARTS = [
  'Moy filtri & Havo filtri',
  'Salonnoy filtr',
  'Svecha (Aramatsiyalangan)',
  'Tormoz kolodkasi (Oldi)',
  'Tormoz kolodkasi (Orqa)',
  'Remen GRM + Rolik',
  'Pompa (Suv nasosi)',
  'Antifriz (G12+)',
  'Akkumulyator (60Ah)',
  'Sharovoy opora',
  'Amortizator',
];

const POPULAR_RECOMMENDATIONS = [
  'Keyingi safar moy va filtr almashtirish',
  'Tormoz kolodkalarini yangilash',
  'GRM remenini almashtirish',
  'Antifriz tizimini yuvish',
  'Svechalarni almashtirish',
  'Amortizator almashtirish',
  'Xodovoy sozlash',
  'Rulevoy tyaga yangilash',
  'Akkumulyatorni almashtirish',
];

export const RecordFormModal: React.FC<RecordFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  existingRecords = [],
}) => {
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [carPlate, setCarPlate] = useState('');
  const [carModel, setCarModel] = useState('');
  const [mileageKm, setMileageKm] = useState<string | number>('');
  const [replacedOil, setReplacedOil] = useState('');
  const [replacedParts, setReplacedParts] = useState('');
  const [partsToReplace, setPartsToReplace] = useState('');
  const [status, setStatus] = useState<'bajarildi' | 'jarayonda' | 'kutilmoqda'>('bajarildi');
  const [costUzs, setCostUzs] = useState<string | number>('');
  const [notes, setNotes] = useState('');
  const [selectedExistingCustomer, setSelectedExistingCustomer] = useState<string>('');
  const [existingCustomerInfo, setExistingCustomerInfo] = useState<ServiceRecord | null>(null);

  // Service type selections: Moy almashtirildi, Zapchast sotildi, or both
  const [isOilChanged, setIsOilChanged] = useState<boolean>(true);
  const [isPartSold, setIsPartSold] = useState<boolean>(false);
  
  // Custom Service Date state
  const [useCustomDate, setUseCustomDate] = useState<boolean>(false);
  const [customDate, setCustomDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Real-time custom catalog items (from Firestore/admin)
  const [customCatalog, setCustomCatalog] = useState<{ customOils: string[]; customParts: string[] }>({
    customOils: [],
    customParts: [],
  });

  useEffect(() => {
    const unsub = subscribeToCatalog((data) => {
      setCustomCatalog(data);
    });
    return () => unsub();
  }, []);

  const combinedOils = useMemo(() => {
    const list = [...POPULAR_OILS, ...(customCatalog.customOils || [])];
    return Array.from(new Set(list.map((s) => s.trim()))).filter(Boolean);
  }, [customCatalog.customOils]);

  const combinedParts = useMemo(() => {
    const list = [...POPULAR_PARTS, ...(customCatalog.customParts || [])];
    return Array.from(new Set(list.map((s) => s.trim()))).filter(Boolean);
  }, [customCatalog.customParts]);

  // Helper to toggle item in replacedOil
  const handleToggleOil = (item: string) => {
    setReplacedOil((prev) => {
      const parts = prev.split(',').map((s) => s.trim()).filter(Boolean);
      const existsIndex = parts.findIndex((p) => p.toLowerCase() === item.toLowerCase());
      if (existsIndex >= 0) {
        parts.splice(existsIndex, 1);
        return parts.join(', ');
      } else {
        parts.push(item);
        return parts.join(', ');
      }
    });
    if (errors.replacedOil) {
      setErrors((e) => ({ ...e, replacedOil: '' }));
    }
  };

  // Helper to toggle item in replacedParts
  const handleTogglePart = (item: string) => {
    setReplacedParts((prev) => {
      const parts = prev.split(',').map((s) => s.trim()).filter(Boolean);
      const existsIndex = parts.findIndex((p) => p.toLowerCase() === item.toLowerCase());
      if (existsIndex >= 0) {
        parts.splice(existsIndex, 1);
        return parts.join(', ');
      } else {
        parts.push(item);
        return parts.join(', ');
      }
    });
    if (errors.replacedParts) {
      setErrors((e) => ({ ...e, replacedParts: '' }));
    }
  };

  // Helper to append item to partsToReplace
  const handleAppendToReplace = (item: string) => {
    setPartsToReplace((prev) => {
      if (!prev.trim()) return item;
      if (prev.toLowerCase().includes(item.toLowerCase())) return prev;
      return `${prev}, ${item}`;
    });
  };

  // Get unique customers list from existing records
  const uniqueCustomers = useMemo(() => {
    const map = new Map<string, ServiceRecord>();
    existingRecords.forEach((r) => {
      const key = r.carPlate.toUpperCase();
      if (!map.has(key)) {
        map.set(key, r);
      }
    });
    return Array.from(map.values());
  }, [existingRecords]);

  useEffect(() => {
    if (initialData) {
      setCustomerName(initialData.customerName || '');
      setPhoneNumber(initialData.phoneNumber || '');
      setCarPlate(initialData.carPlate || '');
      setCarModel(initialData.carModel || '');
      setMileageKm(initialData.mileageKm || '');
      setReplacedOil(initialData.replacedOil || '');
      setReplacedParts(initialData.replacedParts || '');
      setPartsToReplace(initialData.partsToReplace || '');
      setStatus(initialData.status || 'bajarildi');
      setCostUzs(initialData.costUzs || '');
      setNotes(initialData.notes || '');
      setSelectedExistingCustomer('');
      setExistingCustomerInfo(null);

      const oilText = (initialData.replacedOil || '').toLowerCase();
      const partsText = (initialData.replacedParts || '').toLowerCase();
      setIsOilChanged(Boolean(oilText) || partsText.includes('moy') || partsText.includes('oil'));
      setIsPartSold(Boolean(partsText) || partsText.includes('zapchast') || partsText.includes('sotildi'));

      if (initialData.createdAt) {
        setCustomDate(new Date(initialData.createdAt).toISOString().split('T')[0]);
        setUseCustomDate(true);
      } else {
        setCustomDate(new Date().toISOString().split('T')[0]);
        setUseCustomDate(false);
      }
    } else {
      // Reset defaults - start completely empty for strict explicit user selection/typing
      setCustomerName('');
      setPhoneNumber('+998 ');
      setCarPlate('');
      setCarModel('');
      setMileageKm('');
      setReplacedOil('');
      setReplacedParts('');
      setPartsToReplace('');
      setStatus('bajarildi');
      setCostUzs('');
      setNotes('');
      setSelectedExistingCustomer('');
      setExistingCustomerInfo(null);
      setIsOilChanged(true);
      setIsPartSold(false);
      setCustomDate(new Date().toISOString().split('T')[0]);
      setUseCustomDate(false);
    }
    setErrors({});
  }, [initialData, isOpen]);

  // Handle selecting an existing customer
  const handleSelectExistingCustomer = (plate: string) => {
    setSelectedExistingCustomer(plate);
    if (!plate) {
      setExistingCustomerInfo(null);
      return;
    }

    const found = existingRecords.find((r) => r.carPlate.toUpperCase() === plate.toUpperCase());
    if (found) {
      setCustomerName(found.customerName);
      setPhoneNumber(found.phoneNumber);
      setCarPlate(found.carPlate);
      setCarModel(found.carModel);
      setExistingCustomerInfo(found);

      // Pre-fill parts to replace if customer had pending recommendations
      if (found.partsToReplace && !partsToReplace) {
        setPartsToReplace(found.partsToReplace);
      }
    }
  };

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!customerName.trim()) {
      newErrors.customerName = 'Mijoz ismi majburiy!';
    }
    if (!phoneNumber.trim() || phoneNumber.trim() === '+998') {
      newErrors.phoneNumber = 'Telefon nomeri majburiy!';
    }
    if (!carPlate.trim()) {
      newErrors.carPlate = 'Mashina raqami (nomeri) majburiy!';
    }
    if (!mileageKm || Number(mileageKm) <= 0) {
      newErrors.mileageKm = "Bosib o'tilgan masofa (Km) majburiy!";
    }
    if (!costUzs || Number(costUzs) <= 0) {
      newErrors.costUzs = 'Xizmat narxi (summasi) majburiy!';
    }

    // Strict validation for Oil and Spare Parts: No auto-fill defaults!
    if (!isOilChanged && !isPartSold) {
      newErrors.serviceType = "Moy almashtirish yoki Zapchast sotishdan kamida birini tanlang!";
    }

    if (isOilChanged && !replacedOil.trim()) {
      newErrors.replacedOil = "Moy almashtirildi tanlandi! Pastdagi katalogdan bittasini bosing yoki qo'lda turini yozing.";
    }

    if (isPartSold && !replacedParts.trim()) {
      newErrors.replacedParts = "Zapchast sotildi tanlandi! Pastdagi katalogdan bittasini bosing yoki qo'lda zapchast nomini yozing.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const finalOil = isOilChanged ? replacedOil.trim() : '';
    const finalParts = isPartSold ? replacedParts.trim() : '';

    let finalCreatedAt: string | undefined = undefined;
    if (useCustomDate && customDate) {
      try {
        const [yStr, mStr, dStr] = customDate.split('-');
        const year = Number(yStr);
        const month = Number(mStr);
        const day = Number(dStr);
        const now = new Date();
        const parsed = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
        if (!isNaN(parsed.getTime())) {
          finalCreatedAt = parsed.toISOString();
        } else {
          finalCreatedAt = new Date().toISOString();
        }
      } catch {
        finalCreatedAt = new Date().toISOString();
      }
    } else if (initialData?.createdAt) {
      finalCreatedAt = initialData.createdAt;
    } else {
      finalCreatedAt = new Date().toISOString();
    }

    onSave({
      id: initialData?.id,
      createdAt: finalCreatedAt,
      customerName: initialData ? initialData.customerName : customerName.trim(),
      phoneNumber: phoneNumber.trim(),
      carPlate: carPlate.trim().toUpperCase(),
      carModel: carModel.trim() || 'Gentra 1.5',
      mileageKm: mileageKm ? Number(mileageKm) : '',
      replacedOil: finalOil,
      replacedParts: finalParts,
      partsToReplace: partsToReplace.trim(),
      status,
      costUzs: costUzs ? Number(costUzs) : 0,
      notes: notes.trim(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/80 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {initialData ? "Yozuvni Tahrirlash" : "Yangi Xizmat Yozuvini Qo'shish"}
              </h2>
              <p className="text-xs text-slate-400">
                Mijoz va avtomobil zapchast ma'lumotlarini kiritish
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Section: Select from Existing Customers */}
          {!initialData && uniqueCustomers.length > 0 && (
            <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-800/60 space-y-2">
              <label className="block text-xs font-semibold text-blue-300 flex items-center gap-1.5">
                <History className="w-4 h-4 text-blue-400" />
                <span>Eski mijozlardan avto-to'ldirish (Ixtiyoriy):</span>
              </label>
              <select
                value={selectedExistingCustomer}
                onChange={(e) => handleSelectExistingCustomer(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">-- Bazadagi eski mijozni tanlang... --</option>
                {uniqueCustomers.map((cust) => (
                  <option key={cust.id} value={cust.carPlate}>
                    🚗 {cust.carPlate} - {cust.customerName} ({cust.carModel})
                  </option>
                ))}
              </select>

              {existingCustomerInfo && (
                <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>{existingCustomerInfo.customerName}</strong> ({existingCustomerInfo.carPlate}) ma'lumotlari avto-to'ldirildi! Oxirgi kilometraj: {existingCustomerInfo.mileageKm || 0} km.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Section: Service Date Selection (Avtomatik yoki Maxsus/O'tgan sana) */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold text-slate-200">Xizmat Ko'rsatilgan Kuni:</span>
                <span className="text-[11px] px-2 py-0.5 rounded font-mono font-bold bg-slate-900 text-indigo-300 border border-slate-800">
                  {useCustomDate && customDate ? customDate : "Bugungi sana (Avtomatik)"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const nextVal = !useCustomDate;
                  setUseCustomDate(nextVal);
                  if (nextVal && !customDate) {
                    setCustomDate(new Date().toISOString().split('T')[0]);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  useCustomDate
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-400'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-300" />
                <span>{useCustomDate ? "📅 Maxsus sana tanlandi" : "🗓️ Boshqa/O'tgan sanani tanlash"}</span>
              </button>
            </div>

            {useCustomDate && (
              <div className="pt-2.5 border-t border-slate-800/80 space-y-2.5 animate-fadeIn">
                <label className="block text-xs font-medium text-indigo-300 flex items-center justify-between">
                  <span>Xizmat ko'rsatilgan kunni kalendardan tanlang:</span>
                  <span className="text-[10px] text-slate-400 font-normal font-mono">O'tgan kunlar uchun hisobotga yoziladi</span>
                </label>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="date"
                    value={customDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="p-2.5 bg-slate-900 border border-indigo-500/70 rounded-xl text-sm text-indigo-200 font-mono focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all cursor-pointer"
                  />

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCustomDate(new Date().toISOString().split('T')[0])}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        customDate === new Date().toISOString().split('T')[0]
                          ? 'bg-indigo-600 text-white font-bold border-indigo-400'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      Bugun
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 1);
                        setCustomDate(d.toISOString().split('T')[0]);
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                    >
                      Kecha
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 2);
                        setCustomDate(d.toISOString().split('T')[0]);
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                    >
                      2 kun oldin
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 7);
                        setCustomDate(d.toISOString().split('T')[0]);
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                    >
                      1 xafta oldin
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section: Required Client Info */}
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-4">
            {initialData && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  🔒 <strong>Mijoz ismi qulflangan:</strong> Tahrirlashda faqat mijoz ismini o'zgartirib bo'lmaydi. Telefon raqam, mashina raqami, modeli hamda bajarilgan xizmatlarni istalgan vaqtda o'zgartirishingiz mumkin.
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
              <User className="w-4 h-4" />
              <span>Mijoz va Avto Ma'lumotlari (Majburiy maydonlar)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Mijoz Ismi (Mandatory - Locked on Edit) */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Mijoz Ismi <span className="text-red-400 font-bold">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    disabled={Boolean(initialData)}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Masalan: Alisher Qodirov"
                    className={`w-full pl-9 pr-3 py-2.5 ${
                      initialData
                        ? 'bg-slate-950 text-slate-400 border-slate-800 cursor-not-allowed opacity-75'
                        : 'bg-slate-900 border-slate-700 text-white focus:outline-none focus:border-blue-500'
                    } ${errors.customerName ? 'border-red-500' : ''} rounded-xl text-sm transition-all`}
                  />
                </div>
                {errors.customerName && (
                  <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.customerName}
                  </p>
                )}
              </div>

              {/* Telefon Nomer (Editable anytime) */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Telefon Nomer <span className="text-red-400 font-bold">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+998 90 123 45 67"
                    className={`w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 ${
                      errors.phoneNumber ? 'border-red-500' : ''
                    } rounded-xl text-sm transition-all`}
                  />
                </div>
                {errors.phoneNumber && (
                  <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.phoneNumber}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Mashina Raqami (Editable anytime) */}
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Mashina Raqami <span className="text-red-400 font-bold">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={carPlate}
                  onChange={(e) => setCarPlate(e.target.value.toUpperCase())}
                  placeholder="01 A 777 AA"
                  className={`w-full px-3 py-2.5 bg-slate-900 border border-slate-700 text-white font-mono uppercase focus:outline-none focus:border-blue-500 ${
                    errors.carPlate ? 'border-red-500' : ''
                  } rounded-xl text-sm transition-all`}
                />
                {errors.carPlate && (
                  <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.carPlate}
                  </p>
                )}
              </div>

              {/* Mashina Modeli (Editable anytime) */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Mashina Modeli
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Car className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={carModel}
                    onChange={(e) => setCarModel(e.target.value)}
                    placeholder="Masalan: Gentra 1.5, Cobalt LTZ"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-blue-500 rounded-xl text-sm transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Quick Car Model Chips */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1.5">Tezkor tanlash:</span>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_CAR_MODELS.map((model) => (
                  <button
                    key={model}
                    type="button"
                    onClick={() => setCarModel(model)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                      carModel === model
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {model}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Technical Details (KM, Replaced Parts, Parts to Replace) */}
          <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              <Gauge className="w-4 h-4" />
              <span>Xizmat va Zapchastlar Ma'lumoti</span>
            </div>

            {/* Service Category Selection (Moy almashtirildi, Zapchast sotildi, or both) */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
              <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Xizmat Turi (Kamida birini tanlang):</span> <span className="text-red-400 font-bold">*</span>
                </span>
                <span className="text-[10px] text-blue-400 font-normal">Moy yoki Zapchast xizmati</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOilChanged(!isOilChanged);
                    if (errors.serviceType) setErrors((e) => ({ ...e, serviceType: '' }));
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isOilChanged
                      ? 'bg-amber-950/80 border-amber-600 text-amber-300 shadow-md shadow-amber-900/30'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span className="text-base">🛢️</span>
                  <span>Moy Almashtirildi</span>
                  {isOilChanged && <CheckCircle2 className="w-4 h-4 text-amber-400 ml-auto" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPartSold(!isPartSold);
                    if (errors.serviceType) setErrors((e) => ({ ...e, serviceType: '' }));
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isPartSold
                      ? 'bg-blue-950/80 border-blue-600 text-blue-300 shadow-md shadow-blue-900/30'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span className="text-base">⚙️</span>
                  <span>Zapchast Sotildi</span>
                  {isPartSold && <CheckCircle2 className="w-4 h-4 text-blue-400 ml-auto" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOilChanged(true);
                    setIsPartSold(true);
                    if (errors.serviceType) setErrors((e) => ({ ...e, serviceType: '' }));
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isOilChanged && isPartSold
                      ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300 shadow-md shadow-emerald-900/30'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span className="text-base">⚡</span>
                  <span>Ikkalasi Ham</span>
                  {isOilChanged && isPartSold && <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto" />}
                </button>
              </div>

              {errors.serviceType && (
                <p className="text-xs text-red-400 flex items-center gap-1 font-semibold pt-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {errors.serviceType}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Km (Mileage) Required */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Bosib o'tilgan masofa (Km) <span className="text-red-400 font-bold">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Gauge className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    required
                    value={mileageKm}
                    onChange={(e) => setMileageKm(e.target.value)}
                    placeholder="125000"
                    className={`w-full pl-9 pr-12 py-2.5 bg-slate-900 border ${
                      errors.mileageKm ? 'border-red-500' : 'border-slate-700'
                    } rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-all`}
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-500 font-medium">
                    km
                  </span>
                </div>
                {errors.mileageKm && (
                  <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.mileageKm}
                  </p>
                )}
              </div>

              {/* Xizmat Narxi Required */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Xizmat Narxi / Summasi (UZS) <span className="text-red-400 font-bold">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    required
                    value={costUzs}
                    onChange={(e) => setCostUzs(e.target.value)}
                    placeholder="350000"
                    className={`w-full pl-9 pr-12 py-2.5 bg-slate-900 border ${
                      errors.costUzs ? 'border-red-500' : 'border-slate-700'
                    } rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-all`}
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-500">
                    so'm
                  </span>
                </div>
                {errors.costUzs && (
                  <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.costUzs}
                  </p>
                )}
              </div>
            </div>

            {/* Almashtirilgan Moy (Alohida ustun) */}
            {isOilChanged && (
              <div className="space-y-2 p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40">
                <label className="block text-xs font-medium text-amber-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Droplet className="w-3.5 h-3.5 text-amber-400" />
                    <span>Almashtirilgan Moy Turini Tanlang yoki Yozing</span> <span className="text-red-400 font-bold">*</span>
                  </span>
                  <span className="text-[10px] text-amber-400/80 font-normal">Avtomatik to'ldirilmaydi!</span>
                </label>

                {/* Quick Oil Catalog Chips */}
                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold text-amber-400 flex items-center justify-between uppercase tracking-wider">
                    <span>Tayyor Moylar Katalogi (tanlash uchun bosing):</span>
                    <span className="text-slate-500 normal-case font-normal">bosib tanlanadi/o'chiriladi</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {combinedOils.map((oil) => {
                      const isSelected = replacedOil.toLowerCase().includes(oil.toLowerCase());
                      return (
                        <button
                          key={oil}
                          type="button"
                          onClick={() => handleToggleOil(oil)}
                          className={`text-[11px] px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 font-extrabold border border-amber-400 shadow-md shadow-amber-500/20'
                              : 'bg-amber-950/60 hover:bg-amber-900 text-amber-200 border border-amber-800/80'
                          }`}
                        >
                          <span>{isSelected ? '✓' : '+'}</span>
                          <span>{oil}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <input
                  type="text"
                  value={replacedOil}
                  onChange={(e) => {
                    setReplacedOil(e.target.value);
                    if (errors.replacedOil) setErrors((err) => ({ ...err, replacedOil: '' }));
                  }}
                  placeholder="Yuqoridagi katalogdan birini bosing yoki bu yerga o'zingiz yozing..."
                  className={`w-full p-2.5 bg-slate-900 border ${
                    errors.replacedOil ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-700'
                  } rounded-xl text-sm text-amber-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all font-medium`}
                />
                {errors.replacedOil && (
                  <p className="mt-1 text-xs text-red-400 flex items-center gap-1 font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" /> {errors.replacedOil}
                  </p>
                )}
              </div>
            )}

            {/* Almashtirilgan Zapchastlar (Alohida ustun) */}
            {isPartSold && (
              <div className="space-y-2 p-3.5 rounded-xl bg-blue-950/20 border border-blue-800/40">
                <label className="block text-xs font-medium text-blue-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <ShoppingBag className="w-3.5 h-3.5 text-blue-400" />
                    <span>Sotilgan / Almashtirilgan Zapchast Nomini Tanlang yoki Yozing</span> <span className="text-red-400 font-bold">*</span>
                  </span>
                  <span className="text-[10px] text-blue-400/80 font-normal">Avtomatik to'ldirilmaydi!</span>
                </label>

                {/* Quick Parts Catalog Chips */}
                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold text-blue-400 flex items-center justify-between uppercase tracking-wider">
                    <span>Mashhur Zapchastlar Katalogi (tanlash uchun bosing):</span>
                    <span className="text-slate-500 normal-case font-normal">bosib tanlanadi/o'chiriladi</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {combinedParts.map((part) => {
                      const isSelected = replacedParts.toLowerCase().includes(part.toLowerCase());
                      return (
                        <button
                          key={part}
                          type="button"
                          onClick={() => handleTogglePart(part)}
                          className={`text-[11px] px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                            isSelected
                              ? 'bg-blue-500 text-slate-950 font-extrabold border border-blue-400 shadow-md shadow-blue-500/20'
                              : 'bg-blue-950/60 hover:bg-blue-900 text-blue-200 border border-blue-800/80'
                          }`}
                        >
                          <span>{isSelected ? '✓' : '+'}</span>
                          <span>{part}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={replacedParts}
                  onChange={(e) => {
                    setReplacedParts(e.target.value);
                    if (errors.replacedParts) setErrors((err) => ({ ...err, replacedParts: '' }));
                  }}
                  placeholder="Yuqoridagi katalogdan birini bosing yoki bu yerga o'zingiz zapchast nomini yozing..."
                  className={`w-full p-2.5 bg-slate-900 border ${
                    errors.replacedParts ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-700'
                  } rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all`}
                />
                {errors.replacedParts && (
                  <p className="mt-1 text-xs text-red-400 flex items-center gap-1 font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" /> {errors.replacedParts}
                  </p>
                )}
              </div>
            )}

            {/* Almashtirmoq bo'lgan zapchast */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-amber-300 flex items-center justify-between">
                <span>Tavsiya va Rejadagi Zapchastlar (Keyinroq olmoqchi bo'lingan)</span>
                <span className="text-[10px] text-slate-400 font-normal">Baza va mijozga eslatma</span>
              </label>

              {/* Recommended Catalog Chips */}
              <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl space-y-1.5">
                <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1 uppercase tracking-wider">
                  <Wrench className="w-3 h-3" />
                  <span>Tavsiya Qilinadigan Ishlar / Zapchastlar:</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_RECOMMENDATIONS.map((rec) => (
                    <button
                      key={rec}
                      type="button"
                      onClick={() => handleAppendToReplace(rec)}
                      className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-950/50 hover:bg-amber-900/80 text-amber-300 border border-amber-800/70 transition-colors cursor-pointer"
                    >
                      + {rec}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={2}
                value={partsToReplace}
                onChange={(e) => setPartsToReplace(e.target.value)}
                placeholder="Masalan: Orqa amortizator, Remen GRM (130,000 km da), Dinamo podshipnik"
                className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-all"
              />
            </div>

            {/* Qo'shimcha Izoh (Ixtiyoriy) */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Qo'shimcha Izoh (Ixtiyoriy)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Kafolat muddati yoki usta eslatmasi"
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{initialData ? "Saqlash" : "Bazaga Qo'shish"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

