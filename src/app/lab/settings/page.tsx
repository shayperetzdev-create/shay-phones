'use client';

import { SettingsLayout } from '@/components/shared/settings-layout';
import { ProfileSettingsCard } from '@/components/shared/profile-settings-card';
import { PasswordSettingsCard } from '@/components/shared/password-settings-card';
import { NotificationPreferencesCard } from '@/components/shared/notification-preferences-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Lock, Bell } from 'lucide-react';

export default function LabSettingsPage() {
  return (
    <SettingsLayout
      title="הגדרות"
      description="נהל את הגדרות הפרופיל, האבטחה וההתראות שלך."
    >
      <Tabs defaultValue="profile" dir="rtl" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            פרופיל
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            אבטחה
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            התראות
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileSettingsCard />
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <PasswordSettingsCard />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <NotificationPreferencesCard />
        </TabsContent>
      </Tabs>
    </SettingsLayout>
  );
}