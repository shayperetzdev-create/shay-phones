'use client';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLabDashboardStats, useLabRecentRepairs, useLabUrgentRepairs } from '@/hooks/queries/useLabDashboard';
import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';
import { LabDashboardSkeleton } from '@/components/ui/loading-skeletons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ShekelIcon from '@/components/ui/shekel-icon';
import {
  Wrench,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  LayoutDashboard
} from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function LabDashboardPage() {
  // Get current user (lab)
  const { user: currentUser, isLoading: isUserLoading } = useCurrentUser();
  const labId = currentUser?.id || null;

  // React Query hooks with Realtime subscriptions
  const { stats, isLoading: isStatsLoading, isFetching: isStatsFetching } = useLabDashboardStats();
  const { repairs: recentRepairs, isLoading: isRecentLoading, isFetching: isRecentFetching } = useLabRecentRepairs(labId);
  const { repairs: urgentRepairs, isLoading: isUrgentLoading, isFetching: isUrgentFetching } = useLabUrgentRepairs(labId);

  const isLoading = isUserLoading || isStatsLoading || isRecentLoading || isUrgentLoading;
  const isFetching = isStatsFetching || isRecentFetching || isUrgentFetching;

  const router = useRouter();

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      received: { label: 'התקבל', variant: 'secondary' as const },
      in_progress: { label: 'בטיפול', variant: 'default' as const },
      completed: { label: 'הושלם', variant: 'outline' as const },
      replacement_requested: { label: 'בקשת החלפה', variant: 'destructive' as const },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getFaultTypeLabel = (type?: string | null) => {
    if (!type) return 'לא צוין';
    const labels: Record<string, string> = {
      screen: 'מסך',
      charging_port: 'שקע טעינה',
      flash: 'פנס',
      speaker: 'רמקול',
      board: 'לוח אם',
      other: 'אחר',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return <LabDashboardSkeleton />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" dir="rtl">
      {/* Background refresh indicator */}
      <BackgroundRefreshIndicator
        isFetching={isFetching}
        isLoading={isLoading}
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <LayoutDashboard className="h-7 w-7 text-primary" />
            לוח בקרה - מעבדה
          </h1>
          <p className="text-muted-foreground mt-1">סקירה כללית של תיקונים ופעילות</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-blue-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between pb-2">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-sm font-medium">תיקונים בהמתנה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.pendingRepairs}</div>
            <p className="text-xs text-muted-foreground mt-1">ממתינים לטיפול</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-orange-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between pb-2">
            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
              <Wrench className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <CardTitle className="text-sm font-medium">בטיפול</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.inProgressRepairs}</div>
            <p className="text-xs text-muted-foreground mt-1">תיקונים פעילים</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-green-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between pb-2">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-sm font-medium">הושלמו היום</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.completedToday}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.monthlyCompleted} החודש
            </p>
          </CardContent>
        </Card>
      
        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-purple-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between pb-2">
            <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <ShekelIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <CardTitle className="text-sm font-medium">הכנסות חודשיות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <ShekelIcon className="h-6 w-6 text-purple-600 inline-block mb-1" />
              <div className="text-3xl font-bold text-purple-600">
                {stats.monthlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ממוצע: {formatCurrency(stats.monthlyCompleted > 0 ? stats.monthlyRevenue / stats.monthlyCompleted : 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-row-reverse items-center justify-between">
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400"/>
              </div>
              <CardTitle className="text-sm font-medium">זמן תיקון ממוצע</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">
              {stats.averageRepairTime.toFixed(1)} <span className="text-lg text-muted-foreground">שעות</span>
            </div>
            <Progress 
              value={Math.min((24 / stats.averageRepairTime) * 100, 100)} 
              className="h-2"
            />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-row-reverse items-center justify-between">
              <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-sm font-medium">שיעור השלמה</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">
              {stats.completionRate.toFixed(1)}<span className="text-lg text-muted-foreground">%</span>
            </div>
            <Progress 
              value={stats.completionRate} 
              className="h-2"
            />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-row-reverse items-center justify-between">
              <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <CardTitle className="text-sm font-medium">תקלה נפוצה ביותר</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.topFaultType ? getFaultTypeLabel(stats.topFaultType) : 'אין נתונים'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              החודש
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Urgent Repairs Alert */}
      {urgentRepairs.length > 0 && (
        <Alert variant="destructive" className="shadow-sm border-r-4 border-r-red-600">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <AlertDescription className="text-base font-medium">
                יש {urgentRepairs.length} תיקונים דחופים הממתינים למעלה מ-48 שעות!
              </AlertDescription>
              <p className="text-sm mt-1 opacity-90">
                מומלץ לטפל בהם בהקדם האפשרי
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/lab/repairs')}
              className="bg-white hover:bg-red-50"
            >
              צפה בתיקונים
            </Button>
          </div>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Repairs */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  תיקונים אחרונים
                </CardTitle>
                <CardDescription>5 התיקונים האחרונים שהתקבלו</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => router.push('/lab/repairs')}
              >
                צפה בכל התיקונים
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentRepairs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wrench className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>אין תיקונים אחרונים</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentRepairs.map((repair) => (
                  <div 
                    key={repair.id} 
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => router.push('/lab/repairs')}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{repair.device?.device_models?.model_name || 'מכשיר לא ידוע'}</div>
                      <div className="text-sm text-muted-foreground">
                        {getFaultTypeLabel(repair.fault_type)} • {repair.created_at ? formatDate(repair.created_at) : 'לא ידוע'}
                      </div>
                    </div>
                    {getStatusBadge(repair.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Urgent Repairs */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  תיקונים דחופים
                </CardTitle>
                <CardDescription>מעל 48 שעות בהמתנה</CardDescription>
              </div>
              {urgentRepairs.length > 0 && (
                <Badge variant="destructive" className="text-base px-3 py-1">
                  {urgentRepairs.length}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {urgentRepairs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p className="font-medium">מצוין! אין תיקונים דחופים</p>
                <p className="text-sm mt-1">כל התיקונים מטופלים בזמן</p>
              </div>
            ) : (
              <div className="space-y-3">
                {urgentRepairs.map((repair) => {
                  const hoursWaiting = repair.created_at ? Math.floor((Date.now() - new Date(repair.created_at).getTime()) / (1000 * 60 * 60)) : 0;
                  return (
                    <div 
                      key={repair.id} 
                      className="flex items-center gap-3 p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-900 transition-colors cursor-pointer"
                      onClick={() => router.push('/lab/repairs')}
                    >
                      <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{repair.device?.device_models?.model_name || 'מכשיר לא ידוע'}</div>
                        <div className="text-sm text-muted-foreground">
                          {getFaultTypeLabel(repair.fault_type)}
                        </div>
                      </div>
                      <Badge variant="destructive" className="text-sm">
                        {hoursWaiting} שעות
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}