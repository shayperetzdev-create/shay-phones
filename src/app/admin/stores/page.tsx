'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAllUsers } from '@/hooks/queries/useUsers';
import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { StoreUser } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  Plus, Search, Store, Edit, Key,
  UserX, UserCheck, Trash2, BarChart3
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

// StoreUser is now imported from @/types

const editStoreSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  full_name: z.string().min(1, 'שם מלא הוא שדה חובה'),
  phone: z.string().optional(),
  is_active: z.boolean(),
});

const passwordSchema = z.object({
  password: z.string().min(8, 'הסיסמה חייבת להכיל לפחות 8 תווים'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'הסיסמאות אינן תואמות',
  path: ['confirmPassword'],
});

const createStoreSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  full_name: z.string().min(1, 'שם מלא הוא שדה חובה'),
  phone: z.string().optional(),
  password: z.string().min(8, 'הסיסמה חייבת להכיל לפחות 8 תווים'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'הסיסמאות אינן תואמות',
  path: ['confirmPassword'],
});

type CreateStoreFormData = z.infer<typeof createStoreSchema>;
type EditStoreFormData = z.infer<typeof editStoreSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

interface StoreStats {
  totalWarranties: number;
  activeWarranties: number;
  monthlyActivations: number;
}

export default function StoresPage() {
  // React Query hook with Realtime - filter for stores only
  const { users: allUsers, isLoading, isFetching } = useAllUsers();
  const stores = useMemo(() => allUsers.filter(u => u.role === 'store'), [allUsers]);

  // Local state
  const [filteredStores, setFilteredStores] = useState<StoreUser[]>([]);
  const [paginatedStores, setPaginatedStores] = useState<StoreUser[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreUser | null>(null);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  const [storeStats, setStoreStats] = useState<StoreStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const supabase = createClient();
  const { toast } = useToast();

  const createForm = useForm<CreateStoreFormData>({
    resolver: zodResolver(createStoreSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      full_name: '',
      phone: '',
    }
  });

  const editForm = useForm<EditStoreFormData>({
    resolver: zodResolver(editStoreSchema),
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const stats = {
    total: stores.length,
    active: stores.filter(s => s.is_active).length,
    inactive: stores.filter(s => !s.is_active).length,
  };

  useEffect(() => {
    let filtered = stores;

    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter(s => s.is_active === isActive);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.email?.toLowerCase().includes(query) ||
        s.full_name?.toLowerCase().includes(query) ||
        s.phone?.includes(query)
      );
    }

    setFilteredStores(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [stores, searchQuery, statusFilter]);

  useEffect(() => {
    // Apply pagination to filtered stores
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setPaginatedStores(filteredStores.slice(startIndex, endIndex));
  }, [filteredStores, currentPage, itemsPerPage]);

  const fetchStoreStats = async (store: StoreUser) => {
    setLoadingStats(true);
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const { count: totalWarranties } = await supabase
        .from('warranties')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store.id);

      const { count: activeWarranties } = await supabase
        .from('warranties')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store.id)
        .eq('is_active', true)
        .gt('expiry_date', now.toISOString());

      const { count: monthlyActivations } = await supabase
        .from('warranties')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store.id)
        .gte('activation_date', startOfMonth.toISOString());

      setStoreStats({
        totalWarranties: totalWarranties || 0,
        activeWarranties: activeWarranties || 0,
        monthlyActivations: monthlyActivations || 0,
      });
    } catch (error) {
      console.error('Error fetching store stats:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בטעינת הסטטיסטיקות',
        variant: 'destructive',
      });
    } finally {
      setLoadingStats(false);
    }
  };

  const handleCreateStore = async (data: CreateStoreFormData) => {
    setIsSubmitting(true);
    try {
      const { confirmPassword, ...payload } = data;
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, role: 'store' }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      toast({
        title: 'הצלחה',
        description: 'החנות נוצרה בהצלחה',
      });

      setIsCreateDialogOpen(false);
      createForm.reset();
      // React Query + Realtime will auto-refresh
    } catch (error: any) {
      console.error('Error creating store:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה ביצירת החנות',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStore = async (data: EditStoreFormData) => {
    if (!selectedStore) return;

    setIsSubmitting(true);
    try {
      const updates = {
        full_name: data.full_name,
        phone: data.phone,
        is_active: data.is_active,
      };

      const { error } = await (supabase.from('users') as any)
        .update(updates)
        .eq('id', selectedStore.id);

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: 'פרטי החנות עודכנו בהצלחה',
      });

      setIsEditDialogOpen(false);
      // React Query + Realtime will auto-refresh
    } catch (error: any) {
      console.error('Error updating store:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בעדכון החנות',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (data: PasswordFormData) => {
    if (!selectedStore) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedStore.id,
          newPassword: data.password,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      toast({
        title: 'הצלחה',
        description: 'הסיסמה שונתה בהצלחה',
      });

      setIsPasswordDialogOpen(false);
      passwordForm.reset();
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בשינוי הסיסמה',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStoreStatus = async (storeId: string, currentStatus: boolean) => {
    try {
      const { error } = await (supabase.from('users') as any)
        .update({ is_active: !currentStatus })
        .eq('id', storeId);

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: `החנות ${!currentStatus ? 'הופעלה' : 'הושעתה'} בהצלחה`,
      });

      // React Query + Realtime will auto-refresh
    } catch (error: any) {
      console.error('Error toggling store status:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בשינוי סטטוס החנות',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteStore = async (storeId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק חנות זו? הפעולה תמחק אותה לצמיתות.')) return;

    try {
      const response = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: storeId }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      toast({
        title: 'הצלחה',
        description: 'החנות נמחקה בהצלחה',
      });

      // React Query + Realtime will auto-refresh
    } catch (error: any) {
      console.error('Error deleting store:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה במחיקת החנות',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (store: StoreUser) => {
    setSelectedStore(store);
    editForm.reset({
      email: store.email,
      full_name: store.full_name || '',
      phone: store.phone || '',
      is_active: store.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const openPasswordDialog = (store: StoreUser) => {
    setSelectedStore(store);
    passwordForm.reset();
    setIsPasswordDialogOpen(true);
  };

  const openStatsDialog = async (store: StoreUser) => {
    setSelectedStore(store);
    setStoreStats(null);
    setIsStatsDialogOpen(true);
    await fetchStoreStats(store);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Background refresh indicator */}
      <BackgroundRefreshIndicator
        isFetching={isFetching}
        isLoading={isLoading}
      />

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">ניהול חנויות</h2>
          <p className="text-muted-foreground">
            ניהול חנויות המערכת והרשאות
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          הוסף חנות
          <Plus className="ms-2 h-4 w-4" />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">סה"כ חנויות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">פעילות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <UserX className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">מושעות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inactive}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חפש לפי שם, אימייל או טלפון..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                dir="rtl"
                className="pr-8"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('all')}
              >
                הכל
              </Button>
              <Button
                variant={statusFilter === 'active' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('active')}
              >
                פעילות
              </Button>
              <Button
                variant={statusFilter === 'inactive' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('inactive')}
              >
                מושעות
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>רשימת חנויות</CardTitle>
          <CardDescription>
            {filteredStores.length} חנויות במערכת
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Pagination - Above Table */}
          {Math.ceil(filteredStores.length / itemsPerPage) > 1 && (
            <div className="flex items-center justify-between mb-4 pb-4 border-b">
              <div className="text-sm text-muted-foreground">
                מציג {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredStores.length)} מתוך {filteredStores.length} חנויות
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
                  עמוד {currentPage} מתוך {Math.ceil(filteredStores.length / itemsPerPage)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredStores.length / itemsPerPage), prev + 1))}
                  disabled={currentPage === Math.ceil(filteredStores.length / itemsPerPage)}
                >
                  הבא
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.ceil(filteredStores.length / itemsPerPage))}
                  disabled={currentPage === Math.ceil(filteredStores.length / itemsPerPage)}
                >
                  אחרון
                </Button>
              </div>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>חנות</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>תאריך הצטרפות</TableHead>
                <TableHead className="text-left">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedStores.map((store) => (
                <TableRow key={store.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{store.full_name || store.email}</div>
                      <div className="text-sm text-muted-foreground">{store.email}</div>
                      {store.phone && (
                        <div className="text-sm text-muted-foreground">{store.phone}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={store.is_active ? 'default' : 'secondary'}>
                      {store.is_active ? 'פעילה' : 'מושעית'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(store.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openStatsDialog(store)}
                        title="סטטיסטיקות"
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(store)}
                        title="עריכה"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openPasswordDialog(store)}
                        title="שינוי סיסמה"
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleStoreStatus(store.id, store.is_active)}
                        title={store.is_active ? 'השעה' : 'הפעל'}
                      >
                        {store.is_active ?
                          <UserX className="h-4 w-4" /> :
                          <UserCheck className="h-4 w-4" />
                        }
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteStore(store.id)}
                        title="מחיקה"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Store Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>הוספת חנות חדשה</DialogTitle>
            <DialogDescription>
              צור חנות חדשה במערכת
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreateStore)} className="space-y-4">
            <div>
              <Label htmlFor="create-email">אימייל</Label>
              <Input
                id="create-email"
                type="email"
                {...createForm.register('email')}
              />
              {createForm.formState.errors.email && (
                <p className="text-sm text-red-500 mt-1">
                  {createForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="create-password">סיסמה</Label>
              <Input
                id="create-password"
                type="password"
                {...createForm.register('password')}
              />
              {createForm.formState.errors.password && (
                <p className="text-sm text-red-500 mt-1">
                  {createForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="create-confirmPassword">אישור סיסמה</Label>
              <Input
                id="create-confirmPassword"
                type="password"
                {...createForm.register('confirmPassword')}
              />
              {createForm.formState.errors.confirmPassword && (
                <p className="text-sm text-red-500 mt-1">
                  {createForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="create-full_name">שם החנות</Label>
              <Input
                id="create-full_name"
                {...createForm.register('full_name')}
              />
              {createForm.formState.errors.full_name && (
                <p className="text-sm text-red-500 mt-1">
                  {createForm.formState.errors.full_name.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="create-phone">טלפון</Label>
              <Input
                id="create-phone"
                {...createForm.register('phone')}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'יוצר...' : 'צור חנות'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                ביטול
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Store Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>עריכת חנות</DialogTitle>
            <DialogDescription>
              ערוך את פרטי החנות
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleUpdateStore)} className="space-y-4">
            <div>
              <Label htmlFor="edit-email">אימייל</Label>
              <Input
                id="edit-email"
                type="email"
                disabled
                {...editForm.register('email')}
              />
            </div>

            <div>
              <Label htmlFor="edit-full_name">שם החנות</Label>
              <Input
                id="edit-full_name"
                {...editForm.register('full_name')}
              />
              {editForm.formState.errors.full_name && (
                <p className="text-sm text-red-500 mt-1">
                  {editForm.formState.errors.full_name.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="edit-phone">טלפון</Label>
              <Input
                id="edit-phone"
                {...editForm.register('phone')}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-is_active"
                {...editForm.register('is_active')}
                className="h-4 w-4"
              />
              <Label htmlFor="edit-is_active">חנות פעילה</Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'מעדכן...' : 'עדכן'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                ביטול
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>איפוס סיסמה</DialogTitle>
            <DialogDescription>
              הגדר סיסמה חדשה עבור {selectedStore?.full_name || selectedStore?.email}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={passwordForm.handleSubmit(handleResetPassword)} className="space-y-4">
            <div>
              <Label htmlFor="password">סיסמה חדשה</Label>
              <Input
                id="password"
                type="password"
                {...passwordForm.register('password')}
              />
              {passwordForm.formState.errors.password && (
                <p className="text-sm text-red-500 mt-1">
                  {passwordForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword">אישור סיסמה</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...passwordForm.register('confirmPassword')}
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-red-500 mt-1">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'מעדכן...' : 'עדכן סיסמה'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPasswordDialogOpen(false)}
              >
                ביטול
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Store Stats Dialog */}
      <Dialog open={isStatsDialogOpen} onOpenChange={setIsStatsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>סטטיסטיקות - {selectedStore?.full_name || selectedStore?.email}</DialogTitle>
            <DialogDescription>
              סטטיסטיקות החנות
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {loadingStats ? (
              <div className="text-center py-8">טוען נתונים...</div>
            ) : storeStats ? (
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">סה"כ אחריות</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{storeStats.totalWarranties}</div>
                    <p className="text-xs text-muted-foreground">מאז ההצטרפות</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">אחריות פעילות</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{storeStats.activeWarranties}</div>
                    <p className="text-xs text-muted-foreground">כרגע</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">הפעלות החודש</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{storeStats.monthlyActivations}</div>
                    <p className="text-xs text-muted-foreground">החודש הנוכחי</p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                לא ניתן לטעון סטטיסטיקות
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
