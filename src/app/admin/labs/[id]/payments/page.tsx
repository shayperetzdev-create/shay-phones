'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { ArrowRight, FileText, Calendar, TrendingUp, Wallet, Download, RefreshCw } from 'lucide-react';
import ShekelIcon from '@/components/ui/shekel-icon';
import { formatDate, formatCurrency, cn } from '@/lib/utils';

interface Lab {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface Repair {
  id: string;
  cost: number;
  completed_at: string;
  device: {
    imei: string;
    device_models?: {
      model_name: string;
    } | null;
  } | null;
  repair_type?: {
    name: string;
  } | null;
}

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

export default function AdminLabPaymentsPage() {
  const params = useParams();
  const router = useRouter();
  const labId = params.id as string;

  const [lab, setLab] = useState<Lab | null>(null);
  const [completedRepairs, setCompletedRepairs] = useState<Repair[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    reference: '',
    notes: '',
  });

  const supabase = createClient();
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get lab details
      const { data: labData, error: labError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('id', labId)
        .eq('role', 'lab')
        .single();

      if (labError) throw labError;
      setLab(labData);

      // Get all completed repairs
      const { data: repairsData } = await supabase
        .from('repairs')
        .select(`
          id,
          cost,
          completed_at,
          device:devices!repairs_device_id_fkey(
            imei,
            device_models!devices_model_id_fkey(model_name)
          ),
          repair_type:repair_types!repairs_repair_type_id_fkey(name)
        `)
        .eq('lab_id', labId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      setCompletedRepairs((repairsData || []) as any);

      // Get all payments
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('lab_id', labId)
        .order('payment_date', { ascending: false });

      setPayments((paymentsData || []) as any);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את הנתונים',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [supabase, labId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate balance
  const totalEarned = completedRepairs.reduce((sum, repair) => sum + (repair.cost || 0), 0);
  const totalPaid = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
  const balance = totalEarned - totalPaid;

  // Calculate this month
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const thisMonthEarned = completedRepairs
    .filter(r => r.completed_at?.startsWith(currentMonth))
    .reduce((sum, r) => sum + (r.cost || 0), 0);

  const handleAddPayment = async () => {
    try {
      // Validation
      if (!paymentForm.amount || !paymentForm.payment_date) {
        toast({
          title: 'שגיאה',
          description: 'יש למלא את כל השדות החובה',
          variant: 'destructive',
        });
        return;
      }

      const amount = parseFloat(paymentForm.amount);
      if (isNaN(amount) || amount <= 0) {
        toast({
          title: 'שגיאה',
          description: 'סכום התשלום חייב להיות מספר חיובי',
          variant: 'destructive',
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      // Insert payment directly - simple!
      const { error: paymentError } = await (supabase
        .from('payments') as any)
        .insert({
          lab_id: labId,
          amount: amount,
          payment_date: paymentForm.payment_date,
          reference: paymentForm.reference || null,
          notes: paymentForm.notes || null,
          created_by: user?.id || null,
        });

      if (paymentError) throw paymentError;

      toast({
        title: 'הצלחה',
        description: 'התשלום נרשם בהצלחה',
      });

      setIsPaymentDialogOpen(false);
      setPaymentForm({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        reference: '',
        notes: '',
      });
      loadData();
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לרשום את התשלום',
        variant: 'destructive',
      });
    }
  };

  const exportToCSV = () => {
    const csv = [
      ['תאריך', 'IMEI', 'דגם', 'סוג תיקון', 'עלות'],
      ...completedRepairs.map(r => [
        formatDate(r.completed_at),
        (r.device as any)?.imei || '',
        (r.device as any)?.device_models?.model_name || '',
        (r.repair_type as any)?.name || '',
        (r.cost || 0).toString(),
      ]),
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `lab_repairs_${labId}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!lab) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">מעבדה לא נמצאה</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => router.push('/admin/payments')}
          className="mb-4"
        >
          <ArrowRight className="ms-2 h-4 w-4" />
          חזרה לסקירת תשלומים
        </Button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">תשלומים - {lab.full_name}</h1>
            <p className="text-muted-foreground">{lab.email}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadData} variant="outline">
              רענן
              <RefreshCw className="ms-2 h-4 w-4" />
            </Button>
            <Button onClick={exportToCSV} variant="outline">
              ייצוא
              <Download className="ms-2 h-4 w-4" />
            </Button>
            <Button onClick={() => setIsPaymentDialogOpen(true)}>
              רשום תשלום
              <ShekelIcon className="ms-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <CardTitle className="text-sm font-medium">סה"כ עלות תיקונים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right text-green-600">{formatCurrency(totalEarned)}</div>
            <p className="text-xs text-muted-foreground">
              {completedRepairs.length} תיקונים שהושלמו
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
            <ShekelIcon className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-sm font-medium">סה"כ שילמת</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right text-blue-600">{formatCurrency(totalPaid)}</div>
            <p className="text-xs text-muted-foreground">
              {payments.length} תשלומים
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
            <Wallet className="h-4 w-4 text-orange-600" />
            <CardTitle className="text-sm font-medium">יתרה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold text-right",
              balance > 0 ? "text-orange-600" : balance < 0 ? "text-green-600" : "text-gray-600"
            )}>
              {formatCurrency(Math.abs(balance))}
            </div>
            <p className="text-xs text-muted-foreground">
              {balance > 0 ? 'אתה חייב למעבדה' : balance < 0 ? 'המעבדה בפלוס!' : 'מעודכן'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2" dir="rtl">
            <Calendar className="h-4 w-4 text-purple-600" />
            <CardTitle className="text-sm font-medium">החודש</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-right text-purple-600">{formatCurrency(thisMonthEarned)}</div>
            <p className="text-xs text-muted-foreground">
             עלויות התיקונים החודש
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="repairs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="repairs">
            תיקונים ({completedRepairs.length})
            <FileText className="ms-2 h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="payments">
            תשלומים ({payments.length})
            <ShekelIcon className="ms-2 h-4 w-4" />
          </TabsTrigger>
        </TabsList>

        {/* Completed Repairs Tab */}
        <TabsContent value="repairs">
          <Card>
            <CardHeader>
              <CardTitle>תיקונים שהושלמו</CardTitle>
              <CardDescription>
                כל התיקונים שהושלמו על ידי מעבדה זו
              </CardDescription>
            </CardHeader>
            <CardContent>
              {completedRepairs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>אין תיקונים שהושלמו</p>
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
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(repair.completed_at)}
                          </div>
                        </TableCell>
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
              <CardTitle>תשלומים שנרשמו</CardTitle>
              <CardDescription>
                כל התשלומים שהעברת למעבדה זו
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShekelIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>אין תשלומים רשומים</p>
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

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>רישום תשלום חדש</DialogTitle>
            <DialogDescription>
              רשום תשלום למעבדה {lab.full_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Show current balance for reference */}
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="text-sm text-muted-foreground">יתרה נוכחית</div>
              <div className={cn(
                "text-2xl font-bold",
                balance > 0 ? "text-orange-600" : balance < 0 ? "text-green-600" : "text-gray-600"
              )}>
                {formatCurrency(Math.abs(balance))}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {balance > 0 ? 'אתה חייב למעבדה' : balance < 0 ? 'המעבדה בפלוס!' : 'מעודכן'}
              </div>
            </div>

            <div>
              <Label htmlFor="amount">סכום התשלום *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                className="mt-1 text-lg"
              />
              <p className="text-xs text-muted-foreground mt-1">
                ניתן להזין כל סכום, גם יותר מהיתרה
              </p>
            </div>

            <div>
              <Label htmlFor="payment_date">תאריך תשלום *</Label>
              <Input
                id="payment_date"
                type="date"
                value={paymentForm.payment_date}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="reference">אסמכתא</Label>
              <Input
                id="reference"
                placeholder="מספר צ'ק / העברה"
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="notes">הערות</Label>
              <Textarea
                id="notes"
                placeholder="הערות נוספות..."
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                rows={3}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsPaymentDialogOpen(false);
                setPaymentForm({
                  amount: '',
                  payment_date: new Date().toISOString().split('T')[0],
                  reference: '',
                  notes: '',
                });
              }}
            >
              ביטול
            </Button>
            <Button onClick={handleAddPayment}>
              רשום תשלום
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
