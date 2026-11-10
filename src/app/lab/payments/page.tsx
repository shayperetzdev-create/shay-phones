'use client';

import { useMemo } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLabCompletedRepairs, useLabPayments } from '@/hooks/queries/useLabPayments';
import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  TrendingUp,
  Wallet,
  FileText,
  RefreshCw,
  CheckCircle,
  Clock
} from 'lucide-react';
import ShekelIcon from '@/components/ui/shekel-icon';
import { formatDate, formatCurrency } from '@/lib/utils';

export default function LabPaymentsPage() {
  // React Query hooks with Realtime
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const labId = user?.id || null;
  const { repairs: completedRepairs, isLoading: isRepairsLoading, isFetching: isRepairsFetching } = useLabCompletedRepairs(labId);
  const { payments, isLoading: isPaymentsLoading, isFetching: isPaymentsFetching } = useLabPayments(labId);

  const isLoading = isUserLoading || isRepairsLoading || isPaymentsLoading;
  const isFetching = isRepairsFetching || isPaymentsFetching;

  // Calculate stats (memoized for performance)
  const stats = useMemo(() => {
    const totalEarned = completedRepairs.reduce((sum, repair) => sum + (repair.cost || 0), 0);
    const totalPaid = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const balance = totalEarned - totalPaid;

    // Calculate this month
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const thisMonthEarned = completedRepairs
      .filter(r => r.completed_at?.startsWith(currentMonth))
      .reduce((sum, r) => sum + (r.cost || 0), 0);

    const lastPaymentDate = payments[0]?.payment_date || null;

    return {
      totalEarned,
      totalPaid,
      balance,
      thisMonthEarned,
      lastPaymentDate,
    };
  }, [completedRepairs, payments]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Background refresh indicator */}
      <BackgroundRefreshIndicator
        isFetching={isFetching}
        isLoading={isLoading}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">תשלומים</h1>
          <p className="text-muted-foreground">צפייה ביתרה ותשלומים</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <CardTitle className="text-sm font-medium">סה"כ הכנסות מתיקונים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right text-green-600">{formatCurrency(stats.totalEarned)}</div>
            <p className="text-xs text-muted-foreground text-right">
              {completedRepairs.length} תיקונים שהושלמו
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <ShekelIcon className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-sm font-medium">סה"כ קיבלת</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right text-blue-600">{formatCurrency(stats.totalPaid)}</div>
            <p className="text-xs text-muted-foreground text-right">
              {payments.length} תשלומים
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <Wallet className="h-4 w-4 text-orange-600" />
            <CardTitle className="text-sm font-medium">יתרה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold text-right ${stats.balance > 0 ? 'text-orange-600' : stats.balance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
              {formatCurrency(Math.abs(stats.balance))}
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {stats.balance > 0 ? 'המנהל חייב לך' : stats.balance < 0 ? 'אתה בפלוס!' : 'מעודכן'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <Calendar className="h-4 w-4 text-purple-600" />
            <CardTitle className="text-sm font-medium">החודש</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right text-purple-600">{formatCurrency(stats.thisMonthEarned)}</div>
            <p className="text-xs text-muted-foreground text-right">
              {stats.lastPaymentDate ? `תשלום אחרון: ${formatDate(stats.lastPaymentDate)}` : 'אין תשלומים'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="repairs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="repairs">
            <FileText className="ms-2 h-4 w-4" />
            תיקונים ({completedRepairs.length})
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CheckCircle className="ms-2 h-4 w-4" />
            תשלומים ({payments.length})
          </TabsTrigger>
        </TabsList>

        {/* Completed Repairs Tab */}
        <TabsContent value="repairs">
          <Card>
            <CardHeader>
              <CardTitle>תיקונים שהושלמו</CardTitle>
              <CardDescription>
                כל התיקונים שהושלמו ועלותם
              </CardDescription>
            </CardHeader>
            <CardContent>
              {completedRepairs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>עדיין לא השלמת תיקונים</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>תאריך השלמה</TableHead>
                      <TableHead>מכשיר</TableHead>
                      <TableHead>IMEI</TableHead>
                      <TableHead>סוג תיקון</TableHead>
                      <TableHead className="text-left">עלות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedRepairs.map((repair) => (
                      <TableRow key={repair.id}>
                        <TableCell>{formatDate(repair.completed_at)}</TableCell>
                        <TableCell>
                          {(repair.device as any)?.device_models?.model_name || 'לא ידוע'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {(repair.device as any)?.imei || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {(repair.repair_type as any)?.name || 'לא צוין'}
                        </TableCell>
                        <TableCell className="text-left font-bold text-green-600">
                          {formatCurrency(repair.cost || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>תשלומים שהתקבלו</CardTitle>
              <CardDescription>
                כל התשלומים שהמנהל העביר אליך
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShekelIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>עדיין לא קיבלת תשלומים</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>תאריך</TableHead>
                      <TableHead>סכום</TableHead>
                      <TableHead>אסמכתא</TableHead>
                      <TableHead>הערות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>{formatDate(payment.payment_date)}</TableCell>
                        <TableCell>
                          <span className="font-bold text-blue-600 text-lg">
                            {formatCurrency(payment.amount)}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {payment.reference || '-'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {payment.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
