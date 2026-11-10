
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/jwt-helper';

export async function GET(request: NextRequest) {
  // אופטימיזציה: שימוש ב-JWT claims - אפס קריאות נוספות!
  const auth = await requireAdmin();
  if (!auth.success) return auth.response;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  const supabase = await createClient();
  const results: any[] = [];

  const [
    devicesRes,
    usersRes,
    repairsRes
  ] = await Promise.all([
    supabase
      .from('devices')
      .select('id, imei, imei2, device_models!model_id(model_name)')
      .or(`imei.ilike.%${query}%,imei2.ilike.%${query}%`)
      .limit(5),
    supabase
      .from('users')
      .select('id, full_name, email, role')
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(5),
    supabase
      .from('repairs')
      .select('id, device_id')
      .ilike('id', `%${query}%`)
      .limit(5)
  ]);

  if (devicesRes.error) console.error('Search API - Devices Error:', devicesRes.error);
  if (usersRes.error) console.error('Search API - Users Error:', usersRes.error);
  if (repairsRes.error) console.error('Search API - Repairs Error:', repairsRes.error);

  if (devicesRes.data) {
    results.push(...devicesRes.data.map((d: any) => ({
      id: d.id,
      type: 'Device',
      title: d.imei,
      description: d.device_models?.model_name || 'Unknown model',
      url: `/admin/devices?search=${d.imei}`
    })));
  }

  if (usersRes.data) {
    results.push(...usersRes.data.map((u: any) => ({
      id: u.id,
      type: u.role === 'store' ? 'Store' : u.role === 'lab' ? 'Lab' : 'User',
      title: u.full_name || u.email,
      description: u.email,
      url: `/admin/users?search=${u.email}`
    })));
  }

  if (repairsRes.data) {
    results.push(...repairsRes.data.map((r: any) => ({
      type: 'Repair',
      title: `Repair #${r.id.substring(0, 8)}`,
      description: `Device ID: ${r.device_id.substring(0, 8)}`,
      url: `/admin/repairs?search=${r.id}`
    })));
  }

  return NextResponse.json(results);
}
