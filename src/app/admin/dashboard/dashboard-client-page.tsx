'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAdminDashboardStats } from '@/hooks/queries/useAdminDashboard';
import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QuickLinkCard } from '@/components/admin/quick-link-card';
import { SettingCard } from '@/components/admin/setting-card';
import { DeviceModelsDialog } from '@/components/admin/device-models-dialog';
import { RepairTypesDialog } from '@/components/admin/repair-types-dialog';
import { LabRepairPricesDialog } from '@/components/admin/lab-repair-prices-dialog';
import { ComingSoonDialog } from '@/components/admin/coming-soon-dialog';
import ShekelIcon from '@/components/ui/shekel-icon';
import {
  Package,
  Shield,
  Wrench,
  RefreshCw,
  XCircle,
  Users,
  Store,
  BarChart3,
  Smartphone,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { DashboardSkeleton } from '@/components/ui/loading-skeletons';

type DeviceStatus = 'new' | 'active' | 'expired' | 'replaced';

interface Stats {
  total: number;
  new: number;
  active: number;
  expired: number;
  replaced: number;
  inRepair: number;
}

export default function AdminDashboard() {
  // React Query hook with Realtime subscriptions
  const { stats, isLoading, isFetching } = useAdminDashboardStats();

  const [isModelsDialogOpen, setIsModelsDialogOpen] = useState(false);
  const [isRepairTypesDialogOpen, setIsRepairTypesDialogOpen] = useState(false);
  const [isLabPricesDialogOpen, setIsLabPricesDialogOpen] = useState(false);
  const [comingSoonDialog, setComingSoonDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    features: string[];
  }>({
    open: false,
    title: '',
    description: '',
    features: [],
  });

  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const dialog = searchParams.get('dialog');
    if (dialog) {
      if (dialog === 'models') setIsModelsDialogOpen(true);
      else if (dialog === 'repair-types') setIsRepairTypesDialogOpen(true);
      else if (dialog === 'lab-prices') setIsLabPricesDialogOpen(true);
    }
  }, [searchParams]);

  const handleModelsOpenChange = (open: boolean) => {
    setIsModelsDialogOpen(open);
    if (!open) {
      router.push('/admin/dashboard', { scroll: false });
    }
  };

  const handleRepairTypesOpenChange = (open: boolean) => {
    setIsRepairTypesDialogOpen(open);
    if (!open) {
      router.push('/admin/dashboard', { scroll: false });
    }
  };

  const handleLabPricesOpenChange = (open: boolean) => {
    setIsLabPricesDialogOpen(open);
    if (!open) {
      router.push('/admin/dashboard', { scroll: false });
    }
  };

  const showComingSoon = (
    title: string,
    description: string,
    features: string[] = []
  ) => {
    setComingSoonDialog({
      open: true,
      title,
      description,
      features,
    });
  };


  if (isLoading && !searchParams.get('dialog')) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Background refresh indicator */}
      <BackgroundRefreshIndicator
        isFetching={isFetching}
        isLoading={isLoading}
      />

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">דשבורד ניהול</h1>
          <p className="text-muted-foreground">
            סטטיסטיקות ומצב כללי של המערכת
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-blue-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between pb-2">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-sm font-medium">סה&quot;כ מכשירים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-gray-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between pb-2">
            <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
              <Package className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
            <CardTitle className="text-sm font-medium">חדשים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-600">{stats.new}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-green-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between pb-2">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-sm font-medium">אחריות פעילה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-red-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between pb-2">
            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-sm font-medium">אחריות פגה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.expired}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-purple-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between pb-2">
            <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <CardTitle className="text-sm font-medium">הוחלפו</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{stats.replaced}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-orange-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between pb-2">
            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
              <Wrench className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <CardTitle className="text-sm font-medium">בתיקון</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.inRepair}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links Section */}
      <section className="space-y-4" aria-labelledby="quick-links-heading">
        <div>
          <h2 id="quick-links-heading" className="text-2xl font-bold tracking-tight">קישורים מהירים</h2>
          <p className="text-muted-foreground">
            גישה מהירה לכל העמודים העיקריים במערכת
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" role="list">
          <QuickLinkCard
            className=""
            title="מכשירים"
            description="ניהול מלאי מכשירים, ייבוא והחלפות"
            icon={Package}
            href="/admin/devices"
            iconColor="text-blue-600"
          />
          <QuickLinkCard
            className=""
            title="אחריות"
            description="הפעלת אחריות, מעקב ותוקף"
            icon={Shield}
            href="/admin/warranties"
            iconColor="text-green-600"
          />
          <QuickLinkCard
            className=""
            title="משתמשים"
            description="ניהול משתמשים והרשאות"
            icon={Users}
            href="/admin/users"
            iconColor="text-purple-600"
          />
          <QuickLinkCard
            className=""
            title="חנויות"
            description="ניהול חנויות ומשתמשי חנויות"
            icon={Store}
            href="/admin/stores"
            iconColor="text-orange-600"
          />
          <QuickLinkCard
            className=""
            title="מעבדות"
            description="ניהול מעבדות ותיקונים"
            icon={Wrench}
            href="/admin/labs"
            iconColor="text-red-600"
          />
          <QuickLinkCard
            className=""
            title="דוחות"
            description="דוחות וסטטיסטיקות מפורטות"
            icon={BarChart3}
            href="/admin/reports"
            iconColor="text-cyan-600"
          />
        </div>
      </section>

      {/* Quick Settings Section */}
      <section className="space-y-4" aria-labelledby="quick-settings-heading">
        <div>
          <h2 id="quick-settings-heading" className="text-2xl font-bold tracking-tight">הגדרות מהירות</h2>
          <p className="text-muted-foreground">
            נהל הגדרות מערכת בסיסיות ישירות מהדשבורד
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" role="list">
          <SettingCard
            title="ניהול דגמים"
            description="הוסף וערוך דגמי מכשירים ומשך אחריות"
            icon={Smartphone}
            onClick={() => setIsModelsDialogOpen(true)}
          />
          <SettingCard
            title="סוגי תיקונים"
            description="נהל את רשימת סוגי התיקונים האפשריים"
            icon={Wrench}
            onClick={() => setIsRepairTypesDialogOpen(true)}
          />
          <SettingCard
            title="מחירי תיקונים למעבדות"
            description="הגדר מחירים לכל מעבדה לפי סוג תיקון"
            icon={ShekelIcon}
            onClick={() => setIsLabPricesDialogOpen(true)}
          />
        </div>
      </section>

      {/* Dialogs */}
      <DeviceModelsDialog
        open={isModelsDialogOpen}
        onOpenChange={handleModelsOpenChange}
      />
      <RepairTypesDialog
        open={isRepairTypesDialogOpen}
        onOpenChange={handleRepairTypesOpenChange}
      />
      <LabRepairPricesDialog
        open={isLabPricesDialogOpen}
        onOpenChange={handleLabPricesOpenChange}
      />
      <ComingSoonDialog
        open={comingSoonDialog.open}
        onOpenChange={(open) =>
          setComingSoonDialog((prev) => ({ ...prev, open }))
        }
        title={comingSoonDialog.title}
        description={comingSoonDialog.description}
        features={comingSoonDialog.features}
      />
    </div>
  );
}