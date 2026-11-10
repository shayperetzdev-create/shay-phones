'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchLabRepairTypes } from '@/lib/api/repairs';
import type { RepairType } from '@/types';

export interface Lab {
  id: string;
  full_name: string | null;
  email: string;
}

export interface LabRepairPrice {
  id: string;
  lab_id: string;
  repair_type_id: string;
  price: number;
  is_active: boolean;
  lab: Lab;
}

/**
 * שליפת כל סוגי התיקונים
 */
async function fetchAllRepairTypes(): Promise<RepairType[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('repair_types')
    .select('*')
    .order('name');

  if (error) {
    throw new Error(`Failed to fetch repair types: ${error.message}`);
  }

  return data || [];
}

/**
 * שליפת כל המעבדות הפעילות
 */
async function fetchActiveLabs(): Promise<Lab[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('role', 'lab')
    .eq('is_active', true)
    .order('full_name');

  if (error) {
    throw new Error(`Failed to fetch labs: ${error.message}`);
  }

  return data || [];
}

/**
 * שליפת מחירי מעבדה לסוג תיקון מסוים
 */
async function fetchLabRepairPrices(repairTypeId: string): Promise<LabRepairPrice[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('lab_repair_prices')
    .select(`
      *,
      lab:users!lab_repair_prices_lab_id_fkey(id, full_name, email)
    `)
    .eq('repair_type_id', repairTypeId);

  if (error) {
    throw new Error(`Failed to fetch lab prices: ${error.message}`);
  }

  return (data || []) as any as LabRepairPrice[];
}

/**
 * Hook לשליפת סוגי תיקונים זמינים למעבדה (עם מחירים)
 *
 * @param labId - מזהה המעבדה
 * @returns סוגי תיקונים זמינים עם מחירים
 */
export function useLabRepairTypes(labId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['repair-types', 'lab', labId],
    queryFn: () => {
      if (!labId) throw new Error('Lab ID is required');
      return fetchLabRepairTypes(labId);
    },
    enabled: !!labId,
  });

  // Supabase Realtime subscriptions
  // ✅ Optimization: Single channel with multiple table subscriptions
  // Reduces WebSocket connections from 2 to 1 (50% reduction)
  useEffect(() => {
    if (!labId) return;

    const supabase = createClient();

    const handleChange = () => {
      queryClient.invalidateQueries({
        queryKey: ['repair-types', 'lab', labId],
      });
    };

    const channel = supabase
      .channel(`repair-types-lab-all-${labId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'repair_types',
        },
        handleChange
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lab_repair_prices',
          filter: `lab_id=eq.${labId}`,
        },
        handleChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [labId, queryClient]);

  return {
    repairTypes: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook לכל סוגי התיקונים (ללא מחירים)
 */
export function useAllRepairTypes() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['repair-types', 'all'],
    queryFn: fetchAllRepairTypes,
    staleTime: 5 * 60 * 1000, // 5 minutes - semi-static data
    // No refetchInterval - Realtime subscription handles updates
  });

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('repair-types-all')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'repair_types',
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['repair-types', 'all'],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    repairTypes: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook למעבדות פעילות
 */
export function useActiveLabs() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['labs', 'active'],
    queryFn: fetchActiveLabs,
    staleTime: 5 * 60 * 1000, // 5 minutes - semi-static data
    // No refetchInterval - Realtime subscription handles updates
  });

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('labs-active')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: 'role=eq.lab',
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['labs', 'active'],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    labs: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook למחירי מעבדות לסוג תיקון מסוים
 */
export function useLabRepairPrices(repairTypeId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['lab-repair-prices', repairTypeId],
    queryFn: () => {
      if (!repairTypeId) throw new Error('Repair type ID is required');
      return fetchLabRepairPrices(repairTypeId);
    },
    enabled: !!repairTypeId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!repairTypeId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`lab-repair-prices-${repairTypeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lab_repair_prices',
          filter: `repair_type_id=eq.${repairTypeId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['lab-repair-prices', repairTypeId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [repairTypeId, queryClient]);

  return {
    labPrices: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
