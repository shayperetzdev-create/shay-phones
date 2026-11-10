'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Save, Bell } from 'lucide-react';

interface NotificationPreferences {
  emailOnRepairAssigned: boolean;
  emailOnRepairCompleted: boolean;
  emailOnPaymentReceived: boolean;
  emailOnWarrantyExpiring: boolean;
  emailOnReplacementRequest: boolean;
}

const defaultPreferences: NotificationPreferences = {
  emailOnRepairAssigned: true,
  emailOnRepairCompleted: true,
  emailOnPaymentReceived: true,
  emailOnWarrantyExpiring: true,
  emailOnReplacementRequest: true,
};

interface NotificationOption {
  id: keyof NotificationPreferences;
  label: string;
  description: string;
  roles?: ('admin' | 'store' | 'lab')[];
}

const notificationOptions: NotificationOption[] = [
  {
    id: 'emailOnRepairAssigned',
    label: 'התראה על תיקון חדש',
    description: 'קבל התראה כאשר תיקון חדש נוצר במערכת.',
    roles: ['admin', 'lab'],
  },
  {
    id: 'emailOnRepairCompleted',
    label: 'התראה על השלמת תיקון',
    description: 'קבל התראה כאשר תיקון הושלם בהצלחה.',
    roles: ['admin', 'store', 'lab'],
  },
  {
    id: 'emailOnPaymentReceived',
    label: 'התראה על תשלום',
    description: 'קבל התראה כאשר תשלום מתקבל או נרשם במערכת.',
    roles: ['admin', 'lab'],
  },
  {
    id: 'emailOnWarrantyExpiring',
    label: 'התראה על אחריות שפגה',
    description: 'קבל התראה כאשר אחריות עומדת לפוג בקרוב.',
    roles: ['admin', 'store'],
  },
  {
    id: 'emailOnReplacementRequest',
    label: 'התראה על בקשת החלפה',
    description: 'קבל התראה כאשר מתקבלת בקשת החלפה חדשה.',
    roles: ['admin', 'store', 'lab'],
  },
];

export function NotificationPreferencesCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'store' | 'lab' | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationPreferences>(defaultPreferences);

  const supabase = createClient();
  const { toast } = useToast();

  const loadNotificationSettings = useCallback(async (id: string) => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('notification_preferences, role')
        .eq('id', id)
        .single() as { data: { notification_preferences: any; role: 'admin' | 'store' | 'lab' } | null };

      if (userData) {
        setUserRole(userData.role);

        if (userData?.notification_preferences) {
          setNotificationSettings({
            emailOnRepairAssigned: userData.notification_preferences.emailOnRepairAssigned ?? true,
            emailOnRepairCompleted: userData.notification_preferences.emailOnRepairCompleted ?? true,
            emailOnPaymentReceived: userData.notification_preferences.emailOnPaymentReceived ?? true,
            emailOnWarrantyExpiring: userData.notification_preferences.emailOnWarrantyExpiring ?? true,
            emailOnReplacementRequest: userData.notification_preferences.emailOnReplacementRequest ?? true,
          });
        }
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  }, [supabase]);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        loadNotificationSettings(user.id);
      }
    };
    loadUser();
  }, [supabase, loadNotificationSettings]);

  const handleSaveNotifications = async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const { error } = await (supabase
        .from('users') as any)
        .update({
          notification_preferences: notificationSettings,
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: 'העדפות ההתראות נשמרו בהצלחה',
      });

      loadNotificationSettings(userId);
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לשמור את העדפות ההתראות',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter notification options based on user role
  const filteredOptions = notificationOptions.filter((option) =>
    !option.roles || (userRole && option.roles.includes(userRole))
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <CardTitle>העדפות התראות</CardTitle>
        </div>
        <CardDescription>
          בחר כיצד תרצה לקבל התראות על פעילויות במערכת.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {filteredOptions.map((option, index) => (
          <div key={option.id}>
            {index > 0 && <Separator className="mb-4" />}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor={option.id}>{option.label}</Label>
                <p className="text-sm text-muted-foreground">
                  {option.description}
                </p>
              </div>
              <Switch
                id={option.id}
                checked={notificationSettings[option.id]}
                onCheckedChange={(checked) =>
                  setNotificationSettings({ ...notificationSettings, [option.id]: checked })
                }
              />
            </div>
          </div>
        ))}

        <div className="pt-4">
          <Button onClick={handleSaveNotifications} disabled={isLoading}>
            <Save className="ms-2 h-4 w-4" />
            שמור העדפות
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
