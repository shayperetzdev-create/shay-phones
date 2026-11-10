'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useStoreReplacementRequests } from '@/hooks/queries/useReplacements';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';
import { ReplacementsPageSkeleton } from '@/components/ui/loading-skeletons';
import type { User as UserType, Device, DeviceModel, Warranty, Repair, ReplacementRequest, FaultType } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import {
  RefreshCw,
  Plus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Package,
  Calendar,
  User as UserIcon,
  Phone,
  FileText,
  MessageSquare
} from 'lucide-react';
import { formatDate, formatDateTime, validateIMEI } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const replacementRequestSchema = z.object({
  imei: z.string().refine(validateIMEI, 'מספר IMEI לא תקין'),
  customer_name: z.string(), // Read-only field, no validation needed
  customer_phone: z.string(), // Read-only field, no validation needed
  reason: z.string().min(10, 'יש לפרט את הסיבה (לפחות 10 תווים)'),
});

type ReplacementRequestData = z.infer<typeof replacementRequestSchema>;

type ReplacementRequestRow = ReplacementRequest & {
  device: (Device & {
    device_model?: { model_name: string } | null;
    warranty?: Warranty[];
  }) | null;
  repair: {
    fault_type: FaultType | null;
    fault_description: string | null;
    lab?: Pick<UserType, 'full_name' | 'email'> | null;
  } | null;
  resolver: Pick<UserType, 'full_name'> | null;
};

type DeviceSearchResult = Device & {
  device_models?: DeviceModel | null;
  warranty: Warranty[];
  repairs: Repair[];
};

export default function StoreReplacementsPage() {
  // React Query hooks with Realtime
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const storeId = user?.id || null;
  const { requests, isLoading: isRequestsLoading, isFetching } = useStoreReplacementRequests(storeId);

  const isLoading = isUserLoading || isRequestsLoading;

  // Local state for filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedRequest, setSelectedRequest] = useState<ReplacementRequestRow | null>(null);
  const [isNewRequestDialogOpen, setIsNewRequestDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [searchIMEI, setSearchIMEI] = useState('');
  const [searchedDevice, setSearchedDevice] = useState<DeviceSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const supabase = createClient();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ReplacementRequestData>({
    resolver: zodResolver(replacementRequestSchema),
  });

  // --- [תיקון 2: החלפת useState + useEffect ב-useMemo] ---

  // חישוב הרשימה המסוננת
  const filteredRequests = useMemo(() => {
    let filtered = [...requests];

    if (searchQuery) {
      filtered = filtered.filter(request =>
        request.device?.imei?.includes(searchQuery) ||
        request.device?.imei2?.includes(searchQuery) ||
        request.device?.device_model?.model_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.customer_phone?.includes(searchQuery) ||
        request.device?.warranty?.[0]?.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.device?.warranty?.[0]?.customer_phone?.includes(searchQuery)
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(request => request.status === filterStatus);
    }

    return filtered;
  }, [requests, searchQuery, filterStatus]);

  // חישוב הסטטיסטיקות
  const stats = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
    };
  }, [requests]);

  // --- [סוף תיקון 2] ---
  
  const handleSearchDevice = async () => {
    const trimmedIMEI = searchIMEI.trim().replace(/[\s-]/g, '');
    if (!trimmedIMEI) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין מספר IMEI',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('משתמש לא מחובר');

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single<UserType>();

      // Search for device with warranty
      const { data: devices, error } = await supabase
        .from('devices')
        .select(`
          *,
          device_models(*),
          warranty:warranties!inner(
            *,
            store_id
          ),
          repairs(
            id,
            status,
            fault_type,
            lab_id
          )
        `)
        .or(`imei.eq.${trimmedIMEI},imei2.eq.${trimmedIMEI}`)
        .eq('warranty.store_id', userData?.id || '')
        .returns<DeviceSearchResult[]>();

      if (error) {
        console.error('Search error:', error);
        setSearchedDevice(null);
        toast({
          title: 'שגיאה',
          description: 'אירעה שגיאה בחיפוש המכשיר',
          variant: 'destructive',
        });
        return;
      }

      if (!devices || devices.length === 0) {
        setSearchedDevice(null);
        toast({
          title: 'לא נמצא',
          description: 'מכשיר זה לא נמצא או לא שייך לחנות שלך',
          variant: 'destructive',
        });
      } else {
        const device = devices[0];
        setSearchedDevice(device);
        setValue('imei', trimmedIMEI);
        setValue('customer_name', device.warranty[0]?.customer_name || '');
        setValue('customer_phone', device.warranty[0]?.customer_phone || '');
      }
    } catch (error) {
      console.error('Error searching device:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בחיפוש',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const onSubmit = async (data: ReplacementRequestData) => {
    if (!searchedDevice) {
      toast({
        title: 'שגיאה',
        description: 'יש לחפש מכשיר תחילה',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('משתמש לא מחובר');

      // Check if there's already a pending request for this device
      const { data: existingRequest } = await supabase
        .from('replacement_requests')
        .select('id')
        .eq('device_id', searchedDevice.id)
        .eq('status', 'pending')
        .single();

      if (existingRequest) {
        toast({
          title: 'שגיאה',
          description: 'כבר קיימת בקשת החלפה ממתינה למכשיר זה',
          variant: 'destructive',
        });
        return;
      }

      // Create replacement request
      const normalizedPhone = data.customer_phone.replace(/\D/g, '');

      const payload: Partial<ReplacementRequest> = {
        device_id: searchedDevice.id,
        warranty_id: searchedDevice.warranty?.[0]?.id || null,
        repair_id: searchedDevice.repairs?.[0]?.id || null,
        requester_id: user.id,
        customer_name: data.customer_name,
        customer_phone: normalizedPhone,
        reason: data.reason,
        status: 'pending',
      };

      const { error } = await (supabase.from('replacement_requests') as any)
        .insert([payload]);

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: 'בקשת ההחלפה נשלחה בהצלחה',
      });

      setIsNewRequestDialogOpen(false);
      reset();
      setSearchedDevice(null);
      setSearchIMEI('');
      // React Query + Realtime will auto-refresh
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לשלוח את הבקשה',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { icon: Clock, label: 'ממתין', variant: 'outline' as const },
      approved: { icon: CheckCircle, label: 'אושר', variant: 'default' as const },
      rejected: { icon: XCircle, label: 'נדחה', variant: 'destructive' as const },
    };

    const variant = variants[status as keyof typeof variants] || variants.pending;
    const Icon = variant.icon;

    return (
      <Badge variant={variant.variant}>
        <Icon className="ms-1 h-3 w-3" />
        {variant.label}
      </Badge>
    );
  };

  if (isLoading) {
    return <ReplacementsPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Background refresh indicator */}
      <BackgroundRefreshIndicator
        isFetching={isFetching}
        isLoading={isLoading}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">בקשות החלפה</h1>
        <Button onClick={() => setIsNewRequestDialogOpen(true)}>
          בקשה חדשה
          <Plus className="ms-2 h-4 w-4" />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-blue-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-sm font-medium">סה"כ בקשות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 text-right">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-orange-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <CardTitle className="text-sm font-medium">ממתינות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 text-right">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-green-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-sm font-medium">אושרו</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 text-right">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-red-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-sm font-medium">נדחו</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 text-right">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {stats.pending > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>יש {stats.pending} בקשות ממתינות</AlertTitle>
          <AlertDescription>
            הבקשות נמצאות בטיפול וייענו בהקדם האפשרי
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>סינון בקשות</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="חיפוש לפי IMEI, דגם, לקוח..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-10"
            />
          </div>

          <select
            title="בחר סטטוס"
            className="px-3 py-2 border rounded-md text-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'pending' | 'approved' | 'rejected')}
          >
            <option value="all">כל הסטטוסים</option>
            <option value="pending">ממתין</option>
            <option value="approved">אושר</option>
            <option value="rejected">נדחה</option>
          </select>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>מכשיר</TableHead>
                <TableHead>לקוח</TableHead>
                <TableHead>תאריך בקשה</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{request.device?.device_model?.model_name || 'לא ידוע'}</div>
                      <div className="text-sm text-muted-foreground">
                        IMEI: {request.device?.imei || request.device?.imei2}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <UserIcon className="h-3 w-3" />
                        {request.customer_name || request.device?.warranty?.[0]?.customer_name}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {request.customer_phone || request.device?.warranty?.[0]?.customer_phone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(request.created_at)}</TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedRequest(request);
                        setIsDetailsDialogOpen(true);
                      }}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredRequests.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              לא נמצאו בקשות
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Request Dialog */}
      <Dialog open={isNewRequestDialogOpen} onOpenChange={setIsNewRequestDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>בקשת החלפה חדשה</DialogTitle>
            <DialogDescription>
              חפש מכשיר והגש בקשת החלפה
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Device Search */}
            <div className="space-y-4">
              <Label>חיפוש מכשיר</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="הזן מספר IMEI"
                  value={searchIMEI}
                  onChange={(e) => setSearchIMEI(e.target.value)}
                  maxLength={15}
                />
                <Button
                  type="button"
                  onClick={handleSearchDevice}
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <Clock className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  חפש
                </Button>
              </div>
            </div>

            {/* Device Info */}
            {searchedDevice && (
              <>
                <Alert>
                  <Package className="h-4 w-4" />
                  <AlertTitle>נמצא מכשיר</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-1">
                      <div>דגם: {searchedDevice.device_models?.model_name || 'לא ידוע'}</div>
                      <div>IMEI: {searchedDevice.imei}</div>
                      {searchedDevice.imei2 && <div>IMEI 2: {searchedDevice.imei2}</div>}
                      <div>אחריות עד: {formatDate(searchedDevice.warranty[0]?.expiry_date)}</div>
                    </div>
                  </AlertDescription>
                </Alert>

                {/* Request Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <input type="hidden" {...register('imei')} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="customer_name">שם הלקוח</Label>
                      <Input
                        {...register('customer_name')}
                        placeholder="שם הלקוח"
                        readOnly
                        disabled
                        className="bg-muted cursor-not-allowed"
                      />
                      {errors.customer_name && (
                        <p className="text-sm text-red-500">{errors.customer_name.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customer_phone">טלפון</Label>
                      <Input
                        {...register('customer_phone')}
                        placeholder="0501234567"
                        readOnly
                        disabled
                        className="bg-muted cursor-not-allowed"
                      />
                      {errors.customer_phone && (
                        <p className="text-sm text-red-500">{errors.customer_phone.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">סיבת הבקשה</Label>
                    <Textarea
                      {...register('reason')}
                      placeholder="פרט את הסיבה לבקשת ההחלפה..."
                      rows={4}
                    />
                    {errors.reason && (
                      <p className="text-sm text-red-500">{errors.reason.message}</p>
                    )}
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsNewRequestDialogOpen(false)}>
                      ביטול
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Clock className="ms-2 h-4 w-4 animate-spin" />
                          שולח...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="ms-2 h-4 w-4" />
                          שלח בקשה
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Request Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>פרטי בקשת החלפה</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <Label className="text-muted-foreground">מכשיר</Label>
                  <div className="font-medium space-y-1">
                    <div>{selectedRequest.device?.device_model?.model_name || 'לא ידוע'}</div>
                    <div className="text-sm text-muted-foreground font-mono">
                      IMEI: {selectedRequest.device?.imei}
                      {selectedRequest.device?.imei2 && ` | IMEI 2: ${selectedRequest.device?.imei2}`}
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">לקוח</Label>
                  <p className="font-medium">
                    {(selectedRequest.customer_name || selectedRequest.device?.warranty?.[0]?.customer_name) ?? 'לא זמין'}
                    <span className="mx-1">-</span>
                    {(selectedRequest.customer_phone || selectedRequest.device?.warranty?.[0]?.customer_phone) ?? 'לא זמין'}
                  </p>
                </div>

                <div>
                  <Label className="text-muted-foreground">תאריך הגשה</Label>
                  <p className="font-medium">{formatDateTime(selectedRequest.created_at)}</p>
                </div>

                <div>
                  <Label className="text-muted-foreground">סטטוס</Label>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>

                <div>
                  <Label className="text-muted-foreground">סיבת הבקשה</Label>
                  <p className="font-medium">{selectedRequest.reason}</p>
                </div>

                {selectedRequest.admin_notes && (
                  <div>
                    <Label className="text-muted-foreground">הערות מנהל</Label>
                    <Alert>
                      <MessageSquare className="h-4 w-4" />
                      <AlertDescription>{selectedRequest.admin_notes}</AlertDescription>
                    </Alert>
                  </div>
                )}

                {selectedRequest.resolved_at && (
                  <div>
                    <Label className="text-muted-foreground">טופל בתאריך</Label>
                    <p className="font-medium">
                      {formatDateTime(selectedRequest.resolved_at)}
                      {selectedRequest.resolver && ` ע"י ${selectedRequest.resolver.full_name}`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsDetailsDialogOpen(false)}>
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}