'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Device, DeviceModel, Warranty, ReplacementRequest } from '@/types';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useStoreDashboardStats } from '@/hooks/queries/useStoreDashboard';
import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Shield,
  Package,
  Search,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Calendar,
  User,
  Store,
  Hash,
  Clock,
  RefreshCw,
  FileText,
  Phone,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useForm } from 'react-hook-form';
import { formatDate } from '@/lib/utils';

interface WarrantyFormData {
  customer_name: string;
  customer_phone: string;
}

type DeviceWithWarranty = Device & {
  device_models?: DeviceModel | null;
  warranties?: {
    id: string;
    store_id: string;
    customer_name: string;
    customer_phone: string;
    activation_date: string;
    expiry_date: string;
    is_active: boolean;
  }[] | null;
};

type ReplacementRequestWithDevice = ReplacementRequest & {
  device?: DeviceWithWarranty | null;
};

export default function StoreDashboard() {
  // Hooks for user and stats with Realtime
  const { user: currentUser, isLoading: isUserLoading } = useCurrentUser();
  const storeId = currentUser?.id || null;
  const storeName = currentUser?.full_name || currentUser?.email || '';
  const { stats, isLoading: isStatsLoading, isFetching: isStatsFetching } = useStoreDashboardStats(storeId);

  // Local state for interactive features
  const [searchImei, setSearchImei] = useState('');
  const [searchResult, setSearchResult] = useState<DeviceWithWarranty | null>(null);
  const [isActivationDialogOpen, setIsActivationDialogOpen] = useState(false);
  const [isReplacementDialogOpen, setIsReplacementDialogOpen] = useState(false);
  const [activeDevices, setActiveDevices] = useState<DeviceWithWarranty[]>([]);
  const [replacementRequests, setReplacementRequests] = useState<ReplacementRequestWithDevice[]>([]);
  const [activeTab, setActiveTab] = useState('search');
  const activationDateDisplay = formatDate(new Date());

  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<WarrantyFormData>();

  const hasExistingWarranty = Boolean(searchResult?.warranties && searchResult.warranties.length > 0);
  const currentWarranty = hasExistingWarranty ? searchResult!.warranties![0]! : null;

  const fetchActiveDevices = useCallback(async () => {
    if (!storeId) return;

    try {
      // Fetch devices with active warranties for this store
      const { data, error } = await supabase
        .from('devices')
        .select(`
          *,
          device_models(*),
          warranties!inner(
            id,
            store_id,
            customer_name,
            customer_phone,
            activation_date,
            expiry_date,
            is_active
          )
        `)
        .eq('warranties.store_id', storeId)
        .eq('warranties.is_active', true)
        .gte('warranties.expiry_date', new Date().toISOString().split('T')[0]);

      if (error) {
        console.error('Error fetching active devices:', error);
        return;
      }

      setActiveDevices(data || []);
    } catch (error) {
      console.error('Error fetching active devices:', error);
    }
  }, [storeId, supabase]);

  const fetchReplacementRequests = useCallback(async () => {
    if (!storeId) return;

    try {
      const { data: warranties } = await supabase
        .from('warranties')
        .select('device_id')
        .eq('store_id', storeId)
        .returns<Array<Pick<Warranty, 'device_id'>>>();

      const deviceIds = (warranties || []).map(w => w.device_id).filter(Boolean) as string[];

      if (deviceIds.length === 0) {
        setReplacementRequests([]);
        return;
      }

      const { data } = await supabase
        .from('replacement_requests')
        .select(`
          *,
          device:devices(*, device_models(*), warranties(*))
        `)
        .in('device_id', deviceIds)
        .order('created_at', { ascending: false });

      setReplacementRequests(data || []);
    } catch (error) {
      console.error('Error fetching replacement requests:', error);
    }
  }, [storeId, supabase]);

  // Fetch lists on mount and setup Realtime subscriptions
  useEffect(() => {
    if (!storeId) return;

    fetchActiveDevices();
    fetchReplacementRequests();

    // Realtime subscriptions for interactive lists
    const devicesChannel = supabase
      .channel(`store-devices-${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
        },
        () => fetchActiveDevices()
      )
      .subscribe();

    const warrantiesChannel = supabase
      .channel(`store-warranties-${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'warranties',
          filter: `store_id=eq.${storeId}`,
        },
        () => {
          fetchActiveDevices();
          fetchReplacementRequests();
        }
      )
      .subscribe();

    const replacementsChannel = supabase
      .channel(`store-replacements-${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'replacement_requests',
        },
        () => fetchReplacementRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(devicesChannel);
      supabase.removeChannel(warrantiesChannel);
      supabase.removeChannel(replacementsChannel);
    };
  }, [storeId, fetchActiveDevices, fetchReplacementRequests, supabase]);

  const handleSearch = async () => {
    const trimmedIMEI = searchImei.trim().replace(/[\s-]/g, '');
    if (!trimmedIMEI) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין מספר IMEI',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('Searching for IMEI:', trimmedIMEI);

      // Use the search_device_by_imei function with 50 searches limit
      const { data: searchResult, error: searchError } = await (supabase as any)
        .rpc('search_device_by_imei', {
          p_imei: trimmedIMEI,
          p_user_ip: null
        });

      console.log('Search result:', { searchResult, error: searchError });

      if (searchError) {
        console.error('Search error:', searchError);
        toast({
          title: 'שגיאה',
          description: `אירעה שגיאה בחיפוש המכשיר: ${searchError.message}`,
          variant: 'destructive',
        });
        return;
      }

      if (!searchResult || searchResult.length === 0) {
        toast({
          title: 'שגיאה',
          description: 'לא התקבלה תשובה מהשרת',
          variant: 'destructive',
        });
        return;
      }

      const result = searchResult[0];

      // Check if search limit reached
      if (result.search_limit_reached) {
        toast({
          title: 'הגעת למגבלת החיפושים',
          description: 'הגעת למגבלה של 50 חיפושים ליום',
          variant: 'destructive',
        });
        return;
      }

      // Show searches count for stores
      if (result.searches_today !== undefined) {
        console.log(`Searches today: ${result.searches_today}/50`);
      }

      // Check if device was found
      if (!result.device_id) {
        toast({
          title: 'לא נמצא',
          description: `המכשיר עם IMEI ${trimmedIMEI} לא נמצא במערכת`,
          variant: 'destructive',
        });
        return;
      }

      // Convert the result to the expected format
      const device: DeviceWithWarranty = {
        id: result.device_id,
        imei: result.imei,
        imei2: result.imei2 || null,
        model_id: result.model_id, // Corrected: Use model_id from result
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: null,
        is_replaced: result.is_replaced || false,
        replaced_at: result.replaced_at || null,
        imported_by: null,
        import_batch: null,
        device_models: {
          id: result.model_id, // Corrected: Use model_id
          model_name: result.model_name || 'לא ידוע',
          manufacturer: result.manufacturer || null,
          warranty_months: result.warranty_months || 12,
          description: null,
          is_active: true,
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        // Include warranty info if exists
        warranties: result.warranty_id ? [{
          id: result.warranty_id,
          store_id: result.store_id,
          customer_name: result.customer_name || '',
          customer_phone: result.customer_phone || '',
          activation_date: new Date().toISOString().split('T')[0],
          expiry_date: result.warranty_expiry_date || new Date().toISOString().split('T')[0],
          is_active: result.has_active_warranty || false
        }] : []
      };

      console.log('Found device:', device);
      setSearchResult(device);

      // Check warranty and replacement status from the search result
      if (result.is_replaced) {
        toast({
          title: 'מכשיר הוחלף',
          description: `מכשיר זה הוחלף${result.replaced_at ? ' בתאריך ' + formatDate(result.replaced_at) : ''} ולא ניתן להפעיל עליו אחריות`,
          variant: 'destructive',
        });
      } else if (result.has_active_warranty && result.warranty_id) {
        const activationInfo = result.warranty_expiry_date
          ? ` (תוקף עד ${formatDate(result.warranty_expiry_date)})`
          : '';
        toast({
          title: 'אחריות קיימת',
          description: `למכשיר זה כבר קיימת אחריות פעילה${activationInfo}`,
        });
      }
    } catch (error) {
      console.error('Error searching device:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בחיפוש המכשיר',
        variant: 'destructive',
      });
    }
  };

  const onSubmitWarranty = async (data: WarrantyFormData) => {
    if (!searchResult) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('משתמש לא מחובר');

      const device = searchResult;

      const { data: activationResult, error: activationError } = (await supabase
        .rpc('activate_warranty', {
          p_device_id: device.id,
          p_customer_name: data.customer_name,
          p_customer_phone: data.customer_phone,
          p_notes: null,
        } as any)) as {
          data: { success: boolean; message: string; warranty_id: string | null; expiry_date: string | null }[] | null;
          error: any
        };

      if (activationError) throw activationError;

      if (!activationResult?.[0]?.success) {
        throw new Error(activationResult?.[0]?.message || 'שגיאה בהפעלת אחריות');
      }

      // --- Audit Log ---
      const warrantyId = activationResult[0].warranty_id;
      if (warrantyId) {
        supabase.from('audit_log').insert({
          actor_user_id: user.id,
          action: 'warranty.activate',
          entity_type: 'warranty',
          entity_id: warrantyId,
          meta: {
            device_id: device.id,
            customer_name: data.customer_name,
            store_id: user.id
          }
        }).then(({ error: logError }) => {
          if (logError) console.error('Audit log failed:', logError);
        });
      }
      // --- End Audit Log ---

      toast({
        title: 'הצלחה',
        description: `האחריות הופעלה בהצלחה עבור ${data.customer_name}`,
      });

      // Reset form and close dialog
      setIsActivationDialogOpen(false);
      reset();
      setSearchImei('');
      setSearchResult(null);

      // Refresh lists (stats refresh automatically via React Query + Realtime)
      fetchActiveDevices();
      fetchReplacementRequests();

    } catch (error: any) {
      console.error('Error activating warranty:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בהפעלת האחריות',
        variant: 'destructive',
      });
    }
  };

  const handleRequestReplacement = async (deviceId: string, warrantyId: string | null, reason: string) => {
    try {
      const { data, error } = await supabase.rpc('create_replacement_request', {
        p_device_id: deviceId,
        p_reason: reason
      });

      if (error) throw new Error(error.message);

      const result = data?.[0];
      if (!result?.success) {
        throw new Error(result?.message || 'An unknown error occurred.');
      }

      toast({
        title: 'הצלחה',
        description: 'בקשת ההחלפה נשלחה בהצלחה',
      });

      setIsReplacementDialogOpen(false);
      setSearchResult(null);
      setSearchImei('');

      // Refresh lists (stats refresh automatically via React Query + Realtime)
      fetchActiveDevices();
      fetchReplacementRequests();

    } catch (error: any) {
      console.error('Error requesting replacement:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בהגשת בקשת ההחלפה',
        variant: 'destructive',
      });
    }
  };

  const getWarrantyStatus = (warranty: Warranty) => {
    const now = new Date();
    const expiryDate = new Date(warranty.expiry_date);

    if (!warranty.is_active) {
      return { text: 'לא פעילה', variant: 'secondary' as const };
    }

    if (expiryDate < now) {
      return { text: 'פגה תוקף', variant: 'destructive' as const };
    }

    const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 30) {
      return { text: `${daysLeft} ימים נותרו`, variant: 'outline' as const };
    }

    return { text: 'פעילה', variant: 'default' as const };
  };

  const getReplacementStatus = (status: string) => {
    switch (status) {
      case 'pending':
        return { text: 'ממתין', variant: 'outline' as const, icon: Clock };
      case 'approved':
        return { text: 'אושר', variant: 'default' as const, icon: CheckCircle };
      case 'rejected':
        return { text: 'נדחה', variant: 'destructive' as const, icon: AlertCircle };
      case 'completed':
        return { text: 'הושלם', variant: 'secondary' as const, icon: CheckCircle };
      default:
        return { text: status, variant: 'outline' as const, icon: Clock };
    }
  };

  return (
    <div className="space-y-6">
      {/* Background refresh indicator */}
      <BackgroundRefreshIndicator
        isFetching={isStatsFetching}
        isLoading={isUserLoading || isStatsLoading}
      />

      {/* === שורות שהשתנו === */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">ניהול מכשירים ואחריות</h2>
          <p className="text-muted-foreground">
            תצוגה מרכזית של כל המכשירים, אחריות ובקשות החלפה
          </p>
        </div>
        <Button onClick={() => {
          setSearchResult(null); // נקה חיפוש קודם
          setSearchImei('');    // נקה שדה IMEI
          reset();              // אפס את הטופס
          setIsActivationDialogOpen(true);
        }}>
          <Shield className="me-2 h-4 w-4" />
          הפעל אחריות חדשה
        </Button>
      </div>
      {/* === סוף שורות שהשתנו === */}


      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-green-500 cursor-pointer" onClick={() => setActiveTab('active-warranties')}>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-sm font-medium">אחריות פעילות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 text-right">{stats.activeWarranties}</div>
            <p className="text-xs text-muted-foreground mt-1 text-right">מכשירים מוגנים</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-orange-500 cursor-pointer" onClick={() => setActiveTab('replacements')}>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <CardTitle className="text-sm font-medium">בקשות החלפה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600 text-right">{stats.pendingReplacements}</div>
            <p className="text-xs text-muted-foreground mt-1 text-right">ממתינות לטיפול</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-blue-500 cursor-pointer" onClick={() => router.push('/store/reports')}>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-sm font-medium">הפעלות החודש</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600 text-right">{stats.monthlyActivations}</div>
            <p className="text-xs text-muted-foreground mt-1 text-right">אחריות חדשות</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-purple-500 cursor-pointer" onClick={() => router.push('/store/devices')}>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <CardTitle className="text-sm font-medium">סה"כ מכשירים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600 text-right">{stats.totalDevices}</div>
            <p className="text-xs text-muted-foreground mt-1 text-right">במערכת</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3" dir="rtl">
          <TabsTrigger value="search" className="flex items-center justify-center gap-2">
            <Search className="h-4 w-4" />
            חיפוש מכשיר
          </TabsTrigger>
          <TabsTrigger value="replacements" className="flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4" />
            בקשות החלפה
          </TabsTrigger>
          <TabsTrigger value="active-warranties" className="flex items-center justify-center gap-2">
            <Shield className="h-4 w-4" />
            מכשירים עם אחריות
          </TabsTrigger>
        </TabsList>

{/* Active Warranties Tab */}
<TabsContent value="active-warranties" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>מכשירים עם אחריות פעילה</CardTitle>
              <CardDescription>
                כל המכשירים שהופעלה עליהם אחריות בחנות שלך
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeDevices.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>אין מכשירים עם אחריות פעילה</p>
                </div>
              ) : (
                // === קוד הטבלה שהשתנה ===
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>דגם</TableHead>
                      <TableHead>IMEI</TableHead>
                      <TableHead>לקוח</TableHead>
                      <TableHead>טלפון</TableHead>
                      <TableHead>תאריך הפעלה</TableHead>
                      <TableHead>תוקף</TableHead>
                      <TableHead>סטטוס</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeDevices.map((device) => {
                      const warranties = device.warranties as any;
                      const warranty = warranties?.[0];
                      if (!warranty) return null;
                      const status = getWarrantyStatus(warranty);

                      return (
                        <TableRow key={device.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              {device.device_models?.model_name || 'לא ידוע'}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{device.imei}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {warranty.customer_name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              {warranty.customer_phone}
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(warranty.activation_date)}</TableCell>
                          <TableCell>{formatDate(warranty.expiry_date)}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>
                              {status.text}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Replacement Requests Tab */}
        <TabsContent value="replacements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>בקשות החלפה</CardTitle>
              <CardDescription>
                כל בקשות ההחלפה שהוגשו למכשירים שלך
              </CardDescription>
            </CardHeader>
            <CardContent>
              {replacementRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>אין בקשות החלפה</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>דגם</TableHead>
                      <TableHead>IMEI</TableHead>
                      <TableHead>סיבה</TableHead>
                      <TableHead>תאריך בקשה</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>הערות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {replacementRequests.map((request) => {
                      const status = getReplacementStatus(request.status);
                      const StatusIcon = status.icon;

                      return (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              {request.device?.device_models?.model_name || 'לא ידוע'}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{request.device?.imei}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              {request.reason}
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(request.created_at)}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant} className="flex items-center gap-1 w-fit">
                              <StatusIcon className="h-3 w-3" />
                              {status.text}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {request.admin_notes || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>חיפוש מכשיר לפי IMEI</CardTitle>
              <CardDescription>
                חפש מכשיר כדי להפעיל אחריות או להגיש בקשת החלפה
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2" dir="rtl">
                <Input
                  placeholder="הזן מספר IMEI..."
                  value={searchImei}
                  onChange={(e) => setSearchImei(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1"
                  dir="rtl"
                />
                <Button onClick={handleSearch} size="lg">
                  <Search className="me-2 h-4 w-4" />
                  חפש
                </Button>
              </div>

              {/* Search Result */}
              {searchResult && (
                <Card className={`border-2 ${searchResult.is_replaced ? 'border-destructive' : 'border-primary'}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">תוצאות חיפוש</CardTitle>
                      {searchResult.is_replaced ? (
                        <Badge variant="destructive" className="text-sm">
                          מכשיר הוחלף
                        </Badge>
                      ) : (
                        <Badge variant={hasExistingWarranty ? 'default' : 'secondary'} className="text-sm">
                          {hasExistingWarranty ? 'אחריות פעילה' : 'ללא אחריות'}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {searchResult.is_replaced && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          מכשיר זה הוחלף ולא ניתן להפעיל עליו אחריות או להגיש בקשת החלפה.
                          {searchResult.replaced_at && (
                            <> תאריך החלפה: {formatDate(searchResult.replaced_at)}</>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">דגם</Label>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{searchResult.device_models?.model_name || 'לא ידוע'}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">IMEI</Label>
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm">{searchResult.imei}</span>
                        </div>
                      </div>
                      {searchResult.imei2 && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">IMEI 2</Label>
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono text-sm">{searchResult.imei2}</span>
                          </div>
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">תקופת אחריות</Label>
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <span>{searchResult.device_models?.warranty_months || 12} חודשים</span>
                        </div>
                      </div>
                    </div>

                    {currentWarranty && (
                      <div className="border-t pt-4 space-y-3">
                        <h4 className="font-semibold flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          פרטי אחריות
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <Label className="text-xs text-muted-foreground">לקוח</Label>
                            <p className="font-medium">{currentWarranty.customer_name}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">טלפון</Label>
                            <p className="font-medium">{currentWarranty.customer_phone}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">תאריך הפעלה</Label>
                            <p>{formatDate(currentWarranty.activation_date)}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">תוקף עד</Label>
                            <p>{formatDate(currentWarranty.expiry_date)}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {!searchResult.is_replaced && (
                      <div className="flex gap-2 pt-2">
                        {!hasExistingWarranty && (
                          <Button onClick={() => setIsActivationDialogOpen(true)} className="flex-1">
                            <Shield className="me-2 h-4 w-4" />
                            הפעל אחריות
                          </Button>
                        )}
                        {hasExistingWarranty && (
                          <Button onClick={() => setIsReplacementDialogOpen(true)} variant="outline" className="flex-1">
                            <RefreshCw className="me-2 h-4 w-4" />
                            הגש בקשת החלפה
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* === דיאלוג הפעלה - קוד מעודכן === */}
      <Dialog open={isActivationDialogOpen} onOpenChange={(isOpen) => {
        setIsActivationDialogOpen(isOpen);
        if (!isOpen) {
          // אפס את המצב כשהדיאלוג נסגר
          setSearchResult(null);
          setSearchImei('');
          reset();
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>הפעלת אחריות</DialogTitle>
            <DialogDescription>
              {searchResult ? 'הזן את פרטי הלקוח להפעלת האחריות' : 'הזן מספר IMEI לחיפוש והפעלת אחריות'}
            </DialogDescription>
          </DialogHeader>

          {/* === התניה חדשה: הצג חיפוש או טופס === */}
          {!searchResult ? (
            // שלב 1: ממשק חיפוש
            <div className="space-y-4 pt-2">
              <div className="flex gap-2" dir="rtl">
                <Input
                  placeholder="הזן מספר IMEI..."
                  value={searchImei}
                  onChange={(e) => setSearchImei(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1"
                  dir="rtl"
                  id="imei-dialog-search"
                />
                <Button onClick={handleSearch}>
                  <Search className="me-2 h-4 w-4" />
                  חפש
                </Button>
              </div>
            </div>
          ) : (
            // שלב 2: טופס הפעלה
            <form onSubmit={handleSubmit(onSubmitWarranty)} className="space-y-4">
              {/* שדות תצוגה */}
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">תאריך הפעלה:</Label>
                  <span className="text-sm">{activationDateDisplay}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">מפעיל האחריות:</Label>
                  <span className="text-sm font-medium">{storeName || 'החנות שלך'}</span>
                </div>

                {searchResult && (
                  <>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">דגם:</Label>
                      <span className="text-sm">{searchResult.device_models?.model_name || 'לא ידוע'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">IMEI:</Label>
                      <span className="text-sm font-mono">{searchResult.imei}</span>
                    </div>
                    {searchResult.imei2 && (
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">IMEI 2:</Label>
                        <span className="text-sm font-mono">{searchResult.imei2}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">תקופת אחריות:</Label>
                      <span className="text-sm">{searchResult.device_models?.warranty_months || 12} חודשים</span>
                    </div>
                  </>
                )}
              </div>
              
              {/* הצג התראות אם יש צורך */}
              {searchResult.is_replaced && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    מכשיר זה הוחלף ולא ניתן להפעיל עליו אחריות.
                  </AlertDescription>
                </Alert>
              )}
              {hasExistingWarranty && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    למכשיר זה כבר קיימת אחריות פעילה.
                  </AlertDescription>
                </Alert>
              )}

              {/* שדות לעריכה */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="customer_name">שם הלקוח *</Label>
                  <Input
                    id="customer_name"
                    {...register('customer_name', { required: 'שם הלקוח הוא שדה חובה' })}
                    placeholder="ישראל ישראלי"
                  />
                  {errors.customer_name && (
                    <p className="text-sm text-red-500 mt-1">{errors.customer_name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="customer_phone">טלפון הלקוח *</Label>
                  <Input
                    id="customer_phone"
                    {...register('customer_phone', {
                      required: 'טלפון הלקוח הוא שדה חובה',
                      pattern: {
                        value: /^[0-9]{9,10}$/,
                        message: 'מספר טלפון לא תקין'
                      }
                    })}
                    placeholder="050-1234567"
                  />
                  {errors.customer_phone && (
                    <p className="text-sm text-red-500 mt-1">{errors.customer_phone.message}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-start pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsActivationDialogOpen(false)}
                >
                  ביטול
                </Button>
                <Button type="submit" disabled={hasExistingWarranty || searchResult.is_replaced}>
                  {hasExistingWarranty ? 'אחריות כבר קיימת' :
                   searchResult.is_replaced ? 'מכשיר הוחלף' :
                   'הפעל אחריות'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      {/* === סוף דיאלוג הפעלה === */}


      {/* Replacement Request Dialog */}
      <Dialog open={isReplacementDialogOpen} onOpenChange={setIsReplacementDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>הגשת בקשת החלפה</DialogTitle>
            <DialogDescription>
              הזן את הסיבה להחלפת המכשיר
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const reason = (formData.get('reason') as string || '').trim();
            
            if (!reason) {
              toast({
                title: 'שגיאה',
                description: 'יש להזין סיבה להחלפה',
                variant: 'destructive',
              });
              return;
            }
            
            if (reason.length < 5) {
              toast({
                title: 'שגיאה',
                description: 'הסיבה חייבת להכיל לפחות 5 תווים',
                variant: 'destructive',
              });
              return;
            }
            
            if (searchResult) {
              const warrantyId = searchResult.warranties?.[0]?.id || null;
              handleRequestReplacement(searchResult.id, warrantyId, reason);
            }
          }} className="space-y-4">
            {searchResult && (
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">דגם:</Label>
                  <span className="text-sm">{searchResult.device_models?.model_name || 'לא ידוע'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">IMEI:</Label>
                  <span className="text-sm font-mono">{searchResult.imei}</span>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="reason">סיבת ההחלפה * (לפחות 5 תווים)</Label>
              <Input
                id="reason"
                name="reason"
                required
                minLength={5}
                placeholder="לדוגמה: מסך שבור, בעיית סוללה..."
              />
            </div>

            <div className="flex gap-3 justify-start pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsReplacementDialogOpen(false)}
              >
                ביטול
              </Button>
              <Button type="submit">
                <RefreshCw className="me-2 h-4 w-4" />
                הגש בקשה
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}