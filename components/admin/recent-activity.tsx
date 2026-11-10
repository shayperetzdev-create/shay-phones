'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/utils';
import { Shield, Wrench, RefreshCw } from 'lucide-react';

interface Activity {
  id: string;
  type: 'warranty' | 'repair' | 'replacement' | 'device' | 'payment';
  description: string;
  timestamp: string;
  icon: any;
  color: string;
}

interface WarrantyData {
  id: string;
  device_id: string;
  created_at: string;
  device?: {
    imei: string;
    device_models: {
      model_name: string;
    } | null;
  };
}

interface RepairData {
  id: string;
  device_id: string;
  created_at: string;
  device?: {
    imei: string;
    device_models: {
      model_name: string;
    } | null;
  };
}

interface ReplacementData {
  id: string;
  device_id: string;
  created_at: string;
  device?: {
    imei: string;
    device_models: {
      model_name: string;
    } | null;
  };
}

export function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  const fetchRecentActivity = useCallback(async () => {
    try {
      const activities: Activity[] = [];
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Fetch recent warranties
      const { data: warranties } = await supabase
        .from('warranties')
        .select('*, device:devices(imei, device_models(model_name))')
        .gte('created_at', oneDayAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      if (warranties && warranties.length > 0) {
        warranties.forEach((w: WarrantyData) => {
          activities.push({
            id: `warranty-${w.id}`,
            type: 'warranty',
            description: `אחריות הופעלה למכשיר ${w.device?.device_models?.model_name || w.device_id}`,
            timestamp: w.created_at,
            icon: Shield,
            color: 'text-green-600',
          });
        });
      }

      // Fetch recent repairs
      const { data: repairs } = await supabase
        .from('repairs')
        .select('*, device:devices(imei, device_models(model_name))')
        .gte('created_at', oneDayAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      if (repairs && repairs.length > 0) {
        repairs.forEach((r: RepairData) => {
          activities.push({
            id: `repair-${r.id}`,
            type: 'repair',
            description: `תיקון חדש נפתח עבור ${r.device?.device_models?.model_name || r.device_id}`,
            timestamp: r.created_at,
            icon: Wrench,
            color: 'text-blue-600',
          });
        });
      }

      // Fetch recent replacement requests
      const { data: replacements } = await supabase
        .from('replacement_requests')
        .select('*, device:devices(imei, device_models(model_name))')
        .gte('created_at', oneDayAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      if (replacements && replacements.length > 0) {
        replacements.forEach((r: ReplacementData) => {
          activities.push({
            id: `replacement-${r.id}`,
            type: 'replacement',
            description: `בקשת החלפה הוגשה עבור ${r.device?.device_models?.model_name || r.device_id}`,
            timestamp: r.created_at,
            icon: RefreshCw,
            color: 'text-orange-600',
          });
        });
      }

      // Sort by timestamp and take the most recent 5
      activities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setActivities(activities.slice(0, 5));
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchRecentActivity();
  }, [fetchRecentActivity]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4 space-x-reverse">
            <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        אין פעילות אחרונה
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => {
        const Icon = activity.icon;
        return (
          <div key={activity.id} className="flex items-center space-x-4 space-x-reverse">
            <div className={`p-2 rounded-full bg-gray-100 dark:bg-gray-800 ${activity.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">{activity.description}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(activity.timestamp)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}