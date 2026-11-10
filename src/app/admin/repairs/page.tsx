'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAllRepairs } from '@/hooks/queries/useRepairs';
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
import { useToast } from '@/components/ui/use-toast';
import {
  Wrench,
  Search,
  Filter,
  Building2,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Phone,
  User,
  Calendar,
  FileText,
  TrendingUp,
  Package
} from 'lucide-react';
import ShekelIcon from '@/components/ui/shekel-icon';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils';

type RepairStatus = 'received' | 'in_progress' | 'completed' | 'replacement_requested';
type FaultType = 'screen' | 'charging_port' | 'flash' | 'speaker' | 'board' | 'other';

export default function RepairsPage() {
  // React Query hooks with Realtime subscriptions
  const { repairs, isLoading: isRepairsLoading, isFetching, refetch: refetchRepairs } = useAllRepairs();
  const isLoading = isRepairsLoading;

  const [filteredRepairs, setFilteredRepairs] = useState<any[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | RepairStatus>('all');
  const [filterLab, setFilterLab] = useState<string>('all');
  const [filterRepairType, setFilterRepairType] = useState<string>('all');
  const [filterDeviceModel, setFilterDeviceModel] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [selectedRepair, setSelectedRepair] = useState<any>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedLabId, setSelectedLabId] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    received: 0,
    in_progress: 0,
    completed: 0,
    replacement_requested: 0,
    avgRepairTime: 0,
    totalCost: 0,
  });

  const supabase = createClient();
  const { toast } = useToast();

  // Fetch labs on mount
  useEffect(() => {
    const fetchLabs = async () => {
      const { data: labsData } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'lab');
      setLabs(labsData || []);
    };
    fetchLabs();
  }, [supabase]);

  const filterRepairs = useCallback(() => {
    let filtered = repairs;

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    // Filter by lab
    if (filterLab !== 'all') {
      filtered = filtered.filter(r => r.lab_id === filterLab);
    }

    // Filter by repair type
    if (filterRepairType !== 'all') {
      filtered = filtered.filter(r => r.repair_type?.id === filterRepairType);
    }

    // Filter by device model
    if (filterDeviceModel !== 'all') {
      filtered = filtered.filter(r => r.device?.device_model?.model_name === filterDeviceModel);
    }

    // Filter by date range
    if (filterDateFrom) {
      filtered = filtered.filter(r => r.created_at && r.created_at >= filterDateFrom);
    }

    if (filterDateTo) {
      filtered = filtered.filter(r => r.created_at && r.created_at <= filterDateTo + 'T23:59:59');
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (repair) =>
          repair.device?.imei?.toLowerCase().includes(query) ||
          repair.device?.device_model?.model_name?.toLowerCase().includes(query) ||
          repair.customer_name?.toLowerCase().includes(query) ||
          repair.customer_phone?.includes(query) ||
          repair.lab?.full_name?.toLowerCase().includes(query) ||
          repair.lab?.email?.toLowerCase().includes(query)
      );
    }

    setFilteredRepairs(filtered);
  }, [repairs, searchQuery, filterStatus, filterLab, filterRepairType, filterDeviceModel, filterDateFrom, filterDateTo]);

  const calculateStats = useCallback(() => {
    const stats = {
      total: filteredRepairs.length,
      received: filteredRepairs.filter(r => r.status === 'received').length,
      in_progress: filteredRepairs.filter(r => r.status === 'in_progress').length,
      completed: filteredRepairs.filter(r => r.status === 'completed').length,
      replacement_requested: filteredRepairs.filter(r => r.status === 'replacement_requested').length,
      avgRepairTime: 0,
      totalCost: filteredRepairs.reduce((sum, r) => sum + (r.cost || 0), 0),
    };

    // Calculate average repair time
    const completedRepairs = filteredRepairs.filter(r => r.completed_at);
    if (completedRepairs.length > 0) {
      const totalHours = completedRepairs.reduce((sum, r) => {
        const start = new Date(r.created_at);
        const end = new Date(r.completed_at);
        return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }, 0);
      stats.avgRepairTime = totalHours / completedRepairs.length;
    }

    setStats(stats);
  }, [filteredRepairs]);

  useEffect(() => {
    filterRepairs();
  }, [filterRepairs]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  const handleAssignLab = async () => {
    if (!selectedRepair || !selectedLabId) return;

    try {
      const { error } = await (supabase as any)
        .from('repairs')
        .update({
          lab_id: selectedLabId,
          status: 'received'
        } as any)
        .eq('id', selectedRepair.id);

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: 'התיקון הוקצה למעבדה בהצלחה',
      });

      setIsAssignDialogOpen(false);
      setSelectedRepair(null);
      setSelectedLabId('');
      refetchRepairs();
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן להקצות את התיקון',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateStatus = async (repairId: string, newStatus: RepairStatus) => {
    try {
      const updateData: any = { status: newStatus };

      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await (supabase as any)
        .from('repairs')
        .update(updateData as any)
        .eq('id', repairId);

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: 'הסטטוס עודכן בהצלחה',
      });

      refetchRepairs();
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לעדכן את הסטטוס',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: RepairStatus) => {
    const variants = {
      received: { icon: Clock, label: 'התקבל', className: 'bg-blue-100 text-blue-700' },
      in_progress: { icon: Wrench, label: 'בטיפול', className: 'bg-yellow-100 text-yellow-700' },
      completed: { icon: CheckCircle, label: 'הושלם', className: 'bg-green-100 text-green-700' },
      replacement_requested: { icon: Package, label: 'בקשת החלפה', className: 'bg-red-100 text-red-700' },
    };

    const variant = variants[status];
    const Icon = variant.icon;

    return (
      <Badge className={variant.className}>
        <Icon className="ms-1 h-3 w-3" />
        {variant.label}
      </Badge>
    );
  };

  // Legacy fault type labels for backwards compatibility
  const getFaultTypeLabel = (type: FaultType) => {
    const labels = {
      screen: 'מסך',
      charging_port: 'שקע טעינה',
      flash: 'פנס',
      speaker: 'רמקול',
      board: 'לוח אם',
      other: 'אחר',
    };
    return labels[type] || type;
  };

  const getRepairTypeDisplay = (repair: any) => {
    if (repair.repair_type?.name) {
      return repair.repair_type.name;
    }
    if (repair.custom_repair_description) {
      return repair.custom_repair_description;
    }
    if (repair.fault_type) {
      return getFaultTypeLabel(repair.fault_type);
    }
    return 'לא ידוע';
  };

  const getUrgencyBadge = (createdAt: string, status: RepairStatus) => {
    if (status === 'completed' || status === 'replacement_requested') return null;

    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));

    if (days > 3) {
      return <Badge variant="destructive">דחוף - {days} ימים</Badge>;
    } else if (days > 1) {
      return <Badge variant="outline" className="border-yellow-500">{days} ימים</Badge>;
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
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
          <h1 className="text-3xl font-bold tracking-tight">ניהול תיקונים</h1>
          <p className="text-muted-foreground">
            ניהול ומעקב אחר כל התיקונים במערכת
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-blue-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Wrench className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-sm font-medium">סה"כ תיקונים</CardTitle>
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
            <CardTitle className="text-sm font-medium">בטיפול</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.in_progress}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-green-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-sm font-medium">הושלמו</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-purple-500">
          <CardHeader className="flex flex-row-reverse items-center justify-between space-y-0 pb-2">
            <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <ShekelIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <CardTitle className="text-sm font-medium">עלות כוללת</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(stats.totalCost)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>סינון תיקונים</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            <div>
              <Label>חיפוש</Label>
              <div className="relative mt-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="IMEI, לקוח..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-10"
                />
              </div>
            </div>

            <div>
              <Label>מעבדה</Label>
              <select
                title="בחר מעבדה"
                className="w-full px-3 py-2 border rounded-md text-sm mt-1"
                value={filterLab}
                onChange={(e) => setFilterLab(e.target.value)}
              >
                <option value="all">כל המעבדות</option>
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>
                    {lab.full_name || lab.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>סטטוס</Label>
              <select
                title="בחר סטטוס"
                className="w-full px-3 py-2 border rounded-md text-sm mt-1"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
              >
                <option value="all">כל הסטטוסים</option>
                <option value="received">התקבל</option>
                <option value="in_progress">בטיפול</option>
                <option value="completed">הושלם</option>
                <option value="replacement_requested">בקשת החלפה</option>
              </select>
            </div>

            <div>
              <Label>סוג תיקון</Label>
              <select
                title="בחר סוג תיקון"
                className="w-full px-3 py-2 border rounded-md text-sm mt-1"
                value={filterRepairType}
                onChange={(e) => setFilterRepairType(e.target.value)}
              >
                <option value="all">כל הסוגים</option>
                {Array.from(
                  new Map(
                    repairs
                      .map(r => r.repair_type)
                      .filter(
                        (rt): rt is NonNullable<typeof rt> => !!rt
                      )
                      .map(rt => [rt.id, rt])
                  ).values()
                )
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <Label>דגם מכשיר</Label>
              <select
                title="בחר דגם מכשיר"
                className="w-full px-3 py-2 border rounded-md text-sm mt-1"
                value={filterDeviceModel}
                onChange={(e) => setFilterDeviceModel(e.target.value)}
              >
                <option value="all">כל הדגמים</option>
                {Array.from(new Set(repairs.map(r => r.device?.device_model?.model_name).filter(Boolean)))
                  .sort()
                  .map((model: any) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <Label>מתאריך</Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label>עד תאריך</Label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                  setFilterLab('all');
                  setFilterRepairType('all');
                  setFilterDeviceModel('all');
                  setFilterDateFrom('');
                  setFilterDateTo('');
                }}
                className="w-full"
              >
                נקה סינונים
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>רשימת תיקונים ({filteredRepairs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>מכשיר</TableHead>
                <TableHead>לקוח</TableHead>
                <TableHead>תיקון</TableHead>
                <TableHead>מעבדה</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>נפתח</TableHead>
                <TableHead>עלות</TableHead>
                <TableHead>דחיפות</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRepairs.map((repair) => (
                <TableRow key={repair.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{repair.device?.device_model?.model_name}</div>
                      <div className="text-xs text-muted-foreground">{repair.device?.imei}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {repair.customer_name}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {repair.customer_phone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getRepairTypeDisplay(repair)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {repair.lab ? (
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {repair.lab.full_name || repair.lab.email}
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedRepair(repair);
                          setIsAssignDialogOpen(true);
                        }}
                      >
                        הקצה
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(repair.status)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {formatDate(repair.created_at)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {repair.cost ? formatCurrency(repair.cost) : '-'}
                  </TableCell>
                  <TableCell>
                    {getUrgencyBadge(repair.created_at, repair.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedRepair(repair);
                          setIsDetailsDialogOpen(true);
                        }}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>

                      {repair.status === 'received' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUpdateStatus(repair.id, 'in_progress')}
                        >
                          <Wrench className="h-4 w-4 text-yellow-600" />
                        </Button>
                      )}

                      {repair.status === 'in_progress' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUpdateStatus(repair.id, 'completed')}
                        >
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredRepairs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              לא נמצאו תיקונים מתאימים
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Lab Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הקצאת תיקון למעבדה</DialogTitle>
            <DialogDescription>
              בחר מעבדה לביצוע התיקון
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>מעבדה</Label>
              <select
                className="w-full px-3 py-2 border rounded-md mt-1"
                value={selectedLabId}
                onChange={(e) => setSelectedLabId(e.target.value)}
                aria-label="בחירת מעבדה"
              >
                <option value="">בחר מעבדה</option>
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>
                    {lab.full_name || lab.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleAssignLab} disabled={!selectedLabId}>
              הקצה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repair Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>פרטי תיקון</DialogTitle>
            <DialogDescription>פרטי התיקון שנבחר.</DialogDescription>
          </DialogHeader>
          {selectedRepair && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>מכשיר</Label>
                  <p className="font-medium">{selectedRepair.device?.device_model?.model_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedRepair.device?.imei}</p>
                </div>
                <div>
                  <Label>לקוח</Label>
                  <p className="font-medium">{selectedRepair.customer_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedRepair.customer_phone}</p>
                </div>
                <div>
                  <Label>סוג תיקון</Label>
                  <p className="font-medium">{getRepairTypeDisplay(selectedRepair)}</p>
                </div>
                <div>
                  <Label>סטטוס</Label>
                  <div className="mt-1">{getStatusBadge(selectedRepair.status)}</div>
                </div>
                <div>
                  <Label>מעבדה</Label>
                  <p className="font-medium">{selectedRepair.lab?.full_name || selectedRepair.lab?.email || 'לא הוקצה'}</p>
                </div>
                <div>
                  <Label>עלות</Label>
                  <p className="font-medium">
                    {selectedRepair.cost ? formatCurrency(selectedRepair.cost) : 'טרם נקבעה'}
                  </p>
                </div>
                <div>
                  <Label>נפתח</Label>
                  <p className="font-medium">{formatDateTime(selectedRepair.created_at)}</p>
                </div>
                <div>
                  <Label>הושלם</Label>
                  <p className="font-medium">
                    {selectedRepair.completed_at ? formatDateTime(selectedRepair.completed_at) : 'טרם הושלם'}
                  </p>
                </div>
              </div>

              {selectedRepair.fault_description && (
                <div>
                  <Label>תיאור התקלה</Label>
                  <p className="mt-1 p-3 bg-muted rounded">{selectedRepair.fault_description}</p>
                </div>
              )}

              {selectedRepair.notes && (
                <div>
                  <Label>הערות</Label>
                  <p className="mt-1 p-3 bg-muted rounded">{selectedRepair.notes}</p>
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