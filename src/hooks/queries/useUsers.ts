'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@/types';

export interface UserStats {
  totalWarranties: number;
  activeWarranties: number;
  monthlyActivations: number;
  totalRepairs: number;
  pendingRepairs: number;
  completedRepairs: number;
}

/**
 * שליפת כל המשתמשים
 */
async function fetchAllUsers(): Promise<User[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  return (data || []) as User[];
}

/**
 * שליפת סטטיסטיקות למשתמש
 */
async function fetchUserStats(userId: string, role: string): Promise<UserStats> {
  const supabase = createClient();

  const stats: UserStats = {
    totalWarranties: 0,
    activeWarranties: 0,
    monthlyActivations: 0,
    totalRepairs: 0,
    pendingRepairs: 0,
    completedRepairs: 0,
  };

  if (role === 'store') {
    // Store stats
    const { count: totalWarranties } = await supabase
      .from('warranties')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', userId);

    const { count: activeWarranties } = await supabase
      .from('warranties')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', userId)
      .eq('is_active', true)
      .gte('expiry_date', new Date().toISOString());

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: monthlyActivations } = await supabase
      .from('warranties')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', userId)
      .gte('activation_date', startOfMonth.toISOString());

    stats.totalWarranties = totalWarranties || 0;
    stats.activeWarranties = activeWarranties || 0;
    stats.monthlyActivations = monthlyActivations || 0;
  } else if (role === 'lab') {
    // Lab stats
    const { count: totalRepairs } = await supabase
      .from('repairs')
      .select('*', { count: 'exact', head: true })
      .eq('lab_id', userId);

    const { count: pendingRepairs } = await supabase
      .from('repairs')
      .select('*', { count: 'exact', head: true })
      .eq('lab_id', userId)
      .in('status', ['received', 'in_progress']);

    const { count: completedRepairs } = await supabase
      .from('repairs')
      .select('*', { count: 'exact', head: true })
      .eq('lab_id', userId)
      .eq('status', 'completed');

    stats.totalRepairs = totalRepairs || 0;
    stats.pendingRepairs = pendingRepairs || 0;
    stats.completedRepairs = completedRepairs || 0;
  }

  return stats;
}

/**
 * Hook לכל המשתמשים
 */
export function useAllUsers() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['users', 'all'],
    queryFn: fetchAllUsers,
    staleTime: 2 * 60 * 1000, // 2 minutes - semi-static data
    // No refetchInterval - Realtime subscription handles updates
  });

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('users-all')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['users', 'all'],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    users: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook לסטטיסטיקות משתמש
 */
export function useUserStats(userId: string | null, role: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['user', 'stats', userId],
    queryFn: () => {
      if (!userId || !role) throw new Error('User ID and role are required');
      return fetchUserStats(userId, role);
    },
    enabled: !!userId && !!role,
    refetchInterval: 60 * 1000, // 60 seconds as backup to Realtime
  });

  // Realtime subscriptions based on role
  useEffect(() => {
    if (!userId || !role) return;

    const supabase = createClient();

    if (role === 'store') {
      const channel = supabase
        .channel(`user-stats-store-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'warranties',
            filter: `store_id=eq.${userId}`,
          },
          () => {
            queryClient.invalidateQueries({
              queryKey: ['user', 'stats', userId],
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else if (role === 'lab') {
      const channel = supabase
        .channel(`user-stats-lab-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'repairs',
            filter: `lab_id=eq.${userId}`,
          },
          () => {
            queryClient.invalidateQueries({
              queryKey: ['user', 'stats', userId],
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId, role, queryClient]);

  return {
    stats: query.data || {
      totalWarranties: 0,
      activeWarranties: 0,
      monthlyActivations: 0,
      totalRepairs: 0,
      pendingRepairs: 0,
      completedRepairs: 0,
    },
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
