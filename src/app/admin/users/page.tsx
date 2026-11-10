'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';

import { createClient } from '@/lib/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { User } from '@/types';
import { useAllUsers, useUserStats } from '@/hooks/queries/useUsers';
import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  Plus, Search, Shield, Store, Wrench, Edit, Key,
  UserX, UserCheck, Trash2, BarChart3, Users
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { UsersPageSkeleton } from '@/components/ui/loading-skeletons';

type ManagedUser = User;

const editUserSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  full_name: z.string().min(1, 'שם מלא הוא שדה חובה'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'ops', 'marketing', 'store', 'lab']),
  is_active: z.boolean(),
});

const passwordSchema = z.object({
  password: z.string().min(8, 'הסיסמה חייבת להכיל לפחות 8 תווים'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'הסיסמאות אינן תואמות',
  path: ['confirmPassword'],
});

const createUserSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  full_name: z.string().min(1, 'שם מלא הוא שדה חובה'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'ops', 'marketing', 'store', 'lab']),
  password: z.string().min(8, 'הסיסמה חייבת להכיל לפחות 8 תווים'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'הסיסמאות אינן תואמות',
  path: ['confirmPassword'],
});

type CreateUserFormData = z.infer<typeof createUserSchema>;
type EditUserFormData = z.infer<typeof editUserSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

interface UserStats {
  totalWarranties: number;
  activeWarranties: number;
  monthlyActivations: number;
  totalRepairs: number;
  pendingRepairs: number;
  completedRepairs: number;
}

export default function UsersPage() {
  // React Query hook with Realtime
  const { users, isLoading, isFetching } = useAllUsers();

  // Local state for filtering/pagination
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // אופטימיזציה: Cache לכל הסטטיסטיקות - מונע N+1 queries
  const [allStoreStats, setAllStoreStats] = useState<Map<string, UserStats>>(new Map());
  const [allLabStats, setAllLabStats] = useState<Map<string, UserStats>>(new Map());
  const [statsLoaded, setStatsLoaded] = useState(false);

  const supabase = createClient();
  const { toast } = useToast();

  const createForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      full_name: '',
      phone: '',
      role: 'store',
    }
  });

  const editForm = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const selectedRoleCreate = createForm.watch('role');

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    stores: users.filter(u => u.role === 'store').length,
    labs: users.filter(u => u.role === 'lab').length,
    active: users.filter(u => u.is_active).length,
    inactive: users.filter(u => !u.is_active).length,
  };


  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };
  
  const handleRoleFilterChange = (value: string) => {
    setRoleFilter(value);
    setCurrentPage(1);
  };
  
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  // אופטימיזציה: טעינת כל הסטטיסטיקות מראש - 2 קריאות במקום N*3
  const fetchAllStats = useCallback(async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // קריאה 1: כל הסטטיסטיקות של חנויות בבת אחת
      const { data: warrantyStats, error: warrantyError } = await supabase
        .from('warranties')
        .select('store_id, is_active, expiry_date, activation_date');

      if (warrantyError) throw warrantyError;

      // חישוב סטטיסטיקות חנויות בזיכרון
      const storeStatsMap = new Map<string, UserStats>();
      (warrantyStats || []).forEach((w: any) => {
        const storeId = w.store_id;
        if (!storeId) return;

        let stats = storeStatsMap.get(storeId);
        if (!stats) {
          stats = {
            totalWarranties: 0,
            activeWarranties: 0,
            monthlyActivations: 0,
            totalRepairs: 0,
            pendingRepairs: 0,
            completedRepairs: 0,
          };
          storeStatsMap.set(storeId, stats);
        }

        stats.totalWarranties++;

        if (w.is_active && new Date(w.expiry_date) > now) {
          stats.activeWarranties++;
        }

        if (w.activation_date && new Date(w.activation_date) >= startOfMonth) {
          stats.monthlyActivations++;
        }
      });

      setAllStoreStats(storeStatsMap);

      // קריאה 2: כל הסטטיסטיקות של מעבדות בבת אחת
      const { data: repairStats, error: repairError } = await supabase
        .from('repairs')
        .select('lab_id, status, completed_at');

      if (repairError) throw repairError;

      // חישוב סטטיסטיקות מעבדות בזיכרון
      const labStatsMap = new Map<string, UserStats>();
      (repairStats || []).forEach((r: any) => {
        const labId = r.lab_id;
        if (!labId) return;

        let stats = labStatsMap.get(labId);
        if (!stats) {
          stats = {
            totalWarranties: 0,
            activeWarranties: 0,
            monthlyActivations: 0,
            totalRepairs: 0,
            pendingRepairs: 0,
            completedRepairs: 0,
          };
          labStatsMap.set(labId, stats);
        }

        stats.totalRepairs++;

        if (r.status === 'received' || r.status === 'in_progress') {
          stats.pendingRepairs++;
        }

        if (r.status === 'completed' && r.completed_at && new Date(r.completed_at) >= startOfMonth) {
          stats.completedRepairs++;
        }
      });

      setAllLabStats(labStatsMap);
      setStatsLoaded(true);
    } catch (error) {
      console.error('Error fetching all stats:', error);
      // לא מציג שגיאה למשתמש - סטטיסטיקות הן נחמדות לקבל אבל לא קריטיות
    }
  }, [supabase]);

  // Load stats on mount
  useEffect(() => {
    if (!statsLoaded && users.length > 0) {
      fetchAllStats();
    }
  }, [statsLoaded, users.length]);


  const filteredUsers = useMemo(() => {
    let filtered = users;
  
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }
  
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter(u => u.is_active === isActive);
    }
  
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u =>
        u.email?.toLowerCase().includes(query) ||
        u.full_name?.toLowerCase().includes(query) ||
        u.phone?.includes(query)
      );
    }
  
    return filtered;
  }, [users, searchQuery, roleFilter, statusFilter]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredUsers.slice(startIndex, endIndex);
  }, [filteredUsers, currentPage, itemsPerPage]);

  // אופטימיזציה: שימוש ב-cache במקום קריאות חדשות - חוסך 3-6 קריאות לכל משתמש!
  const fetchUserStats = useCallback(async (user: ManagedUser) => {
    setLoadingStats(true);
    try {
      // אם יש cache - השתמש בו מיד (אפס קריאות!)
      if (user.role === 'store') {
        const cachedStats = allStoreStats.get(user.id);
        if (cachedStats) {
          setUserStats(cachedStats);
          setLoadingStats(false);
          return;
        }
      } else if (user.role === 'lab') {
        const cachedStats = allLabStats.get(user.id);
        if (cachedStats) {
          setUserStats(cachedStats);
          setLoadingStats(false);
          return;
        }
      }

      // אם אין cache - טען מחדש את כל הסטטיסטיקות (fallback)
      // זה יקרה רק אם העמוד נטען ישירות לסטטיסטיקות
      await fetchAllStats();

      // אחרי הטעינה, קח מה-cache - צריך לגשת מה-state החדש
      setTimeout(() => {
        if (user.role === 'store') {
          const stats = allStoreStats.get(user.id);
          setUserStats(stats || {
            totalWarranties: 0,
            activeWarranties: 0,
            monthlyActivations: 0,
            totalRepairs: 0,
            pendingRepairs: 0,
            completedRepairs: 0,
          });
        } else if (user.role === 'lab') {
          const stats = allLabStats.get(user.id);
          setUserStats(stats || {
            totalWarranties: 0,
            activeWarranties: 0,
            monthlyActivations: 0,
            totalRepairs: 0,
            pendingRepairs: 0,
            completedRepairs: 0,
          });
        }
      }, 100);
    } catch (error) {
      console.error('Error fetching user stats:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בטעינת הסטטיסטיקות',
        variant: 'destructive',
      });
    } finally {
      setTimeout(() => setLoadingStats(false), 100);
    }
  }, [allStoreStats, allLabStats, fetchAllStats, toast]);

  const handleCreateUser = async (data: CreateUserFormData) => {
    setIsSubmitting(true);
    try {
      const { confirmPassword, ...payload } = data;
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      toast({
        title: 'הצלחה',
        description: 'המשתמש נוצר בהצלחה',
      });

      setIsCreateDialogOpen(false);
      createForm.reset();
      // React Query + Realtime will auto-refresh
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה ביצירת המשתמש',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (data: EditUserFormData) => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      const updates = {
        full_name: data.full_name,
        phone: data.phone,
        role: data.role,
        is_active: data.is_active,
      };

      const { error } = await (supabase.from('users') as any)
        .update(updates)
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: 'פרטי המשתמש עודכנו בהצלחה',
      });

      setIsEditDialogOpen(false);
      // React Query + Realtime will auto-refresh
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בעדכון המשתמש',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (data: PasswordFormData) => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
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

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await (supabase.from('users') as any)
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: `המשתמש ${!currentStatus ? 'הופעל' : 'הושעה'} בהצלחה`,
      });
      // React Query + Realtime will auto-refresh
    } catch (error: any) {
      console.error('Error toggling user status:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בשינוי סטטוס המשתמש',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק משתמש זה? הפעולה תמחק אותו לצמיתות.')) return;

    try {
      const response = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      toast({
        title: 'הצלחה',
        description: 'המשתמש נמחק בהצלחה',
      });
      // React Query + Realtime will auto-refresh
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה במחיקת המשתמש',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (user: ManagedUser) => {
    setSelectedUser(user);
    editForm.reset({
      email: user.email,
      full_name: user.full_name || '',
      phone: user.phone || '',
      role: user.role,
      is_active: user.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const openPasswordDialog = (user: ManagedUser) => {
    setSelectedUser(user);
    passwordForm.reset();
    setIsPasswordDialogOpen(true);
  };

  const openStatsDialog = async (user: ManagedUser) => {
    setSelectedUser(user);
    setUserStats(null);
    setIsStatsDialogOpen(true);
    await fetchUserStats(user);
  };

  const getRoleBadge = (role: string) => {
    const config = {
      admin: { variant: 'default' as const, icon: Shield, text: 'מנהל' },
      store: { variant: 'outline' as const, icon: Store, text: 'חנות' },
      lab: { variant: 'secondary' as const, icon: Wrench, text: 'מעבדה' },
    };
    const roleConfig = config[role as keyof typeof config];
    const Icon = roleConfig.icon;
    return (
      <Badge variant={roleConfig.variant}>
        <Icon className="h-3 w-3 ms-1" />
        {roleConfig.text}
      </Badge>
    );
  };

  if (isLoading) {
    return <UsersPageSkeleton />;
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
          <h2 className="text-3xl font-bold tracking-tight">ניהול משתמשים</h2>
          <p className="text-muted-foreground">
            ניהול משתמשי המערכת והרשאות
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          הוסף משתמש
          <Plus className="ms-2 h-4 w-4" />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">סה"כ משתמשים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">מנהלים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right">{stats.admins}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
            <Store className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">חנויות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right">{stats.stores}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">מעבדות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right">{stats.labs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">פעילים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right">{stats.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
            <UserX className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">מושעים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right">{stats.inactive}</div>
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
                  onChange={(e) => handleSearchChange(e.target.value)}
                  dir="rtl"
                  className="pr-8"
                />
            </div>
            <Select value={roleFilter} onValueChange={handleRoleFilterChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל התפקידים</SelectItem>
                <SelectItem value="admin">מנהלים</SelectItem>
                <SelectItem value="ops">תפעול</SelectItem>
                <SelectItem value="marketing">שיווק</SelectItem>
                <SelectItem value="store">חנויות</SelectItem>
                <SelectItem value="lab">מעבדות</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="active">פעילים</SelectItem>
                <SelectItem value="inactive">מושעים</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>רשימת משתמשים</CardTitle>
          <CardDescription>
            {filteredUsers.length} משתמשים במערכת
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Pagination - Above Table */}
          {Math.ceil(filteredUsers.length / itemsPerPage) > 1 && (
            <div className="flex items-center justify-between mb-4 pb-4 border-b">
              <div className="text-sm text-muted-foreground">
                מציג {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredUsers.length)} מתוך {filteredUsers.length} משתמשים
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
                  עמוד {currentPage} מתוך {Math.ceil(filteredUsers.length / itemsPerPage)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredUsers.length / itemsPerPage), prev + 1))}
                  disabled={currentPage === Math.ceil(filteredUsers.length / itemsPerPage)}
                >
                  הבא
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.ceil(filteredUsers.length / itemsPerPage))}
                  disabled={currentPage === Math.ceil(filteredUsers.length / itemsPerPage)}
                >
                  אחרון
                </Button>
              </div>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>משתמש</TableHead>
                <TableHead>תפקיד</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>תאריך הצטרפות</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.full_name || user.email}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                      {user.phone && (
                        <div className="text-sm text-muted-foreground">{user.phone}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? 'default' : 'secondary'}>
                      {user.is_active ? 'פעיל' : 'מושעה'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {(user.role === 'store' || user.role === 'lab') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openStatsDialog(user)}
                          title="סטטיסטיקות"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(user)}
                        title="עריכה"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openPasswordDialog(user)}
                        title="שינוי סיסמה"
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleUserStatus(user.id, user.is_active)}
                        title={user.is_active ? 'השעה' : 'הפעל'}
                      >
                        {user.is_active ?
                          <UserX className="h-4 w-4" /> :
                          <UserCheck className="h-4 w-4" />
                        }
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteUser(user.id)}
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

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>הוספת משתמש חדש</DialogTitle>
            <DialogDescription>
              צור משתמש חדש במערכת
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreateUser)} className="space-y-4">
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
              <Label htmlFor="create-full_name">שם מלא</Label>
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

            <div>
              <Label htmlFor="create-role">תפקיד</Label>
              <Select
                value={selectedRoleCreate}
                onValueChange={(value) => createForm.setValue('role', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">מנהל</SelectItem>
                  <SelectItem value="ops">תפעול</SelectItem>
                  <SelectItem value="marketing">שיווק</SelectItem>
                  <SelectItem value="store">חנות</SelectItem>
                  <SelectItem value="lab">מעבדה</SelectItem>
                </SelectContent>
              </Select>
              {createForm.formState.errors.role && (
                <p className="text-sm text-red-500 mt-1">
                  {createForm.formState.errors.role.message}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'יוצר...' : 'צור משתמש'}
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

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>עריכת משתמש</DialogTitle>
            <DialogDescription>
              ערוך את פרטי המשתמש
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleUpdateUser)} className="space-y-4">
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
              <Label htmlFor="edit-full_name">שם מלא</Label>
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

            <div>
              <Label htmlFor="edit-role">תפקיד</Label>
              <Select
                value={editForm.watch('role')}
                onValueChange={(value) => editForm.setValue('role', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">מנהל</SelectItem>
                  <SelectItem value="ops">תפעול</SelectItem>
                  <SelectItem value="marketing">שיווק</SelectItem>
                  <SelectItem value="store">חנות</SelectItem>
                  <SelectItem value="lab">מעבדה</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-is_active"
                {...editForm.register('is_active')}
                className="h-4 w-4"
              />
              <Label htmlFor="edit-is_active">משתמש פעיל</Label>
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
              הגדר סיסמה חדשה עבור {selectedUser?.full_name || selectedUser?.email}
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

      {/* User Stats Dialog */}
      <Dialog open={isStatsDialogOpen} onOpenChange={setIsStatsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>סטטיסטיקות - {selectedUser?.full_name || selectedUser?.email}</DialogTitle>
            <DialogDescription>
              {selectedUser?.role === 'store' ? 'סטטיסטיקות החנות' : 'סטטיסטיקות המעבדה'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {loadingStats ? (
              <div className="text-center py-8">טוען נתונים...</div>
            ) : userStats ? (
              <div className="grid gap-4 md:grid-cols-3">
                {selectedUser?.role === 'store' ? (
                  <>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">סה"כ אחריות</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{userStats.totalWarranties}</div>
                        <p className="text-xs text-muted-foreground">מאז ההצטרפות</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">אחריות פעילות</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{userStats.activeWarranties}</div>
                        <p className="text-xs text-muted-foreground">כרגע</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">הפעלות החודש</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{userStats.monthlyActivations}</div>
                        <p className="text-xs text-muted-foreground">החודש הנוכחי</p>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">סה"כ תיקונים</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{userStats.totalRepairs}</div>
                        <p className="text-xs text-muted-foreground">מאז ההצטרפות</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">תיקונים פעילים</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{userStats.pendingRepairs}</div>
                        <p className="text-xs text-muted-foreground">כרגע</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">הושלמו החודש</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{userStats.completedRepairs}</div>
                        <p className="text-xs text-muted-foreground">החודש הנוכחי</p>
                      </CardContent>
                    </Card>
                  </>
                )}
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
