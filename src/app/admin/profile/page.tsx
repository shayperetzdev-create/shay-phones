'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UserData } from '@/types/user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Mail,
  Calendar,
  Shield,
  Activity,
  Package,
  Wrench,
  RefreshCw,
  CheckCircle,
  Clock,
  TrendingUp,
  Store,
  Users
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

interface ProfileStats {
  totalActions: number;
  devicesManaged: number;
  repairsHandled: number;
  warrantiesActivated: number;
  replacementsApproved: number;
  activeRepairs: number;
}

interface RecentActivity {
  id: string;
  action: string;
  description: string;
  timestamp: string;
  type: 'device' | 'repair' | 'warranty' | 'replacement' | 'user';
}

const roleLabels: Record<string, string> = {
  admin: 'מנהל מערכת',
  store: 'חנות',
  lab: 'מעבדה',
};

const roleColors: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  store: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  lab: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

export default function ProfilePage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [stats, setStats] = useState<ProfileStats>({
    totalActions: 0,
    devicesManaged: 0,
    repairsHandled: 0,
    warrantiesActivated: 0,
    replacementsApproved: 0,
    activeRepairs: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchUserData();
    fetchStats();
    fetchRecentActivity();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (!error && data) {
          setUser(data as UserData);
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const userId = authUser.id;

      // Get user role
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      const userRole = userData?.role;

      // Fetch various statistics based on user role
      // Only admins import devices
      const devicesPromise = userRole === 'admin'
        ? supabase
            .from('devices')
            .select('id', { count: 'exact', head: true })
            .eq('imported_by', userId)
        : Promise.resolve({ count: 0 });

      const [devicesResult, repairsResult, warrantiesResult, replacementsResult, activeRepairsResult] = await Promise.all([
        devicesPromise,
        // Repairs created/handled by user
        supabase
          .from('repairs')
          .select('id', { count: 'exact', head: true })
          .eq('created_by', userId),

        // Warranties activated by user
        supabase
          .from('warranties')
          .select('id', { count: 'exact', head: true })
          .eq('activated_by', userId),

        // Replacement requests resolved by user (mainly admins)
        supabase
          .from('replacement_requests')
          .select('id', { count: 'exact', head: true })
          .eq('resolved_by', userId)
          .eq('status', 'approved'),

        // Active repairs assigned to user (for labs)
        supabase
          .from('repairs')
          .select('id', { count: 'exact', head: true })
          .eq('lab_id', userId)
          .in('status', ['received', 'in_progress']),
      ]);

      const totalActions =
        (devicesResult.count || 0) +
        (repairsResult.count || 0) +
        (warrantiesResult.count || 0) +
        (replacementsResult.count || 0);

      setStats({
        totalActions,
        devicesManaged: userRole === 'admin' ? (devicesResult.count || 0) : 0,
        repairsHandled: repairsResult.count || 0,
        warrantiesActivated: warrantiesResult.count || 0,
        replacementsApproved: replacementsResult.count || 0,
        activeRepairs: activeRepairsResult.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const userId = authUser.id;
      const activities: RecentActivity[] = [];

      // Get user role
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      const userRole = userData?.role;

      // Fetch recent devices imported (only for admins)
      if (userRole === 'admin') {
        const { data: devices } = await supabase
          .from('devices')
          .select('id, created_at, device_models(model_name)')
          .eq('imported_by', userId)
          .order('created_at', { ascending: false })
          .limit(3);

        devices?.forEach(device => {
          const modelName = (device.device_models as any)?.model_name || 'לא ידוע';
          activities.push({
            id: `device-${device.id}`,
            action: 'ייבא מכשיר',
            description: `דגם: ${modelName}`,
            timestamp: device.created_at,
            type: 'device',
          });
        });
      }

      // Fetch recent repairs
      const { data: repairs } = await supabase
        .from('repairs')
        .select('id, customer_name, status, created_at')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })
        .limit(3);

      repairs?.forEach(repair => {
        activities.push({
          id: `repair-${repair.id}`,
          action: 'פתח תיקון',
          description: `לקוח: ${repair.customer_name}`,
          timestamp: repair.created_at,
          type: 'repair',
        });
      });

      // Fetch recent warranties
      const { data: warranties } = await supabase
        .from('warranties')
        .select('id, customer_name, created_at')
        .eq('activated_by', userId)
        .order('created_at', { ascending: false })
        .limit(3);

      warranties?.forEach(warranty => {
        activities.push({
          id: `warranty-${warranty.id}`,
          action: 'הפעיל אחריות',
          description: `לקוח: ${warranty.customer_name}`,
          timestamp: warranty.created_at,
          type: 'warranty',
        });
      });

      // Fetch recent replacement approvals
      const { data: replacements } = await supabase
        .from('replacement_requests')
        .select('id, customer_name, resolved_at')
        .eq('resolved_by', userId)
        .not('resolved_at', 'is', null)
        .order('resolved_at', { ascending: false })
        .limit(3);

      replacements?.forEach(replacement => {
        activities.push({
          id: `replacement-${replacement.id}`,
          action: 'אישר החלפה',
          description: `לקוח: ${replacement.customer_name}`,
          timestamp: replacement.resolved_at!,
          type: 'replacement',
        });
      });

      // Sort all activities by timestamp
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivity(activities.slice(0, 10));
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  };

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'device': return <Package className="h-4 w-4" />;
      case 'repair': return <Wrench className="h-4 w-4" />;
      case 'warranty': return <Shield className="h-4 w-4" />;
      case 'replacement': return <RefreshCw className="h-4 w-4" />;
      case 'user': return <Users className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: RecentActivity['type']) => {
    switch (type) {
      case 'device': return 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400';
      case 'repair': return 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400';
      case 'warranty': return 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400';
      case 'replacement': return 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400';
      case 'user': return 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">טוען פרופיל...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">הפרופיל שלי</h1>
        <p className="text-muted-foreground">
          מידע אישי, סטטיסטיקות ופעילות אחרונה
        </p>
      </div>

      {/* User Info Card */}
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
              <AvatarImage src="/avatar.png" alt={user?.full_name ?? undefined} />
              <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-primary to-primary/60">
                {user?.full_name?.split(' ').map((n: string) => n[0]).join('') || 'A'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-3">
              <div>
                <h2 className="text-2xl font-bold">{user?.full_name || 'משתמש'}</h2>
                <p className="text-muted-foreground">{user?.email}</p>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <Badge className={roleColors[user?.role || 'admin']}>
                    {roleLabels[user?.role || 'admin']}
                  </Badge>
                </div>

                {user?.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{user.phone}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    הצטרף {user?.created_at ? formatDistanceToNow(new Date(user.created_at), { addSuffix: true, locale: he }) : 'לא זמין'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${user?.is_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-muted-foreground">
                  {user?.is_active ? 'פעיל' : 'לא פעיל'}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Cards */}
      <div>
        <h2 className="text-xl font-bold mb-4">הסטטיסטיקות שלי</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-blue-500">
            <CardHeader className="flex flex-row-reverse items-center justify-between pb-2">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-sm font-medium">סה&quot;כ פעולות</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.totalActions}</div>
              <p className="text-xs text-muted-foreground mt-1">כל הפעולות שביצעת</p>
            </CardContent>
          </Card>

          {stats.devicesManaged > 0 && (
            <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-purple-500">
              <CardHeader className="flex flex-row-reverse items-center justify-between pb-2">
                <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle className="text-sm font-medium">מכשירים</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">{stats.devicesManaged}</div>
                <p className="text-xs text-muted-foreground mt-1">מכשירים שייבאת</p>
              </CardContent>
            </Card>
          )}

          {stats.warrantiesActivated > 0 && (
            <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-green-500">
              <CardHeader className="flex flex-row-reverse items-center justify-between pb-2">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="text-sm font-medium">אחריות</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{stats.warrantiesActivated}</div>
                <p className="text-xs text-muted-foreground mt-1">אחריות שהפעלת</p>
              </CardContent>
            </Card>
          )}

          {stats.repairsHandled > 0 && (
            <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-orange-500">
              <CardHeader className="flex flex-row-reverse items-center justify-between pb-2">
                <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                  <Wrench className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <CardTitle className="text-sm font-medium">תיקונים</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">{stats.repairsHandled}</div>
                <p className="text-xs text-muted-foreground mt-1">תיקונים שטיפלת בהם</p>
              </CardContent>
            </Card>
          )}

          {stats.activeRepairs > 0 && (
            <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-yellow-500">
              <CardHeader className="flex flex-row-reverse items-center justify-between pb-2">
                <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <CardTitle className="text-sm font-medium">תיקונים פעילים</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-600">{stats.activeRepairs}</div>
                <p className="text-xs text-muted-foreground mt-1">תיקונים בתהליך</p>
              </CardContent>
            </Card>
          )}

          {stats.replacementsApproved > 0 && (
            <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-cyan-500">
              <CardHeader className="flex flex-row-reverse items-center justify-between pb-2">
                <div className="h-10 w-10 rounded-full bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <CardTitle className="text-sm font-medium">החלפות אושרו</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-cyan-600">{stats.replacementsApproved}</div>
                <p className="text-xs text-muted-foreground mt-1">בקשות החלפה שאישרת</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <Card className="shadow-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <CardTitle>פעילות אחרונה</CardTitle>
          </div>
          <CardDescription>
            10 הפעולות האחרונות שביצעת במערכת
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>אין פעילות אחרונה</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity, index) => (
                <div key={activity.id}>
                  <div className="flex items-start gap-4">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center ${getActivityColor(activity.type)}`}>
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{activity.action}</p>
                      <p className="text-sm text-muted-foreground truncate">{activity.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true, locale: he })}
                      </p>
                    </div>
                  </div>
                  {index < recentActivity.length - 1 && <Separator className="mt-3" />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
