import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface AuthResult {
  user: any;
  role: string;
  isActive: boolean;
}

/**
 * אימות משתמש ובדיקת הרשאות - עם caching פשוט
 * משתמש ב-request headers כדי למנוע בדיקות כפולות
 */
export async function authenticateRequest(
  request: Request,
  allowedRoles?: string[]
): Promise<{ success: true; data: AuthResult } | { success: false; response: NextResponse }> {
  try {
    const supabase = await createClient();

    // קריאה 1: אימות (חובה)
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        response: NextResponse.json({ error: 'לא מורשה' }, { status: 401 })
      };
    }

    // אופטימיזציה: בדוק אם יש JWT claims עם role
    // אם הוספת custom claims (אופציה 1), תוכל להשתמש בזה:
    // const role = user.user_metadata?.role || user.app_metadata?.role;

    // קריאה 2: הרשאות (רק אם אין claims)
    const { data: userData, error: roleError } = await supabase
      .from('users')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (roleError || !userData) {
      return {
        success: false,
        response: NextResponse.json({ error: 'לא ניתן לאמת הרשאות' }, { status: 403 })
      };
    }

    // בדיקת פעילות
    if (!userData.is_active) {
      return {
        success: false,
        response: NextResponse.json({ error: 'חשבון לא פעיל' }, { status: 403 })
      };
    }

    // בדיקת הרשאות לפי role
    if (allowedRoles && !allowedRoles.includes(userData.role)) {
      return {
        success: false,
        response: NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
      };
    }

    return {
      success: true,
      data: {
        user,
        role: userData.role,
        isActive: userData.is_active
      }
    };
  } catch (error: any) {
    console.error('Authentication error:', error);
    return {
      success: false,
      response: NextResponse.json({ error: 'שגיאת שרת' }, { status: 500 })
    };
  }
}

/**
 * בדיקה מהירה אם המשתמש הוא admin
 */
export async function requireAdmin(request: Request) {
  return authenticateRequest(request, ['admin']);
}

/**
 * אימות כללי - כל משתמש מחובר
 */
export async function requireAuth(request: Request) {
  return authenticateRequest(request);
}
