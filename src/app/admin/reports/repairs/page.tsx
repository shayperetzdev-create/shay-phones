'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { User, Device, DeviceModel, Warranty, Repair, RepairType } from '@/types';
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
  Filter,
  Download,
  Wrench,
  Building2,
  Calendar,
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import ShekelIcon from '@/components/ui/shekel-icon';

type FaultType = 'screen' | 'charging_port' | 'flash' | 'speaker' | 'board' | 'other';

interface RepairReport {
  repairs: any[];
  byLab: Record<string, { count: number; revenue: number }>;
  byRepairType: Record<string, { count: number; revenue: number }>;
  byMonth: Record<string, { count: number; revenue: number }>;
  totalRepairs: number;
  totalRevenue: number;
}

// Legacy fault type labels for backwards compatibility
const faultTypeLabels: Record<FaultType, string> = {
  screen: 'מסך',
  charging_port: 'שקע טעינה',
  flash: 'פנס',
  speaker: 'רמקול',
  board: 'לוח אם',
  other: 'אחר',
};

const statusLabels: Record<string, string> = {
  received: 'התקבל',
  in_progress: 'בטיפול',
  completed: 'הושלם',
  replacement_requested: 'בקשת החלפה',
  cancelled: 'בוטל',
};

export default function AdminRepairsReportPage() {
  const [report, setReport] = useState<RepairReport>({
    repairs: [],
    byLab: {},
    byRepairType: {},
    byMonth: {},
    totalRepairs: 0,
    totalRevenue: 0
  });
  type AdminRepair = Repair & {
    device?: (Pick<Device, 'imei'> & {
      device_models?: Pick<DeviceModel, 'model_name'> | null;
    }) | null;
    lab?: Pick<User, 'full_name' | 'email'> | null;
    warranty?: (Warranty & {
      store?: Pick<User, 'full_name' | 'email'> | null;
    }) | null;
    repair_type?: Pick<RepairType, 'id' | 'name'> | null;
  };

  type LabRow = Pick<User, 'id' | 'full_name' | 'email' | 'phone'>;
  type RepairTypeRow = Pick<RepairType, 'id' | 'name' | 'is_active'>;

  const [allRepairs, setAllRepairs] = useState<AdminRepair[]>([]);
  const [labs, setLabs] = useState<LabRow[]>([]);
  const [repairTypes, setRepairTypes] = useState<RepairTypeRow[]>([]);
  const [filterLab, setFilterLab] = useState<string>('all');
  const [filterRepairType, setFilterRepairType] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch all labs
      const { data: labsData } = await supabase
        .from('users')
        .select('id, full_name, email, phone')
        .eq('role', 'lab')
        .order('full_name')
        .returns<LabRow[]>();

      setLabs(labsData || []);

      // Fetch all repair types
      const { data: repairTypesData } = await supabase
        .from('repair_types')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name')
        .returns<RepairTypeRow[]>();

      setRepairTypes(repairTypesData || []);

      // Fetch all repairs with related data
      const { data: repairsData } = await supabase
        .from('repairs')
        .select(`
          *,
          device:devices(imei, device_models(model_name)),
          lab:users!repairs_lab_id_fkey(full_name, email),
          warranty:warranties(
            customer_name,
            customer_phone,
            store:users!warranties_store_id_fkey(full_name, email)
          ),
          repair_type:repair_types(id, name)
        `)
        .order('created_at', { ascending: false })
        .returns<AdminRepair[]>();

      setAllRepairs(repairsData || []);

      // Extract available months
      const months = new Set<string>();
      (repairsData || []).forEach(repair => {
        const month = repair.created_at.substring(0, 7);
        months.add(month);
      });
      setAvailableMonths(Array.from(months).sort((a, b) => b.localeCompare(a)));

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את הנתונים',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [supabase, toast]);

  const processReport = useCallback(() => {
    let filteredRepairs = [...allRepairs];

    // Apply filters
    if (filterLab !== 'all') {
      filteredRepairs = filteredRepairs.filter(r => r.lab_id === filterLab);
    }
    if (filterRepairType !== 'all') {
      filteredRepairs = filteredRepairs.filter(r => r.repair_type_id === filterRepairType);
    }
    if (filterMonth !== 'all') {
      filteredRepairs = filteredRepairs.filter(r => r.created_at.startsWith(filterMonth));
    }

    // Process statistics
    const byLab: Record<string, { count: number; revenue: number }> = {};
    const byRepairType: Record<string, { count: number; revenue: number }> = {};
    const byMonth: Record<string, { count: number; revenue: number }> = {};
    let totalRevenue = 0;

    filteredRepairs.forEach(repair => {
      const revenue = repair.cost || 0;
      totalRevenue += revenue;

      // By Lab
      const labName = repair.lab?.full_name || repair.lab?.email || 'לא ידוע';
      if (!byLab[labName]) {
        byLab[labName] = { count: 0, revenue: 0 };
      }
      byLab[labName].count++;
      byLab[labName].revenue += revenue;

      // By Repair Type
      const repairTypeName = repair.repair_type?.name || faultTypeLabels[repair.fault_type as FaultType] || 'לא ידוע';
      if (!byRepairType[repairTypeName]) {
        byRepairType[repairTypeName] = { count: 0, revenue: 0 };
      }
      byRepairType[repairTypeName].count++;
      byRepairType[repairTypeName].revenue += revenue;

      // By Month
      const month = repair.created_at.substring(0, 7);
      if (!byMonth[month]) {
        byMonth[month] = { count: 0, revenue: 0 };
      }
      byMonth[month].count++;
      byMonth[month].revenue += revenue;
    });

    setReport({
      repairs: filteredRepairs,
      byLab,
      byRepairType,
      byMonth,
      totalRepairs: filteredRepairs.length,
      totalRevenue
    });
  }, [allRepairs, filterLab, filterRepairType, filterMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    processReport();
  }, [processReport]);

  const exportToCSV = () => {
    const selectedLab = filterLab === 'all' ? null : labs.find(l => l.id === filterLab);
    const labLabel = filterLab === 'all' ? 'הכל' : (selectedLab?.full_name || selectedLab?.email || '');
    const selectedRepairType = filterRepairType === 'all' ? null : repairTypes.find(rt => rt.id === filterRepairType);
    const repairTypeLabel = filterRepairType === 'all' ? 'הכל' : (selectedRepairType?.name || '');
    const csvContent = [
      ['דוח תיקונים מפורט'],
      ['תאריך הפקה: ' + new Date().toLocaleDateString('he-IL')],
      [''],
      ['סינונים:'],
      ['מעבדה: ' + labLabel],
      ['סוג תיקון: ' + repairTypeLabel],
      ['חודש: ' + (filterMonth === 'all' ? 'הכל' : filterMonth)],
      [''],
      ['סיכום כללי'],
      ['סה"כ תיקונים', 'סה"כ עלות', 'מחיר ממוצע'],
      [report.totalRepairs, formatCurrency(report.totalRevenue), formatCurrency(report.totalRepairs > 0 ? report.totalRevenue / report.totalRepairs : 0)],
      [''],
      ['פילוח לפי מעבדה'],
      ['מעבדה', 'כמות', 'הכנסה', 'ממוצע'],
      ...Object.entries(report.byLab)
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .map(([lab, data]) => [
          lab,
          data.count,
          formatCurrency(data.revenue),
          formatCurrency(data.revenue / data.count)
        ]),
      [''],
      ['פילוח לפי סוג תיקון'],
      ['סוג תיקון', 'כמות', 'הכנסה', 'ממוצע'],
      ...Object.entries(report.byRepairType)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([type, data]) => [
          type,
          data.count,
          formatCurrency(data.revenue),
          formatCurrency(data.revenue / data.count)
        ]),
      [''],
      ['פילוח לפי חודש'],
      ['חודש', 'כמות', 'הכנסה', 'ממוצע'],
      ...Object.entries(report.byMonth)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([month, data]) => [
          month,
          data.count,
          formatCurrency(data.revenue),
          formatCurrency(data.revenue / data.count)
        ]),
      [''],
      ['פירוט תיקונים'],
      ['תאריך', 'מכשיר', 'תיקון', 'מעבדה', 'חנות', 'סטטוס', 'עלות'],
      ...report.repairs.map(repair => [
        formatDate(repair.created_at),
        `${repair.device?.device_models?.model_name || 'לא ידוע'} - ${repair.device?.imei}`,
        repair.repair_type?.name || faultTypeLabels[repair.fault_type as FaultType] || 'לא ידוע',
        repair.lab?.full_name || repair.lab?.email || '',
        repair.warranty?.store?.full_name || repair.warranty?.store?.email || '',
        statusLabels[repair.status] || repair.status,
        formatCurrency(repair.cost || 0)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `repairs_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/admin/reports">
              <Button variant="ghost" size="sm">
                <ArrowRight className="ms-1 h-4 w-4" />
                חזרה לדוחות
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">דוח תיקונים מפורט</h1>
          <p className="text-muted-foreground">
            ניתוח מעמיק של תיקונים לפי מעבדות, סוגי תקלות וחודשים
          </p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          ייצוא לאקסל
          <Download className="ms-2 h-4 w-4" />
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-end" dir="rtl">
          <div className="flex items-center gap-2">
            <CardTitle>סינונים</CardTitle>
            <Filter className="h-5 w-5" />
            {(filterLab !== 'all' || filterRepairType !== 'all' || filterMonth !== 'all') && (
              <Badge variant="secondary" className="mr-2">
                {[filterLab !== 'all', filterRepairType !== 'all', filterMonth !== 'all'].filter(Boolean).length} פעילים
              </Badge>
            )}
          </div>
          {(filterLab !== 'all' || filterRepairType !== 'all' || filterMonth !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterLab('all');
                setFilterRepairType('all');
                setFilterMonth('all');
              }}
            >
              איפוס סינונים
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">מעבדה</label>
              <Select value={filterLab} onValueChange={setFilterLab}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל המעבדות</SelectItem>
                  {labs.map((lab) => (
                    <SelectItem key={lab.id} value={lab.id}>
                      {lab.full_name || lab.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">סוג תיקון</label>
              <Select value={filterRepairType} onValueChange={setFilterRepairType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל סוגי התיקונים</SelectItem>
                  {repairTypes.map((repairType) => (
                    <SelectItem key={repairType.id} value={repairType.id}>
                      {repairType.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">חודש</label>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל החודשים</SelectItem>
                  {availableMonths.map((month) => (
                    <SelectItem key={month} value={month}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">סה"כ תיקונים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right">{report.totalRepairs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <CardTitle className="text-sm font-medium">סה"כ עלות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right">{formatCurrency(report.totalRevenue)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">מעבדות פעילות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right">{Object.keys(report.byLab).length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
            <ShekelIcon className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">מחיר ממוצע</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right">
              {formatCurrency(report.totalRepairs > 0 ? report.totalRevenue / report.totalRepairs : 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistics Tables */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* By Lab */}
        <Card>
          <CardHeader>
            <CardTitle>פילוח לפי מעבדה</CardTitle>
            <CardDescription>סה"כ {Object.keys(report.byLab).length} מעבדות</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">מעבדה</TableHead>
                  <TableHead className="text-right">תיקונים</TableHead>
                  <TableHead className="text-right">הכנסה</TableHead>
                  <TableHead className="text-right">ממוצע</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(report.byLab)
                  .sort((a, b) => b[1].revenue - a[1].revenue)
                  .map(([lab, data]) => (
                    <TableRow key={lab}>
                      <TableCell className="font-medium">{lab}</TableCell>
                      <TableCell>{data.count}</TableCell>
                      <TableCell>{formatCurrency(data.revenue)}</TableCell>
                      <TableCell>{formatCurrency(data.revenue / data.count)}</TableCell>
                    </TableRow>
                  ))}
                {Object.keys(report.byLab).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      אין נתונים להצגה
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* By Repair Type */}
        <Card>
          <CardHeader>
            <CardTitle>פילוח לפי סוג תיקון</CardTitle>
            <CardDescription>התפלגות סוגי התיקונים</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">סוג תיקון</TableHead>
                  <TableHead className="text-right">תיקונים</TableHead>
                  <TableHead className="text-right">הכנסה</TableHead>
                  <TableHead className="text-right">ממוצע</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(report.byRepairType)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([type, data]) => (
                    <TableRow key={type}>
                      <TableCell className="font-medium">
                        {type}
                      </TableCell>
                      <TableCell>{data.count}</TableCell>
                      <TableCell>{formatCurrency(data.revenue)}</TableCell>
                      <TableCell>{formatCurrency(data.revenue / data.count)}</TableCell>
                    </TableRow>
                  ))}
                {Object.keys(report.byRepairType).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      אין נתונים להצגה
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* By Month */}
        <Card>
          <CardHeader>
            <CardTitle>פילוח לפי חודש</CardTitle>
            <CardDescription>מגמה חודשית</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">חודש</TableHead>
                  <TableHead className="text-right">תיקונים</TableHead>
                  <TableHead className="text-right">הכנסה</TableHead>
                  <TableHead className="text-right">ממוצע</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(report.byMonth)
                  .sort((a, b) => b[0].localeCompare(a[0]))
                  .map(([month, data]) => (
                    <TableRow key={month}>
                      <TableCell className="font-medium">{month}</TableCell>
                      <TableCell>{data.count}</TableCell>
                      <TableCell>{formatCurrency(data.revenue)}</TableCell>
                      <TableCell>{formatCurrency(data.revenue / data.count)}</TableCell>
                    </TableRow>
                  ))}
                {Object.keys(report.byMonth).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      אין נתונים להצגה
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Repairs List */}
      <Card>
        <CardHeader>
          <CardTitle>רשימת תיקונים מפורטת ({report.repairs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {report.repairs.length === 0 ? (
            <div className="text-center py-12">
              <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">אין תיקונים להצגה</h3>
              <p className="text-muted-foreground">
                {(filterLab !== 'all' || filterRepairType !== 'all' || filterMonth !== 'all')
                  ? 'נסה לשנות את הסינונים כדי לראות תוצאות'
                  : 'עדיין לא בוצעו תיקונים במערכת'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-right">מכשיר</TableHead>
                    <TableHead className="text-right">תיקון</TableHead>
                    <TableHead className="text-right">מעבדה</TableHead>
                    <TableHead className="text-right">חנות</TableHead>
                    <TableHead className="text-right">סטטוס</TableHead>
                    <TableHead className="text-right">עלות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.repairs.slice(0, 50).map((repair) => (
                    <TableRow key={repair.id}>
                      <TableCell>{formatDate(repair.created_at)}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{repair.device?.device_models?.model_name || 'לא ידוע'}</div>
                          <div className="text-xs text-muted-foreground">{repair.device?.imei}</div>
                        </div>
                      </TableCell>
                      <TableCell>{repair.repair_type?.name || faultTypeLabels[repair.fault_type as FaultType] || 'לא ידוע'}</TableCell>
                      <TableCell>{repair.lab?.full_name || repair.lab?.email || '-'}</TableCell>
                      <TableCell>{repair.warranty?.store?.full_name || repair.warranty?.store?.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={
                          repair.status === 'completed' ? 'default' :
                            repair.status === 'in_progress' ? 'secondary' :
                              repair.status === 'replacement_requested' ? 'destructive' :
                                repair.status === 'cancelled' ? 'outline' :
                                  'outline'
                        }>
                          {statusLabels[repair.status] || repair.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(repair.cost || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {report.repairs.length > 50 && (
                <div className="text-center mt-4 text-sm text-muted-foreground">
                  מוצגות 50 תוצאות ראשונות מתוך {report.repairs.length}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}