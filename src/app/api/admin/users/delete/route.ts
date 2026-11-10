import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/jwt-helper';

export async function POST(request: Request) {
  try {
    // אופטימיזציה: שימוש ב-JWT claims - אפס קריאות נוספות!
    const auth = await requireAdmin();
    if (!auth.success) return auth.response;

    // קבל את ה-userId למחיקה
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // עכשיו השתמש ב-service client לביצוע המחיקה
    const supabaseService = await createServiceClient();
    
    // מחיקת המשתמש ממערכת האימות של Supabase
    const { error: deleteError } = await supabaseService.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Delete error:', deleteError);
      throw deleteError;
    }
    
    // הרשומה בטבלת 'users' נמחקת אוטומטית בזכות "ON DELETE CASCADE"

    return NextResponse.json({ success: true, message: 'המשתמש נמחק בהצלחה' });
    
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: error.message || 'שגיאה במחיקת משתמש' }, { status: 400 });
  }
}