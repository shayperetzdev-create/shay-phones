'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAllReplacementRequests } from '@/hooks/queries/useReplacements';
import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import {
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Package,
  Wrench,
  FileText,
  MessageSquare,
  Calendar,
  User,
  Phone,
  Building2
} from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/utils';
import { ReplacementsPageSkeleton } from '@/components/ui/loading-skeletons';

type RequestStatus = 'pending' | 'approved' | 'rejected';

export default function ReplacementsPage() {
  // React Query hook with Realtime
  
  const { requests, isLoading, isFetching, refetch } = useAllReplacementRequests();
  // Local state for filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | RequestStatus>('all');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isDecisionDialogOpen, setIsDecisionDialogOpen] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve');
  const [adminNotes, setAdminNotes] = useState('');

  // אופטימיזציה: שמירת user ID לצורך audit logging
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const supabase = createClient();
  const { toast } = useToast();

  const getUserDisplayName = useCallback((user?: { full_name?: string | null; email?: string | null }) => {
    if (!user) return '';
    return user.full_name?.trim() || user.email || '';
  }, []);



  const filteredRequests = useMemo(() => {
    let filtered = requests;
  
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }
  
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (request) =>
          request.device?.imei?.toLowerCase().includes(query) ||
          request.device?.device_model?.model_name?.toLowerCase().includes(query) ||
          getUserDisplayName(request.requester)?.toLowerCase().includes(query) ||
          request.reason?.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [requests, searchQuery, filterStatus, getUserDisplayName]);


  // אופטימיזציה: טעינת user ID פעם אחת בלבד
  useEffect(() => {
    const loadUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    loadUserId();
  }, [supabase]);

  const stats = useMemo(() => {
    const statsData = {
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
      avgProcessTime: 0,
    };
  
    const processedRequests = requests.filter(r => r.resolved_at);
    if (processedRequests.length > 0) {
      const totalTime = processedRequests.reduce((sum, r) => {
        const created = new Date(r.created_at).getTime();
        const resolved = new Date(r.resolved_at!).getTime();
        return sum + (resolved - created);
      }, 0);
      statsData.avgProcessTime = totalTime / processedRequests.length / (1000 * 60 * 60);
    }
    return statsData;
  }, [requests]);

  const handleDecision = async () => {
    if (!selectedRequest) return;
    if (decision === 'reject' && !adminNotes.trim()) {
      toast({
        title: 'שגיאה',
        description: 'יש לציין סיבת דחייה',
        variant: 'destructive',
      });
      return;
    }

    try {
      // אופטימיזציה: משתמש ב-currentUserId במקום getUser()
      if (!currentUserId) throw new Error('משתמש לא מחובר');

      if (decision === 'approve') {
        const { error } = await supabase.rpc('approve_replacement', {
          p_request_id: selectedRequest.id,
          p_admin_notes: adminNotes || null,
        } as any);

        if (error) throw error;

        // --- Audit Log ---
        supabase.from('audit_log').insert({
          actor_user_id: currentUserId,
          action: 'replacement.approve',
          entity_type: 'replacement_request',
          entity_id: selectedRequest.id,
          meta: {
            device_id: selectedRequest.device?.id,
            requester_id: selectedRequest.requester_id,
            admin_notes: adminNotes || null
          }
        }).then(({ error: logError }) => {
          if (logError) console.error('Audit log failed:', logError);
        });
        // --- End Audit Log ---

        toast({
          title: 'הבקשה אושרה',
          description: `ההחלפה עבור ${selectedRequest.device?.device_model?.model_name} (IMEI: ${selectedRequest.device?.imei}) אושרה.`,
        });
      } else {
        const { error } = await supabase.rpc('reject_replacement', {
          p_request_id: selectedRequest.id,
          p_admin_notes: adminNotes,
        } as any);

        if (error) throw error;

        // --- Audit Log ---
        supabase.from('audit_log').insert({
          actor_user_id: currentUserId,
          action: 'replacement.reject',
          entity_type: 'replacement_request',
          entity_id: selectedRequest.id,
          meta: {
            device_id: selectedRequest.device?.id,
            requester_id: selectedRequest.requester_id,
            admin_notes: adminNotes
          }
        }).then(({ error: logError }) => {
          if (logError) console.error('Audit log failed:', logError);
        });
        // --- End Audit Log ---

        toast({
          title: 'הבקשה נדחתה',
          description: `ההחלפה עבור ${selectedRequest.device?.device_model?.model_name} (IMEI: ${selectedRequest.device?.imei}) נדחתה.`,
          variant: 'destructive',
        });
      }

      setIsDecisionDialogOpen(false);
      setAdminNotes('');
      // React Query + Realtime will auto-refresh
    } catch (error) {
      console.error('Error processing decision:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בעיבוד הבקשה',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: RequestStatus) => {
    const variants = {
      pending: { variant: 'outline' as const, text: 'ממתין' },
      approved: { variant: 'default' as const, text: 'אושר' },
      rejected: { variant: 'destructive' as const, text: 'נדחה' },
    };
    const config = variants[status];
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  const getPriorityBadge = (createdAt: string, status: RequestStatus) => {
    if (status !== 'pending') return null;

    const created = new Date(createdAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 48) {
      return <Badge variant="destructive">דחוף</Badge>;
    } else if (hoursDiff > 24) {
      return <Badge variant="outline">בינוני</Badge>;
    }
    return <Badge variant="secondary">רגיל</Badge>;
  };

  const getRequesterTypeBadge = (role?: string) => {
    if (!role) return null;
    const config = {
      store: { text: 'חנות', variant: 'outline' as const },
      lab: { text: 'מעבדה', variant: 'secondary' as const },
      admin: { text: 'מנהל', variant: 'default' as const },
    };
    const roleConfig = config[role as keyof typeof config];
    if (!roleConfig) return null;
    return <Badge variant={roleConfig.variant}>{roleConfig.text}</Badge>;
  };

  if (isLoading) {
    return <ReplacementsPageSkeleton />;
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Background refresh indicator */}
      <BackgroundRefreshIndicator
        isFetching={isFetching}
        isLoading={isLoading}
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">בקשות החלפה</h1>
          <p className="text-muted-foreground">
            ניהול ואישור בקשות החלפת מכשירים
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-blue-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-sm font-medium">סה"כ בקשות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-orange-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <CardTitle className="text-sm font-medium">ממתינות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
            {stats.pending > 0 && (
              <p className="text-xs text-muted-foreground font-medium">דורש טיפול</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-green-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-sm font-medium">אושרו</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-red-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-sm font-medium">נדחו</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-purple-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <CardTitle className="text-sm font-medium">זמן טיפול ממוצע</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.avgProcessTime.toFixed(1)}ש'</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>בקשות החלפה</CardTitle>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              רענן
              <RefreshCw className="h-4 w-4 ms-2" />
            </Button>
          </div>
          <div className="flex gap-4 mt-4">
            <select
              title="בחר סטטוס"
              className="px-3 py-2 border rounded-md"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
            >
              <option value="all">כל הסטטוסים</option>
              <option value="pending">ממתין</option>
              <option value="approved">אושר</option>
              <option value="rejected">נדחה</option>
            </select>

            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="חיפוש לפי IMEI, דגם, מבקש או סיבה..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>מכשיר</TableHead>
                <TableHead>מבקש</TableHead>
                <TableHead>סיבה</TableHead>
                <TableHead>תאריך</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>דחיפות</TableHead>
                <TableHead>מטופל ע"י</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{request.device?.device_model?.model_name}</div>
                      <div className="text-xs text-muted-foreground">{request.device?.imei}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{getUserDisplayName(request.requester) || 'ללא שם'}</span>
                        {getRequesterTypeBadge(request.requester?.role)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {request.requester?.email || ''}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px]">
                      <p className="text-sm truncate">{request.reason}</p>
                      {request.repair && (
                        <Badge variant="outline" className="mt-1">
                          תיקון: {request.repair.fault_type}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {formatDate(request.created_at)}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell>
                    {getPriorityBadge(request.created_at, request.status)}
                  </TableCell>
                  <TableCell>
                    {request.resolver ? (
                      <div className="text-sm">
                        <div>{request.resolver.full_name}</div>
                        {request.resolved_at && (
                          <div className="text-xs text-muted-foreground">
                            {formatDate(request.resolved_at)}
                          </div>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedRequest(request);
                          setIsDetailsDialogOpen(true);
                        }}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>

                      {request.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedRequest(request);
                              setDecision('approve');
                              setIsDecisionDialogOpen(true);
                            }}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedRequest(request);
                              setDecision('reject');
                              setIsDecisionDialogOpen(true);
                            }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredRequests.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              לא נמצאו בקשות מתאימות
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDecisionDialogOpen} onOpenChange={setIsDecisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision === 'approve' ? 'אישור בקשת החלפה' : 'דחיית בקשת החלפה'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <div className="mt-2">
                  <p>מכשיר: {selectedRequest.device?.device_model?.model_name}</p>
                  <p>IMEI: {selectedRequest.device?.imei}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>הערות מנהל</Label>
              <textarea
                className="w-full px-3 py-2 border rounded-md mt-1 min-h-[100px]"
                placeholder={decision === 'approve' ? 'הערות לאישור...' : 'סיבת הדחייה (חובה)...'}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>

            {decision === 'approve' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>שים לב</AlertTitle>
                <AlertDescription>
                  אישור הבקשה ישנה את סטטוס המכשיר ל"הוחלף"
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDecisionDialogOpen(false)}>
              ביטול
            </Button>
            <Button
              onClick={handleDecision}
              variant={decision === 'approve' ? 'default' : 'destructive'}
              disabled={decision === 'reject' && !adminNotes}
            >
              {decision === 'approve' ? 'אשר החלפה' : 'דחה בקשה'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>פרטי בקשת החלפה</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>מכשיר</Label>
                  <p className="font-medium">{selectedRequest.device?.device_model?.model_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedRequest.device?.imei}</p>
                </div>
                <div>
                  <Label>סטטוס</Label>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
                <div>
                  <Label>מבקש</Label>
                  <p className="font-medium">{getUserDisplayName(selectedRequest.requester) || '-'}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedRequest.requester?.email || ''}
                  </p>
                </div>
                <div>
                  <Label>תאריך הגשה</Label>
                  <p className="font-medium">{formatDateTime(selectedRequest.created_at)}</p>
                </div>

                {selectedRequest.repair && (
                  <>
                    <div>
                      <Label>תקלה קשורה</Label>
                      <p className="font-medium">{selectedRequest.repair.fault_type}</p>
                    </div>
                    <div>
                      <Label>מעבדה מטפלת</Label>
                      <p className="font-medium">{getUserDisplayName(selectedRequest.repair.lab) || 'לא צוין'}</p>
                    </div>
                  </>
                )}

                {selectedRequest.resolver && (
                  <>
                    <div>
                      <Label>טופל על ידי</Label>
                      <p className="font-medium">{selectedRequest.resolver.full_name}</p>
                    </div>
                    <div>
                      <Label>תאריך טיפול</Label>
                      <p className="font-medium">
                        {selectedRequest.resolved_at && formatDateTime(selectedRequest.resolved_at)}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div>
                <Label>סיבת הבקשה</Label>
                <p className="mt-1 p-3 bg-muted rounded">{selectedRequest.reason}</p>
              </div>

              {selectedRequest.admin_notes && (
                <div>
                  <Label>הערות מנהל</Label>
                  <p className="mt-1 p-3 bg-muted rounded">{selectedRequest.admin_notes}</p>
                </div>
              )}

              {selectedRequest.repair?.fault_description && (
                <div>
                  <Label>תיאור התקלה</Label>
                  <p className="mt-1 p-3 bg-muted rounded">{selectedRequest.repair.fault_description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsDetailsDialogOpen(false)}>
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}