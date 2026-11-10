import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/jwt-helper';

export async function GET() {
  try {
    // אופטימיזציה: שימוש ב-JWT claims - אפס קריאות נוספות!
    const auth = await requireAdmin();
    if (!auth.success) return auth.response;

    const supabase = await createClient();

    const { data: repairTypes, error } = await supabase
      .from('repair_types')
      .select('*')
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

export async function POST(request: Request) {
  try {
    // אופטימיזציה: שימוש ב-JWT claims - אפס קריאות נוספות!
    const auth = await requireAdmin();
    if (!auth.success) return auth.response;

    const supabase = await createClient();

    const body = await request.json();
    const { name, description } = body;

    const { data, error } = await (supabase
      .from('repair_types') as any)
      .insert({
        name,
        description,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating repair type:', error);
    return NextResponse.json(
      { error: 'Failed to create repair type' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    // אופטימיזציה: שימוש ב-JWT claims - אפס קריאות נוספות!
    const auth = await requireAdmin();
    if (!auth.success) return auth.response;

    const supabase = await createClient();

    const body = await request.json();
    const { id, name, description, is_active } = body;

    const { data, error } = await (supabase
      .from('repair_types') as any)
      .update({ name, description, is_active })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating repair type:', error);
    return NextResponse.json(
      { error: 'Failed to update repair type' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    // אופטימיזציה: שימוש ב-JWT claims - אפס קריאות נוספות!
    const auth = await requireAdmin();
    if (!auth.success) return auth.response;

    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('repair_types')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting repair type:', error);
    return NextResponse.json(
      { error: 'Failed to delete repair type' },
      { status: 500 }
    );
  }
}
