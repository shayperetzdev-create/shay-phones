import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { User } from '@/types';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/jwt-helper';

export async function POST(request: Request) {
  try {
    // אופטימיזציה: שימוש ב-JWT claims - אפס קריאות נוספות!
    const auth = await requireAdmin();
    if (!auth.success) return auth.response;

    const { userId, newPassword } = await request.json();

    // השתמש ב-service client לעדכון הסיסמה
    const supabaseService = await createServiceClient();
    
    // עדכן את הסיסמה
    const { error } = await supabaseService.auth.admin.updateUserById(
      userId,
      { 
        password: newPassword,
        email_confirm: true // וודא שהאימייל מאושר
      }
    );

    if (error) throw error;

    // עדכן את זמן העדכון של המשתמש
    const supabaseClient = await createClient();
    const { error: updateError } = await (supabaseClient.from('users') as any)
      .update({
        updated_at: new Date().toISOString()
      } satisfies Partial<User>)
      .eq('id', userId);

    if (updateError) {
      console.error('Update error:', updateError);
    }

    return NextResponse.json({ 
      success: true,
      message: 'הסיסמה אופסה בהצלחה'
    });
    
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { error: error.message || 'שגיאה באיפוס סיסמה' },
      { status: 400 }
    );
  }
}