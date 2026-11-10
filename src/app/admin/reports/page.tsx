'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileText,
  Download,
  TrendingUp,
  BarChart3,
  PieChart,
  Calendar,
  Package,
  Wrench,
  Shield,
  Building2,
  Users,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Printer
} from 'lucide-react';
import ShekelIcon from '@/components/ui/shekel-icon';
import { formatDate, formatCurrency } from '@/lib/utils';

type ReportType = 'summary' | 'devices' | 'repairs' | 'warranties' | 'payments' | 'performance';
type DateRange = 'week' | 'month' | 'quarter' | 'year' | 'custom';

interface ReportData {
  summary?: {
    totalDevices: number;
    activeWarranties: number;
    totalRepairs: number;
    completedRepairs: number;
    totalRevenue: number;
    paidAmount: number;
    pendingAmount: number;
    replacementRequests: number;
  };
  devices?: {
    byStatus: Record<string, number>;
    byModel: Record<string, number>;
    activationRate: number;
    monthlyImports: { month: string; count: number }[];
  };
  repairs?: {
    byStatus: Record<string, number>;
    byRepairType: Record<string, number>;
    byLab: Record<string, { count: number; revenue: number }>;
    monthlyRepairs: { month: string; count: number; revenue: number }[];
  };
  warranties?: {
    activeCount: number;
    expiredCount: number;
    byStore: Record<string, number>;
    monthlyActivations: { month: string; count: number }[];
    expiringNext30Days: number;
  };
  payments?: {
    totalRevenue: number;
    paidAmount: number;
    pendingAmount: number;
    byLab: Record<string, { paid: number; pending: number }>;
    monthlyPayments: { month: string; amount: number }[];
  };
  performance?: {
    topStores: { name: string; warranties: number; revenue: number }[];
    topLabs: { name: string; repairs: number; revenue: number }[];
    topRepairTypes: { type: string; count: number; percentage: number }[];
    avgWarrantyDuration: number;
  };
}

export default function AdminReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('summary');
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reportData, setReportData] = useState<ReportData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const now = new Date();
    const start = new Date();

    switch (dateRange) {
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
  }, [dateRange]);



  const generateReport = useCallback(async () => {
    if (!startDate || !endDate) return;
    if (typeof window === 'undefined') return; // Skip during SSR

    setIsGenerating(true);

    try {
      const data: ReportData = {};

      switch (reportType) {
        case 'summary':
          data.summary = await generateSummaryReport();
          break;
        case 'devices':
          data.devices = await generateDevicesReport();
          break;
        case 'repairs':
          data.repairs = await generateRepairsReport();
          break;
        case 'warranties':
          data.warranties = await generateWarrantiesReport();
          break;
        case 'payments':
          data.payments = await generatePaymentsReport();
          break;
        case 'performance':
          data.performance = await generatePerformanceReport();
          break;
      }

      setReportData(data);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsGenerating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, startDate, endDate]);

  useEffect(() => {
    generateReport();
  }, [generateReport]);

  const generateSummaryReport = async () => {
    if (typeof window === 'undefined') return undefined; // Skip during SSR
    const { count: totalDevices } = await supabase
      .from('devices')
      .select('*', { count: 'exact', head: true });

    const { count: activeWarranties } = await supabase
      .from('warranties')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .gte('expiry_date', new Date().toISOString());

    const { data: repairs } = await supabase
      .from('repairs')
      .select('status, cost')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const totalRepairs = repairs?.length || 0;
    const completedRepairs = (repairs as any[] | null)?.filter((r: any) => r.status === 'completed').length || 0;
    const totalRevenue = (repairs as any[] | null)?.reduce((sum: number, r: any) => sum + (r.cost || 0), 0) || 0;

    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate);

    const paymentsArr = payments as Array<{ amount: number }> | null;
    const paidAmount = (paymentsArr)?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const pendingAmount = totalRevenue - paidAmount;

    const { count: replacementRequests } = await supabase
      .from('replacement_requests')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    return {
      totalDevices: totalDevices || 0,
      activeWarranties: activeWarranties || 0,
      totalRepairs,
      completedRepairs,
      totalRevenue,
      paidAmount,
      pendingAmount,
      replacementRequests: replacementRequests || 0,
    };
  };

  const generateDevicesReport = async () => {
    if (typeof window === 'undefined') return undefined; // Skip during SSR
    const { data: devices } = await supabase
      .from('devices')
      .select('created_at, device_models(model_name), warranties!devices_id_fkey(is_active)')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const deviceList = (devices ?? []) as Array<{
      created_at: string;
      device_models: { model_name: string } | null;
      warranties: { is_active: boolean }[];
    }>;
    const byStatus: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const monthlyImports: Record<string, number> = {};

    deviceList.forEach(device => {
      // By status
      const hasActiveWarranty = device.warranties?.some(w => w.is_active) ?? false;
      const status = hasActiveWarranty ? 'באחריות' : 'ללא אחריות';
      byStatus[status] = (byStatus[status] || 0) + 1;

      // By model
      const modelName = device.device_models?.model_name || 'לא ידוע';
      byModel[modelName] = (byModel[modelName] || 0) + 1;

      // Monthly imports
      if (device.created_at) {
        const month = new Date(device.created_at).toISOString().slice(0, 7);
        monthlyImports[month] = (monthlyImports[month] || 0) + 1;
      }
    });

    const totalDevices = deviceList.length || 0;
    const activeDevices = byStatus['active'] || 0;
    const activationRate = totalDevices > 0 ? (activeDevices / totalDevices) * 100 : 0;

    return {
      byStatus,
      byModel,
      activationRate,
      monthlyImports: Object.entries(monthlyImports).map(([month, count]) => ({ month, count })),
    };
  };

  const generateRepairsReport = async () => {
    if (typeof window === 'undefined') return undefined; // Skip during SSR
    const { data: repairs } = await supabase
      .from('repairs')
      .select(`
        status,
        fault_type,
        cost,
        created_at,
        completed_at,
        lab:users!repairs_lab_id_fkey(id, full_name, email),
        repair_type:repair_types(id, name)
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const repairsList = (repairs ?? []) as Array<{
      status: string;
      fault_type: string | null;
      cost: number | null;
      created_at: string;
      completed_at: string | null;
      lab: { id: string; full_name: string | null; email: string | null } | null;
      repair_type: { id: string; name: string } | null;
    }>;
    const byStatus: Record<string, number> = {};
    const byRepairType: Record<string, number> = {};
    const byLab: Record<string, { count: number; revenue: number }> = {};
    const monthlyRepairs: Record<string, { count: number; revenue: number }> = {};

    // Legacy fault type labels for backwards compatibility
    const faultTypeLabels: Record<string, string> = {
      screen: 'מסך',
      charging_port: 'שקע טעינה',
      flash: 'פנס',
      speaker: 'רמקול',
      board: 'לוח אם',
      other: 'אחר',
    };

    const getRepairTypeName = (repair: typeof repairsList[0]): string => {
      if (repair.repair_type?.name) return repair.repair_type.name;
      if (repair.fault_type) return faultTypeLabels[repair.fault_type] || repair.fault_type;
      return 'אחר';
    };

    repairsList.forEach(repair => {
      // By status
      byStatus[repair.status] = (byStatus[repair.status] || 0) + 1;

      // By repair type
      const repairTypeName = getRepairTypeName(repair);
      byRepairType[repairTypeName] = (byRepairType[repairTypeName] || 0) + 1;

      // By lab
      if (repair.lab) {
        const labName = repair.lab.full_name || repair.lab.email || 'מעבדה';
        if (!byLab[labName]) {
          byLab[labName] = { count: 0, revenue: 0 };
        }
        byLab[labName].count++;
        byLab[labName].revenue += repair.cost || 0;
      }

      // Monthly repairs
      if (repair.created_at) {
        const month = new Date(repair.created_at).toISOString().slice(0, 7);
        if (!monthlyRepairs[month]) {
          monthlyRepairs[month] = { count: 0, revenue: 0 };
        }
        monthlyRepairs[month].count++;
        monthlyRepairs[month].revenue += repair.cost || 0;
      }
    });

    return {
      byStatus,
      byRepairType,
      byLab,
      monthlyRepairs: Object.entries(monthlyRepairs).map(([month, data]) => ({ month, ...data })),
    };
  };

  const generateWarrantiesReport = async () => {
    if (typeof window === 'undefined') return undefined; // Skip during SSR
    const { data: warranties } = await supabase
      .from('warranties')
      .select(`
        is_active,
        expiry_date,
        activation_date,
        store:users!warranties_store_id_fkey(id, full_name, email)
      `)
      .gte('activation_date', startDate)
      .lte('activation_date', endDate);

    const warrantiesList = (warranties ?? []) as Array<{
      is_active: boolean;
      expiry_date: string;
      activation_date: string;
      store: { id: string; full_name: string | null; email: string | null } | null;
    }>;
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    let activeCount = 0;
    let expiredCount = 0;
    let expiringNext30Days = 0;
    const byStore: Record<string, number> = {};
    const monthlyActivations: Record<string, number> = {};

    warrantiesList.forEach(warranty => {
      if (!warranty.expiry_date) return;
      const expiryDate = new Date(warranty.expiry_date);

      if (warranty.is_active && expiryDate > now) {
        activeCount++;

        if (expiryDate <= thirtyDaysFromNow) {
          expiringNext30Days++;
        }
      } else {
        expiredCount++;
      }

      // By store
      if (warranty.store) {
        const storeName = warranty.store.full_name || warranty.store.email || 'חנות';
        byStore[storeName] = (byStore[storeName] || 0) + 1;
      }

      // Monthly activations
      if (warranty.activation_date) {
        const month = new Date(warranty.activation_date).toISOString().slice(0, 7);
        monthlyActivations[month] = (monthlyActivations[month] || 0) + 1;
      }
    });

    return {
      activeCount,
      expiredCount,
      byStore,
      monthlyActivations: Object.entries(monthlyActivations).map(([month, count]) => ({ month, count })),
      expiringNext30Days,
    };
  };

  const generatePaymentsReport = async () => {
    if (typeof window === 'undefined') return undefined; // Skip during SSR
    const { data: payments } = await supabase
      .from('payments')
      .select(`
        amount,
        payment_date,
        lab:users!payments_lab_id_fkey(id, full_name, email)
      `)
      .gte('payment_date', startDate)
      .lte('payment_date', endDate);

    const paymentsList = (payments ?? []) as Array<{
      amount: number;
      payment_date: string;
      lab: { id: string; full_name: string | null; email: string | null } | null;
    }>;
    let totalRevenue = 0;
    let paidAmount = 0;
    const byLab: Record<string, { paid: number; pending: number }> = {};
    const monthlyPayments: Record<string, number> = {};

    paymentsList.forEach(payment => {
      totalRevenue += payment.amount;
      paidAmount += payment.amount;

      // By lab
      if (payment.lab) {
        const labName = payment.lab.full_name || payment.lab.email || 'מעבדה';
        if (!byLab[labName]) {
          byLab[labName] = { paid: 0, pending: 0 };
        }
        byLab[labName].paid += payment.amount;
      }

      // Monthly payments
      if (payment.payment_date) {
        const month = new Date(payment.payment_date).toISOString().slice(0, 7);
        monthlyPayments[month] = (monthlyPayments[month] || 0) + payment.amount;
      }
    });

    return {
      totalRevenue,
      paidAmount,
      pendingAmount: 0,
      byLab,
      monthlyPayments: Object.entries(monthlyPayments).map(([month, amount]) => ({ month, amount })),
    };
  };

  const generatePerformanceReport = async () => {
    if (typeof window === 'undefined') return undefined; // Skip during SSR
    // Top stores
    const { data: storeWarranties } = await supabase
      .from('warranties')
      .select(`
        store:users!warranties_store_id_fkey(id, full_name, email)
      `)
      .gte('activation_date', startDate)
      .lte('activation_date', endDate);

    const storeWarrantiesList = (storeWarranties ?? []) as Array<{
      store: { id: string; full_name: string | null; email: string | null } | null;
    }>;
    const storeStats: Record<string, { warranties: number; revenue: number }> = {};

    storeWarrantiesList.forEach(warranty => {
      if (warranty.store) {
        const storeName = warranty.store.full_name || warranty.store.email || 'חנות';
        if (!storeStats[storeName]) {
          storeStats[storeName] = { warranties: 0, revenue: 0 };
        }
        storeStats[storeName].warranties++;
      }
    });

    const topStores = Object.entries(storeStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.warranties - a.warranties)
      .slice(0, 5);

    // Top labs
    const { data: labRepairs } = await supabase
      .from('repairs')
      .select(`
        cost,
        created_at,
        completed_at,
        status,
        lab:users!repairs_lab_id_fkey(id, full_name, email)
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const labRepairsList = (labRepairs ?? []) as Array<{
      cost: number | null;
      created_at: string;
      completed_at: string | null;
      status: string;
      lab: { id: string; full_name: string | null; email: string | null } | null;
    }>;
    const labStats: Record<string, { repairs: number; revenue: number }> = {};

    labRepairsList.forEach(repair => {
      if (repair.lab) {
        const labName = repair.lab.full_name || repair.lab.email || 'מעבדה';
        if (!labStats[labName]) {
          labStats[labName] = { repairs: 0, revenue: 0 };
        }
        labStats[labName].repairs++;
        labStats[labName].revenue += repair.cost || 0;
      }
    });

    const topLabs = Object.entries(labStats)
      .map(([name, stats]) => ({
        name,
        repairs: stats.repairs,
        revenue: stats.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Top repair types
    const { data: repairData } = await supabase
      .from('repairs')
      .select('fault_type, repair_type:repair_types(id, name)')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const repairDataList = (repairData ?? []) as Array<{
      fault_type: string | null;
      repair_type: { id: string; name: string } | null;
    }>;

    // Legacy fault type labels
    const faultTypeLabels: Record<string, string> = {
      screen: 'מסך',
      charging_port: 'שקע טעינה',
      flash: 'פנס',
      speaker: 'רמקול',
      board: 'לוח אם',
      other: 'אחר',
    };

    const repairTypeCounts: Record<string, number> = {};
    const totalRepairs = repairData?.length || 0;

    repairDataList.forEach(repair => {
      let typeName = 'אחר';
      if (repair.repair_type?.name) {
        typeName = repair.repair_type.name;
      } else if (repair.fault_type) {
        typeName = faultTypeLabels[repair.fault_type] || repair.fault_type;
      }
      repairTypeCounts[typeName] = (repairTypeCounts[typeName] || 0) + 1;
    });

    const topRepairTypes = Object.entries(repairTypeCounts)
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalRepairs > 0 ? (count / totalRepairs) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      topStores,
      topLabs,
      topRepairTypes,
      avgWarrantyDuration: 12, // Default from system
    };
  };

  const exportReport = () => {
    const filename = `report_${reportType}_${startDate}_${endDate}.csv`;
    let csvContent = '';

    switch (reportType) {
      case 'summary':
        if (reportData.summary) {
          csvContent = [
            ['מדד', 'ערך'],
            ['סה"כ מכשירים', reportData.summary.totalDevices],
            ['אחריות פעילה', reportData.summary.activeWarranties],
            ['סה"כ תיקונים', reportData.summary.totalRepairs],
            ['תיקונים שהושלמו', reportData.summary.completedRepairs],
            ['הכנסות', reportData.summary.totalRevenue],
            ['שולם', reportData.summary.paidAmount],
            ['ממתין לתשלום', reportData.summary.pendingAmount],
            ['בקשות החלפה', reportData.summary.replacementRequests],
          ].map(row => row.join(',')).join('\n');
        }
        break;
    }

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const getFaultTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      screen: 'מסך',
      charging_port: 'שקע טעינה',
      flash: 'פנס',
      speaker: 'רמקול',
      board: 'לוח אם',
      other: 'אחר',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">דוחות</h1>
          <p className="text-muted-foreground">
            הפקת דוחות וניתוח נתונים
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportReport} variant="outline" disabled={isGenerating}>
            ייצוא לאקסל
            <Download className="ms-2 h-4 w-4" />
          </Button>
          <Button onClick={() => window.print()} variant="outline">
            הדפסה
            <Printer className="ms-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>דוחות מפורטים</CardTitle>
          <CardDescription>גישה מהירה לדוחות מתקדמים</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/admin/reports/repairs" className="block">
              <Button
                variant="outline"
                className="h-auto flex-col items-start p-4 gap-2 w-full"
              >
                <div className="flex items-center gap-2 w-full">
                  <Wrench className="h-5 w-5 text-primary" />
                  <span className="font-semibold">דוח תיקונים מפורט</span>
                </div>
                <p className="text-xs text-muted-foreground text-right w-full">
                  ניתוח מעמיק של תיקונים לפי מעבדות, סוגי תקלות וחודשים
                </p>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Report Controls */}
      <Card>
        <CardHeader>
          <CardTitle>הגדרות דוח</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">סוג דוח</label>
              <Select value={reportType} onValueChange={(value: ReportType) => setReportType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">סיכום כללי</SelectItem>
                  <SelectItem value="devices">מכשירים</SelectItem>
                  <SelectItem value="repairs">תיקונים</SelectItem>
                  <SelectItem value="warranties">אחריות</SelectItem>
                  <SelectItem value="payments">תשלומים</SelectItem>
                  <SelectItem value="performance">ביצועים</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">תקופה</label>
              <Select value={dateRange} onValueChange={(value: DateRange) => setDateRange(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">שבוע אחרון</SelectItem>
                  <SelectItem value="month">חודש אחרון</SelectItem>
                  <SelectItem value="quarter">רבעון אחרון</SelectItem>
                  <SelectItem value="year">שנה אחרונה</SelectItem>
                  <SelectItem value="custom">מותאם אישית</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateRange === 'custom' && (
              <>
                <div>
                  <label htmlFor="report-start-date" className="text-sm font-medium mb-1 block">מתאריך</label>
                  <input
                    type="date"
                    id="report-start-date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="report-end-date" className="text-sm font-medium mb-1 block">עד תאריך</label>
                  <input
                    type="date"
                    id="report-end-date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </>
            )}

            {dateRange !== 'custom' && (
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-1 block">תקופת הדוח</label>
                <p className="px-3 py-2 bg-muted rounded-md">
                  {formatDate(startDate)} - {formatDate(endDate)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Content */}
      {isGenerating ? (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Summary Report */}
          {reportType === 'summary' && reportData.summary && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">סה"כ מכשירים</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-right">{reportData.summary.totalDevices}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
                  <Shield className="h-4 w-4 text-green-600" />
                  <CardTitle className="text-sm font-medium">אחריות פעילה</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-right">{reportData.summary.activeWarranties}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
                  <Wrench className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-sm font-medium">תיקונים</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-right">{reportData.summary.completedRepairs}/{reportData.summary.totalRepairs}</div>
                  <p className="text-xs text-muted-foreground text-right">הושלמו מסה"כ</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
                  <ShekelIcon className="h-4 w-4 text-green-600" />
                  <CardTitle className="text-sm font-medium">הכנסות</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-right">{formatCurrency(reportData.summary.totalRevenue)}</div>
                  <p className="text-xs text-muted-foreground text-right">
                    <span className="text-right">{formatCurrency(reportData.summary.paidAmount)} שולם</span>
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Devices Report */}
          {reportType === 'devices' && reportData.devices && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>התפלגות לפי סטטוס</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(reportData.devices.byStatus).map(([status, count]) => (
                        <div key={status} className="flex justify-between items-center">
                          <span className="capitalize">{status}</span>
                          <Badge>{count}</Badge>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground">שיעור הפעלה</p>
                      <p className="text-2xl font-bold">{reportData.devices.activationRate.toFixed(1)}%</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>דגמים פופולריים</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(reportData.devices.byModel)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([model, count]) => (
                          <div key={model} className="flex justify-between items-center">
                            <span>{model}</span>
                            <Badge>{count}</Badge>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* Repairs Report */}
          {reportType === 'repairs' && reportData.repairs && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>סוגי תקלות</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(reportData.repairs.byRepairType).map(([type, count]) => (
                        <div key={type} className="flex justify-between items-center">
                          <span>{type}</span>
                          <Badge>{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>מעבדות מובילות</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(reportData.repairs.byLab)
                        .sort(([, a], [, b]) => b.revenue - a.revenue)
                        .slice(0, 3)
                        .map(([lab, stats]) => (
                          <div key={lab}>
                            <div className="flex justify-between">
                              <span className="font-medium">{lab}</span>
                              <span>{formatCurrency(stats.revenue)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{stats.count} תיקונים</p>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* Performance Report */}
          {reportType === 'performance' && reportData.performance && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>חנויות מובילות</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {reportData.performance.topStores.map((store, index) => (
                        <div key={store.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{index + 1}</Badge>
                            <span>{store.name}</span>
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{store.warranties} אחריות</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>מעבדות מובילות</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {reportData.performance.topLabs.map((lab, index) => (
                        <div key={lab.name}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{index + 1}</Badge>
                              <span>{lab.name}</span>
                            </div>
                            <div className="text-left">
                              <p className="font-medium">{formatCurrency(lab.revenue)}</p>
                              <p className="text-xs text-muted-foreground">
                                {lab.repairs} תיקונים
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}