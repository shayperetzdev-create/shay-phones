'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAllWarranties } from '@/hooks/queries/useWarranties';
import { useDevicesWithoutWarranty } from '@/hooks/queries/useDevices';
import { useAllUsers } from '@/hooks/queries/useUsers';
import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Search,
  Plus,
  Phone,
  User,
  Store,
  XCircle
} from 'lucide-react';
import { formatDate, validateIMEI, validateIsraeliPhone } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const warrantySchema = z.object({
  imei: z.string().refine(validateIMEI, 'מספר IMEI לא תקין'),
  customer_name: z.string().min(2, 'שם הלקוח חייב להכיל לפחות 2 תווים'),
  customer_phone: z.string().refine(validateIsraeliPhone, 'מספר טלפון לא תקין'),
  store_id: z.string().optional(),
});

type WarrantyFormData = z.infer<typeof warrantySchema>;

export default function WarrantiesPage() {
  // React Query hooks with Realtime
  const { warranties, isLoading: isWarrantiesLoading, isFetching: isWarrantiesFetching } = useAllWarranties();
  const { devices, isLoading: isDevicesLoading, isFetching: isDevicesFetching } = useDevicesWithoutWarranty();
  const { users: allUsers, isLoading: isUsersLoading, isFetching: isUsersFetching } = useAllUsers();
  const stores = useMemo(() => allUsers.filter(u => u.role === 'store'), [allUsers]);

  const isLoading = isWarrantiesLoading || isDevicesLoading || isUsersLoading;
  const isFetching = isWarrantiesFetching || isDevicesFetching || isUsersFetching;

  // Local state for filtering/pagination
  const [filteredWarranties, setFilteredWarranties] = useState<any[]>([]);
  const [paginatedWarranties, setPaginatedWarranties] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isActivationDialogOpen, setIsActivationDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  const supabase = createClient();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<WarrantyFormData>({
    resolver: zodResolver(warrantySchema),
  });

  const getUserDisplayName = useCallback((user?: { full_name?: string | null; email?: string | null } | null) => {
    if (!user) return '';
    return user.full_name?.trim() || user.email || '';
  }, []);

  const getStatusBadge = (warranty: any) => {
    const expiryDate = new Date(warranty.expiry_date);
    const now = new Date();

    if (!warranty.is_active) {
      return <Badge className="bg-gray-500">בוטל</Badge>;
    }
    if (expiryDate < now) {
      return <Badge className="bg-red-500">פג תוקף</Badge>;
    }
    return <Badge className="bg-green-500">פעיל</Badge>;
  };

  const filterWarranties = useCallback(() => {
    let filtered = warranties;

    // Filter by status
    if (filterStatus !== 'all') {
      const now = new Date();
      filtered = filtered.filter(w => {
        const expiryDate = new Date(w.expiry_date);
        if (filterStatus === 'active') {
          return expiryDate >= now && w.is_active;
        } else {
          return expiryDate < now || !w.is_active;
        }
      });
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (warranty) =>
          warranty.device?.imei?.toLowerCase().includes(query) ||
          warranty.device?.device_models?.model_name?.toLowerCase().includes(query) ||
          warranty.customer_name?.toLowerCase().includes(query) ||
          warranty.customer_phone?.includes(query) ||
          getUserDisplayName(warranty.store)?.toLowerCase().includes(query)
      );
    }

    setFilteredWarranties(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [warranties, filterStatus, searchQuery, getUserDisplayName]);

  useEffect(() => {
    filterWarranties();
  }, [filterWarranties]);

  useEffect(() => {
    // Apply pagination to filtered warranties
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setPaginatedWarranties(filteredWarranties.slice(startIndex, endIndex));
  }, [filteredWarranties, currentPage, itemsPerPage]);

  const handleSearch = async () => {
    const trimmedIMEI = searchQuery.trim().replace(/[\s-]/g, '');

    if (!trimmedIMEI || !validateIMEI(trimmedIMEI)) {
      toast({
        title: 'שגיאה',
        description: 'אנא הזן מספר IMEI תקין',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('Searching for IMEI:', trimmedIMEI);

      // Use the search_device_by_imei function (admin has unlimited searches)
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

      // Check if device was found (device_id will be null if not found)
      if (!result.device_id) {
        toast({
          title: 'לא נמצא',
          description: `המכשיר עם IMEI ${trimmedIMEI} לא נמצא במערכת`,
          variant: 'destructive',
        });
        return;
      }

      // The result object contains the device data directly
      const deviceFromSearch = result;

      const deviceRecord = {
        id: deviceFromSearch.device_id,
        imei: deviceFromSearch.imei,
        model: deviceFromSearch.model_name || 'לא ידוע',
        warranty_months: deviceFromSearch.warranty_months || 12,
        warranty: deviceFromSearch.warranty_id ? [{ id: deviceFromSearch.warranty_id }] : [],
        is_replaced: deviceFromSearch.is_replaced || false,
        replaced_at: deviceFromSearch.replaced_at || null,
        activation_date: deviceFromSearch.activation_date || null,
        expiry_date: deviceFromSearch.expiry_date || null,
        warranty_status: deviceFromSearch.warranty_status || 'new'
      };

      console.log('Found device:', deviceRecord);

      // Check if device was replaced - show warning but allow to see details
      if (deviceFromSearch.is_replaced) {
        setSelectedDevice(deviceRecord);
        setValue('imei', deviceRecord.imei);
        setIsActivationDialogOpen(true);
        toast({
          title: 'מכשיר הוחלף',
          description: 'מכשיר זה הוחלף ולא ניתן להפעיל עליו אחריות. תאריך החלפה: ' +
            (deviceFromSearch.replaced_at ? new Date(deviceFromSearch.replaced_at).toLocaleDateString('he-IL') : 'לא ידוע'),
          variant: 'destructive',
        });
        return;
      }

      if (deviceRecord.warranty && deviceRecord.warranty.length > 0) {
        setSelectedDevice(deviceRecord);
        setValue('imei', deviceRecord.imei);
        setIsActivationDialogOpen(true);
        toast({
          title: 'אחריות קיימת',
          description: `למכשיר זה כבר יש אחריות פעילה (${deviceFromSearch.activation_date ? formatDate(deviceFromSearch.activation_date) : ''} - ${deviceFromSearch.expiry_date ? formatDate(deviceFromSearch.expiry_date) : ''})`,
          variant: 'destructive',
        });
        return;
      }

      setSelectedDevice(deviceRecord);
      setValue('imei', deviceRecord.imei);
      setIsActivationDialogOpen(true);
    } catch (error: any) {
      console.error('Error searching device:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בחיפוש המכשיר',
        variant: 'destructive',
      });
    }
  };

  const onActivateWarranty = async (data: WarrantyFormData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('משתמש לא מחובר');

      // Calculate expiry date
      const activationDate = new Date();
      const expiryDate = new Date(activationDate);
      expiryDate.setMonth(expiryDate.getMonth() + (selectedDevice?.warranty_months || 12));

      const { error } = await (supabase.from('warranties') as any).insert([{
        device_id: selectedDevice.id,
        store_id: data.store_id || null,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        activation_date: activationDate.toISOString().split('T')[0],
        expiry_date: expiryDate.toISOString().split('T')[0],
        activated_by: user.id,
        is_active: true,
      }]);

      if (error) throw error;

      // Update device status
      await (supabase.from('devices') as any)
        .update({ warranty_status: 'active' })
        .eq('id', selectedDevice.id);

      toast({
        title: 'הצלחה',
        description: 'האחריות הופעלה בהצלחה',
      });

      setIsActivationDialogOpen(false);
      reset();
      setSelectedDevice(null);
      // React Query + Realtime will auto-refresh
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן להפעיל את האחריות',
        variant: 'destructive',
      });
    }
  };

  const handleCancelWarranty = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך לבטל אחריות זו?')) return;

    try {
      const { error } = await (supabase as any)
        .from('warranties')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: 'האחריות בוטלה בהצלחה',
      });

      // React Query + Realtime will auto-refresh
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לבטל את האחריות',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-96">טוען...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Background refresh indicator */}
      <BackgroundRefreshIndicator
        isFetching={isFetching}
        isLoading={isLoading}
      />

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">ניהול אחריות</h1>
        <Button onClick={() => setIsActivationDialogOpen(true)}>
          הפעל אחריות חדשה
          <Plus className="ms-2 h-4 w-4" />
        </Button>

        {/* Activation Dialog */}
        <Dialog open={isActivationDialogOpen} onOpenChange={setIsActivationDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>הפעלת אחריות</DialogTitle>
              <DialogDescription>
                הזן מספר IMEI להפעלת האחריות
              </DialogDescription>
            </DialogHeader>
            {selectedDevice ? (
              <form onSubmit={handleSubmit(onActivateWarranty)} className="space-y-4">
                {/* Device Info Display */}
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">פרטי המכשיר</Label>
                    {(selectedDevice as any).is_replaced && (
                      <Badge variant="destructive">מוחלף</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">IMEI</Label>
                      <p className="font-mono">{selectedDevice.imei}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">דגם</Label>
                      <p>{selectedDevice.model || 'לא ידוע'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">תקופת אחריות</Label>
                      <p>{selectedDevice.warranty_months || 12} חודשים</p>
                    </div>
                    {(selectedDevice as any).is_replaced && (selectedDevice as any).replaced_at && (
                      <div>
                        <Label className="text-xs text-muted-foreground">תאריך החלפה</Label>
                        <p>{formatDate((selectedDevice as any).replaced_at)}</p>
                      </div>
                    )}
                  </div>

                  {/* Show warranty dates if exists */}
                  {(selectedDevice as any).activation_date && (
                    <div className="border-t pt-3 space-y-2">
                      <Label className="text-sm font-medium">אחריות קיימת</Label>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <Label className="text-xs text-muted-foreground">תאריך הפעלה</Label>
                          <p>{formatDate((selectedDevice as any).activation_date)}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">תוקף עד</Label>
                          <p>{formatDate((selectedDevice as any).expiry_date)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label>שם לקוח *</Label>
                  <Input
                    {...register('customer_name')}
                    placeholder="הזן שם לקוח"
                  />
                  {errors.customer_name && (
                    <p className="text-sm text-red-500 mt-1">{errors.customer_name.message}</p>
                  )}
                </div>

                <div>
                  <Label>טלפון לקוח *</Label>
                  <Input
                    {...register('customer_phone')}
                    placeholder="050-1234567"
                  />
                  {errors.customer_phone && (
                    <p className="text-sm text-red-500 mt-1">{errors.customer_phone.message}</p>
                  )}
                </div>

                <div>
                  <Label>חנות (אופציונלי)</Label>
                  <Select onValueChange={(value) => setValue('store_id', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר חנות" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {getUserDisplayName(store)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={isSubmitting || (selectedDevice as any).is_replaced || (selectedDevice.warranty && selectedDevice.warranty.length > 0)}
                  >
                    {isSubmitting ? 'מפעיל...' :
                     (selectedDevice as any).is_replaced ? 'מכשיר הוחלף - לא ניתן להפעיל' :
                     (selectedDevice.warranty && selectedDevice.warranty.length > 0) ? 'אחריות כבר קיימת' :
                     'הפעל אחריות'}
                  </Button>
                </DialogFooter>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>IMEI</Label>
                  <div className="flex gap-2">
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="הזן IMEI"
                    />
                    <Button onClick={handleSearch}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>רשימת אחריות</CardTitle>
            <div className="flex gap-2">
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={filterStatus === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('all')}
                >
                  הכל ({warranties.length})
                </Button>
                <Button
                  size="sm"
                  variant={filterStatus === 'active' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('active')}
                >
                  פעיל
                </Button>
                <Button
                  size="sm"
                  variant={filterStatus === 'expired' ? 'default' : 'outline'}
                  onClick={() => setFilterStatus('expired')}
                >
                  פג תוקף
                </Button>
              </div>
              <div className="relative w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="חיפוש..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Pagination - Above Table */}
          {Math.ceil(filteredWarranties.length / itemsPerPage) > 1 && (
            <div className="flex items-center justify-between mb-4 pb-4 border-b">
              <div className="text-sm text-muted-foreground">
                מציג {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredWarranties.length)} מתוך {filteredWarranties.length} אחריות
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  ראשון
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  הקודם
                </Button>
                <div className="text-sm">
                  עמוד {currentPage} מתוך {Math.ceil(filteredWarranties.length / itemsPerPage)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredWarranties.length / itemsPerPage), prev + 1))}
                  disabled={currentPage === Math.ceil(filteredWarranties.length / itemsPerPage)}
                >
                  הבא
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.ceil(filteredWarranties.length / itemsPerPage))}
                  disabled={currentPage === Math.ceil(filteredWarranties.length / itemsPerPage)}
                >
                  אחרון
                </Button>
              </div>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IMEI</TableHead>
                <TableHead>דגם</TableHead>
                <TableHead>לקוח</TableHead>
                <TableHead>טלפון</TableHead>
                <TableHead>חנות</TableHead>
                <TableHead>הופעל</TableHead>
                <TableHead>תוקף עד</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedWarranties.map((warranty) => (
                <TableRow key={warranty.id}>
                  <TableCell className="font-mono text-sm">
                    {warranty.device?.imei}
                  </TableCell>
                  <TableCell>{warranty.device?.device_model?.model_name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {warranty.customer_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {warranty.customer_phone}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getUserDisplayName(warranty.store) ? (
                      <div className="flex items-center gap-1">
                        <Store className="h-3 w-3" />
                        {getUserDisplayName(warranty.store)}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>{formatDate(warranty.activation_date)}</TableCell>
                  <TableCell>{formatDate(warranty.expiry_date)}</TableCell>
                  <TableCell>{getStatusBadge(warranty)}</TableCell>
                  <TableCell>
                    {warranty.is_active && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCancelWarranty(warranty.id)}
                      >
                        <XCircle className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredWarranties.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              לא נמצאו אחריות מתאימות
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}