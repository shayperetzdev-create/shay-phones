'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * שליפת מכשירים ללא אחריות
 */
async function fetchDevicesWithoutWarranty() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('devices_with_status')
    .select('*')
    .eq('warranty_status', 'new');

  if (error) {
    throw new Error(`Failed to fetch devices: ${error.message}`);
  }

  return data || [];
}

/**
 * Hook לשליפת מכשירים ללא אחריות עם Realtime updates
 */
export function useDevicesWithoutWarranty() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['devices', 'without-warranty'],
    queryFn: fetchDevicesWithoutWarranty,
    staleTime: 2 * 60 * 1000, // 2 minutes - semi-static data
    refetchInterval: 5 * 60 * 1000, // 5 minutes as backup to Realtime
  });

  // Supabase Realtime subscription
  // ✅ Optimization: Single channel with multiple table subscriptions
  // Reduces WebSocket connections from 2 to 1 (50% reduction)
  useEffect(() => {
    const supabase = createClient();

    const handleChange = () => {
      queryClient.invalidateQueries({
        queryKey: ['devices', 'without-warranty'],
      });
    };

    const channel = supabase
      .channel('devices-without-warranty-all')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
        },
        handleChange
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'warranties',
        },
        handleChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    devices: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
