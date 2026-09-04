import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Users,
  Search,
  FileSpreadsheet,
  Car,
  Phone,
  Calendar,
  DollarSign,
  Droplet,
  Wrench,
  TrendingUp,
  Award,
  ArrowUpDown,
  X,
  Clock,
  Filter,
  CheckCircle2,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Download,
  Edit3,
  Save,
  AlertTriangle,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { ServiceRecord } from '../types';
import { createAdminLog } from '../lib/adminSession';
import { updateCustomerRecordsInCloud } from '../lib/firebase';

interface AdminCustomerCrmProps {
  records: ServiceRecord[];
  currentUsername: string;
  onSelectCustomerService?: (carPlate: string, customerName?: string) => void;
  onUpdateCustomerRecords?: (
    recordIds: string[],
    updatedFields: {
      customerName: string;
      carPlate: string;
      phoneNumber: string;
      carModel?: string;
    }
  ) => Promise<void>;
}

export interface CrmCustomerItem {
  key: string;
  customerName: string;
  phoneNumber: string;
  carPlate: string;
  carModel: string;
  records: ServiceRecord[];
  totalVisits: number;
  allTimeSpent: number;
  oilSpent: number;
  partsSpent: number;
  laborSpent: number;
  firstVisit: string;
  lastVisit: string;
  lastMileage: number | string;
  favoriteOil: { name: string; count: number; spent: number };
  favoritePart: { name: string; count: number; spent: number };
  oilList: Array<{ name: string; brand: string; count: number; spent: number }>;
  partsList: Array<{ name: string; count: number; spent: number }>;
}

// Helper: Extract oil and parts cleanly from a single record
const extractOilAndPartsInfo = (record: ServiceRecord) => {
  let oilStr = (record.replacedOil || '').trim();
  let partsStr = (record.replacedParts || '').trim();

  // If oil is empty but parts contain oil brands, split them
  if (!oilStr && partsStr) {
    const oilKeywords = ['shell', 'castrol', 'mannol', 'zic', 'lukoil', 'kixx', 'mobil', 'chevrolet', 'hyundai', 'total', '5w-', '10w-', '0w-', '4t', 'oil', 'moy'];
    const segments = partsStr.split(/[,;\n+]+/);
    const oilSegs: string[] = [];
    const partSegs: string[] = [];

    segments.forEach((seg) => {
      const trimmed = seg.trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      if (oilKeywords.some((b) => lower.includes(b)) && !lower.includes('filtr') && !lower.includes('kolodka') && !lower.includes('remon')) {
        oilSegs.push(trimmed);
      } else {
        partSegs.push(trimmed);
      }
    });

    if (oilSegs.length > 0) {
      oilStr = oilSegs.join(', ');
      partsStr = partSegs.join(', ');
    }
  }

  // Detect Oil Brand
  let oilBrand = 'Noma\'lum';
  const oilLower = oilStr.toLowerCase();
  if (oilLower.includes('mannol')) oilBrand = 'Mannol';
  else if (oilLower.includes('zic')) oilBrand = 'ZIC';
  else if (oilLower.includes('castrol')) oilBrand = 'Castrol';
  else if (oilLower.includes('shell')) oilBrand = 'Shell';
  else if (oilLower.includes('kixx')) oilBrand = 'Kixx';
  else if (oilLower.includes('lukoil')) oilBrand = 'Lukoil';
  else if (oilLower.includes('mobil')) oilBrand = 'Mobil';
  else if (oilLower.includes('total')) oilBrand = 'Total';
  else if (oilLower.includes('hyundai')) oilBrand = 'Hyundai XTeer';
  else if (oilLower.includes('chevrolet') || oilLower.includes('gm')) oilBrand = 'GM Genuine';
  else if (oilStr) oilBrand = oilStr.split(' ')[0] || 'Boshqa';

  // Explicit or derived costs
  const totalCost = Number(record.costUzs) || 0;
  const explicitOil = record.oilCostUzs !== undefined && record.oilCostUzs !== '' ? Number(record.oilCostUzs) : undefined;
  const explicitParts = record.partsCostUzs !== undefined && record.partsCostUzs !== '' ? Number(record.partsCostUzs) : undefined;

  let finalOilCost = 0;
  let finalPartsCost = 0;
  let finalLaborCost = 0;

  const hasOil = Boolean(oilStr && oilStr !== '—');
  const hasParts = Boolean(partsStr && partsStr !== '—');

  if (explicitOil !== undefined && explicitParts !== undefined) {
    finalOilCost = explicitOil;
    finalPartsCost = explicitParts;
    finalLaborCost = Math.max(0, totalCost - (explicitOil + explicitParts));
  } else if (explicitOil !== undefined) {
    finalOilCost = explicitOil;
    finalPartsCost = Math.max(0, totalCost - explicitOil);
  } else if (explicitParts !== undefined) {
    finalPartsCost = explicitParts;
    finalOilCost = Math.max(0, totalCost - explicitParts);
  } else {
    if (hasOil && !hasParts) {
      finalOilCost = totalCost;
    } else if (!hasOil && hasParts) {
      finalPartsCost = totalCost;
    } else if (hasOil && hasParts) {
      finalOilCost = Math.round(totalCost * 0.55);
      finalPartsCost = totalCost - finalOilCost;
    } else {
      finalLaborCost = totalCost;
    }
  }

  // Parse individual parts items
  const individualParts: string[] = [];
  if (partsStr && partsStr !== '—') {
    partsStr.split(/[,;\n+]+/).forEach((p) => {
      const t = p.trim();
      if (t && t.length > 1) {
        individualParts.push(t);
      }
    });
  }

  return {
    oilStr: oilStr || '',
    oilBrand,
    partsStr: partsStr || '',
    individualParts,
    oilCost: finalOilCost,
    partsCost: finalPartsCost,
    laborCost: finalLaborCost,
    totalCost,
  };
};

export const AdminCustomerCrm: React.FC<AdminCustomerCrmProps> = ({
  records,
  currentUsername,
  onSelectCustomerService,
  onUpdateCustomerRecords,
}) => {
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'visits_desc' | 'spent_desc' | 'recent_desc' | 'name_asc'>('visits_desc');
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  // Selected customer for full Dossier Analytics Modal
  const [selectedCustomer, setSelectedCustomer] = useState<CrmCustomerItem | null>(null);

  // Dossier date period filter
  const [dossierPeriod, setDossierPeriod] = useState<'all' | 'today' | 'this_month' | 'this_year' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Dossier brand & part multi-filters
  const [selectedOilBrandsFilter, setSelectedOilBrandsFilter] = useState<string[]>([]);
  const [selectedPartsFilter, setSelectedPartsFilter] = useState<string[]>([]);
  const [dossierTab, setDossierTab] = useState<'overview' | 'visits' | 'oils' | 'parts'>('overview');

  // Customer Edit State
  const [editingCustomer, setEditingCustomer] = useState<CrmCustomerItem | null>(null);
  const [editForm, setEditForm] = useState({
    customerName: '',
    carPlate: '',
    phoneNumber: '',
    carModel: '',
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [crmToastMessage, setCrmToastMessage] = useState<string | null>(null);

  const showCrmToast = (msg: string) => {
    setCrmToastMessage(msg);
    setTimeout(() => setCrmToastMessage(null), 4000);
  };

  const handleStartEdit = (customer: CrmCustomerItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingCustomer(customer);
    setEditForm({
      customerName: customer.customerName,
      carPlate: customer.carPlate,
      phoneNumber: customer.phoneNumber,
      carModel: customer.carModel !== '—' ? customer.carModel : '',
    });
    setEditError(null);
  };

  const handleSaveCustomerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    const cleanName = editForm.customerName.trim();
    const cleanPlate = editForm.carPlate.toUpperCase().trim();
    const cleanPhone = editForm.phoneNumber.trim();
    const cleanModel = editForm.carModel.trim();

    if (!cleanName || cleanName.length < 2) {
      setEditError("Mijoz ismini kamida 2 ta belgidan iborat qilib kiriting!");
      return;
    }
    if (!cleanPlate || cleanPlate.length < 3) {
      setEditError("Mashina davlat raqamini to'liq kiriting (masalan: 01 A 777 AA)!");
      return;
    }
    if (!cleanPhone || cleanPhone.length < 7) {
      setEditError("Telefon raqamini to'liq kiriting (masalan: +998 90 123 45 67)!");
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);

    try {
      // Find all record IDs for this customer
      const targetRecordIds = new Set<string>();
      editingCustomer.records.forEach((r) => targetRecordIds.add(r.id));

      const oldPlateKey = editingCustomer.carPlate.toUpperCase().replace(/\s+/g, '').trim();
      const oldPhoneKey = editingCustomer.phoneNumber.replace(/\D/g, '').trim();

      // Check full records list to ensure all matching records are updated
      records.forEach((r) => {
        const rPlate = (r.carPlate || '').toUpperCase().replace(/\s+/g, '').trim();
        const rPhone = (r.phoneNumber || '').replace(/\D/g, '').trim();
        if ((oldPlateKey && rPlate === oldPlateKey) || (oldPhoneKey && rPhone === oldPhoneKey)) {
          targetRecordIds.add(r.id);
        }
      });

      const recordIdsArray = Array.from(targetRecordIds);

      // Save to Cloud & System
      if (onUpdateCustomerRecords) {
        await onUpdateCustomerRecords(recordIdsArray, {
          customerName: cleanName,
          carPlate: cleanPlate,
          phoneNumber: cleanPhone,
          carModel: cleanModel,
        });
      } else {
        await updateCustomerRecordsInCloud(recordIdsArray, {
          customerName: cleanName,
          carPlate: cleanPlate,
          phoneNumber: cleanPhone,
          carModel: cleanModel,
        });
        // Also update local storage if standalone
        try {
          const localSaved = localStorage.getItem('daewoo_nargiz_records_v1');
          if (localSaved) {
            const list: ServiceRecord[] = JSON.parse(localSaved);
            const updated = list.map((r) => {
              if (recordIdsArray.includes(r.id)) {
                return {
                  ...r,
                  customerName: cleanName,
                  carPlate: cleanPlate,
                  phoneNumber: cleanPhone,
                  ...(cleanModel ? { carModel: cleanModel } : {}),
                };
              }
              return r;
            });
            localStorage.setItem('daewoo_nargiz_records_v1', JSON.stringify(updated));
          }
        } catch {}
      }

      // Log action
      await createAdminLog(
        "Mijoz Ma'lumotlari O'zgartirildi (CRM)",
        `Super Admin "${currentUsername}" tomonidan mijoz "${editingCustomer.customerName}" (${editingCustomer.carPlate}) tahrirlandi: Ism: "${cleanName}", Raqam: "${cleanPlate}", Tel: "${cleanPhone}", Model: "${cleanModel || '—'}" (${recordIdsArray.length} ta xizmat yozuvida yangilandi)`,
        currentUsername
      );

      // If this customer is currently open in the dossier modal, update it immediately
      if (selectedCustomer && (selectedCustomer.key === editingCustomer.key || selectedCustomer.carPlate === editingCustomer.carPlate)) {
        const updatedDossierRecords = selectedCustomer.records.map((r) =>
          recordIdsArray.includes(r.id)
            ? {
                ...r,
                customerName: cleanName,
                carPlate: cleanPlate,
                phoneNumber: cleanPhone,
                ...(cleanModel ? { carModel: cleanModel } : {}),
              }
            : r
        );

        setSelectedCustomer({
          ...selectedCustomer,
          customerName: cleanName,
          carPlate: cleanPlate,
          phoneNumber: cleanPhone,
          carModel: cleanModel || selectedCustomer.carModel,
          records: updatedDossierRecords,
        });
      }

      setEditingCustomer(null);
      showCrmToast(`✅ Mijoz "${cleanName}" (${cleanPlate}) ma'lumotlari va barcha ${recordIdsArray.length} ta xizmat yozuvlari butun tizim bo'ylab muvaffaqiyatli yangilandi!`);
    } catch (err: any) {
      setEditError(`Saqlashda xatolik yuz berdi: ${err?.message || "Qayta urinib ko'ring"}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Copy phone handler
  const handleCopyPhone = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  // Group and deduplicate records into unique customer entities
  const customerList = useMemo<CrmCustomerItem[]>(() => {
    const map = new Map<string, ServiceRecord[]>();

    records.forEach((r) => {
      // Clean carPlate as primary deduplication key; fallback to clean phone
      const plateKey = (r.carPlate || '').toUpperCase().replace(/\s+/g, '').trim();
      const phoneKey = (r.phoneNumber || '').replace(/\D/g, '').trim();
      const nameKey = (r.customerName || '').toLowerCase().trim();

      const key = plateKey || phoneKey || nameKey || r.id;

      const existing = map.get(key) || [];
      existing.push(r);
      map.set(key, existing);
    });

    const items: CrmCustomerItem[] = [];

    map.forEach((customerRecords, key) => {
      // Sort records by createdAt ascending for timeline, descending for latest
      const sortedDesc = [...customerRecords].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const latest = sortedDesc[0];
      const oldest = sortedDesc[sortedDesc.length - 1];

      let allTimeSpent = 0;
      let oilSpent = 0;
      let partsSpent = 0;
      let laborSpent = 0;

      const oilFrequency = new Map<string, { brand: string; count: number; spent: number }>();
      const partsFrequency = new Map<string, { count: number; spent: number }>();

      customerRecords.forEach((rec) => {
        const info = extractOilAndPartsInfo(rec);
        allTimeSpent += info.totalCost;
        oilSpent += info.oilCost;
        partsSpent += info.partsCost;
        laborSpent += info.laborCost;

        // Tally oils
        if (info.oilStr) {
          const oName = info.oilStr;
          const curr = oilFrequency.get(oName) || { brand: info.oilBrand, count: 0, spent: 0 };
          curr.count += 1;
          curr.spent += info.oilCost;
          oilFrequency.set(oName, curr);
        }

        // Tally parts
        if (info.individualParts.length > 0) {
          const perPartCost = info.individualParts.length > 0 ? Math.round(info.partsCost / info.individualParts.length) : 0;
          info.individualParts.forEach((pName) => {
            const currP = partsFrequency.get(pName) || { count: 0, spent: 0 };
            currP.count += 1;
            currP.spent += perPartCost;
            partsFrequency.set(pName, currP);
          });
        }
      });

      // Find favorite oil
      let favoriteOil = { name: '—', count: 0, spent: 0 };
      oilFrequency.forEach((val, name) => {
        if (val.count > favoriteOil.count) {
          favoriteOil = { name, count: val.count, spent: val.spent };
        }
      });

      // Find favorite part
      let favoritePart = { name: '—', count: 0, spent: 0 };
      partsFrequency.forEach((val, name) => {
        if (val.count > favoritePart.count) {
          favoritePart = { name, count: val.count, spent: val.spent };
        }
      });

      // Transform maps to arrays
      const oilList = Array.from(oilFrequency.entries()).map(([name, data]) => ({
        name,
        brand: data.brand,
        count: data.count,
        spent: data.spent,
      })).sort((a, b) => b.count - a.count);

      const partsList = Array.from(partsFrequency.entries()).map(([name, data]) => ({
        name,
        count: data.count,
        spent: data.spent,
      })).sort((a, b) => b.count - a.count);

      items.push({
        key,
        customerName: latest.customerName || 'Noma\'lum mijoz',
        phoneNumber: latest.phoneNumber || '—',
        carPlate: latest.carPlate || '—',
        carModel: latest.carModel || '—',
        records: sortedDesc,
        totalVisits: customerRecords.length,
        allTimeSpent,
        oilSpent,
        partsSpent,
        laborSpent,
        firstVisit: oldest.createdAt,
        lastVisit: latest.createdAt,
        lastMileage: latest.mileageKm || 0,
        favoriteOil,
        favoritePart,
        oilList,
        partsList,
      });
    });

    return items;
  }, [records]);

  // Filtered and Sorted Customer Directory
  const filteredCustomers = useMemo(() => {
    let result = customerList;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.customerName.toLowerCase().includes(q) ||
          c.phoneNumber.toLowerCase().includes(q) ||
          c.carPlate.toLowerCase().includes(q) ||
          c.carModel.toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      if (sortBy === 'visits_desc') return b.totalVisits - a.totalVisits;
      if (sortBy === 'spent_desc') return b.allTimeSpent - a.allTimeSpent;
      if (sortBy === 'recent_desc') {
        return new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime();
      }
      if (sortBy === 'name_asc') {
        return a.customerName.localeCompare(b.customerName, 'uz-UZ');
      }
      return 0;
    });
  }, [customerList, searchTerm, sortBy]);

  // Directory Overview KPI numbers
  const crmStats = useMemo(() => {
    const totalUnique = customerList.length;
    const totalVisits = customerList.reduce((acc, c) => acc + c.totalVisits, 0);
    const totalRevenue = customerList.reduce((acc, c) => acc + c.allTimeSpent, 0);
    const avgSpent = totalUnique > 0 ? Math.round(totalRevenue / totalUnique) : 0;
    return { totalUnique, totalVisits, totalRevenue, avgSpent };
  }, [customerList]);

  // Export Entire Deduplicated Customer Directory to Excel (.xlsx)
  const handleExportDirectoryExcel = async () => {
    await createAdminLog(
      "Excel Eksport (Mijozlar CRM)",
      `Super Admin "${currentUsername}" tomonidan barcha mijozlar bazasi (${filteredCustomers.length} ta mijoz) Excel (.xlsx) ga yuklandi`,
      currentUsername
    );

    const dataRows = filteredCustomers.map((c, idx) => ({
      'T/r': idx + 1,
      'Mijoz Ismi': c.customerName,
      'Telefon Raqami': c.phoneNumber,
      'Mashina Raqami': c.carPlate,
      'Mashina Modeli': c.carModel,
      'Tashriflar Soni': c.totalVisits,
      'Jami Sarflangan Summa (so\'m)': c.allTimeSpent,
      'Moyga Sarflangan (so\'m)': c.oilSpent,
      'Zapchastga Sarflangan (so\'m)': c.partsSpent,
      'Eng Ko\'p Quygan Moyi': c.favoriteOil.name !== '—' ? `${c.favoriteOil.name} (${c.favoriteOil.count} marta)` : 'Moy quyilmagan',
      'Eng Ko\'p Olgan Zapchasti': c.favoritePart.name !== '—' ? `${c.favoritePart.name} (${c.favoritePart.count} marta)` : 'Zapchast olinmagan',
      'Birinchi Tashrif': new Date(c.firstVisit).toLocaleDateString('uz-UZ'),
      'Oxirgi Tashrif': new Date(c.lastVisit).toLocaleDateString('uz-UZ'),
      'Oxirgi Probeg (km)': c.lastMileage || '—',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    worksheet['!cols'] = [
      { wch: 6 },  // T/r
      { wch: 22 }, // Ism
      { wch: 18 }, // Tel
      { wch: 14 }, // Raqam
      { wch: 16 }, // Model
      { wch: 16 }, // Tashriflar
      { wch: 26 }, // Jami
      { wch: 22 }, // Moy
      { wch: 24 }, // Zapchast
      { wch: 28 }, // Eng ko'p moy
      { wch: 28 }, // Eng ko'p zapchast
      { wch: 16 }, // Birinchi
      { wch: 16 }, // Oxirgi
      { wch: 18 }, // Probeg
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mijozlar_CRM_Bazasi');
    const todayStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `DaewooNargiz_Mijozlar_CRM_${todayStr}.xlsx`);
  };

  // Open Customer Dossier
  const handleOpenDossier = (customer: CrmCustomerItem) => {
    setSelectedCustomer(customer);
    setDossierPeriod('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSelectedOilBrandsFilter([]);
    setSelectedPartsFilter([]);
    setDossierTab('overview');

    createAdminLog(
      "Mijoz CRM Dossye Ochildi",
      `Mijoz: "${customer.customerName}" (${customer.carPlate}) tahliliy profili ochildi`,
      currentUsername
    );
  };

  // Filtered customer records inside Dossier based on period, oil brands, and parts
  const dossierData = useMemo(() => {
    if (!selectedCustomer) return null;

    let recs = [...selectedCustomer.records];

    // 1. Period filter
    const now = new Date();
    if (dossierPeriod === 'today') {
      recs = recs.filter((r) => {
        const d = new Date(r.createdAt);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      });
    } else if (dossierPeriod === 'this_month') {
      recs = recs.filter((r) => {
        const d = new Date(r.createdAt);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      });
    } else if (dossierPeriod === 'this_year') {
      recs = recs.filter((r) => {
        const d = new Date(r.createdAt);
        return d.getFullYear() === now.getFullYear();
      });
    } else if (dossierPeriod === 'custom') {
      if (customStartDate) {
        const start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        recs = recs.filter((r) => new Date(r.createdAt) >= start);
      }
      if (customEndDate) {
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        recs = recs.filter((r) => new Date(r.createdAt) <= end);
      }
    }

    // 2. Oil brands filter
    if (selectedOilBrandsFilter.length > 0) {
      recs = recs.filter((r) => {
        const info = extractOilAndPartsInfo(r);
        return (
          selectedOilBrandsFilter.includes(info.oilBrand) ||
          selectedOilBrandsFilter.some((b) => info.oilStr.toLowerCase().includes(b.toLowerCase()))
        );
      });
    }

    // 3. Parts filter
    if (selectedPartsFilter.length > 0) {
      recs = recs.filter((r) => {
        const info = extractOilAndPartsInfo(r);
        return info.individualParts.some((p) =>
          selectedPartsFilter.some((f) => p.toLowerCase().includes(f.toLowerCase()))
        );
      });
    }

    // Recalculate metrics for this filtered period/selection
    let periodTotalSpent = 0;
    let periodOilSpent = 0;
    let periodPartsSpent = 0;
    let periodLaborSpent = 0;

    const periodOilMap = new Map<string, { brand: string; count: number; spent: number }>();
    const periodPartsMap = new Map<string, { count: number; spent: number }>();

    recs.forEach((rec) => {
      const info = extractOilAndPartsInfo(rec);
      periodTotalSpent += info.totalCost;
      periodOilSpent += info.oilCost;
      periodPartsSpent += info.partsCost;
      periodLaborSpent += info.laborCost;

      if (info.oilStr) {
        const currO = periodOilMap.get(info.oilStr) || { brand: info.oilBrand, count: 0, spent: 0 };
        currO.count += 1;
        currO.spent += info.oilCost;
        periodOilMap.set(info.oilStr, currO);
      }

      if (info.individualParts.length > 0) {
        const perPart = Math.round(info.partsCost / info.individualParts.length);
        info.individualParts.forEach((p) => {
          const currP = periodPartsMap.get(p) || { count: 0, spent: 0 };
          currP.count += 1;
          currP.spent += perPart;
          periodPartsMap.set(p, currP);
        });
      }
    });

    let topOil = { name: '—', count: 0, spent: 0 };
    periodOilMap.forEach((v, k) => {
      if (v.count > topOil.count) topOil = { name: k, count: v.count, spent: v.spent };
    });

    let topPart = { name: '—', count: 0, spent: 0 };
    periodPartsMap.forEach((v, k) => {
      if (v.count > topPart.count) topPart = { name: k, count: v.count, spent: v.spent };
    });

    const periodOilsList = Array.from(periodOilMap.entries()).map(([name, data]) => ({
      name,
      brand: data.brand,
      count: data.count,
      spent: data.spent,
    })).sort((a, b) => b.count - a.count);

    const periodPartsList = Array.from(periodPartsMap.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      spent: data.spent,
    })).sort((a, b) => b.count - a.count);

    return {
      filteredRecords: recs,
      totalVisits: recs.length,
      periodTotalSpent,
      periodOilSpent,
      periodPartsSpent,
      periodLaborSpent,
      topOil,
      topPart,
      periodOilsList,
      periodPartsList,
    };
  }, [
    selectedCustomer,
    dossierPeriod,
    customStartDate,
    customEndDate,
    selectedOilBrandsFilter,
    selectedPartsFilter,
  ]);

  // Export Single Customer Dossier to Excel (.xlsx)
  const handleExportCustomerDossierExcel = async () => {
    if (!selectedCustomer || !dossierData) return;

    await createAdminLog(
      "Excel Eksport (Mijoz Tahlili)",
      `Super Admin "${currentUsername}" tomonidan mijoz "${selectedCustomer.customerName}" (${selectedCustomer.carPlate}) tahliliy hisoboti Excel (.xlsx) ga yuklandi`,
      currentUsername
    );

    const workbook = XLSX.utils.book_new();

    // Sheet 1: Xulosa
    const summaryRows = [
      { 'Ko\'rsatkich': 'Mijoz Ismi', 'Qiymat': selectedCustomer.customerName },
      { 'Ko\'rsatkich': 'Telefon Raqami', 'Qiymat': selectedCustomer.phoneNumber },
      { 'Ko\'rsatkich': 'Mashina Raqami', 'Qiymat': selectedCustomer.carPlate },
      { 'Ko\'rsatkich': 'Mashina Modeli', 'Qiymat': selectedCustomer.carModel },
      { 'Ko\'rsatkich': 'Tanlangan Davr', 'Qiymat': dossierPeriod === 'all' ? 'Barcha vaqt' : dossierPeriod === 'today' ? 'Bugun' : dossierPeriod === 'this_month' ? 'Shu oy' : dossierPeriod === 'this_year' ? 'Shu yil' : `${customStartDate} - ${customEndDate}` },
      { 'Ko\'rsatkich': 'Tashriflar Soni', 'Qiymat': `${dossierData.totalVisits} ta` },
      { 'Ko\'rsatkich': 'Jami Sarflangan Summa', 'Qiymat': `${dossierData.periodTotalSpent.toLocaleString('uz-UZ')} so'm` },
      { 'Ko\'rsatkich': 'Moyga Sarflangan Summa', 'Qiymat': `${dossierData.periodOilSpent.toLocaleString('uz-UZ')} so'm` },
      { 'Ko\'rsatkich': 'Zapchastga Sarflangan Summa', 'Qiymat': `${dossierData.periodPartsSpent.toLocaleString('uz-UZ')} so'm` },
      { 'Ko\'rsatkich': 'Eng Ko\'p Quygan Moyi', 'Qiymat': `${dossierData.topOil.name} (${dossierData.topOil.count} marta)` },
      { 'Ko\'rsatkich': 'Eng Ko\'p Olgan Zapchasti', 'Qiymat': `${dossierData.topPart.name} (${dossierData.topPart.count} marta)` },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(workbook, wsSummary, 'Umumiy_Xulosa');

    // Sheet 2: Tashriflar Tarixi
    const visitsRows = dossierData.filteredRecords.map((r, idx) => {
      const info = extractOilAndPartsInfo(r);
      return {
        'T/r': idx + 1,
        'Sana': new Date(r.createdAt).toLocaleDateString('uz-UZ'),
        'Vaqt': new Date(r.createdAt).toLocaleTimeString('uz-UZ'),
        'Probeg (km)': r.mileageKm || '—',
        'Quyilgan Moy': info.oilStr || '—',
        'Moy Narxi (so\'m)': info.oilCost,
        'Olingan Zapchastlar': info.partsStr || '—',
        'Zapchast Narxi (so\'m)': info.partsCost,
        'Jami Summa (so\'m)': info.totalCost,
        'Holat': r.status,
        'Izoh': r.notes || '',
      };
    });
    const wsVisits = XLSX.utils.json_to_sheet(visitsRows);
    wsVisits['!cols'] = [
      { wch: 6 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 28 }, { wch: 18 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 25 },
    ];
    XLSX.utils.book_append_sheet(workbook, wsVisits, 'Tashriflar_Tarixi');

    // Sheet 3: Moylar Tahlili
    const oilRows = dossierData.periodOilsList.map((o, idx) => ({
      'T/r': idx + 1,
      'Moy Nomi / Brendi': o.name,
      'Brend': o.brand,
      'Quyishlar Soni': o.count,
      'Jami Summa (so\'m)': o.spent,
    }));
    const wsOils = XLSX.utils.json_to_sheet(oilRows);
    wsOils['!cols'] = [{ wch: 6 }, { wch: 32 }, { wch: 16 }, { wch: 16 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(workbook, wsOils, 'Moylar_Tahlili');

    // Sheet 4: Zapchastlar Tahlili
    const partRows = dossierData.periodPartsList.map((p, idx) => ({
      'T/r': idx + 1,
      'Zapchast Nomi': p.name,
      'Olishlar Soni': p.count,
      'Jami Summa (so\'m)': p.spent,
    }));
    const wsParts = XLSX.utils.json_to_sheet(partRows);
    wsParts['!cols'] = [{ wch: 6 }, { wch: 32 }, { wch: 16 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(workbook, wsParts, 'Zapchastlar_Tahlili');

    const cleanName = selectedCustomer.customerName.replace(/[^a-zA-Z0-9а-яА-ЯёЁ_]/g, '_');
    const cleanPlate = selectedCustomer.carPlate.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(workbook, `Mijoz_${cleanName}_${cleanPlate}_Tahlil.xlsx`);
  };

  // Toggle brand filter in dossier
  const toggleOilBrandFilter = (brand: string) => {
    setSelectedOilBrandsFilter((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  // Toggle part filter in dossier
  const togglePartFilter = (part: string) => {
    setSelectedPartsFilter((prev) =>
      prev.includes(part) ? prev.filter((p) => p !== part) : [...prev, part]
    );
  };

  return (
    <div className="space-y-5">
      {/* KPI TOP METRICS BAR */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <div className="p-3.5 sm:p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-purple-950/80 border border-purple-800/80 text-purple-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] sm:text-xs text-slate-400 font-semibold truncate">Jami Noyob Mijozlar</div>
            <div className="text-base sm:text-xl font-extrabold text-white mt-0.5 font-mono">
              {crmStats.totalUnique} ta
            </div>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-950/80 border border-blue-800/80 text-blue-400 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] sm:text-xs text-slate-400 font-semibold truncate">Jami Tashriflar</div>
            <div className="text-base sm:text-xl font-extrabold text-blue-300 mt-0.5 font-mono">
              {crmStats.totalVisits} marta
            </div>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] sm:text-xs text-slate-400 font-semibold truncate">Umumiy Tushum</div>
            <div className="text-sm sm:text-lg font-extrabold text-emerald-400 mt-0.5 font-mono truncate">
              {crmStats.totalRevenue.toLocaleString('uz-UZ')} so'm
            </div>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-950/80 border border-amber-800/80 text-amber-400 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] sm:text-xs text-slate-400 font-semibold truncate">O'rtacha Bitta Mijoz</div>
            <div className="text-sm sm:text-lg font-extrabold text-amber-300 mt-0.5 font-mono truncate">
              {crmStats.avgSpent.toLocaleString('uz-UZ')} so'm
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH, SORT AND EXCEL ACTIONS HEADER */}
      <div className="bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Mijoz ismi, telefon raqami yoki mashina raqami bo'yicha qidirish..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort & Export controls */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-slate-200 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="visits_desc" className="bg-slate-900 text-white">Ko'p tashrif buyurganlar</option>
              <option value="spent_desc" className="bg-slate-900 text-white">Ko'p xarajat qilganlar</option>
              <option value="recent_desc" className="bg-slate-900 text-white">Oxirgi kelganlar</option>
              <option value="name_asc" className="bg-slate-900 text-white">Ism bo'yicha (A-Z)</option>
            </select>
          </div>

          {/* Primary Default Excel Export Button */}
          <button
            onClick={handleExportDirectoryExcel}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 border border-emerald-400/40 transition-all cursor-pointer shrink-0"
            title="Barcha noyob mijozlar ro'yxatini Excel (.xlsx) formatida yuklab olish"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Excel (.xlsx) ga yuklash</span>
          </button>
        </div>
      </div>

      {/* DEDUPLICATED CUSTOMERS TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            <h2 className="text-xs sm:text-sm font-extrabold text-white">
              Noyob Mijozlar Bazasi (Bir mijoz qayta takrorsiz)
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold border border-purple-500/30">
              {filteredCustomers.length} ta
            </span>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Mijoz ustiga bosing — to'liq tahlil va davr hisoboti ochiladi
          </span>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs sm:text-sm space-y-2">
            <Users className="w-10 h-10 mx-auto text-slate-600 stroke-[1.5]" />
            <p className="font-semibold text-slate-400">Hech qanday mijoz topilmadi</p>
            <p className="text-xs text-slate-600">Qidiruv parametrlarini o'zgartirib ko'ring</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3.5 w-12 text-center">#</th>
                  <th className="py-3 px-3.5">Mijoz Ismi</th>
                  <th className="py-3 px-3.5">Telefon Raqami</th>
                  <th className="py-3 px-3.5">Mashina Raqami</th>
                  <th className="py-3 px-3.5 hidden md:table-cell">Model</th>
                  <th className="py-3 px-3.5 text-center">Tashriflar</th>
                  <th className="py-3 px-3.5 text-right">Jami Xarajat</th>
                  <th className="py-3 px-3.5 hidden lg:table-cell">Eng Ko'p Quygan Moyi</th>
                  <th className="py-3 px-3.5 hidden xl:table-cell">Oxirgi Tashrif</th>
                  <th className="py-3 px-3.5 text-center w-36">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCustomers.map((customer, idx) => (
                  <tr
                    key={customer.key}
                    onClick={() => handleOpenDossier(customer)}
                    className="hover:bg-purple-950/20 cursor-pointer transition-colors group"
                  >
                    {/* Index */}
                    <td className="py-3 px-3.5 text-center font-mono text-slate-500 group-hover:text-purple-400">
                      {idx + 1}
                    </td>

                    {/* Customer Name */}
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-white group-hover:text-purple-300 transition-colors flex items-center gap-1.5">
                        <span className="truncate max-w-[150px] sm:max-w-[200px]">
                          {customer.customerName}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 md:hidden mt-0.5">
                        {customer.carModel !== '—' ? customer.carModel : ''}
                      </div>
                    </td>

                    {/* Phone number */}
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${customer.phoneNumber.replace(/\s+/g, '')}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-slate-300 hover:text-blue-400 transition-colors"
                        >
                          {customer.phoneNumber}
                        </a>
                        <button
                          onClick={(e) => handleCopyPhone(customer.phoneNumber, e)}
                          title="Telefon raqamidan nusxa olish"
                          className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                        >
                          {copiedPhone === customer.phoneNumber ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Car Plate */}
                    <td className="py-3 px-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-950 border border-slate-700/80 text-white font-mono font-bold tracking-wider text-[11px] shadow-sm">
                        <span className="text-[9px] text-blue-400 mr-1 font-sans">UZ</span>
                        {customer.carPlate}
                      </span>
                    </td>

                    {/* Car Model */}
                    <td className="py-3 px-3.5 hidden md:table-cell text-slate-300 font-medium">
                      {customer.carModel}
                    </td>

                    {/* Visits count badge */}
                    <td className="py-3 px-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {customer.totalVisits} marta
                      </span>
                    </td>

                    {/* Total spent */}
                    <td className="py-3 px-3.5 text-right font-mono font-extrabold text-emerald-400">
                      {customer.allTimeSpent.toLocaleString('uz-UZ')} so'm
                    </td>

                    {/* Favorite Oil */}
                    <td className="py-3 px-3.5 hidden lg:table-cell text-slate-300">
                      {customer.favoriteOil.name !== '—' ? (
                        <div className="flex items-center gap-1 truncate max-w-[180px]">
                          <Droplet className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{customer.favoriteOil.name}</span>
                          <span className="text-[10px] text-amber-400/80 shrink-0 font-mono">
                            ({customer.favoriteOil.count}x)
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Last visit date */}
                    <td className="py-3 px-3.5 hidden xl:table-cell text-slate-400 text-[11px] font-mono">
                      {new Date(customer.lastVisit).toLocaleDateString('uz-UZ')}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenDossier(customer)}
                          className="px-2.5 py-1.5 bg-purple-950/60 hover:bg-purple-900 border border-purple-700/60 hover:border-purple-500 text-purple-200 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm active:scale-95"
                          title="Ushbu mijoz bo'yicha to'liq tahlil va davr hisoboti"
                        >
                          <TrendingUp className="w-3.5 h-3.5 text-purple-300" />
                          <span className="hidden sm:inline">Tahlil</span>
                        </button>

                        <button
                          onClick={(e) => handleStartEdit(customer, e)}
                          className="px-2.5 py-1.5 bg-amber-950/70 hover:bg-amber-900 border border-amber-700/60 hover:border-amber-500 text-amber-200 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm active:scale-95"
                          title="Mijoz ismi, mashina raqami va telefonini butun tizim bo'ylab tahrirlash"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-300" />
                          <span className="hidden sm:inline">Tahrir</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* IN-DEPTH CUSTOMER DOSSIER & ANALYTICS MODAL */}
      {selectedCustomer && dossierData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* MODAL HEADER */}
            <div className="p-4 sm:p-6 bg-slate-950 border-b border-slate-800 flex items-start justify-between gap-3 shrink-0">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-lg bg-blue-950/80 text-blue-300 font-mono text-xs font-bold border border-blue-600/40">
                    <span className="text-[10px] text-blue-400 mr-1.5 font-sans font-black">UZ</span>
                    {selectedCustomer.carPlate}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 font-semibold">
                    {selectedCustomer.carModel}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-lg bg-purple-950 text-purple-300 border border-purple-800 font-mono font-bold">
                    Jami {selectedCustomer.totalVisits} marta kelgan
                  </span>
                </div>

                <h2 className="text-lg sm:text-2xl font-black text-white flex items-center gap-2 pt-0.5">
                  <Users className="w-5 h-5 text-purple-400 shrink-0" />
                  <span>{selectedCustomer.customerName}</span>
                </h2>

                <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                  <a
                    href={`tel:${selectedCustomer.phoneNumber.replace(/\s+/g, '')}`}
                    className="flex items-center gap-1.5 text-blue-400 hover:underline font-mono font-bold"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{selectedCustomer.phoneNumber}</span>
                  </a>
                  <span>•</span>
                  <span>Birinchi tashrif: <strong className="text-slate-200">{new Date(selectedCustomer.firstVisit).toLocaleDateString('uz-UZ')}</strong></span>
                  <span>•</span>
                  <span>Oxirgi tashrif: <strong className="text-slate-200">{new Date(selectedCustomer.lastVisit).toLocaleDateString('uz-UZ')}</strong></span>
                </div>
              </div>

              {/* Close & Excel Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleStartEdit(selectedCustomer)}
                  className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 active:from-amber-700 active:to-amber-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-amber-950/60 cursor-pointer border border-amber-400/40 shrink-0 active:scale-95"
                  title="Mijoz ismi, mashina raqami va telefonini butun tizim bo'ylab o'zgartirish"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-200" />
                  <span>Mijozni Tahrirlash</span>
                </button>

                <button
                  onClick={handleExportCustomerDossierExcel}
                  className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950 cursor-pointer border border-emerald-400/40 shrink-0"
                  title="Ushbu mijoz tahlilini Excel (.xlsx) ga yuklash"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                  <span className="hidden sm:inline">Mijoz Hisoboti (.xlsx)</span>
                </button>

                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* MODAL BODY (SCROLLABLE) */}
            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
              {/* Quick Edit Notice Banner */}
              <div className="bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-purple-950/30 border border-amber-800/50 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-900/80 border border-amber-700/80 text-amber-300 flex items-center justify-center shrink-0 shadow-sm">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs sm:text-sm font-extrabold text-amber-200">
                        Mijoz ismi, mashina raqami yoki telefonini o'zgartirish
                      </p>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                        Butun tizimga qo'llanadi
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                      Kiritilgan o'zgarishlar ushbu mijozning barcha <strong>{selectedCustomer.totalVisits} ta</strong> oldingi xizmat yozuvlariga va <strong className="text-purple-300 font-mono">daewoonargiz</strong> hisobiga ham darhol tatbiq etiladi.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleStartEdit(selectedCustomer)}
                  className="w-full sm:w-auto px-3.5 py-2 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-md shadow-amber-950/50 border border-amber-400/40"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-100" />
                  <span>O'zgartirish</span>
                </button>
              </div>

              {/* PERIOD SELECTOR ROW */}
              <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    Davr:
                  </span>
                  {(['all', 'today', 'this_month', 'this_year', 'custom'] as const).map((p) => {
                    const labels = {
                      all: 'Barcha davr (Butunlay)',
                      today: 'Bugun',
                      this_month: 'Shu oy',
                      this_year: 'Shu yil',
                      custom: 'Maxsus davr',
                    };
                    return (
                      <button
                        key={p}
                        onClick={() => setDossierPeriod(p)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          dossierPeriod === p
                            ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                            : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
                        }`}
                      >
                        {labels[p]}
                      </button>
                    );
                  })}
                </div>

                {/* Custom date range inputs */}
                {dossierPeriod === 'custom' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                    />
                    <span className="text-slate-500 text-xs">—</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                )}
              </div>

              {/* DYNAMIC KPI SUMMARY CARDS FOR THIS PERIOD */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {/* 1. Visits */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 block font-semibold">Tashriflar soni</span>
                  <span className="text-base font-black text-white font-mono mt-0.5 block">
                    {dossierData.totalVisits} marta
                  </span>
                  <span className="text-[10px] text-purple-400 block">
                    {dossierPeriod === 'all' ? 'barcha vaqt' : 'tanlangan davrda'}
                  </span>
                </div>

                {/* 2. Top Oil */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-amber-400 block font-semibold flex items-center gap-1">
                    <Droplet className="w-3 h-3" />
                    Eng ko'p quygan moyi
                  </span>
                  <span className="text-xs font-black text-white mt-0.5 block truncate" title={dossierData.topOil.name}>
                    {dossierData.topOil.name}
                  </span>
                  <span className="text-[10px] text-amber-300 font-mono block">
                    {dossierData.topOil.count > 0 ? `${dossierData.topOil.count} marta` : '—'}
                  </span>
                </div>

                {/* 3. Top Part */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-blue-400 block font-semibold flex items-center gap-1">
                    <Wrench className="w-3 h-3" />
                    Eng ko'p olgan zapchasti
                  </span>
                  <span className="text-xs font-black text-white mt-0.5 block truncate" title={dossierData.topPart.name}>
                    {dossierData.topPart.name}
                  </span>
                  <span className="text-[10px] text-blue-300 font-mono block">
                    {dossierData.topPart.count > 0 ? `${dossierData.topPart.count} marta` : '—'}
                  </span>
                </div>

                {/* 4. Total Spent */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-emerald-400 block font-semibold">Jami xarajat</span>
                  <span className="text-xs font-black text-emerald-400 font-mono mt-0.5 block truncate">
                    {dossierData.periodTotalSpent.toLocaleString('uz-UZ')} so'm
                  </span>
                  <span className="text-[10px] text-slate-500 block">umumiy summa</span>
                </div>

                {/* 5. Oil Spent */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-amber-400 block font-semibold">Moyga ketgan</span>
                  <span className="text-xs font-black text-amber-300 font-mono mt-0.5 block truncate">
                    {dossierData.periodOilSpent.toLocaleString('uz-UZ')} so'm
                  </span>
                  <span className="text-[10px] text-slate-500 block">faqat moy summasi</span>
                </div>

                {/* 6. Parts Spent */}
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="text-[10px] text-blue-400 block font-semibold">Zapchastga ketgan</span>
                  <span className="text-xs font-black text-blue-300 font-mono mt-0.5 block truncate">
                    {dossierData.periodPartsSpent.toLocaleString('uz-UZ')} so'm
                  </span>
                  <span className="text-[10px] text-slate-500 block">faqat zapchastlar</span>
                </div>
              </div>

              {/* BRAND & SPARE PART MULTI-FILTERS SECTION */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
                    Moy Brendlari va Zapchastlar bo'yicha saralash
                  </span>
                  {(selectedOilBrandsFilter.length > 0 || selectedPartsFilter.length > 0) && (
                    <button
                      onClick={() => {
                        setSelectedOilBrandsFilter([]);
                        setSelectedPartsFilter([]);
                      }}
                      className="text-[11px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer"
                    >
                      Barcha filtrlarni tozalash
                    </button>
                  )}
                </div>

                {/* Oil brands pills */}
                {selectedCustomer.oilList.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                      <Droplet className="w-3 h-3 text-amber-400" />
                      Quyilgan moy brendlari (Tanlab alohida ko'rish):
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {selectedCustomer.oilList.map((o) => {
                        const isSelected = selectedOilBrandsFilter.includes(o.brand) || selectedOilBrandsFilter.includes(o.name);
                        return (
                          <button
                            key={o.name}
                            onClick={() => toggleOilBrandFilter(o.brand || o.name)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border flex items-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500 shadow-sm'
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <span>{o.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/30 font-mono text-amber-300">
                              {o.count}x
                            </span>
                            <span className="text-[10px] text-emerald-400 font-mono">
                              ({o.spent.toLocaleString('uz-UZ')} so'm)
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Spare parts pills */}
                {selectedCustomer.partsList.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                      <Wrench className="w-3 h-3 text-blue-400" />
                      Olingan zapchastlar (Tanlab alohida ko'rish):
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {selectedCustomer.partsList.map((p) => {
                        const isSelected = selectedPartsFilter.includes(p.name);
                        return (
                          <button
                            key={p.name}
                            onClick={() => togglePartFilter(p.name)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border flex items-center gap-1.5 cursor-pointer ${
                              isSelected
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500 shadow-sm'
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <span>{p.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/30 font-mono text-blue-300">
                              {p.count}x
                            </span>
                            <span className="text-[10px] text-emerald-400 font-mono">
                              ({p.spent.toLocaleString('uz-UZ')} so'm)
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* DOSSIER SECTION TABS */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  onClick={() => setDossierTab('overview')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    dossierTab === 'overview'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📋 Barcha Tashriflar ({dossierData.filteredRecords.length})
                </button>

                <button
                  onClick={() => setDossierTab('oils')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    dossierTab === 'oils'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🛢️ Moylar Hisoboti ({dossierData.periodOilsList.length})
                </button>

                <button
                  onClick={() => setDossierTab('parts')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    dossierTab === 'parts'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ⚙️ Zapchastlar Hisoboti ({dossierData.periodPartsList.length})
                </button>
              </div>

              {/* TAB CONTENT: 1. ALL VISITS TABLE */}
              {dossierTab === 'overview' && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-3">Sana & Vaqt</th>
                          <th className="py-2.5 px-3">Probeg</th>
                          <th className="py-2.5 px-3">Quyilgan Moy</th>
                          <th className="py-2.5 px-3">Moy Narxi</th>
                          <th className="py-2.5 px-3">Olingan Zapchastlar</th>
                          <th className="py-2.5 px-3">Zapchast Narxi</th>
                          <th className="py-2.5 px-3 text-right">Jami Summa</th>
                          <th className="py-2.5 px-3">Holat</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {dossierData.filteredRecords.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-slate-500 text-xs">
                              Tanlangan davr va filtrlar bo'yicha hech qanday tashrif topilmadi.
                            </td>
                          </tr>
                        ) : (
                          dossierData.filteredRecords.map((r) => {
                            const info = extractOilAndPartsInfo(r);
                            return (
                              <tr key={r.id} className="hover:bg-slate-900/50">
                                <td className="py-2.5 px-3 font-mono text-slate-300">
                                  <div>{new Date(r.createdAt).toLocaleDateString('uz-UZ')}</div>
                                  <div className="text-[10px] text-slate-500">{new Date(r.createdAt).toLocaleTimeString('uz-UZ')}</div>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-white">
                                  {r.mileageKm ? `${Number(r.mileageKm).toLocaleString('uz-UZ')} km` : '—'}
                                </td>
                                <td className="py-2.5 px-3 text-amber-300 font-medium">
                                  {info.oilStr || '—'}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-amber-400">
                                  {info.oilCost > 0 ? `${info.oilCost.toLocaleString('uz-UZ')} so'm` : '—'}
                                </td>
                                <td className="py-2.5 px-3 text-blue-300 font-medium">
                                  {info.partsStr || '—'}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-blue-400">
                                  {info.partsCost > 0 ? `${info.partsCost.toLocaleString('uz-UZ')} so'm` : '—'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-400">
                                  {info.totalCost.toLocaleString('uz-UZ')} so'm
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                    {r.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: 2. OILS BREAKDOWN */}
              {dossierTab === 'oils' && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-3 w-10 text-center">#</th>
                          <th className="py-2.5 px-3">Moy Nomi / Turi</th>
                          <th className="py-2.5 px-3">Brend</th>
                          <th className="py-2.5 px-3 text-center">Quyishlar Soni</th>
                          <th className="py-2.5 px-3 text-right">Jami Sarflangan Summa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {dossierData.periodOilsList.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                              Ushbu davrda quyilgan moylar mavjud emas.
                            </td>
                          </tr>
                        ) : (
                          dossierData.periodOilsList.map((oil, idx) => (
                            <tr key={oil.name} className="hover:bg-slate-900/50">
                              <td className="py-2.5 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                                <Droplet className="w-3.5 h-3.5 text-amber-400" />
                                <span>{oil.name}</span>
                              </td>
                              <td className="py-2.5 px-3 text-amber-300 font-semibold">{oil.brand}</td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-white">
                                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  {oil.count} marta
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-400">
                                {oil.spent.toLocaleString('uz-UZ')} so'm
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB CONTENT: 3. PARTS BREAKDOWN */}
              {dossierTab === 'parts' && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-3 w-10 text-center">#</th>
                          <th className="py-2.5 px-3">Zapchast Nomi</th>
                          <th className="py-2.5 px-3 text-center">Olishlar Soni</th>
                          <th className="py-2.5 px-3 text-right">Jami Sarflangan Summa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {dossierData.periodPartsList.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-500 text-xs">
                              Ushbu davrda olingan zapchastlar mavjud emas.
                            </td>
                          </tr>
                        ) : (
                          dossierData.periodPartsList.map((part, idx) => (
                            <tr key={part.name} className="hover:bg-slate-900/50">
                              <td className="py-2.5 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                                <Wrench className="w-3.5 h-3.5 text-blue-400" />
                                <span>{part.name}</span>
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-white">
                                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  {part.count} marta
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-400">
                                {part.spent.toLocaleString('uz-UZ')} so'm
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <span className="text-[11px] text-slate-400 font-mono">
                Daewoo Nargiz Auto Servis CRM • {selectedCustomer.customerName}
              </span>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CUSTOMER MODAL (GLOBAL DATABASE & HISTORICAL SYNC) */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden my-6 flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 bg-slate-950 border-b border-slate-800 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                    <Edit3 className="w-3 h-3" />
                    Mijozni Tahrirlash
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-mono font-bold">
                    {editingCustomer.totalVisits} ta xizmat bog'langan
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  Mijoz Ma'lumotlarini O'zgartirish
                </h3>
                <p className="text-xs text-slate-400">
                  Hozirgi: <strong className="text-slate-200">{editingCustomer.customerName}</strong> ({editingCustomer.carPlate})
                </p>
              </div>
              <button
                onClick={() => !isSavingEdit && setEditingCustomer(null)}
                disabled={isSavingEdit}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveCustomerEdit} className="p-4 sm:p-6 space-y-4">
              {/* Warning / Explanation Box */}
              <div className="p-3.5 bg-purple-950/30 border border-purple-800/60 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-amber-300 block font-black">
                    Butun tizimga ta'sir qiluvchi o'zgartirish:
                  </strong>
                  Ushbu mijozning ismi, mashina raqami yoki telefoni o'zgartirilganda, bazadagi <strong>barcha {editingCustomer.totalVisits} ta</strong> oldingi xizmat yozuvlari avtomatik yangilanadi. Bu ma'lumotlar <strong className="text-purple-300 font-mono">daewoonargiz</strong> hisobi bilan kirilganda ham darhol yangi ko'rinishda aks etadi.
                </div>
              </div>

              {editError && (
                <div className="p-3 bg-red-950/80 border border-red-800 text-red-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Customer Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Mijoz Ismi <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.customerName}
                  onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                  placeholder="Masalan: Alisher Valiyev"
                  required
                  disabled={isSavingEdit}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white font-bold placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Car Plate */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Mashina Davlat Raqami <span className="text-red-400">*</span>
                </label>
                <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl overflow-hidden focus-within:border-amber-500 transition-colors">
                  <div className="px-3 py-2.5 bg-blue-950/80 text-blue-400 font-sans font-black text-xs border-r border-slate-800 shrink-0 flex items-center gap-1">
                    <span>UZ</span>
                  </div>
                  <input
                    type="text"
                    value={editForm.carPlate}
                    onChange={(e) => setEditForm({ ...editForm, carPlate: e.target.value.toUpperCase() })}
                    placeholder="01 A 777 AA"
                    required
                    disabled={isSavingEdit}
                    className="flex-1 bg-transparent px-3.5 py-2.5 text-xs sm:text-sm text-white font-mono font-black uppercase placeholder-slate-500 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Avtomobil davlat raqami katta harflar va bo'shliqlar bilan kiritilishi tavsiya etiladi.
                </p>
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Telefon Raqami <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={editForm.phoneNumber}
                    onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                    placeholder="+998 90 123 45 67"
                    required
                    disabled={isSavingEdit}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white font-mono font-bold placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              {/* Car Model */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Mashina Modeli <span className="text-slate-500 text-[11px]">(Ixtiyoriy)</span>
                </label>
                <div className="relative">
                  <Car className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={editForm.carModel}
                    onChange={(e) => setEditForm({ ...editForm, carModel: e.target.value })}
                    placeholder="Masalan: Gentra, Cobalt, Damas, Nexia 3..."
                    disabled={isSavingEdit}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  disabled={isSavingEdit}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  Bekor qilish
                </button>

                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 active:from-amber-700 active:to-amber-800 text-white text-xs sm:text-sm font-black transition-all flex items-center gap-2 shadow-lg shadow-amber-950/60 border border-amber-400/40 cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-200" />
                      <span>Yangilanmoqda...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 text-amber-200" />
                      <span>Saqlash va Butun Tizimga Qo'llash</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating CRM Toast Notification */}
      {crmToastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="p-4 bg-emerald-950/95 border border-emerald-700 rounded-2xl shadow-2xl text-xs sm:text-sm font-bold text-emerald-200 flex items-center gap-3 backdrop-blur-md">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="leading-relaxed">{crmToastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};
