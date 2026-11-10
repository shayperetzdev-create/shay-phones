'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * שליפת כל בקשות ההחלפה (admin)
 */
async function fetchAllReplacementRequests() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('replacement_requests')
    .select(`
      *,
      device:devices(
        *,
        device_model:device_models(model_name),
        warranty:warranties(*)
      ),
      repair:repairs(
        fault_type,
        fault_description,
        lab:users!repairs_lab_id_fkey(full_name, email)
      ),
      requester:users!replacement_requests_requester_id_fkey(full_name, role, email),
      resolver:users!replacement_requests_resolved_by_fkey(full_name)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch replacement requests: ${error.message}`);
  }

  return data || [];
}

/**
 * שליפת בקשות החלפה של חנות ספציפית
 */
async function fetchStoreReplacementRequests(storeId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('replacement_requests')
    .select(`
      *,
      device:devices(
        *,
        device_model:device_models(model_name),
        warranty:warranties(*)
      ),
      repair:repairs(
        fault_type,
        fault_description,
        lab:users!repairs_lab_id_fkey(full_name, email)
      ),
      requester:users!replacement_requests_requester_id_fkey(full_name, role, email),
      resolver:users!replacement_requests_resolved_by_fkey(full_name)
    `)
    .eq('requester_id', storeId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch replacement requests: ${error.message}`);
  }

  return data || [];
}

/**
 * Hook לשליפת כל בקשות ההחלפה (admin) עם Realtime updates
 */
export function useAllReplacementRequests() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['replacement-requests', 'all'],
    queryFn: fetchAllReplacementRequests,
    refetchInterval: 60 * 1000, // 60 seconds as backup to Realtime
  });

  // Supabase Realtime subscription
  // ✅ Optimization: Single channel with multiple table subscriptions
  // Reduces WebSocket connections from 2 to 1 (50% reduction)
  useEffect(() => {
    const supabase = createClient();

    const handleChange = () => {
      queryClient.invalidateQueries({
        queryKey: ['replacement-requests', 'all'],
      });
    };

    const channel = supabase
      .channel('replacement-requests-all-combined')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'replacement_requests',
        },
        handleChange
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
        },
        handleChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    requests: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook לשליפת בקשות החלפה של חנות עם Realtime updates
 */
export function useStoreReplacementRequests(storeId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['replacement-requests', 'store', storeId],
    queryFn: () => {
      if (!storeId) throw new Error('Store ID is required');
      return fetchStoreReplacementRequests(storeId);
    },
    enabled: !!storeId,
    refetchInterval: 60 * 1000, // 60 seconds as backup to Realtime
  });

  // Supabase Realtime subscription
  // ✅ Optimization: Single channel with multiple table subscriptions
  // Reduces WebSocket connections from 2 to 1 (50% reduction)
  useEffect(() => {
    if (!storeId) return;

    const supabase = createClient();

    const handleChange = () => {
      queryClient.invalidateQueries({
        queryKey: ['replacement-requests', 'store', storeId],
      });
    };

    const channel = supabase
      .channel(`replacement-requests-store-all-${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'replacement_requests',
          filter: `requester_id=eq.${storeId}`,
        },
        handleChange
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
        },
        handleChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, queryClient]);

  return {
    requests: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
