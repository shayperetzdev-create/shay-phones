'use client';

import { useEffect, useState, useCallback } from 'react';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { 
  FileText, Download, TrendingUp, BarChart3, Calendar,
  Package, Shield, RefreshCw, Clock, CheckCircle, AlertCircle
} from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';

type DateRange = 'week' | 'month' | 'quarter' | 'year';

interface StoreReportData {
  summary: {
    totalWarranties: number;
    activeWarranties: number;
    expiredWarranties: number;
    replacements: number;
    monthlyActivations: { month: string; count: number }[];
  };
  warranties: {
    recent: any[];
    expiringSoon: any[];
  };
  replacements: {
    pending: number;
    approved: number;
    rejected: number;
    list: any[];
  };
}

export default function StoreReportsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [reportData, setReportData] = useState<StoreReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const supabase = createClient();
  const { toast } = useToast();

  const loadUserData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('משתמש לא מחובר');

      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      setUserData(data);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }, [supabase]);

  const generateReport = useCallback(async () => {
    if (!userData?.id) return;

    setIsLoading(true);

    try {
      // Calculate date range inline
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

      const startISO = start.toISOString();
      const endISO = now.toISOString();
      const storeId = userData.id;

      // Get warranties data
      const { data: warranties } = await supabase
        .from('warranties')
        .select(`
          *,
          device:devices(imei, device_models(model_name))
        `)
        .eq('store_id', storeId)
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: false }) as {
        data: Array<{
          id: string;
          activation_date: string;
          customer_name: string;
          device: {
            imei: string;
            device_models: { model_name: string } | null;
          } | null;
        }> | null;
        error: any;
      };

      // Get all warranties for counts
      const { data: allWarranties } = await supabase
        .from('warranties')
        .select('*')
        .eq('store_id', storeId) as {
        data: Array<{
          id: string;
          is_active: boolean;
          activation_date: string;
        }> | null;
        error: any;
      };

      const activeCount = allWarranties?.filter(w => w.is_active).length || 0;
      const expiredCount = allWarranties?.filter(w => !w.is_active).length || 0;

      // Get warranties expiring soon (next 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      const { data: expiringSoon } = await supabase
        .from('warranties')
        .select(`
          *,
          device:devices(imei, device_models(model_name))
        `)
        .eq('store_id', storeId)
        .eq('is_active', true)
        .lte('expiry_date', thirtyDaysFromNow.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true })
        .limit(10);

      // Get replacement requests
      const { data: replacements } = await supabase
        .from('replacement_requests')
        .select(`
          *,
          device:devices!inner(
            *,
            device_models(model_name),
            warranty:warranties!inner(*)
          )
        `)
        .eq('device.warranty.store_id', storeId)
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: false }) as {
        data: Array<{
          id: string;
          status: string;
          created_at: string;
          device: {
            device_models: { model_name: string } | null;
            warranty: Array<any>;
          };
        }> | null;
        error: any;
      };

      // Calculate monthly activations
      const monthlyData: { [key: string]: number } = {};
      warranties?.forEach((warranty) => {
        if (!warranty.activation_date) return;
        const month = new Date(warranty.activation_date).toLocaleDateString('he-IL', { 
          month: 'long', 
          year: 'numeric' 
        });
        monthlyData[month] = (monthlyData[month] || 0) + 1;
      });

      const monthlyActivations = Object.entries(monthlyData).map(([month, count]) => ({
        month,
        count
      }));

      // Count replacements by status
      const pendingReplacements = replacements?.filter(r => r.status === 'pending').length || 0;
      const approvedReplacements = replacements?.filter(r => r.status === 'approved').length || 0;
      const rejectedReplacements = replacements?.filter(r => r.status === 'rejected').length || 0;

      setReportData({
        summary: {
          totalWarranties: allWarranties?.length || 0,
          activeWarranties: activeCount,
          expiredWarranties: expiredCount,
          replacements: replacements?.length || 0,
          monthlyActivations
        },
        warranties: {
          recent: warranties?.slice(0, 10) || [],
          expiringSoon: expiringSoon || []
        },
        replacements: {
          pending: pendingReplacements,
          approved: approvedReplacements,
          rejected: rejectedReplacements,
          list: replacements?.slice(0, 10) || []
        }
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן ליצור את הדוח',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [userData, supabase, dateRange, toast]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  useEffect(() => {
    if (userData?.id) {
      generateReport();
    }
  }, [generateReport, userData]);

  const exportReport = async () => {
    if (!reportData) return;

    try {
      const csvData = [
        ['דוח חנות', userData?.full_name || userData?.email || ''],
        ['תאריך', new Date().toLocaleDateString('he-IL')],
        [''],
        ['סיכום'],
        ['סה"כ אחריות', reportData.summary.totalWarranties],
        ['אחריות פעילות', reportData.summary.activeWarranties],
        ['אחריות שפגו', reportData.summary.expiredWarranties],
        ['בקשות החלפה', reportData.summary.replacements],
        [''],
        ['אחריות אחרונות'],
        ['תאריך', 'לקוח', 'דגם', 'IMEI', 'סטטוס'],
        ...reportData.warranties.recent.map(w => [
          formatDate(w.activation_date),
          w.customer_name,
          w.device?.device_models?.model_name,
          w.device?.imei,
          w.is_active ? 'פעיל' : 'לא פעיל'
        ])
      ];

      const csv = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `דוח_חנות_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      toast({
        title: 'הצלחה',
        description: 'הדוח יוצא בהצלחה',
      });
    } catch (error) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לייצא את הדוח',
        variant: 'destructive',
      });
    }
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
          <h1 className="text-3xl font-bold tracking-tight">דוחות</h1>
          <p className="text-muted-foreground">
            צפייה בנתונים וסטטיסטיקות של החנות
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={(value: DateRange) => setDateRange(value)}>
            <SelectTrigger className="w-40" dir="rtl">
              <SelectValue placeholder="בחר טווח תאריכים" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="week">שבוע אחרון</SelectItem>
              <SelectItem value="month">חודש אחרון</SelectItem>
              <SelectItem value="quarter">רבעון אחרון</SelectItem>
              <SelectItem value="year">שנה אחרונה</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportReport} variant="outline" dir="rtl">
            ייצוא לאקסל
            <Download className="ms-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {reportData && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-blue-500">
            <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
              <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-sm font-medium">סה"כ אחריות</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-right text-blue-600">{reportData.summary.totalWarranties}</div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-green-500">
            <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <CardTitle className="text-sm font-medium">אחריות פעילות</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-right text-green-600">{reportData.summary.activeWarranties}</div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-red-500">
            <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <CardTitle className="text-sm font-medium">אחריות שפגו</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-right text-red-600">{reportData.summary.expiredWarranties}</div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-orange-500">
            <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
              <RefreshCw className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <CardTitle className="text-sm font-medium">בקשות החלפה</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-right text-orange-600">{reportData.summary.replacements}</div>
            </CardContent>
          </Card>
        </div>

          {/* Monthly Activations */}
          {reportData.summary.monthlyActivations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>הפעלות אחריות לפי חודש</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reportData.summary.monthlyActivations.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span>{item.month}</span>
                      <Badge variant="outline">{item.count} הפעלות</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Expiring Soon */}
          {reportData.warranties.expiringSoon.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>אחריות שפגות בקרוב</CardTitle>
                <CardDescription>אחריות שפגות ב-30 הימים הקרובים</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reportData.warranties.expiringSoon.map((warranty) => (
                    <div key={warranty.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-medium">{warranty.customer_name}</span>
                        <span className="text-sm text-muted-foreground mx-2">•</span>
                        <span className="text-sm">{warranty.device?.device_models?.model_name}</span>
                      </div>
                      <Badge variant="destructive">
                        פג ב-{formatDate(warranty.expiry_date)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Replacement Requests */}
          {reportData.replacements.list.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>בקשות החלפה אחרונות</CardTitle>
                <CardDescription>
                  ממתינות: {reportData.replacements.pending} | 
                  אושרו: {reportData.replacements.approved} | 
                  נדחו: {reportData.replacements.rejected}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reportData.replacements.list.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-medium">{request.device?.device_models?.model_name}</span>
                        <span className="text-sm text-muted-foreground mx-2">•</span>
                        <span className="text-sm">{formatDate(request.created_at)}</span>
                      </div>
                      <Badge 
                        variant={
                          request.status === 'approved' ? 'default' :
                          request.status === 'rejected' ? 'destructive' :
                          'outline'
                        }
                      >
                        {request.status === 'pending' ? 'ממתין' :
                         request.status === 'approved' ? 'אושר' : 'נדחה'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}