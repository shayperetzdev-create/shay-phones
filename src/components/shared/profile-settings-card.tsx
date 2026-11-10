'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Save, User as UserIcon, Phone, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const profileSettingsSchema = z.object({
  full_name: z.string().min(2, 'שם מלא חייב להכיל לפחות 2 תווים'),
  phone: z.string().min(9, 'מספר טלפון לא תקין'),
});

type ProfileSettingsFormData = z.infer<typeof profileSettingsSchema>;

export function ProfileSettingsCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState<User | null>(null);
  const supabase = createClient();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProfileSettingsFormData>({
    resolver: zodResolver(profileSettingsSchema),
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('משתמש לא מחובר');

      const { data: userRecord } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single() as { data: User | null };

      if (userRecord) {
        setUserData(userRecord);
        setValue('full_name', userRecord.full_name || '');
        setValue('phone', userRecord.phone || '');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את נתוני המשתמש',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [supabase, setValue, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onSubmit = async (data: ProfileSettingsFormData) => {
    if (!userData) return;

    setIsLoading(true);
    try {
      const updates: Partial<User> = {
        full_name: data.full_name,
        phone: data.phone,
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase.from('users') as any)
        .update(updates)
        .eq('id', userData.id);

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: 'הפרטים האישיים עודכנו בהצלחה',
      });

      loadData();
    } catch (error: any) {
      // כאן השרת יחזיר שגיאה אם משתמש לא מורשה ינסה לעדכן
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לשמור את הפרטים',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // בדיקה אם המשתמש הוא חנות או מעבדה
  const isEditingDisabled = userData?.role === 'store' || userData?.role === 'lab';

  if (isLoading && !userData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>פרטים אישיים</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>פרטים אישיים</CardTitle>
        {/* עדכון התיאור בהתאם להרשאות */}
        <CardDescription>
          {isEditingDisabled
            ? 'באפשרותך לצפות בפרטים האישיים שלך. רק מנהל מערכת יכול לעדכן אותם.'
            : 'עדכן את הפרטים האישיים שלך.'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">שם מלא</Label>
              <div className="relative">
                <UserIcon className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="full_name"
                  {...register('full_name')}
                  className="pr-10"
                  disabled={isEditingDisabled} // נטרול שדה
                />
              </div>
              {errors.full_name && (
                <p className="text-sm text-red-500">{errors.full_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">טלפון</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  {...register('phone')}
                  className="pr-10"
                  disabled={isEditingDisabled} // נטרול שדה
                />
              </div>
              {errors.phone && (
                <p className="text-sm text-red-500">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>אימייל</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input value={userData?.email || ''} disabled className="pr-10 bg-muted" />
              </div>
               <p className="text-sm text-muted-foreground">
                לא ניתן לשנות את כתובת האימייל.
              </p>
            </div>
          </div>

          <Button type="submit" disabled={isLoading || isEditingDisabled}> {/* נטרול כפתור */}
            <Save className="ms-2 h-4 w-4" />
            שמור שינויים
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}