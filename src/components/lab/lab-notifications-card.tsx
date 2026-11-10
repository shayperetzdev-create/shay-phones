
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

export function LabNotificationsCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [notificationSettings, setNotificationSettings] = useState({
    emailOnRepairAssigned: true,
    emailOnRepairCompleted: true,
    emailOnPaymentReceived: true,
  });

  const supabase = createClient();
  const { toast } = useToast();

  const loadNotificationSettings = useCallback(async (id: string) => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('notification_preferences')
        .eq('id', id)
        .single() as { data: { notification_preferences: any } | null };

      if (userData?.notification_preferences) {
        setNotificationSettings({
          emailOnRepairAssigned: userData.notification_preferences.emailOnRepairAssigned ?? true,
          emailOnRepairCompleted: userData.notification_preferences.emailOnRepairCompleted ?? true,
          emailOnPaymentReceived: userData.notification_preferences.emailOnPaymentReceived ?? true,
        });
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <CardTitle>העדפות התראות</CardTitle>
        </div>
        <CardDescription>
          הגדר כיצד תרצה לקבל התראות.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="emailOnRepairAssigned">התראה על תיקון חדש</Label>
            <p className="text-sm text-muted-foreground">
              קבל התראה כאשר תיקון חדש מוקצה אליך.
            </p>
          </div>
          <Switch
            id="emailOnRepairAssigned"
            checked={notificationSettings.emailOnRepairAssigned}
            onCheckedChange={(checked) =>
              setNotificationSettings({ ...notificationSettings, emailOnRepairAssigned: checked })
            }
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="emailOnRepairCompleted">התראה על השלמת תיקון</Label>
            <p className="text-sm text-muted-foreground">
              קבל התראה כאשר תיקון מסומן כהושלם.
            </p>
          </div>
          <Switch
            id="emailOnRepairCompleted"
            checked={notificationSettings.emailOnRepairCompleted}
            onCheckedChange={(checked) =>
              setNotificationSettings({ ...notificationSettings, emailOnRepairCompleted: checked })
            }
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="emailOnPaymentReceived">התראה על תשלום שהתקבל</Label>
            <p className="text-sm text-muted-foreground">
              קבל התראה כאשר תשלום מתקבל מהמנהל.
            </p>
          </div>
          <Switch
            id="emailOnPaymentReceived"
            checked={notificationSettings.emailOnPaymentReceived}
            onCheckedChange={(checked) =>
              setNotificationSettings({ ...notificationSettings, emailOnPaymentReceived: checked })
            }
          />
        </div>

        <Button onClick={handleSaveNotifications} disabled={isLoading}>
          <Save className="ms-2 h-4 w-4" />
          שמור העדפות
        </Button>
      </CardContent>
    </Card>
  );
}
