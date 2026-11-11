import React, { useState, useMemo, useEffect } from 'react';
import { ServiceRecord } from '../types';
import { createAdminLog } from '../lib/adminSession';
import {
  getOverdueOilCustomers,
  OIL_REMINDER_SMS_TEMPLATE,
  getOilReminderSmsHref,
  formatSmsPhoneNumber
} from '../lib/oilUtils';
import {
  X,
  Droplet,
  Phone,
  Car,
  Calendar,
  Clock,
  MessageSquare,
  History,
  Plus,
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
  User,
  Copy,
  Check,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface OverdueOilModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: ServiceRecord[];
  onSelectCustomer: (carPlate: string, customerName?: string) => void;
  onNewServiceForCustomer: (carPlate: string, customerName?: string, phone?: string, carModel?: string) => void;
  username?: string;
}

export const OverdueOilModal: React.FC<OverdueOilModalProps> = ({
  isOpen,
  onClose,
  records,
  onSelectCustomer,
  onNewServiceForCustomer,
  username = 'daewoonargiz',
}) => {
  const [showTemplate, setShowTemplate] = useState<boolean>(false);
  const [copiedTemplate, setCopiedTemplate] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      createAdminLog(
        "Moy Vaqti O'tganlar Ko'rildi",
        "1 oydan ortiq vaqt ilgari moy almashtirgan mijozlar ro'yxati va eslatma oynasi ochildi",
        username
      );
    }
  }, [isOpen, username]);

  const handleCopyTemplate = () => {
    try {
      navigator.clipboard.writeText(OIL_REMINDER_SMS_TEMPLATE);
      setCopiedTemplate(true);
      setTimeout(() => setCopiedTemplate(false), 2000);
    } catch {}
  };

  // Compute unique customers and their latest oil service record
  const overdueCustomers = useMemo(() => {
    return getOverdueOilCustomers(records);
  }, [records]);

  const filteredOverdueList = overdueCustomers;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl my-auto overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Droplet className="w-5 h-5 text-amber-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Moy Almashtirish Vaqti Kelgan Mijozlar
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold text-xs border border-amber-500/40">
                  {overdueCustomers.length} ta mijoz
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Belgilangan oralig'i (yoki 30 kun) bo'yicha moy almashtirish vaqti kelgan barcha avtomobillar ro'yxati
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplate((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                showTemplate
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700'
              }`}
              title="SMS xabar shablonini ko'rish va nusxa olish"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">SMS Shabloni</span>
              <span className="sm:hidden">SMS</span>
              {showTemplate ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SMS Template Preview Drawer */}
        {showTemplate && (
          <div className="p-4 bg-slate-950 border-b border-amber-500/30 animate-fadeIn">
            <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                  <span>Avtomatik SMS Xabar Shabloni:</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyTemplate}
                  className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedTemplate ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Nusxalandi!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Nusxa olish</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="text-xs text-slate-200 font-sans whitespace-pre-wrap bg-slate-950 p-3 rounded-lg border border-slate-800 leading-relaxed select-all">
                {OIL_REMINDER_SMS_TEMPLATE}
              </pre>
              <p className="text-[11px] text-slate-400">
                ℹ️ Har qanday telefondan (Android yoki iPhone) mijoz kartasidagi <strong>"SMS Xabar"</strong> tugmasi bosilganda, ushbu xabar matni va mijoz raqami SMS ilovangizda jo'natishga tayyor holatda ochiladi.
              </p>
            </div>
          </div>
        )}

        {/* Customer Cards List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {filteredOverdueList.length === 0 ? (
            <div className="text-center py-12 bg-slate-950/50 rounded-2xl border border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                <Droplet className="w-6 h-6" />
              </div>
              <p className="text-slate-400 text-xs font-medium">
                Siz tanlagan mezonga mos moy muddati kelgan mijozlar topilmadi.
              </p>
            </div>
          ) : (
            filteredOverdueList.map((item) => {
              const { key, plate, customerName, phoneNumber, carModel, latestOilRecord, daysAgo, thresholdDays, isCustomInterval, totalServices } = item;
              const formattedPhone = phoneNumber || latestOilRecord.phoneNumber || '';
              const cleanPhone = formattedPhone.replace(/\s+/g, '');

              // Determine urgency level badge
              let UrgencyBadge = (
                <div className="flex flex-col items-end gap-1">
                  <span className="px-2.5 py-1 rounded-lg bg-amber-950/80 text-amber-300 border border-amber-800/80 font-bold text-[11px] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{daysAgo} kun o'tdi</span>
                  </span>
                  {isCustomInterval && (
                    <span className="text-[10px] font-medium text-amber-400/90 font-mono">
                      (Oraliq: {thresholdDays} kun)
                    </span>
                  )}
                </div>
              );

              if (daysAgo >= thresholdDays * 2 || daysAgo >= 90) {
                UrgencyBadge = (
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2.5 py-1 rounded-lg bg-red-950/90 text-red-300 border border-red-800 font-extrabold text-[11px] flex items-center gap-1 animate-pulse">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                      <span>{daysAgo} kun (MUDDAT O'TGAN! 🚨)</span>
                    </span>
                    {isCustomInterval && (
                      <span className="text-[10px] font-medium text-red-300 font-mono">
                        (Oraliq: {thresholdDays} kun)
                      </span>
                    )}
                  </div>
                );
              } else if (daysAgo >= thresholdDays + 15 || daysAgo >= 60) {
                UrgencyBadge = (
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2.5 py-1 rounded-lg bg-orange-950/90 text-orange-300 border border-orange-800 font-bold text-[11px] flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                      <span>{daysAgo} kun ({thresholdDays}+ kun ⚠️)</span>
                    </span>
                    {isCustomInterval && (
                      <span className="text-[10px] font-medium text-orange-300 font-mono">
                        (Oraliq: {thresholdDays} kun)
                      </span>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={key}
                  className="bg-slate-950 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 space-y-3 transition-all hover:bg-slate-900/60 shadow-md group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800/80 pb-3">
                    {/* Customer & Car Info */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 font-mono font-black text-amber-400 text-sm">
                        <Car className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-extrabold text-white group-hover:text-amber-300 transition-colors">
                            {customerName}
                          </h3>
                          <span className="px-2 py-0.5 bg-slate-900 border border-slate-700 text-slate-200 font-mono font-bold text-xs rounded-md">
                            {plate}
                          </span>
                          {carModel && (
                            <span className="text-xs text-slate-400 font-medium">
                              • {carModel}
                            </span>
                          )}
                        </div>

                        {/* Phone & Service Count */}
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                          {formattedPhone ? (
                            <div className="flex items-center gap-2">
                              <a
                                href={`tel:${cleanPhone}`}
                                className="text-blue-400 hover:text-blue-300 font-mono font-bold flex items-center gap-1"
                              >
                                <Phone className="w-3.5 h-3.5 text-blue-400" />
                                <span>{formattedPhone}</span>
                              </a>
                              <span className="text-slate-600">•</span>
                              <a
                                href={getOilReminderSmsHref(formattedPhone)}
                                className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 text-[11px] bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30 transition-colors"
                                title="SMS eslatma jo'natish"
                              >
                                <MessageSquare className="w-3 h-3 text-amber-400" />
                                <span>SMS</span>
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Telefon yo'q</span>
                          )}
                          <span>• Jami {totalServices} marta xizmatda bo'lgan</span>
                        </div>
                      </div>
                    </div>

                    {/* Urgency Badge */}
                    <div className="shrink-0">{UrgencyBadge}</div>
                  </div>

                  {/* Oil Details & Mileage */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[10px]">🛢️ Oxirgi almashtirilgan moy:</span>
                      <strong className="text-amber-300 font-semibold block truncate">
                        {latestOilRecord.replacedOil || latestOilRecord.replacedParts || 'Moy almashtirildi'}
                      </strong>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px]">📅 Oxirgi moy almashtirish sanasi:</span>
                      <strong className="text-slate-200 font-semibold block">
                        {new Date(latestOilRecord.createdAt).toLocaleDateString('uz-UZ')}{' '}
                        {latestOilRecord.mileageKm ? `(${Number(latestOilRecord.mileageKm).toLocaleString('uz-UZ')} km)` : ''}
                      </strong>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                    {/* History Button */}
                    <button
                      onClick={() => {
                        onClose();
                        onSelectCustomer(plate, customerName);
                      }}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-blue-300 hover:text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <History className="w-3.5 h-3.5 text-blue-400" />
                      <span>To'liq Tarixni Ko'rish</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </button>

                    {/* Quick SMS, Call & New Service Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {formattedPhone && (
                        <>
                          {/* SMS Xabar Yuborish (Qo'ng'iroq oldida) */}
                          <a
                            href={getOilReminderSmsHref(formattedPhone)}
                            className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-amber-900/30 transition-all cursor-pointer hover:scale-105"
                            title="SMS yuborishga avtomatik o'tish"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-white" />
                            <span>SMS Xabar</span>
                          </a>

                          {/* Qo'ng'iroq qilish */}
                          <a
                            href={`tel:${cleanPhone}`}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow transition-all cursor-pointer hover:scale-105"
                            title="Qo'ng'iroq qilish"
                          >
                            <Phone className="w-3.5 h-3.5 text-white" />
                            <span>Qo'ng'iroq</span>
                          </a>
                        </>
                      )}

                      <button
                        onClick={() => {
                          onClose();
                          onNewServiceForCustomer(
                            plate,
                            customerName,
                            phoneNumber,
                            carModel
                          );
                        }}
                        className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow transition-all cursor-pointer hover:scale-105 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Yangi Xizmat Yozish</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2 text-slate-400 text-[11px] sm:text-xs">
            <span className="text-amber-400 font-bold">💬 SMS Xizmati:</span>
            <span>Mijoz kartasidagi "SMS Xabar" tugmasi bosilganda telefoningizda tayyor xabar bilan SMS ochiladi.</span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl cursor-pointer"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
};
