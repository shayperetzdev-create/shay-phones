'use client';

import { useEffect, useMemo, useState } from 'react';
import { opsClient } from '@/lib/ops';

type Location = { id: string; name: string; location_type: string; assigned_user_id: string | null };
type Carton = { id: string; carton_code: string; location_id: string | null; quantity: number; device_models: { model_name: string } | null };
type User = { id: string; full_name: string | null; email: string };

export default function VanReportPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [cartons, setCartons] = useState<Carton[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [vanId, setVanId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      opsClient().from('locations').select('id, name, location_type, assigned_user_id').eq('location_type', 'van').order('name'),
      opsClient().from('cartons').select('id, carton_code, location_id, quantity, device_models(model_name)'),
      opsClient().from('users').select('id, full_name, email'),
    ]).then(([locRes, cartonRes, userRes]) => {
      if (locRes.error || cartonRes.error || userRes.error) {
        setError(locRes.error?.message || cartonRes.error?.message || userRes.error?.message || '');
      }
      setLocations(locRes.data ?? []);
      setCartons(cartonRes.data ?? []);
      setUsers(userRes.data ?? []);
      if ((locRes.data ?? []).length > 0) setVanId(locRes.data[0].id);
    });
  }, []);

  const rows = useMemo(
    () => cartons.filter((c) => c.location_id === vanId),
    [cartons, vanId]
  );

  const van = locations.find((l) => l.id === vanId);
  const agent = users.find((u) => u.id === van?.assigned_user_id);

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">דוח סוכן — רכב</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <select className="h-10 w-full max-w-md rounded-md border bg-background px-3" value={vanId} onChange={(e) => setVanId(e.target.value)}>
        <option value="">בחרו רכב</option>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      {van && (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          נציג: {agent?.full_name || agent?.email || 'לא משויך'} · קרטונים ברכב: {rows.length} · יחידות: {rows.reduce((s, r) => s + Number(r.quantity), 0)}
        </div>
      )}
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="flex justify-between px-4 py-3">
            <span>{row.carton_code} · {row.device_models?.model_name}</span>
            <span className="text-muted-foreground">{row.quantity} יח׳</span>
          </li>
        ))}
        {vanId && rows.length === 0 && <li className="px-4 py-6 text-muted-foreground">אין מלאי ברכב זה</li>}
      </ul>
    </div>
  );
}
