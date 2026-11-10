'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface LabRepair {
  id: string;
  cost: number;
  completed_at: string;
  created_at?: string;
  device?: {
    imei: string;
    device_models?: {
      model_name: string;
    } | null;
  } | null;
  repair_type?: {
    name: string;
  } | null;
}

export interface LabPayment {
  id: string;
  amount: number;
  payment_date: string;
  reference: string | null;
  notes: string | null;
}

export interface LabBalance {
  lab_id: string;
  lab_name: string;
  lab_email: string;
  total_earned: number;
  total_paid: number;
  balance: number;
  repairs_count: number;
  payments_count: number;
}

/**
 * שליפת תיקונים מושלמים של מעבדה
 */
async function fetchLabCompletedRepairs(labId: string): Promise<LabRepair[]> {
  const supabase = createClient();

  const { data, error } = await supabase
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

  if (error) {
    throw new Error(`Failed to fetch completed repairs: ${error.message}`);
  }

  return (data || []) as any as LabRepair[];
}

/**
 * שליפת תשלומים של מעבדה
 */
async function fetchLabPayments(labId: string): Promise<LabPayment[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('lab_id', labId)
    .order('payment_date', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch payments: ${error.message}`);
  }

  return (data || []) as LabPayment[];
}

/**
 * Hook לתיקונים מושלמים של מעבדה
 */
export function useLabCompletedRepairs(labId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['lab', 'completed-repairs', labId],
    queryFn: () => {
      if (!labId) throw new Error('Lab ID is required');
      return fetchLabCompletedRepairs(labId);
    },
    enabled: !!labId,
    refetchInterval: 60 * 1000, // 60 seconds as backup to Realtime
  });

  // Realtime subscription
  useEffect(() => {
    if (!labId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`lab-completed-repairs-${labId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'repairs',
          filter: `lab_id=eq.${labId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['lab', 'completed-repairs', labId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [labId, queryClient]);

  return {
    repairs: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook לתשלומים של מעבדה
 */
export function useLabPayments(labId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['lab', 'payments', labId],
    queryFn: () => {
      if (!labId) throw new Error('Lab ID is required');
      return fetchLabPayments(labId);
    },
    enabled: !!labId,
    refetchInterval: 60 * 1000, // 60 seconds as backup to Realtime
  });

  // Realtime subscription
  useEffect(() => {
    if (!labId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`lab-payments-${labId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `lab_id=eq.${labId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['lab', 'payments', labId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [labId, queryClient]);

  return {
    payments: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * שליפת יתרות כל המעבדות (admin)
 */
async function fetchAllLabsBalances(): Promise<LabBalance[]> {
  const supabase = createClient();

  // Fetch all active labs
  const { data: labs } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('role', 'lab')
    .eq('is_active', true)
    .order('full_name');

  if (!labs) return [];

  // For each lab, calculate balance
  const balancesPromises = labs.map(async (lab: any) => {
    // Get all completed repairs
    const { data: repairs } = await supabase
      .from('repairs')
      .select('id, cost')
      .eq('lab_id', lab.id)
      .eq('status', 'completed');

    // Get all payments
    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .eq('lab_id', lab.id);

    const totalEarned = (repairs as any)?.reduce((sum: number, r: any) => sum + (r.cost || 0), 0) || 0;
    const totalPaid = (payments as any)?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;

    return {
      lab_id: lab.id,
      lab_name: lab.full_name || lab.email || '',
      lab_email: lab.email || '',
      total_earned: totalEarned,
      total_paid: totalPaid,
      balance: totalEarned - totalPaid,
      repairs_count: repairs?.length || 0,
      payments_count: payments?.length || 0,
    };
  });

  const balances = await Promise.all(balancesPromises);
  return balances.sort((a, b) => b.balance - a.balance);
}

/**
 * Hook ליתרות כל המעבדות (admin) עם Realtime updates
 */
export function useAllLabsBalances() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['labs', 'balances', 'all'],
    queryFn: fetchAllLabsBalances,
    refetchInterval: 60 * 1000, // 60 seconds as backup to Realtime
  });

  // Realtime subscription - batched for efficiency
  // ✅ Optimization: Single channel with multiple table subscriptions
  // Reduces WebSocket connections from 2 to 1 (50% reduction)
  useEffect(() => {
    const supabase = createClient();

    const handleChange = () => {
      queryClient.invalidateQueries({
        queryKey: ['labs', 'balances', 'all'],
      });
    };

    // Single channel monitoring all relevant tables
    const channel = supabase
      .channel('labs-balances-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'repairs' },
        handleChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        handleChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    labBalances: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
