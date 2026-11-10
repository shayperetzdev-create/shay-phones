'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const userSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  password: z.string().min(6, 'סיסמה חייבת להכיל לפחות 6 תווים'),
  full_name: z.string().min(2, 'שם מלא חייב להכיל לפחות 2 תווים'),
  phone: z.string(),
  role: z.enum(['admin', 'ops', 'marketing', 'store', 'lab']),
});

type UserFormData = z.infer<typeof userSchema>;

export default function NewUserPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: UserFormData) => {
    setIsLoading(true);

    try {
      // Use service role to create user
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error);

      toast({
        title: 'הצלחה',
        description: 'המשתמש נוסף בהצלחה',
      });

      router.push('/admin/users');
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>הוספת משתמש חדש</CardTitle>
          <CardDescription>הוסף משתמש חדש למערכת</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="email">אימייל</Label>
                <Input id="email" type="email" {...register('email')} />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="password">סיסמה</Label>
                <Input id="password" type="password" {...register('password')} />
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="full_name">שם מלא</Label>
                <Input id="full_name" {...register('full_name')} />
                {errors.full_name && (
                  <p className="text-sm text-red-500">{errors.full_name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="phone">טלפון</Label>
                <Input id="phone" {...register('phone')} />
              </div>

              <div>
                <Label htmlFor="role">תפקיד</Label>
                <Select onValueChange={(value) => setValue('role', value as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר תפקיד" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">מנהל</SelectItem>
                    <SelectItem value="ops">תפעול</SelectItem>
                    <SelectItem value="marketing">שיווק</SelectItem>
                    <SelectItem value="store">חנות</SelectItem>
                    <SelectItem value="lab">מעבדה</SelectItem>
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-sm text-red-500">{errors.role.message}</p>
                )}
              </div>

            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'מוסיף...' : 'הוסף משתמש'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/admin/users')}
              >
                ביטול
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}