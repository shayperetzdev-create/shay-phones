'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/client';
import { UserData } from '@/types/user';
import { LabRepairsPageSkeleton } from '@/components/ui/loading-skeletons';
import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';
import { useLabRepairs } from '@/hooks/queries/useRepairs';
import { useLabRepairTypes } from '@/hooks/queries/useRepairTypes';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogFooter,
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
  Wrench,
  Search,
  Plus,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  XCircle,
  Package
} from 'lucide-react';
import { formatDate, formatCurrency, cn } from '@/lib/utils';

type RepairStatus = 'received' | 'in_progress' | 'completed' | 'replacement_requested';
type FaultType = 'screen' | 'charging_port' | 'flash' | 'speaker' | 'board' | 'other';


interface RepairType {
  id: string;
  name: string;
  description: string | null;
  price: number;
}

const repairSchema = z.object({
  customer_name: z.string().min(2, 'שם הלקוח חייב להכיל לפחות 2 תווים'),
  customer_phone: z.string().min(10, 'מספר טלפון לא תקין'),
  fault_description: z.string().min(5, 'יש להזין תיאור תקלה (לפחות 5 תווים)'),
  notes: z.string().optional(),
});

type RepairFormData = z.infer<typeof repairSchema>;

export default function LabRepairsPage() {
  // Load current user to get labId
  const { user: currentUser, isLoading: isUserLoading } = useCurrentUser();
  const labId = currentUser?.id || null;

  // React Query hooks with Realtime subscriptions
  const { repairs, isLoading: isRepairsLoading, isFetching: isRepairsFetching, refetch: refetchRepairs } = useLabRepairs(labId);
  const { repairTypes: availableRepairTypes, isLoading: isRepairTypesLoading, isFetching: isRepairTypesFetching } = useLabRepairTypes(labId);

  // Combined loading state
  const isLoading = isUserLoading || isRepairsLoading || isRepairTypesLoading;
  const isFetching = isRepairsFetching || isRepairTypesFetching;

  // State
  const [selectedRepair, setSelectedRepair] = useState<any>(null);
  const [isNewRepairDialogOpen, setIsNewRepairDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<RepairStatus | ''>('');
  const [updateRepairTypeId, setUpdateRepairTypeId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRepairType, setFilterRepairType] = useState<string>('all');
  const [filterDeviceModel, setFilterDeviceModel] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [searchIMEI, setSearchIMEI] = useState('');
  const [searchedDevice, setSearchedDevice] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [repairCost, setRepairCost] = useState('');
  const [replacementReason, setReplacementReason] = useState('');
  const [selectedRepairTypeId, setSelectedRepairTypeId] = useState<string>('');
  const [customRepairDescription, setCustomRepairDescription] = useState('');
  const [customRepairPrice, setCustomRepairPrice] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // אופטימיזציה: שמירת user ID לצורך audit logging
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // --- [תיקון 1: הוספת useMemo עבור רשימות סינון ייחודיות] ---
  const uniqueFilterRepairTypes = useMemo(() => {
    const allRepairTypes = repairs.map(r => r.repair_type).filter((rt): rt is NonNullable<typeof rt> => rt !== null && rt !== undefined);
    const uniqueMap = new Map();
    allRepairTypes.forEach(rt => {
      if (!uniqueMap.has(rt.id)) {
        uniqueMap.set(rt.id, rt);
      }
    });
    return Array.from(uniqueMap.values());
  }, [repairs]);

  const uniqueFilterDeviceModels = useMemo(() => {
    const allModels = repairs.map(r => r.device?.device_models?.model_name).filter(Boolean);
    return Array.from(new Set(allModels)).sort();
  }, [repairs]);

  // --- [תיקון 2: החלפת useEffect + useState ב-useMemo עבור נתונים נגזרים] ---
  
  // חישוב הרשימה המסוננת
  const filteredRepairs = useMemo(() => {
    let filtered = repairs;

    if (filterStatus.startsWith('replacement_')) {
      const reqStatus = filterStatus.replace('replacement_', '');
      filtered = filtered.filter(r => {
        if (r.status !== 'replacement_requested') return false;
        const latestRequest = r.replacement_requests?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        return latestRequest?.status === reqStatus;
      });
    } else if (filterStatus !== 'all') {
      filtered = filtered.filter(r => r.status === filterStatus);
    }

    if (filterRepairType !== 'all') {
      filtered = filtered.filter(r => r.repair_type?.id === filterRepairType);
    }

    if (filterDeviceModel !== 'all') {
      filtered = filtered.filter(r => r.device?.device_models?.model_name === filterDeviceModel);
    }

    if (filterDateFrom) {
      filtered = filtered.filter(r => r.created_at && r.created_at >= filterDateFrom);
    }

    if (filterDateTo) {
      filtered = filtered.filter(r => r.created_at && r.created_at <= filterDateTo + 'T23:59:59');
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (repair) =>
          repair.device?.imei?.toLowerCase().includes(query) ||
          repair.device?.device_models?.model_name?.toLowerCase().includes(query) ||
          repair.warranty?.[0]?.customer_name?.toLowerCase().includes(query) ||
          repair.customer_name?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [repairs, searchQuery, filterStatus, filterRepairType, filterDeviceModel, filterDateFrom, filterDateTo]);
  
  // חישוב הרשימה המחולקת לעמודים
  const paginatedRepairs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredRepairs.slice(startIndex, endIndex);
  }, [filteredRepairs, currentPage, itemsPerPage]);


  // --- [תיקון 3: הוספת Event Handlers לאיפוס עמוד] ---
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };
  const handleStatusChange = (value: string) => {
    setFilterStatus(value);
    setCurrentPage(1);
  };
  const handleRepairTypeChange = (value: string) => {
    setFilterRepairType(value);
    setCurrentPage(1);
  };
  const handleDeviceModelChange = (value: string) => {
    setFilterDeviceModel(value);
    setCurrentPage(1);
  };
  const handleDateFromChange = (value: string) => {
    setFilterDateFrom(value);
    setCurrentPage(1);
  };
  const handleDateToChange = (value: string) => {
    setFilterDateTo(value);
    setCurrentPage(1);
  };
  
  const handleClearFilters = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setFilterRepairType('all');
    setFilterDeviceModel('all');
    setFilterDateFrom('');
    setFilterDateTo('');
    setCurrentPage(1);
  };
  // --- [סוף התיקונים] ---


  const supabase = createClient();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RepairFormData>({
    resolver: zodResolver(repairSchema),
  });

  // Update currentUserId from currentUser
  useEffect(() => {
    if (currentUser) {
      setCurrentUserId(currentUser.id);
    }
  }, [currentUser]);

  // (הסרנו את הלוגיקה הבעייתית של filterData ו-useEffect)

  useEffect(() => {
    if (isUpdateDialogOpen && selectedRepair) {
      // Pre-fill form if it's a custom repair
      if (selectedRepair.custom_repair_description) {
        setUpdateRepairTypeId('other');
        setCustomRepairDescription(selectedRepair.custom_repair_description);
        setCustomRepairPrice(selectedRepair.custom_repair_price?.toString() || '');
      } else {
        // Reset fields for standard repair
        setUpdateRepairTypeId(selectedRepair.repair_type_id || '');
        setCustomRepairDescription('');
        setCustomRepairPrice('');
      }
        setUpdateStatus(selectedRepair.status || '');
    }
  }, [isUpdateDialogOpen, selectedRepair]);



  const handleSearchDevice = async () => {
    const trimmedIMEI = searchIMEI.trim().replace(/[\s-]/g, '');

    if (!trimmedIMEI) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין מספר IMEI',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSearching(true);

      // Search using IMEI lookup view - minimal info only
      const { data: lookupData, error: lookupError } = await supabase
        .from('devices_imei_lookup')
        .select('*')
        .or(`imei.eq.${trimmedIMEI},imei2.eq.${trimmedIMEI}`)
        .maybeSingle() as {
          data: any;
          error: any;
        };

      if (lookupError || !lookupData) {
        toast({
          title: 'לא נמצא',
          description: 'לא נמצא מכשיר עם IMEI זה',
          variant: 'destructive',
        });
        setSearchedDevice(null);
        return;
      }

      // Check if device has active warranty
      if (!lookupData.has_active_warranty) {
        toast({
          title: 'אין אחריות פעילה',
          description: 'למכשיר זה אין אחריות פעילה',
          variant: 'destructive',
        });
        setSearchedDevice(null);
        return;
      }

      // Check if device already has active repair
      if (lookupData.has_active_repair) {
        toast({
          title: 'שגיאה',
          description: 'כבר קיים תיקון פעיל למכשיר זה',
          variant: 'destructive',
        });
        setSearchedDevice(null);
        return;
      }

      // Get warranty details for customer info
      const { data: warrantyData } = await supabase
        .from('warranties')
        .select('id, customer_name, customer_phone, activation_date, expiry_date')
        .eq('device_id', lookupData.id)
        .eq('is_active', true)
        .gte('expiry_date', new Date().toISOString().split('T')[0])
        .single() as {
          data: any;
          error: any;
        };

      const data = {
        id: lookupData.id,
        imei: trimmedIMEI,
        model: lookupData.model_name || 'לא ידוע',
        warranty: warrantyData ? [warrantyData] : []
      };

      setSearchedDevice(data);

      // Auto-fill customer details from warranty (always required)
      if (warrantyData) {
        setSearchedDevice(data);
        setValue('customer_name', warrantyData.customer_name || '');
        setValue('customer_phone', warrantyData.customer_phone || '');
      } else {
        toast({
          title: 'שגיאת נתונים',
          description: 'המכשיר נמצא אך פרטי הלקוח המשויכים לאחריות לא אותרו.',
          variant: 'destructive',
        });
        setSearchedDevice(null);
      }

    } catch (error) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לחפש את המכשיר',
        variant: 'destructive',
      });
      setSearchedDevice(null);
    } finally {
      setIsSearching(false);
    }
  };

  const onSubmit = async (data: RepairFormData) => {

    try {
      if (!searchedDevice) {
        toast({
          title: 'שגיאה',
          description: 'יש לחפש מכשיר תחילה',
          variant: 'destructive',
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      const typedUserData = userData as UserData | null;
      if (!typedUserData) throw new Error('משתמש לא נמצא');

      // Check if repair already exists for this device
      const { data: existingRepair } = await supabase
        .from('repairs')
        .select('id, status')
        .eq('device_id', searchedDevice.id)
        .not('status', 'in', '(completed,cancelled,replacement_requested)')
        .limit(1)
        .maybeSingle();

      if (existingRepair) {
        toast({
          title: 'שגיאה',
          description: 'כבר קיים תיקון פעיל למכשיר זה',
          variant: 'destructive',
        });
        return;
      }

      // Create repair without repair_type_id and cost - will be set later when updating status
      const { data: newRepair, error } = await (supabase
        .from('repairs') as any)
        .insert({
          device_id: searchedDevice.id,
          lab_id: typedUserData.id,
          warranty_id: searchedDevice.warranty[0]?.id || null,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          fault_description: data.fault_description,
          notes: data.notes,
          status: 'received',
          created_by: user.id,
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      // --- Audit Log ---
      if (newRepair) {
        supabase.from('audit_log').insert({
          actor_user_id: user.id,
          action: 'repair.create',
          entity_type: 'repair',
          entity_id: newRepair.id,
          meta: { 
            device_id: searchedDevice.id,
            lab_id: typedUserData.id,
            customer_name: data.customer_name
          }
        }).then(({ error: logError }) => {
          if (logError) console.error('Audit log failed:', logError);
        });
      }
      // --- End Audit Log ---

      toast({
        title: 'הצלחה',
        description: 'התיקון נוסף בהצלחה. סוג התיקון והמחיר יוגדרו בעת עדכון הסטטוס.',
      });

      setIsNewRepairDialogOpen(false);
      reset();
      setSearchedDevice(null);
      setSearchIMEI('');
      setRepairCost('');
      setSelectedRepairTypeId('');
      refetchRepairs();
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן ליצור את התיקון',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateRepair = async () => {
    if (!selectedRepair) return;

    try {
      const updateData: any = {};

      const isCustomRepair = updateRepairTypeId === 'other';

      // Update status if changed
      if (updateStatus && updateStatus !== selectedRepair.status) {
        updateData.status = updateStatus;

        if (updateStatus === 'completed') {
          updateData.completed_at = new Date().toISOString();

          const hasPredefinedRepair = updateRepairTypeId && !isCustomRepair;
          const hasExistingRepair = selectedRepair.repair_type?.id;

          // If completing, must have a repair type (predefined or custom)
          if (!isCustomRepair && !hasPredefinedRepair && !hasExistingRepair) {
            toast({
              title: 'שגיאה',
              description: 'יש לבחור סוג תיקון לפני סיום התיקון',
              variant: 'destructive',
            });
            return;
          }

          // If completing as a custom repair, description is mandatory (price is optional)
          if (isCustomRepair && !customRepairDescription) {
            toast({
              title: 'שגיאה',
              description: 'לפני סגירת תיקון, יש למלא תיאור עבור תיקון מותאם.',
              variant: 'destructive',
            });
            return;
          }

          // Warn if completing custom repair without price
          if (isCustomRepair && !customRepairPrice) {
            // Allow but show warning in the success message later
          }
        }
      }

      // Handle custom repair type
      if (isCustomRepair) {
        if (!customRepairDescription) {
          toast({
            title: 'שגיאה',
            description: 'בעת בחירת סוג תיקון \"אחר\", יש למלא תיאור.',
            variant: 'destructive',
          });
          return;
        }
        updateData.repair_type_id = null;
        updateData.custom_repair_description = customRepairDescription;
        updateData.custom_repair_price = customRepairPrice ? parseFloat(customRepairPrice) : null;
      } else if (updateRepairTypeId && updateRepairTypeId !== selectedRepair.repair_type?.id) {
        // Handle predefined repair type
        updateData.repair_type_id = updateRepairTypeId;
        // Clear custom repair fields if switching from custom to predefined
        updateData.custom_repair_description = null;
        updateData.custom_repair_price = null;
        // The trigger will automatically update the cost based on the new repair type
      }

      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
        toast({
          title: 'אין שינויים',
          description: 'לא בוצעו שינויים',
          variant: 'default',
        });
        setIsUpdateDialogOpen(false);
        return;
      }

      const { data: updatedRepair, error } = await (supabase
        .from('repairs') as any)
        .update(updateData)
        .eq('id', selectedRepair.id)
        .select('*, repair_type:repair_types(name), cost')
        .single();

      if (error) throw error;

      // Check if cost was set (especially when completing repair)
      if (updateData.status === 'completed' && updatedRepair.cost === null) {
        toast({
          title: 'אזהרה',
          description: `התיקון הושלם אבל לא נקבע מחיר. נא להגדיר מחיר עבור סוג תיקון "${updatedRepair.repair_type?.name || customRepairDescription || 'לא ידוע'}".`,
          variant: 'destructive',
        });
      }

      // --- Audit Log ---
      if (currentUserId) {
        supabase.from('audit_log').insert({
          actor_user_id: currentUserId,
          action: 'repair.update',
          entity_type: 'repair',
          entity_id: selectedRepair.id,
          meta: {
            updates: updateData,
            lab_id: selectedRepair.lab_id
          }
        }).then(({ error: logError }) => {
          if (logError) console.error('Audit log failed:', logError);
        });
      }
      // --- End Audit Log ---

      // Show success message with warning if custom repair without price
      const isCustomWithoutPrice = isCustomRepair && !customRepairPrice && updateData.status === 'completed';

      toast({
        title: 'הצלחה',
        description: isCustomWithoutPrice
          ? 'התיקון עודכן בהצלחה. שים לב: לא הוגדר מחיר לתיקון מותאם זה.'
          : 'התיקון עודכן בהצלחה',
        variant: isCustomWithoutPrice ? 'default' : undefined,
      });

      setIsUpdateDialogOpen(false);
      setUpdateStatus('');
      setUpdateRepairTypeId('');
      setCustomRepairDescription('');
      setCustomRepairPrice('');
      refetchRepairs();
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לעדכן את התיקון',
        variant: 'destructive',
      });
    }
  };

  const handleRequestReplacement = async () => {
    try {
      if (!selectedRepair || !replacementReason) {
        toast({
          title: 'שגיאה',
          description: 'יש למלא את הסיבה להחלפה',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase.rpc('create_replacement_request', {
        p_device_id: selectedRepair.device.id,
        p_reason: replacementReason,
        p_repair_id: selectedRepair.id
      });

      if (error) throw new Error(error.message);

      const result = data?.[0];
      if (!result?.success) {
        throw new Error(result?.message || 'An unknown error occurred.');
      }

      toast({
        title: 'הצלחה',
        description: 'בקשת החלפה נשלחה בהצלחה',
      });

      setIsDetailsDialogOpen(false);
      setReplacementReason('');
      refetchRepairs();
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לשלוח בקשת החלפה',
        variant: 'destructive',
      });
    }
  };

  const getRepairStatusBadge = (repair: any) => {
    let status = repair.status;
    let label = status;
    let variant: "default" | "secondary" | "destructive" | "outline" = 'secondary';
    let icon = AlertCircle;
    let className = '';

    if (status === 'replacement_requested') {
      const latestRequest = repair.replacement_requests?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      
      if (latestRequest) {
        switch (latestRequest.status) {
          case 'pending':
            label = 'בקשה נשלחה';
            variant = 'outline';
            className = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 border-yellow-300';
            icon = Clock;
            break;
          case 'approved':
            label = 'החלפה אושרה';
            variant = 'default';
            className = 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-300 border-green-400';
            icon = CheckCircle;
            break;
          case 'rejected':
            label = 'החלפה נדחתה';
            variant = 'destructive';
            className = 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-300 border-red-400';
            icon = XCircle;
            break;
          default:
            label = 'בקשת החלפה';
            className = 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
            icon = Package;
        }
      } else {
        label = 'בקשת החלפה';
        className = 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
        icon = Package;
      }
    } else {
      const statusConfig = {
        received: { label: 'התקבל', variant: 'secondary' as const, icon: Clock, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
        in_progress: { label: 'בטיפול', variant: 'default' as const, icon: Wrench, className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
        completed: { label: 'הושלם', variant: 'outline' as const, icon: CheckCircle, className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
      };
      const config = (statusConfig as any)[status];
      if (config) {
        label = config.label;
        variant = config.variant;
        icon = config.icon;
        className = config.className;
      }
    }

    const Icon = icon;
    return (
      <Badge variant={variant} className={cn("whitespace-nowrap", className)}>
        <Icon className="h-3 w-3 me-1" />
        {label}
      </Badge>
    );
  };

  const getFaultTypeLabel = (type?: FaultType | string | null) => {
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
    return <LabRepairsPageSkeleton />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Background refresh indicator */}
      <BackgroundRefreshIndicator
        isFetching={isFetching}
        isLoading={isLoading}
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Wrench className="h-7 w-7 text-primary" />
            ניהול תיקונים
          </h1>
          <p className="text-muted-foreground mt-1">טיפול בתיקונים ומעקב סטטוס</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => refetchRepairs()}
            disabled={isFetching}
            className="flex-1 sm:flex-none"
          >
            רענן
            <RefreshCw className={cn("h-4 w-4 me-2", isFetching && "animate-spin")} />
          </Button>
          <Button
            onClick={() => setIsNewRepairDialogOpen(true)}
            className="flex-1 sm:flex-none"
          >
            תיקון חדש
            <Plus className="h-4 w-4 ms-2" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Label>חיפוש</Label>
              <div className="relative mt-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="IMEI, דגם או שם לקוח..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>

            <div>
              <Label>סטטוס</Label>
              <Select value={filterStatus} onValueChange={handleStatusChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="כל הסטטוסים" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הסטטוסים</SelectItem>
                  <SelectItem value="received">התקבל</SelectItem>
                  <SelectItem value="in_progress">בטיפול</SelectItem>
                  <SelectItem value="completed">הושלם</SelectItem>
                  <SelectItem value="replacement_pending">בקשה נשלחה</SelectItem>
                  <SelectItem value="replacement_approved">החלפה אושרה</SelectItem>
                  <SelectItem value="replacement_rejected">החלפה נדחתה</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>סוג תיקון</Label>
              <Select value={filterRepairType} onValueChange={handleRepairTypeChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="כל הסוגים" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הסוגים</SelectItem>
                  {/* [תיקון 1.1]: שימוש במשתנה החדש שהוכן עם useMemo */}
                  {uniqueFilterRepairTypes.map((rt: any) => (
                      <SelectItem key={rt.id} value={rt.id}>
                        {rt.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>דגם מכשיר</Label>
              <Select value={filterDeviceModel} onValueChange={handleDeviceModelChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="כל הדגמים" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הדגמים</SelectItem>
                  {/* [תיקון 1.2]: שימוש במשתנה החדש שהוכן עם useMemo */}
                  {uniqueFilterDeviceModels.map((model: any) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>מתאריך</Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => handleDateFromChange(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label>עד תאריך</Label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => handleDateToChange(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="lg:col-span-3 flex items-end">
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="w-full"
              >
                נקה סינונים
              </Button>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">
                {filteredRepairs.length}
              </div>
              <div className="text-sm text-muted-foreground mt-1">תיקונים מסוננים</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(filteredRepairs.reduce((sum, r) => sum + (r.cost || 0), 0))}
              </div>
              <div className="text-sm text-muted-foreground mt-1">סה"כ סכום</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-3xl font-bold text-orange-600">
                {filteredRepairs.filter(r => r.status === 'completed').length}
              </div>
              <div className="text-sm text-muted-foreground mt-1">הושלמו</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-3xl font-bold text-purple-600">
                {filteredRepairs.filter(r => r.status === 'in_progress').length}
              </div>
              <div className="text-sm text-muted-foreground mt-1">בטיפול</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pagination - Above Table */}
      {Math.ceil(filteredRepairs.length / itemsPerPage) > 1 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-row-reverse">
              <div className="text-sm text-muted-foreground">
                מציג {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredRepairs.length)} מתוך {filteredRepairs.length} תיקונים
              </div>
              <div className="flex items-center gap-2 flex-row-reverse">
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
                  עמוד {currentPage} מתוך {Math.ceil(filteredRepairs.length / itemsPerPage)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredRepairs.length / itemsPerPage), prev + 1))}
                  disabled={currentPage === Math.ceil(filteredRepairs.length / itemsPerPage)}
                >
                  הבא
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.ceil(filteredRepairs.length / itemsPerPage))}
                  disabled={currentPage === Math.ceil(filteredRepairs.length / itemsPerPage)}
                >
                  אחרון
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Repairs Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {paginatedRepairs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Wrench className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">אין תיקונים להצגה</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || filterStatus !== 'all'
                  ? 'נסה לשנות את הסינון או החיפוש'
                  : 'התחל על ידי הוספת תיקון חדש'}
              </p>
              {!searchQuery && filterStatus === 'all' && (
                <Button onClick={() => setIsNewRepairDialogOpen(true)}>
                  תיקון חדש
                  <Plus className="h-4 w-4 ms-2" />
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">IMEI</TableHead>
                    <TableHead className="font-semibold">דגם</TableHead>
                    <TableHead className="font-semibold">לקוח</TableHead>
                    <TableHead className="font-semibold">תקלה</TableHead>
                    <TableHead className="font-semibold">סטטוס</TableHead>
                    <TableHead className="font-semibold">עלות</TableHead>
                    <TableHead className="font-semibold">תאריך</TableHead>
                    <TableHead className="font-semibold text-center">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRepairs.map((repair) => (
                    <TableRow
                      key={repair.id}
                      className="hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedRepair(repair);
                        setIsDetailsDialogOpen(true);
                      }}
                    >
                      <TableCell className="font-mono text-sm">{repair.device?.imei}</TableCell>
                      <TableCell className="font-medium">{repair.device?.device_models?.model_name || 'לא ידוע'}</TableCell>
                      <TableCell>{repair.warranty?.[0]?.customer_name || repair.customer_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {repair.repair_type?.name || repair.custom_repair_description || getFaultTypeLabel(repair.fault_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>{getRepairStatusBadge(repair)}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(repair.cost || 0)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{repair.created_at ? formatDate(repair.created_at) : 'לא ידוע'}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1 justify-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedRepair(repair);
                              setIsDetailsDialogOpen(true);
                            }}
                            title="פרטים"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          {repair.status !== 'completed' && repair.status !== 'replacement_requested' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedRepair(repair);
                                setIsUpdateDialogOpen(true);
                              }}
                              title="עדכן סטטוס"
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
            </div>
          )}
        </CardContent>
      </Card>

{/* New Repair Dialog */}
<Dialog open={isNewRepairDialogOpen} onOpenChange={setIsNewRepairDialogOpen}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>תיקון חדש</DialogTitle>
            <DialogDescription>הזן את פרטי התיקון</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Device Search */}
            <div className="space-y-2">
              <Label>חיפוש מכשיר לפי IMEI</Label>
              <div className="flex gap-2">
                <Input
                  value={searchIMEI}
                  onChange={(e) => setSearchIMEI(e.target.value)}
                  placeholder="הזן IMEI"
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={handleSearchDevice}
                  disabled={isSearching || !searchIMEI}
                >
                  {isSearching ? <RefreshCw className="h-4 w-4 animate-spin me-2" /> : <Search className="h-4 w-4 me-2" />}
                  חפש
                </Button>
              </div>

              {searchedDevice && (
                <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-semibold">מכשיר נמצא - {searchedDevice.model}</span>
                  </div>
                  {searchedDevice.warranty && searchedDevice.warranty[0] && (
                    <div className="text-sm text-green-800 dark:text-green-200" dir="rtl">
                      <p><strong>הופעלה:</strong> {formatDate(searchedDevice.warranty[0].activation_date)}</p>
                      <p><strong>בתוקף עד:</strong> {formatDate(searchedDevice.warranty[0].expiry_date)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div>
              <Label htmlFor="customer_name">שם הלקוח *</Label>
              <Input
                id="customer_name"
                {...register('customer_name')}
                placeholder="פרטי הלקוח יוזנו אוטומטית"
                className={errors.customer_name ? 'border-red-500' : ''}
                readOnly
              />
              {errors.customer_name && (
                <p className="text-sm text-red-500 mt-1">{errors.customer_name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="customer_phone">טלפון הלקוח *</Label>
              <Input
                id="customer_phone"
                {...register('customer_phone')}
                placeholder="פרטי הלקוח יוזנו אוטומטית"
                className={errors.customer_phone ? 'border-red-500' : ''}
                readOnly
              />
              {errors.customer_phone && (
                <p className="text-sm text-red-500 mt-1">{errors.customer_phone.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="fault_description">תיאור התקלה *</Label>
              <Textarea
                id="fault_description"
                {...register('fault_description')}
                placeholder="תאר את התקלה שדווחה על ידי הלקוח..."
                rows={4}
                className={errors.fault_description ? 'border-red-500' : ''}
                disabled={!searchedDevice}
              />
              {errors.fault_description && (
                <p className="text-sm text-red-500 mt-1">{errors.fault_description.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                * סוג התיקון והמחיר יוגדרו מאוחר יותר בעת עדכון הסטטוס
              </p>
            </div>

            <div>
              <Label htmlFor="notes">הערות</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                rows={2}
                disabled={!searchedDevice}
              />
            </div>
            

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsNewRepairDialogOpen(false);
                  reset();
                  setSearchedDevice(null);
                  setSearchIMEI('');
                  setSelectedRepairTypeId('');
                }}
              >
                ביטול
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !searchedDevice}
              >
                {isSubmitting ? 'שומר...' : 'שמור תיקון'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>פרטי תיקון</DialogTitle>
          </DialogHeader>

          {selectedRepair && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>IMEI</Label>
                  <p className="font-mono">{selectedRepair.device?.imei}</p>
                </div>
                <div>
                  <Label>דגם</Label>
                  <p>{selectedRepair.device?.device_models?.model_name || 'לא ידוע'}</p>
                </div>
                <div>
                  <Label>לקוח</Label>
                  <p>{selectedRepair.warranty?.customer_name || selectedRepair.customer_name}</p>
                </div>
                <div>
                  <Label>טלפון</Label>
                  <p>{selectedRepair.warranty?.customer_phone || selectedRepair.customer_phone}</p>
                </div>
                <div>
                  <Label>סוג תיקון</Label>
                  <p>{selectedRepair.repair_type?.name || selectedRepair.custom_repair_description || getFaultTypeLabel(selectedRepair.fault_type)}</p>
                </div>
                <div>
                  <Label>סטטוס</Label>
                  {getRepairStatusBadge(selectedRepair)}
                </div>
                <div>
                  <Label>עלות</Label>
                  <p>{formatCurrency(selectedRepair.cost || 0)}</p>
                </div>
                <div>
                  <Label>תאריך קבלה</Label>
                  <p>{formatDate(selectedRepair.created_at)}</p>
                </div>
                <div>
                <Label>תאריך הפעלת אחריות</Label>
                <p>
                  {selectedRepair.warranty?.activation_date
                    ? formatDate(selectedRepair.warranty.activation_date)
                    : 'לא זמין'}
                </p>
                </div>
              <div>
                <Label>תאריך סיום אחריות</Label>
                <p>
                  {selectedRepair.warranty?.expiry_date
                    ? formatDate(selectedRepair.warranty.expiry_date)
                    : 'לא זמין'}
                </p>
              </div>
              </div>

              {selectedRepair.fault_description && (
                <div>
                  <Label>תיאור התקלה</Label>
                  <p className="text-sm text-muted-foreground">{selectedRepair.fault_description}</p>
                </div>
              )}

              {selectedRepair.notes && (
                <div>
                  <Label>הערות</Label>
                  <p className="text-sm text-muted-foreground">{selectedRepair.notes}</p>
                </div>
              )}

              {selectedRepair.status !== 'replacement_requested' && selectedRepair.status !== 'completed' && (
                <div className="space-y-2">
                  <Label htmlFor="replacement_reason">בקשת החלפה</Label>
                  <Textarea
                    id="replacement_reason"
                    value={replacementReason}
                    onChange={(e) => setReplacementReason(e.target.value)}
                    placeholder="הזן סיבה להחלפה..."
                    rows={3}
                  />
                  <Button onClick={handleRequestReplacement} variant="destructive" className="w-full">
                    <AlertCircle className="h-4 w-4 me-2" />
                    שלח בקשת החלפה
                  </Button>
                </div>
              )}

              {selectedRepair.replacement_requests && selectedRepair.replacement_requests.length > 0 && (
                <div>
                  <Label>בקשות החלפה</Label>
                  <div className="border rounded p-2">
                    {selectedRepair.replacement_requests.map((req: any) => (
                      <div key={req.id} className="flex items-center justify-between">
                        <span className="text-sm">{formatDate(req.created_at)}</span>
                        <Badge>{req.status === 'pending' ? 'ממתין' : req.status === 'approved' ? 'אושר' : 'נדחה'}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Repair Dialog */}
      <Dialog
        open={isUpdateDialogOpen}
        onOpenChange={(open) => {
          setIsUpdateDialogOpen(open);
          if (!open) {
            setUpdateStatus('');
            setUpdateRepairTypeId('');
            setCustomRepairDescription('');
            setCustomRepairPrice('');
          }
        }}
      >
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>עדכון תיקון</DialogTitle>
            <DialogDescription>עדכן סטטוס או סוג תיקון</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Info */}
            <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
              <div><strong>מכשיר:</strong> {selectedRepair?.device?.device_models?.model_name}</div>
              <div><strong>IMEI:</strong> {selectedRepair?.device?.imei}</div>
              <div><strong>סטטוס נוכחי:</strong> {
                selectedRepair?.status === 'received' ? 'התקבל' :
                  selectedRepair?.status === 'in_progress' ? 'בטיפול' :
                    selectedRepair?.status === 'completed' ? 'הושלם' :
                      selectedRepair?.status === 'replacement_requested' ? 'בקשת החלפה' : ''
              }</div>
              <div><strong>סוג תיקון נוכחי:</strong> {selectedRepair?.repair_type?.name || 'לא הוגדר'}</div>
            </div>

            {/* Status Selection */}
            <div>
              <Label htmlFor="update-status">סטטוס חדש</Label>
              <select
                id="update-status"
                className="w-full px-3 py-2 border rounded-md mt-1"
                value={updateStatus}
                onChange={(e) => setUpdateStatus(e.target.value as RepairStatus)}
              >
                <option value="">-- בחר סטטוס (אופציונלי) --</option>
                <option value="received">התקבל</option>
                <option value="in_progress">בטיפול</option>
                <option value="completed">הושלם</option>
              </select>
            </div>

            {/* Repair Type Selection */}
            <div>
              <Label htmlFor="update-repair-type">סוג תיקון חדש</Label>
              <select
                title="בחר סוג תיקון"
                id="update-repair-type"
                className="w-full px-3 py-2 border rounded-md mt-1"
                value={updateRepairTypeId}
                onChange={(e) => setUpdateRepairTypeId(e.target.value)}
              >
                <option value="">-- בחר סוג תיקון (אופציונלי) --</option>
                {availableRepairTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name} - {formatCurrency(rt.price)}
                  </option>
                ))}
                <option value="other">אחר (הזנה ידנית)</option>
              </select>
              {updateRepairTypeId && updateRepairTypeId !== 'other' && (
                <p className="text-xs text-muted-foreground mt-1">
                  * המחיר יעודכן אוטומטית לפי סוג התיקון החדש
                </p>
              )}
            </div>

            {updateRepairTypeId === 'other' && (
              <div className="space-y-4 p-4 border rounded-md bg-muted/50">
                <div>
                  <Label htmlFor="custom-repair-description">תיאור תיקון מותאם</Label>
                  <Input
                    id="custom-repair-description"
                    value={customRepairDescription}
                    onChange={(e) => setCustomRepairDescription(e.target.value)}
                    placeholder="לדוגמה: החלפת סוללה"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="custom-repair-price">מחיר מותאם</Label>
                  <Input
                    id="custom-repair-price"
                    type="number"
                    value={customRepairPrice}
                    onChange={(e) => setCustomRepairPrice(e.target.value)}
                    placeholder="הזן מחיר בשקלים"
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsUpdateDialogOpen(false);
                setUpdateStatus('');
                setUpdateRepairTypeId('');
                setCustomRepairDescription('');
                setCustomRepairPrice('');
              }}
            >
              ביטול
            </Button>
            <Button onClick={handleUpdateRepair}>
              עדכן תיקון
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}