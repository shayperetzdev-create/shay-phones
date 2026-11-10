'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, Warranty, Repair } from '@/types';
import { Trophy, TrendingUp, Store, Wrench } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface Performer {
  id: string;
  name: string;
  type: 'store' | 'lab';
  metric: number;
  metricLabel: string;
  trend: 'up' | 'down' | 'neutral';
  rank: number;
  avatar?: string;
}

interface WarrantyCount {
  store_id: string;
  id: string;
}

interface RepairCount {
  lab_id: string;
  id: string;
  status: string;
}

export function TopPerformers() {
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'stores' | 'labs'>('stores');
  const supabase = createClient();

  const fetchTopPerformers = useCallback(async () => {
    try {
      setIsLoading(true);
      
      if (selectedTab === 'stores') {
        // Fetch top stores by warranty activations
        const { data: stores } = await supabase
          .from('users')
          .select('id, full_name, email')
          .eq('role', 'store')
          .limit(5)
          .returns<Pick<User, 'id' | 'full_name' | 'email'>[]>();

        const { data: warrantyCounts } = await supabase
          .from('warranties')
          .select('store_id, id')
          .not('store_id', 'is', null)
          .returns<Array<Pick<Warranty, 'store_id' | 'id'>>>();

        // Count warranties per store
        const storeCounts = (warrantyCounts || []).reduce((acc, w) => {
          if (!w.store_id) {
            return acc;
          }
          acc[w.store_id] = (acc[w.store_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};

        const topStores = (stores || []).map((store, index) => ({
          id: store.id,
          name: store.full_name || store.email || 'חנות',
          type: 'store' as const,
          metric: storeCounts[store.id] || 0,
          metricLabel: 'הפעלות אחריות',
          trend: 'up' as const,
          rank: index + 1,
        })) || [];

        // Sort by metric and take top 5
        topStores.sort((a, b) => b.metric - a.metric);
        setPerformers(topStores.slice(0, 5));
        
      } else {
        // Fetch top labs by repairs completed
        const { data: labs } = await supabase
          .from('users')
          .select('id, full_name, email')
          .eq('role', 'lab')
          .limit(5)
          .returns<Pick<User, 'id' | 'full_name' | 'email'>[]>();

        const { data: repairCounts } = await supabase
          .from('repairs')
          .select('lab_id, id, status')
          .eq('status', 'completed')
          .not('lab_id', 'is', null)
          .returns<Array<Pick<Repair, 'lab_id' | 'id' | 'status'>>>();

        // Count completed repairs per lab
        const labCounts = (repairCounts || []).reduce((acc, r) => {
          if (!r.lab_id) {
            return acc;
          }
          acc[r.lab_id] = (acc[r.lab_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};

        const topLabs = (labs || []).map((lab, index) => ({
          id: lab.id,
          name: lab.full_name || lab.email || 'מעבדה',
          type: 'lab' as const,
          metric: labCounts[lab.id] || 0,
          metricLabel: 'תיקונים הושלמו',
          trend: 'up' as const,
          rank: index + 1,
        })) || [];

        // Sort by metric and take top 5
        topLabs.sort((a, b) => b.metric - a.metric);
        setPerformers(topLabs.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching top performers:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTab, supabase]);

  useEffect(() => {
    fetchTopPerformers();
  }, [fetchTopPerformers]);

  const maxMetric = Math.max(...performers.map(p => p.metric)) || 1;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4 space-x-reverse">
            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab Selection */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg">
        <button
          onClick={() => setSelectedTab('stores')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            selectedTab === 'stores'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Store className="h-4 w-4" />
          חנויות
        </button>
        <button
          onClick={() => setSelectedTab('labs')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            selectedTab === 'labs'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Wrench className="h-4 w-4" />
          מעבדות
        </button>
      </div>

      {/* Performers List */}
      <div className="space-y-3">
        {performers.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            אין נתונים להצגה
          </p>
        ) : (
          performers.map((performer) => (
            <div key={performer.id} className="flex items-center gap-3">
              {/* Rank */}
              <div className="flex items-center justify-center w-8 h-8">
                {performer.rank === 1 ? (
                  <Trophy className="h-5 w-5 text-yellow-500" />
                ) : performer.rank === 2 ? (
                  <Trophy className="h-5 w-5 text-gray-400" />
                ) : performer.rank === 3 ? (
                  <Trophy className="h-5 w-5 text-orange-600" />
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">
                    {performer.rank}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <Avatar className="h-8 w-8">
                <AvatarImage src={performer.avatar} />
                <AvatarFallback className="text-xs">
                  {performer.name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{performer.name}</p>
                  {performer.trend === 'up' && (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Progress 
                    value={(performer.metric / maxMetric) * 100} 
                    className="h-1.5 flex-1"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {performer.metric} {performer.metricLabel}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}