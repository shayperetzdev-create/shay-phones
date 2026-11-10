'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAllUsers } from '@/hooks/queries/useUsers';
import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LabUser } from '@/types';
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
  Plus, Search, Wrench, Edit, Key,
  UserX, UserCheck, Trash2, BarChart3, Tag
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/utils';

// LabUser is now imported from @/types

const editLabSchema = z.object({
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

const createLabSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  full_name: z.string().min(1, 'שם מלא הוא שדה חובה'),
  phone: z.string().optional(),
  password: z.string().min(8, 'הסיסמה חייבת להכיל לפחות 8 תווים'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'הסיסמאות אינן תואמות',
  path: ['confirmPassword'],
});

type CreateLabFormData = z.infer<typeof createLabSchema>;
type EditLabFormData = z.infer<typeof editLabSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

interface LabStats {
  totalRepairs: number;
  pendingRepairs: number;
  completedRepairs: number;
}

export default function LabsPage() {
  // React Query hook with Realtime - filter for labs only
  const { users: allUsers, isLoading, isFetching } = useAllUsers();
  const labs = useMemo(() => allUsers.filter(u => u.role === 'lab'), [allUsers]);

  // Local state
  const [filteredLabs, setFilteredLabs] = useState<LabUser[]>([]);
  const [selectedLab, setSelectedLab] = useState<LabUser | null>(null);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [labStats, setLabStats] = useState<LabStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const supabase = createClient();
  const { toast } = useToast();
  const router = useRouter();

  const createForm = useForm<CreateLabFormData>({
    resolver: zodResolver(createLabSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      full_name: '',
      phone: '',
    }
  });

  const editForm = useForm<EditLabFormData>({
    resolver: zodResolver(editLabSchema),
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const stats = {
    total: labs.length,
    active: labs.filter(l => l.is_active).length,
    inactive: labs.filter(l => !l.is_active).length,
  };

  useEffect(() => {
    let filtered = labs;

    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter(l => l.is_active === isActive);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(l =>
        l.email?.toLowerCase().includes(query) ||
        l.full_name?.toLowerCase().includes(query) ||
        l.phone?.includes(query)
      );
    }

    setFilteredLabs(filtered);
  }, [labs, searchQuery, statusFilter]);

  const fetchLabStats = async (lab: LabUser) => {
    setLoadingStats(true);
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const { count: totalRepairs } = await supabase
        .from('repairs')
        .select('*', { count: 'exact', head: true })
        .eq('lab_id', lab.id);

      const { count: pendingRepairs } = await supabase
        .from('repairs')
        .select('*', { count: 'exact', head: true })
        .eq('lab_id', lab.id)
        .in('status', ['received', 'in_progress']);

      const { count: completedRepairs } = await supabase
        .from('repairs')
        .select('*', { count: 'exact', head: true })
        .eq('lab_id', lab.id)
        .eq('status', 'completed')
        .gte('completed_at', startOfMonth.toISOString());

      setLabStats({
        totalRepairs: totalRepairs || 0,
        pendingRepairs: pendingRepairs || 0,
        completedRepairs: completedRepairs || 0,
      });
    } catch (error) {
      console.error('Error fetching lab stats:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בטעינת הסטטיסטיקות',
        variant: 'destructive',
      });
    } finally {
      setLoadingStats(false);
    }
  };

  const handleCreateLab = async (data: CreateLabFormData) => {
    setIsSubmitting(true);
    try {
      const { confirmPassword, ...payload } = data;
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, role: 'lab' }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      toast({
        title: 'הצלחה',
        description: 'המעבדה נוצרה בהצלחה',
      });

      setIsCreateDialogOpen(false);
      createForm.reset();
      // React Query + Realtime will auto-refresh
    } catch (error: any) {
      console.error('Error creating lab:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה ביצירת המעבדה',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateLab = async (data: EditLabFormData) => {
    if (!selectedLab) return;

    setIsSubmitting(true);
    try {
      const updates = {
        full_name: data.full_name,
        phone: data.phone,
        is_active: data.is_active,
      };

      const { error } = await (supabase.from('users') as any)
        .update(updates)
        .eq('id', selectedLab.id);

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: 'פרטי המעבדה עודכנו בהצלחה',
      });

      setIsEditDialogOpen(false);
      // React Query + Realtime will auto-refresh
    } catch (error: any) {
      console.error('Error updating lab:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בעדכון המעבדה',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (data: PasswordFormData) => {
    if (!selectedLab) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedLab.id,
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

  const toggleLabStatus = async (labId: string, currentStatus: boolean) => {
    try {
      const { error } = await (supabase.from('users') as any)
        .update({ is_active: !currentStatus })
        .eq('id', labId);

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: `המעבדה ${!currentStatus ? 'הופעלה' : 'הושעתה'} בהצלחה`,
      });

      // React Query + Realtime will auto-refresh
    } catch (error: any) {
      console.error('Error toggling lab status:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בשינוי סטטוס המעבדה',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteLab = async (labId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק מעבדה זו? הפעולה תמחק אותה לצמיתות.')) return;

    try {
      const response = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: labId }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      toast({
        title: 'הצלחה',
        description: 'המעבדה נמחקה בהצלחה',
      });

      // React Query + Realtime will auto-refresh
    } catch (error: any) {
      console.error('Error deleting lab:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה במחיקת המעבדה',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (lab: LabUser) => {
    setSelectedLab(lab);
    editForm.reset({
      email: lab.email,
      full_name: lab.full_name || '',
      phone: lab.phone || '',
      is_active: lab.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const openPasswordDialog = (lab: LabUser) => {
    setSelectedLab(lab);
    passwordForm.reset();
    setIsPasswordDialogOpen(true);
  };

  const openStatsDialog = async (lab: LabUser) => {
    setSelectedLab(lab);
    setLabStats(null);
    setIsStatsDialogOpen(true);
    await fetchLabStats(lab);
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
          <h2 className="text-3xl font-bold tracking-tight">ניהול מעבדות</h2>
          <p className="text-muted-foreground">
            ניהול מעבדות המערכת והרשאות
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          הוסף מעבדה
          <Plus className="ms-2 h-4 w-4" />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">סה"כ מעבדות</CardTitle>
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
          <CardTitle>רשימת מעבדות</CardTitle>
          <CardDescription>
            {filteredLabs.length} מעבדות במערכת
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>מעבדה</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>תאריך הצטרפות</TableHead>
                <TableHead className="text-left">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLabs.map((lab) => (
                <TableRow key={lab.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{lab.full_name || lab.email}</div>
                      <div className="text-sm text-muted-foreground">{lab.email}</div>
                      {lab.phone && (
                        <div className="text-sm text-muted-foreground">{lab.phone}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={lab.is_active ? 'default' : 'secondary'}>
                      {lab.is_active ? 'פעילה' : 'מושעית'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(lab.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/admin/labs/${lab.id}/repair-pricing`)}
                        title="מחירי תיקונים"
                      >
                        <Tag className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openStatsDialog(lab)}
                        title="סטטיסטיקות"
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(lab)}
                        title="עריכה"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openPasswordDialog(lab)}
                        title="שינוי סיסמה"
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleLabStatus(lab.id, lab.is_active)}
                        title={lab.is_active ? 'השעה' : 'הפעל'}
                      >
                        {lab.is_active ?
                          <UserX className="h-4 w-4" /> :
                          <UserCheck className="h-4 w-4" />
                        }
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteLab(lab.id)}
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

      {/* Create Lab Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>הוספת מעבדה חדשה</DialogTitle>
            <DialogDescription>
              צור מעבדה חדשה במערכת
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreateLab)} className="space-y-4">
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
              <Label htmlFor="create-full_name">שם המעבדה</Label>
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
                {isSubmitting ? 'יוצר...' : 'צור מעבדה'}
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

      {/* Edit Lab Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>עריכת מעבדה</DialogTitle>
            <DialogDescription>
              ערוך את פרטי המעבדה
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleUpdateLab)} className="space-y-4">
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
              <Label htmlFor="edit-full_name">שם המעבדה</Label>
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
              <Label htmlFor="edit-is_active">מעבדה פעילה</Label>
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
              הגדר סיסמה חדשה עבור {selectedLab?.full_name || selectedLab?.email}
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

      {/* Lab Stats Dialog */}
      <Dialog open={isStatsDialogOpen} onOpenChange={setIsStatsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>סטטיסטיקות - {selectedLab?.full_name || selectedLab?.email}</DialogTitle>
            <DialogDescription>
              סטטיסטיקות המעבדה
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {loadingStats ? (
              <div className="text-center py-8">טוען נתונים...</div>
            ) : labStats ? (
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">סה"כ תיקונים</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{labStats.totalRepairs}</div>
                    <p className="text-xs text-muted-foreground">מאז ההצטרפות</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">תיקונים פעילים</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{labStats.pendingRepairs}</div>
                    <p className="text-xs text-muted-foreground">כרגע</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">הושלמו החודש</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{labStats.completedRepairs}</div>
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
