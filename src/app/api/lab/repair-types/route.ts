import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireLab } from '@/lib/auth/jwt-helper';

export async function GET() {
  try {
    // אופטימיזציה: שימוש ב-JWT claims - אפס קריאות נוספות!
    const auth = await requireLab();
    if (!auth.success) return auth.response;

    const supabase = await createClient();

    const { data: repairTypes, error } = await supabase
      .from('repair_types')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    return NextResponse.json(repairTypes);
  } catch (error) {
    console.error('Error fetching repair types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repair types' },
      { status: 500 }
    );
  }
}
