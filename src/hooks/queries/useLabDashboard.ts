'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface LabDashboardStats {
  pendingRepairs: number;
  inProgressRepairs: number;
  completedToday: number;
  monthlyCompleted: number;
  monthlyRevenue: number;
  averageRepairTime: number;
  topFaultType: string;
  completionRate: number;
}

export interface LabRepairItem {
  id: string;
  status: string;
  fault_type?: string;
  created_at?: string;
  device?: {
    imei: string;
    device_models?: {
      model_name: string;
    } | null;
  } | null;
  warranty?: {
    customer_name: string;
    customer_phone: string;
  } | null;
}

/**
 * שליפת סטטיסטיקות דשבורד מעבדה (RPC)
 */
async function fetchLabDashboardStats(): Promise<LabDashboardStats> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('get_lab_dashboard_stats');

  if (error) {
    throw new Error(`Failed to fetch lab stats: ${error.message}`);
  }

  return (data as unknown as LabDashboardStats) || {
    pendingRepairs: 0,
    inProgressRepairs: 0,
    completedToday: 0,
    monthlyCompleted: 0,
    monthlyRevenue: 0,
    averageRepairTime: 0,
    topFaultType: '',
    completionRate: 0,
  };
}

/**
 * שליפת תיקונים אחרונים של מעבדה
 */
async function fetchLabRecentRepairs(labId: string): Promise<LabRepairItem[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('repairs')
    .select(`
      *,
      device:devices(
        imei,
        device_models(model_name)
      ),
      warranty:warranties(
        customer_name,
        customer_phone
      )
    `)
    .eq('lab_id', labId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(`Failed to fetch recent repairs: ${error.message}`);
  }

  return (data || []) as any as LabRepairItem[];
}

/**
 * שליפת תיקונים דחופים (מעל 48 שעות)
 */
async function fetchLabUrgentRepairs(labId: string): Promise<LabRepairItem[]> {
  const supabase = createClient();

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const { data, error } = await supabase
    .from('repairs')
    .select(`
      *,
      device:devices(
        imei,
        device_models(model_name)
      ),
      warranty:warranties(
        customer_name,
        customer_phone
      )
    `)
    .eq('lab_id', labId)
    .in('status', ['received', 'in_progress'])
    .lt('created_at', twoDaysAgo.toISOString())
    .order('created_at', { ascending: true })
    .limit(5);

  if (error) {
    throw new Error(`Failed to fetch urgent repairs: ${error.message}`);
  }

  return (data || []) as any as LabRepairItem[];
}

/**
 * Hook לסטטיסטיקות דשבורד מעבדה
 */
export function useLabDashboardStats() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['lab', 'dashboard', 'stats'],
    queryFn: fetchLabDashboardStats,
    refetchInterval: 60 * 1000, // 60 seconds as backup to Realtime
  });

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();

    const repairsChannel = supabase
      .channel('lab-dashboard-stats')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'repairs',
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['lab', 'dashboard', 'stats'],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(repairsChannel);
    };
  }, [queryClient]);

  return {
    stats: query.data || {
      pendingRepairs: 0,
      inProgressRepairs: 0,
      completedToday: 0,
      monthlyCompleted: 0,
      monthlyRevenue: 0,
      averageRepairTime: 0,
      topFaultType: '',
      completionRate: 0,
    },
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook לתיקונים אחרונים של מעבדה
 */
export function useLabRecentRepairs(labId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['lab', 'recent-repairs', labId],
    queryFn: () => {
      if (!labId) throw new Error('Lab ID is required');
      return fetchLabRecentRepairs(labId);
    },
    enabled: !!labId,
    refetchInterval: 60 * 1000, // 60 seconds as backup to Realtime
  });

  // Realtime subscription
  useEffect(() => {
    if (!labId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`lab-recent-repairs-${labId}`)
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
            queryKey: ['lab', 'recent-repairs', labId],
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
 * Hook לתיקונים דחופים של מעבדה
 */
export function useLabUrgentRepairs(labId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['lab', 'urgent-repairs', labId],
    queryFn: () => {
      if (!labId) throw new Error('Lab ID is required');
      return fetchLabUrgentRepairs(labId);
    },
    enabled: !!labId,
    refetchInterval: 60 * 1000, // 60 seconds as backup to Realtime
  });

  // Realtime subscription
  useEffect(() => {
    if (!labId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`lab-urgent-repairs-${labId}`)
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
            queryKey: ['lab', 'urgent-repairs', labId],
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
