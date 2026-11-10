'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  X, 
  Clock,
  Package,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';

interface SystemAlert {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
  dismissible: boolean;
  icon: any;
}

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  const fetchAlerts = useCallback(async () => {
    try {
      const alertsList: SystemAlert[] = [];

      // Check for pending replacements
      const { count: replacementsCount } = await supabase
        .from('replacement_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (replacementsCount && replacementsCount > 5) {
        alertsList.push({
          id: 'high-replacements',
          type: 'warning',
          title: 'בקשות החלפה רבות ממתינות',
          description: `יש ${replacementsCount} בקשות החלפה הממתינות לאישור`,
          action: {
            label: 'עבור לבקשות',
            href: '/admin/replacements',
          },
          dismissible: true,
          icon: RefreshCw,
        });
      }

      // Check for overdue repairs
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const { count: overdueRepairs } = await supabase
        .from('repairs')
        .select('*', { count: 'exact', head: true })
        .in('status', ['received', 'in_progress'])
        .lt('created_at', threeDaysAgo.toISOString());

      if (overdueRepairs && overdueRepairs > 0) {
        alertsList.push({
          id: 'overdue-repairs',
          type: 'error',
          title: 'תיקונים באיחור',
          description: `${overdueRepairs} תיקונים בטיפול מעל 3 ימים`,
          action: {
            label: 'צפה בתיקונים',
            href: '/admin/repairs?filter=overdue',
          },
          dismissible: false,
          icon: Clock,
        });
      }

      // Check for low warranty activation rate
      const { count: newDevices } = await supabase
        .from('devices')
        .select('*', { count: 'exact', head: true })
        .eq('warranty_status', 'new');

      const { count: totalDevices } = await supabase
        .from('devices')
        .select('*', { count: 'exact', head: true });

      if (totalDevices && newDevices && (newDevices / totalDevices) > 0.4) {
        alertsList.push({
          id: 'low-activation',
          type: 'info',
          title: 'שיעור הפעלת אחריות נמוך',
          description: `${((newDevices / totalDevices) * 100).toFixed(1)}% מהמכשירים טרם הופעלו`,
          action: {
            label: 'דוח מכשירים',
            href: '/admin/devices?filter=new',
          },
          dismissible: true,
          icon: Package,
        });
      }

      // Check for successful milestone
      const { count: completedToday } = await supabase
        .from('repairs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', new Date().toISOString().split('T')[0]);

      if (completedToday && completedToday >= 10) {
        alertsList.push({
          id: 'milestone-repairs',
          type: 'success',
          title: 'יעד יומי הושג!',
          description: `${completedToday} תיקונים הושלמו היום`,
          dismissible: true,
          icon: CheckCircle,
        });
      }

      // Filter out dismissed alerts
      const activeAlerts = alertsList.filter(
        alert => !dismissedAlerts.includes(alert.id)
      );

      setAlerts(activeAlerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, dismissedAlerts]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 100000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const dismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => [...prev, alertId]);
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  if (isLoading || alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const Icon = alert.icon;
        const variantMap = {
          warning: 'default',
          error: 'destructive',
          info: 'default',
          success: 'default',
        };

        return (
          <Alert 
            key={alert.id} 
            variant={variantMap[alert.type] as any}
            className={`
              ${alert.type === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-950' : ''}
              ${alert.type === 'info' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : ''}
              ${alert.type === 'warning' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950' : ''}
            `}
          >
            <Icon className={`h-4 w-4 ${
              alert.type === 'success' ? 'text-green-600' :
              alert.type === 'info' ? 'text-blue-600' :
              alert.type === 'warning' ? 'text-yellow-600' :
              'text-red-600'
            }`} />
            <AlertTitle className="flex items-center justify-between">
              <span>{alert.title}</span>
              {alert.dismissible && (
                <button
                  title="הסתר הודעה"
                  onClick={() => dismissAlert(alert.id)}
                  className="ms-auto hover:opacity-70 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </AlertTitle>
            <AlertDescription className="flex items-center justify-between mt-2">
              <span>{alert.description}</span>
              {alert.action && (
                <Link href={alert.action.href}>
                  <Button size="sm" variant="outline" className="ms-4">
                    {alert.action.label}
                  </Button>
                </Link>
              )}
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}