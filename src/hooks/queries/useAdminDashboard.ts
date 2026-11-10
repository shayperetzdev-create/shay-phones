'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface AdminDashboardStats {
  total: number;
  new: number;
  active: number;
  expired: number;
  replaced: number;
  inRepair: number;
}

/**
 * שליפת סטטיסטיקות דשבורד מנהל
 */
async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  const supabase = createClient();

  const [devicesResult, repairsResult] = await Promise.all([
    supabase.from('devices_with_status').select('warranty_status'),
    supabase
      .from('repairs')
      .select('device_id', { count: 'exact', head: true })
      .in('status', ['received', 'in_progress']),
  ]);

  if (devicesResult.error) {
    throw new Error(`Failed to fetch devices: ${devicesResult.error.message}`);
  }

  const devices = devicesResult.data || [];
  const stats: AdminDashboardStats = {
    total: devices.length,
    new: devices.filter(d => !d.warranty_status || d.warranty_status === 'new').length,
    active: devices.filter(d => d.warranty_status === 'active').length,
    expired: devices.filter(d => d.warranty_status === 'expired').length,
    replaced: devices.filter(d => d.warranty_status === 'replaced').length,
    inRepair: repairsResult.count || 0,
  };

  return stats;
}

/**
 * Hook לסטטיסטיקות דשבורד מנהל עם Realtime updates
 */
export function useAdminDashboardStats() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: fetchAdminDashboardStats,
    refetchInterval: 60 * 1000, // 60 seconds as backup to Realtime
  });

  // Supabase Realtime subscription - batched for efficiency
  // ✅ Optimization: Single channel with multiple table subscriptions
  // Reduces WebSocket connections from 3 to 1 (66% reduction)
  useEffect(() => {
    const supabase = createClient();

    const handleChange = () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'dashboard', 'stats'],
      });
    };

    // Single channel monitoring all relevant tables
    const channel = supabase
      .channel('admin-dashboard-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devices' },
        handleChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'warranties' },
        handleChange
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'repairs' },
        handleChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    stats: query.data || {
      total: 0,
      new: 0,
      active: 0,
      expired: 0,
      replaced: 0,
      inRepair: 0,
    },
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
