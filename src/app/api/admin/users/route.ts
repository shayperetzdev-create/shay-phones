import { createServiceClient } from '@/lib/supabase/server';
import type { User } from '@/types';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/jwt-helper';

export async function POST(request: Request) {
  try {
    // אופטימיזציה: שימוש ב-JWT claims - אפס קריאות נוספות למסד נתונים!
    const auth = await requireAdmin();
    if (!auth.success) return auth.response;

    const data = await request.json();

    // השתמש ב-service client לכל הפעולות
    const supabaseService = await createServiceClient();

    // Create auth user
    const { data: authData, error: authError2 } = await supabaseService.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        phone: data.phone,
        role: data.role,
      }
    });

    if (authError2) throw authError2;

    // Create user in public.users table manually
    // הטריגר אמור לעשות זאת, אבל לפעמים הוא נכשל בגלל RLS
    // נשתמש ב-upsert כדי למנוע duplicates אם הטריגר עבד
    const { error: insertError } = await supabaseService
      .from('users')
      .upsert({
        id: authData.user!.id,
        email: data.email,
        full_name: data.full_name,
        phone: data.phone,
        role: data.role,
        is_active: true,
      }, {
        onConflict: 'id', // אם המשתמש כבר קיים (מהטריגר), עדכן
        ignoreDuplicates: false // עדכן את הנתונים במקרה של התנגשות
      });

    if (insertError) {
      // אם נכשל להוסיף/לעדכן ל-public.users, נמחק את המשתמש מ-auth
      await supabaseService.auth.admin.deleteUser(authData.user!.id);
      throw new Error('Failed to create user profile: ' + insertError.message);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}