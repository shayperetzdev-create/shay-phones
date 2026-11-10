'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Device, DeviceModel, Warranty, Repair } from '@/types';
import { useStoreWarranties } from '@/hooks/queries/useWarranties';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';
import { StoreDevicesPageSkeleton } from '@/components/ui/loading-skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import {
  Package,
  Search,
  Shield,
  Wrench,
  Calendar,
  User,
  Phone,
  Hash,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Download
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type WarrantyStatus = 'new' | 'active' | 'expired' | 'replaced';

type StoreWarranty = Warranty & {
  device: (Pick<Device, 'id' | 'imei' | 'imei2'> & {
    device_models: Pick<DeviceModel, 'model_name'> | null;
  }) | null;
  repairs: Array<
    Pick<Repair, 'id' | 'status' | 'fault_type' | 'lab_id' | 'created_at' | 'completed_at'>
  > | null;
};

export default function StoreDevicesPage() {
  // Load current user to get storeId
  const { user: currentUser, isLoading: isUserLoading } = useCurrentUser();
  const storeId = currentUser?.id || null;

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // React Query hook - fetch all warranties (stores typically have fewer devices)
  const {
    warranties,
    total,
    isLoading: isWarrantiesLoading,
    isFetching,
    refetch: refetchWarranties,
  } = useStoreWarranties(storeId, 1, 10000); // Large page size to get all data

  const isLoading = isUserLoading || isWarrantiesLoading;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');
  const [selectedWarranty, setSelectedWarranty] = useState<StoreWarranty | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [filteredWarranties, setFilteredWarranties] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    expired: 0,
    inRepair: 0,
  });

  const { toast } = useToast();
  const supabase = createClient();
  const router = useRouter();

  // Calculate stats when warranties change
  useEffect(() => {
    const now = new Date();
    const activeCount = warranties.filter((w: any) =>
      new Date(w.expiry_date) > now && w.is_active
    ).length;

    const expiredCount = warranties.filter((w: any) =>
      new Date(w.expiry_date) <= now || !w.is_active
    ).length;

    const inRepairCount = warranties.filter((w: any) =>
      (w.repairs || []).some((r: any) => ['received', 'in_progress', 'replacement_requested'].includes(r.status))
    ).length;

    setStats({
      total,
      active: activeCount,
      expired: expiredCount,
      inRepair: inRepairCount,
    });
  }, [warranties, total]);

  const filterData = useCallback(() => {
    let filtered = [...warranties];

    if (searchQuery) {
      filtered = filtered.filter(warranty =>
        warranty.device?.imei?.includes(searchQuery) ||
        warranty.device?.imei2?.includes(searchQuery) ||
        warranty.device?.device_models?.model_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        warranty.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        warranty.customer_phone?.includes(searchQuery)
      );
    }

    if (filterStatus !== 'all') {
      const now = new Date();
      if (filterStatus === 'active') {
        filtered = filtered.filter(w =>
          new Date(w.expiry_date) > now && w.is_active
        );
      } else if (filterStatus === 'expired') {
        filtered = filtered.filter(w =>
          new Date(w.expiry_date) <= now || !w.is_active
        );
      }
    }

    setFilteredWarranties(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [warranties, searchQuery, filterStatus]);

  const [paginatedWarranties, setPaginatedWarranties] = useState<any[]>([]);

  useEffect(() => {
    filterData();
  }, [filterData]);

  useEffect(() => {
    // Apply client-side pagination to filtered warranties
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setPaginatedWarranties(filteredWarranties.slice(startIndex, endIndex));
  }, [filteredWarranties, currentPage, itemsPerPage]);

  const getWarrantyStatus = (warranty: StoreWarranty) => {
    const now = new Date();
    const expiryDate = new Date(warranty.expiry_date);

    if (!warranty.is_active) {
      return { icon: XCircle, label: 'מבוטל', variant: 'secondary' as const };
    } else if (expiryDate < now) {
      return { icon: XCircle, label: 'פג תוקף', variant: 'destructive' as const };
    } else {
      return { icon: CheckCircle, label: 'פעיל', variant: 'default' as const };
    }
  };

  const getRepairStatus = (
    repairs: StoreWarranty['repairs']
  ) => {
    if (!repairs || repairs.length === 0) return null;

    const activeRepair = repairs.find(r =>
      ['received', 'in_progress', 'replacement_requested'].includes(r.status)
    );

    if (activeRepair) {
      return (
        <Badge variant="outline">
          <Wrench className="ms-1 h-3 w-3" />
          בתיקון
        </Badge>
      );
    }

    const hasCompleted = repairs.some(r => r.status === 'completed');
    if (hasCompleted) {
      return (
        <Badge variant="secondary">
          <CheckCircle className="ms-1 h-3 w-3" />
          תוקן
        </Badge>
      );
    }

    return null;
  };

  const exportToCSV = () => {
    const csvContent = [
      ['IMEI 1', 'IMEI 2', 'דגם', 'שם לקוח', 'טלפון', 'תאריך הפעלה', 'תוקף עד', 'סטטוס'],
      ...filteredWarranties.map(warranty => [
        warranty.device?.imei || '',
        warranty.device?.imei2 || '',
        warranty.device?.device_models?.model_name || '',
        warranty.customer_name,
        warranty.customer_phone,
        formatDate(warranty.activation_date),
        formatDate(warranty.expiry_date),
        getWarrantyStatus(warranty).label
      ]),
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `warranties_${new Date().toISOString()}.csv`;
    link.click();
  };

  if (isLoading) {
    return <StoreDevicesPageSkeleton />;
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
          <h1 className="text-3xl font-bold tracking-tight">המכשירים שלי</h1>
          <p className="text-muted-foreground">
            ניהול ומעקב אחר מכשירים ואחריות של החנות
          </p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="ms-2 h-4 w-4" />
          ייצוא לאקסל
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-blue-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <CardTitle className="text-sm font-medium">סה"כ מכשירים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right text-blue-600">{stats.total}</div>
            <p className="text-xs text-muted-foreground text-right">
              מכשירים עם אחריות
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-green-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
            <CardTitle className="text-sm font-medium">אחריות פעילה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground text-right">
              בתוקף
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-red-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <CardTitle className="text-sm font-medium">פג תוקף</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right text-red-600">{stats.expired}</div>
            <p className="text-xs text-muted-foreground text-right">
              אחריות שפגה
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-orange-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <Wrench className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <CardTitle className="text-sm font-medium">בתיקון</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right text-orange-600">{stats.inRepair}</div>
            <p className="text-xs text-muted-foreground text-right">
              במעבדה כרגע
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>סינון וחיפוש</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש לפי IMEI, דגם, שם לקוח או טלפון..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10"
              dir="rtl"
            />
          </div>
          <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as 'all' | 'active' | 'expired')}>
            <SelectTrigger className="w-[180px]" dir="rtl">
              <SelectValue placeholder="סטטוס" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="all">כל הסטטוסים</SelectItem>
              <SelectItem value="active">פעיל</SelectItem>
              <SelectItem value="expired">פג תוקף</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Pagination - Above Table */}
      {Math.ceil(filteredWarranties.length / itemsPerPage) > 1 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                מציג {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredWarranties.length)} מתוך {filteredWarranties.length} מכשירים
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
          </CardContent>
        </Card>
      )}

      {/* Warranties Table */}
      <Card>
        <CardHeader>
          <CardTitle>רשימת מכשירים ({filteredWarranties.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>מכשיר</TableHead>
                <TableHead>לקוח</TableHead>
                <TableHead>תאריך הפעלה</TableHead>
                <TableHead>תוקף עד</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>מס' תיקונים</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedWarranties.map((warranty) => {
                const status = getWarrantyStatus(warranty);
                const StatusIcon = status.icon;

                return (
                  <TableRow key={warranty.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{warranty.device?.device_models?.model_name}</div>
                        <div className="text-sm text-muted-foreground font-mono">
                          {warranty.device?.imei}
                        </div>
                        {warranty.device?.imei2 && (
                          <div className="text-xs text-muted-foreground font-mono">
                            IMEI 2: {warranty.device?.imei2}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{warranty.customer_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {warranty.customer_phone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(warranty.activation_date)}</TableCell>
                    <TableCell>{formatDate(warranty.expiry_date)}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>
                        <StatusIcon className="ms-1 h-3 w-3" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {warranty.repairs && warranty.repairs.length > 0 ? (
                          <>
                            <div className="flex items-center gap-1">
                              <Wrench className="h-3 w-3 text-muted-foreground" />
                              <Badge variant="outline" className="font-mono">
                                {warranty.repairs.length}
                              </Badge>
                            </div>
                            {getRepairStatus(warranty.repairs)}
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedWarranty(warranty);
                          setIsDetailsDialogOpen(true);
                        }}
                      >
                        פרטים
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredWarranties.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              לא נמצאו מכשירים מתאימים
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      {selectedWarranty && (
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>פרטי אחריות</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>דגם המכשיר</Label>
                  <p className="font-medium">{selectedWarranty.device?.device_models?.model_name}</p>
                </div>
                <div>
                  <Label>IMEI</Label>
                  <p className="font-mono">{selectedWarranty.device?.imei}</p>
                </div>
                <div>
                  <Label>שם לקוח</Label>
                  <p>{selectedWarranty.customer_name}</p>
                </div>
                <div>
                  <Label>טלפון</Label>
                  <p>{selectedWarranty.customer_phone}</p>
                </div>
                <div>
                  <Label>תאריך הפעלה</Label>
                  <p>{formatDate(selectedWarranty.activation_date)}</p>
                </div>
                <div>
                  <Label>תוקף עד</Label>
                  <p>{formatDate(selectedWarranty.expiry_date)}</p>
                </div>
                <div>
                  <Label>סטטוס אחריות</Label>
                  <div className="mt-1">
                    {(() => {
                      const status = getWarrantyStatus(selectedWarranty);
                      const StatusIcon = status.icon;
                      return (
                        <Badge variant={status.variant}>
                          <StatusIcon className="ms-1 h-3 w-3" />
                          {status.label}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Repairs History */}
              {selectedWarranty.repairs && selectedWarranty.repairs.length > 0 && (
                <div>
                  <Label className="mb-2 block">היסטוריית תיקונים</Label>
                  <div className="space-y-2 border rounded-lg p-4">
                    {selectedWarranty.repairs.map((repair) => (
                      <div key={repair.id} className="flex justify-between items-start pb-2 border-b last:border-0">
                        <div>
                          <p className="font-medium">
                            {repair.fault_type === 'screen' ? 'מסך' :
                              repair.fault_type === 'charging_port' ? 'שקע טעינה' :
                                repair.fault_type === 'flash' ? 'פנס' :
                                  repair.fault_type === 'speaker' ? 'רמקול' :
                                    repair.fault_type === 'board' ? 'לוח אם' : 'אחר'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(repair.created_at)}
                            {repair.completed_at && ` - ${formatDate(repair.completed_at)}`}
                          </p>
                        </div>
                        <Badge variant={
                          repair.status === 'completed' ? 'default' :
                            repair.status === 'in_progress' ? 'outline' :
                              'secondary'
                        }>
                          {repair.status === 'completed' ? 'הושלם' :
                            repair.status === 'in_progress' ? 'בטיפול' :
                              repair.status === 'received' ? 'התקבל' :
                                repair.status === 'replacement_requested' ? 'בקשת החלפה' :
                                  'סטטוס אחר'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setIsDetailsDialogOpen(false)}>סגור</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}