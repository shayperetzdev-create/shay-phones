'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

interface UserDetailsModalProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdate: () => void;
}

const userSchema = z.object({
  full_name: z.string().min(1, 'שם מלא הוא שדה חובה'),
  phone: z.string().nullable(),
  role: z.enum(['admin', 'store', 'lab']),
  is_active: z.boolean(),
});

type UserFormData = z.infer<typeof userSchema>;

export function UserDetailsModal({ userId, open, onOpenChange, onUserUpdate }: UserDetailsModalProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const supabase = createClient();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  useEffect(() => {
    const fetchUserDetails = async () => {
      if (!userId) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();
        if (error) throw error;
        if (data) {
          const userData = data as User;
          setUser(userData);
          reset({
            full_name: userData.full_name || '',
            phone: userData.phone,
            role: userData.role,
            is_active: userData.is_active,
          });
        }
      } catch (error) {
        console.error('Error fetching user details:', error);
        toast({ title: 'שגיאה בטעינת פרטי המשתמש', variant: 'destructive' });
      }
      setIsLoading(false);
    };

    if (open) {
      fetchUserDetails();
    }
  }, [userId, open, supabase, toast, reset]);

  const handleSave = async (data: UserFormData) => {
    if (!userId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update(data)
        .eq('id', userId);
      if (error) throw error;
      toast({ title: 'פרטי המשתמש עודכנו בהצלחה' });
      onUserUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating user:', error);
      toast({ title: 'שגיאה בעדכון פרטי המשתמש', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>פרטי משתמש</DialogTitle>
          <DialogDescription>ערוך את פרטי המשתמש</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : user ? (
          <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={user.email} disabled />
            </div>
            <div>
              <Label htmlFor="full_name">שם מלא</Label>
              <Input id="full_name" {...register('full_name')} />
              {errors.full_name && <p className="text-sm text-red-500 mt-1">{errors.full_name.message}</p>}
            </div>
            <div>
              <Label htmlFor="phone">טלפון</Label>
              <Input id="phone" {...register('phone')} />
            </div>
            <div>
              <Label htmlFor="role">תפקיד</Label>
              <Select onValueChange={(value) => setValue('role', value as any)} value={user.role}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">מנהל</SelectItem>
                  <SelectItem value="store">חנות</SelectItem>
                  <SelectItem value="lab">מעבדה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="is_active" {...register('is_active')} checked={watch('is_active')} onCheckedChange={(checked) => setValue('is_active', checked)} />
              <Label htmlFor="is_active">משתמש פעיל</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>ביטול</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                שמור שינויים
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div>לא נמצא משתמש</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
