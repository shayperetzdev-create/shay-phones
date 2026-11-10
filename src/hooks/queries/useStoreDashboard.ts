'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface StoreDashboardStats {
  activeWarranties: number;
  pendingReplacements: number;
  monthlyActivations: number;
  totalDevices: number;
}

/**
 * שליפת סטטיסטיקות דשבורד חנות
 */
async function fetchStoreDashboardStats(storeId: string): Promise<StoreDashboardStats> {
  const supabase = createClient();

  // Active warranties count
  const { count: activeCount } = await supabase
    .from('warranties')
    .select('*', { count: 'exact' })
    .eq('store_id', storeId)
    .eq('is_active', true)
    .gte('expiry_date', new Date().toISOString());

  // Get device IDs for this store
  const { data: warranties } = await supabase
    .from('warranties')
    .select('device_id')
    .eq('store_id', storeId);

  const deviceIds = (warranties || []).map(w => w.device_id).filter(Boolean) as string[];

  // Pending replacements
  const { count: pendingCount } = await supabase
    .from('replacement_requests')
    .select('*', { count: 'exact' })
    .in('device_id', deviceIds.length > 0 ? deviceIds : [''])
    .eq('status', 'pending');

  // Monthly activations
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count: monthlyCount } = await supabase
    .from('warranties')
    .select('*', { count: 'exact' })
    .eq('store_id', storeId)
    .gte('activation_date', startOfMonth.toISOString());

  // Total devices
  const { data: deviceCountData } = await supabase.rpc('get_store_device_count');

  return {
    activeWarranties: activeCount || 0,
    pendingReplacements: pendingCount || 0,
    monthlyActivations: monthlyCount || 0,
    totalDevices: deviceCountData || 0,
  };
}

/**
 * Hook לסטטיסטיקות דשבורד חנות
 */
export function useStoreDashboardStats(storeId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['store', 'dashboard', 'stats', storeId],
    queryFn: () => {
      if (!storeId) throw new Error('Store ID is required');
      return fetchStoreDashboardStats(storeId);
    },
    enabled: !!storeId,
    refetchInterval: 60 * 1000, // 60 seconds as backup to Realtime
  });

  // Realtime subscription - batched for efficiency
  // ✅ Optimization: Single channel with multiple table subscriptions
  // Reduces WebSocket connections from 2 to 1 (50% reduction)
  useEffect(() => {
    if (!storeId) return;

    const supabase = createClient();

    const handleChange = () => {
      queryClient.invalidateQueries({
        queryKey: ['store', 'dashboard', 'stats', storeId],
      });
    };

    // Single channel monitoring all relevant tables
    const channel = supabase
      .channel(`store-dashboard-all-${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'warranties',
          filter: `store_id=eq.${storeId}`,
        },
        handleChange
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'replacement_requests',
        },
        handleChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, queryClient]);

  return {
    stats: query.data || {
      activeWarranties: 0,
      pendingReplacements: 0,
      monthlyActivations: 0,
      totalDevices: 0,
    },
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
