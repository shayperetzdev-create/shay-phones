import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireLab } from '@/lib/auth/jwt-helper';

export async function GET() {
  try {
    // אופטימיזציה: שימוש ב-JWT claims - אפס קריאות נוספות!
    const auth = await requireLab();
    if (!auth.success) return auth.response;

    const supabase = await createClient();

    const { data: prices, error } = await supabase
      .from('lab_repair_prices')
      .select(`
        *,
        repair_types (
          id,
          name,
          description
        )
      `)
      .eq('lab_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(prices);
  } catch (error) {
    console.error('Error fetching repair prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repair prices' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // אופטימיזציה: שימוש ב-JWT claims - אפס קריאות נוספות!
    const auth = await requireLab();
    if (!auth.success) return auth.response;

    const supabase = await createClient();

    const body = await request.json();
    const { repair_type_id, price, notes } = body;

    const { data, error } = await (supabase
      .from('lab_repair_prices') as any)
      .insert({
        lab_id: auth.user.id,
        repair_type_id,
        price,
        notes,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating repair price:', error);
    return NextResponse.json(
      { error: 'Failed to create repair price' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    // אופטימיזציה: שימוש ב-JWT claims - אפס קריאות נוספות!
    const auth = await requireLab();
    if (!auth.success) return auth.response;

    const supabase = await createClient();

    const body = await request.json();
    const { id, price, is_active, notes } = body;

    const { data, error } = await (supabase
      .from('lab_repair_prices') as any)
      .update({ price, is_active, notes })
      .eq('id', id)
      .eq('lab_id', auth.user.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating repair price:', error);
    return NextResponse.json(
      { error: 'Failed to update repair price' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    // אופטימיזציה: שימוש ב-JWT claims - אפס קריאות נוספות!
    const auth = await requireLab();
    if (!auth.success) return auth.response;

    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const { error } = await supabase
      .from('lab_repair_prices')
      .delete()
      .eq('id', id)
      .eq('lab_id', auth.user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting repair price:', error);
    return NextResponse.json(
      { error: 'Failed to delete repair price' },
      { status: 500 }
    );
  }
}
