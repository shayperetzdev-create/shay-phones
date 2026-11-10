'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLabCompletedRepairs, useLabPayments } from '@/hooks/queries/useLabPayments';
import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';
import type { User, Device, DeviceModel, Warranty, Repair, RepairType, Payment } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { formatDate, formatCurrency } from '@/lib/utils';
import {
  Calendar,
  Wrench,
  TrendingUp,
  Download,
  FileText,
  CheckCircle,
  Clock
} from 'lucide-react';
import ShekelIcon from '@/components/ui/shekel-icon';

type CompletedRepair = Repair & {
  device?: (Pick<Device, 'imei'> & {
    device_models?: Pick<DeviceModel, 'model_name'> | null;
  }) | null;
  warranty?: (Warranty & {
    store?: Pick<User, 'full_name' | 'email'> | null;
  }) | null;
  repair_type?: Pick<RepairType, 'id' | 'name'> | null;
};

type LabPayment = Payment;

interface MonthlyReport {
  month: string;
  year: number;
  repairs: CompletedRepair[];
  totalRepairs: number;
  totalRevenue: number;
  byRepairType: Record<string, { count: number; revenue: number }>;
  payments: LabPayment[];
}

export default function LabFinancialReportPage() {
  // React Query hooks with Realtime
  const { user: labData, isLoading: isUserLoading } = useCurrentUser();
  const labId = labData?.id || null;
  const { repairs: completedRepairs, isLoading: isRepairsLoading, isFetching: isRepairsFetching } = useLabCompletedRepairs(labId);
  const { payments, isLoading: isPaymentsLoading, isFetching: isPaymentsFetching } = useLabPayments(labId);

  const isLoading = isUserLoading || isRepairsLoading || isPaymentsLoading;
  const isFetching = isRepairsFetching || isPaymentsFetching;

  // Local state for UI
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  
  // --- [תיקון 2: הפיכת state נגזר ל-useMemo] ---

  // Legacy fault type labels for backwards compatibility
  const faultTypeLabels: Record<string, string> = {
    screen: 'מסך',
    charging_port: 'שקע טעינה',
    flash: 'פנס',
    speaker: 'רמקול',
    board: 'לוח אם',
    other: 'אחר',
  };

  // עטיפת הפונקציה ב-useCallback כדי לייצב אותה עבור useMemo
  const getRepairTypeName = useCallback((repair: CompletedRepair): string => {
    if (repair.repair_type?.name) {
      return repair.repair_type.name;
    }
    if (repair.fault_type) {
      return faultTypeLabels[repair.fault_type] || repair.fault_type;
    }
    return 'אחר';
  }, [faultTypeLabels]); // תלות זו יציבה

  // חישוב הדוחות באמצעות useMemo
  const monthlyReports = useMemo(() => {
    if (!completedRepairs || !payments) return [];

    // Process data by month
    const reportsByMonth: Record<string, MonthlyReport> = {};

    completedRepairs.forEach(repair => {
      const completionDate = repair.completed_at || repair.created_at;
      if (!completionDate) return;
      const month = completionDate.substring(0, 7);
      if (!reportsByMonth[month]) {
        reportsByMonth[month] = {
          month: month.split('-')[1],
          year: parseInt(month.split('-')[0]),
          repairs: [],
          totalRepairs: 0,
          totalRevenue: 0,
          byRepairType: {},
          payments: []
        };
      }

      reportsByMonth[month].repairs.push(repair as any);
      reportsByMonth[month].totalRepairs++;
      reportsByMonth[month].totalRevenue += repair.cost || 0;

      // Group by repair type
      const repairTypeName = getRepairTypeName(repair as any);
      if (!reportsByMonth[month].byRepairType[repairTypeName]) {
        reportsByMonth[month].byRepairType[repairTypeName] = { count: 0, revenue: 0 };
      }
      reportsByMonth[month].byRepairType[repairTypeName].count++;
      reportsByMonth[month].byRepairType[repairTypeName].revenue += repair.cost || 0;
    });

    // Add payments to months
    payments.forEach(payment => {
      const month = payment.payment_date.substring(0, 7);
      if (reportsByMonth[month]) {
        reportsByMonth[month].payments.push(payment as any);
      }
    });

    const sortedReports = Object.values(reportsByMonth).sort((a, b) => {
      const dateA = `${a.year}-${String(a.month).padStart(2, '0')}`;
      const dateB = `${b.year}-${String(b.month).padStart(2, '0')}`;
      return dateB.localeCompare(dateA);
    });

    return sortedReports;
  }, [completedRepairs, payments, getRepairTypeName]);

  // חישוב סטטיסטיקות כלליות באמצעות useMemo
  const totalStats = useMemo(() => {
    if (!completedRepairs || !payments) {
      return { totalRepairs: 0, totalRevenue: 0, totalPaid: 0, balance: 0 };
    }
    
    const totalRevenue = completedRepairs.reduce((sum, r) => sum + (r.cost || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    return {
      totalRepairs: completedRepairs.length,
      totalRevenue,
      totalPaid,
      balance: totalRevenue - totalPaid
    };
  }, [completedRepairs, payments]);

  // useEffect חדש: קובע את החודש הנבחר כברירת מחדל רק כשהדוחות נטענים
  useEffect(() => {
    // אם הדוחות נטענו ועדיין לא נבחר חודש, בחר את החדש ביותר
    if (monthlyReports.length > 0 && !selectedMonth) {
      const mostRecentMonth = `${monthlyReports[0].year}-${String(monthlyReports[0].month).padStart(2, '0')}`;
      setSelectedMonth(mostRecentMonth);
    }
    // אפקט זה תלוי *רק* בדוחות, ולא בחודש שנבחר
  }, [monthlyReports, selectedMonth]); 
  // (הוספנו את selectedMonth בחזרה כדי למנוע stale state, אבל הלוגיקה `!selectedMonth` מונעת לולאה)
  // עריכה: עדיף להסיר את התלות ב-selectedMonth לחלוטין כדי למנוע בלבול
  /* useEffect(() => {
    if (monthlyReports.length > 0 && !selectedMonth) {
      const mostRecentMonth = `${monthlyReports[0].year}-${String(monthlyReports[0].month).padStart(2, '0')}`;
      setSelectedMonth(mostRecentMonth);
    }
  }, [monthlyReports]); 
  */
  // נשאיר את הקוד המקורי של המשתמש כרגע, הוא עובד בסדר
  useEffect(() => {
    if (monthlyReports.length > 0 && !selectedMonth) {
      const mostRecentMonth = `${monthlyReports[0].year}-${String(monthlyReports[0].month).padStart(2, '0')}`;
      setSelectedMonth(mostRecentMonth);
    }
  }, [monthlyReports, selectedMonth]); // הלולאה נשברת כי selectedMonth יפסיק להיות Falsy


  const exportToCSV = () => {
    const selectedReport = monthlyReports.find(r => 
      `${r.year}-${String(r.month).padStart(2, '0')}` === selectedMonth
    );
    
    if (!selectedReport) return;

    const csvContent = [
      ['דוח כספי - ' + (labData?.full_name || labData?.email || '')],
      ['חודש: ' + selectedMonth],
      [''],
      ['סיכום כללי'],
      ['תיקונים', 'הכנסות'],
      [selectedReport.totalRepairs, formatCurrency(selectedReport.totalRevenue)],
      [''],
      ['פירוט לפי סוג תיקון'],
      ['סוג תיקון', 'כמות', 'הכנסה'],
      ...Object.entries(selectedReport.byRepairType).map(([type, data]) => [
        type,
        data.count,
        formatCurrency(data.revenue)
      ]),
      [''],
      ['פירוט תיקונים'],
      ['תאריך', 'דגם', 'תיקון', 'מחיר', 'חנות'],
      ...selectedReport.repairs.map(repair => [
        repair.completed_at ? formatDate(repair.completed_at) : formatDate(repair.created_at),
        repair.device?.device_models?.model_name || 'לא ידוע',
        getRepairTypeName(repair),
        formatCurrency(repair.cost || 0),
        repair.warranty?.store?.full_name || repair.warranty?.store?.email || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `financial_report_${selectedMonth}.csv`;
    link.click();
  };

  // חישוב הדוח הנוכחי באמצעות useMemo
  const currentMonthReport = useMemo(() => {
    return monthlyReports.find(r => 
      `${r.year}-${String(r.month).padStart(2, '0')}` === selectedMonth
    );
  }, [monthlyReports, selectedMonth]);

  // --- [סוף תיקון 2] ---

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Background refresh indicator */}
      <BackgroundRefreshIndicator
        isFetching={isFetching}
        isLoading={isLoading}
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">דוח כספי</h1>
          <p className="text-muted-foreground">
            סיכום תיקונים והכנסות - {labData?.full_name || labData?.email || ''}
          </p>
        </div>
        <div className="flex gap-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="בחר חודש..." />
            </SelectTrigger>
            <SelectContent>
              {monthlyReports.map((report) => {
                const monthValue = `${report.year}-${String(report.month).padStart(2, '0')}`;
                return (
                  <SelectItem key={monthValue} value={monthValue}>
                    {report.month}/{report.year}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="ms-2 h-4 w-4" />
            ייצוא לאקסל
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">סה"כ תיקונים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right">{totalStats.totalRepairs}</div>
            <p className="text-xs text-muted-foreground text-right">תיקונים שהושלמו</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <CardTitle className="text-sm font-medium">סה"כ הכנסות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right">{formatCurrency(totalStats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground text-right">הכנסות מתיקונים</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-sm font-medium">התקבל</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right">{formatCurrency(totalStats.totalPaid)}</div>
            <p className="text-xs text-muted-foreground text-right">תשלומים שהתקבלו</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <Clock className="h-4 w-4 text-orange-600" />
            <CardTitle className="text-sm font-medium">יתרה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right">{formatCurrency(totalStats.balance)}</div>
            <p className="text-xs text-muted-foreground text-right">מאזן תשלומים</p>
          </CardContent>
        </Card>
      </div>

      {currentMonthReport && (
        <>
          {/* Monthly Summary */}
          <Card>
            <CardHeader>
              <CardTitle>סיכום חודש {currentMonthReport.month}/{currentMonthReport.year}</CardTitle>
              <CardDescription>
                {currentMonthReport.totalRepairs} תיקונים בסך {formatCurrency(currentMonthReport.totalRevenue)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* By Repair Type */}
                <div>
                  <h4 className="font-medium mb-2">פילוח לפי סוג תיקון</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">סוג תיקון</TableHead>
                        <TableHead className="text-right">כמות</TableHead>
                        <TableHead className="text-right">מחיר יחידה</TableHead>
                        <TableHead className="text-right">סה"כ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(currentMonthReport.byRepairType).map(([type, data]) => (
                        <TableRow key={type}>
                          <TableCell>{type}</TableCell>
                          <TableCell>{data.count}</TableCell>
                      <TableCell>
                        {formatCurrency(data.count > 0 ? data.revenue / data.count : 0)}
                      </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(data.revenue)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold">
                        <TableCell>סה"כ</TableCell>
                        <TableCell>{currentMonthReport.totalRepairs}</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>{formatCurrency(currentMonthReport.totalRevenue)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Payments Received */}
                {currentMonthReport.payments.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">תשלומים שהתקבלו</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">תאריך</TableHead>
                          <TableHead className="text-right">סכום</TableHead>
                          <TableHead className="text-right">אסמכתא</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentMonthReport.payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{formatDate(payment.payment_date)}</TableCell>
                            <TableCell className="font-bold text-blue-600">
                              {formatCurrency(payment.amount)}
                            </TableCell>
                            <TableCell>{payment.reference || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Repairs List */}
          <Card>
            <CardHeader>
              <CardTitle>פירוט תיקונים</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-right">מכשיר</TableHead>
                    <TableHead className="text-right">תיקון</TableHead>
                    <TableHead className="text-right">לקוח</TableHead>
                    <TableHead className="text-right">חנות</TableHead>
                    <TableHead className="text-right">מחיר</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentMonthReport.repairs.map((repair) => (
                    <TableRow key={repair.id}>
                      <TableCell>{repair.completed_at ? formatDate(repair.completed_at) : '-'}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{repair.device?.device_models?.model_name || 'לא ידוע'}</div>
                          <div className="text-xs text-muted-foreground">{repair.device?.imei}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getRepairTypeName(repair)}</TableCell>
                      <TableCell>{repair.warranty?.customer_name || repair.customer_name}</TableCell>
                      <TableCell>{repair.warranty?.store?.full_name || repair.warranty?.store?.email || '-'}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(repair.cost || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}