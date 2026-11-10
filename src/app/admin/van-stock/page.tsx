'use client';

import { FormEvent, useEffect, useState } from 'react';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Location = { id: string; name: string; location_type: string; assigned_user_id: string | null };
type Carton = { id: string; carton_code: string; location_id: string | null; quantity: number; device_models: { model_name: string } | null };
type User = { id: string; full_name: string | null; email: string };

export default function VanStockPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [cartons, setCartons] = useState<Carton[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [vanName, setVanName] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [targetLocationId, setTargetLocationId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const [locRes, cartonRes, userRes] = await Promise.all([
      opsClient().from('locations').select('id, name, location_type, assigned_user_id').order('name'),
      opsClient().from('cartons').select('id, carton_code, location_id, quantity, device_models(model_name)').order('carton_code'),
      opsClient().from('users').select('id, full_name, email').in('role', ['ops', 'marketing', 'admin']).eq('is_active', true),
    ]);
    setLocations(locRes.data ?? []);
    setCartons(cartonRes.data ?? []);
    setUsers(userRes.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const createVan = async (event: FormEvent) => {
    event.preventDefault();
    const { error: insertError } = await opsClient().from('locations').insert({
      name: vanName.trim(),
      location_type: 'van',
      assigned_user_id: assignedUserId || null,
      notes: assignedUserId ? `van:${assignedUserId}` : null,
    });
    if (insertError) { setError(insertError.message); return; }
    setVanName('');
    await load();
  };

  const moveCartons = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    const { data, error: rpcError } = await opsClient().rpc('move_cartons_to_location', {
      p_carton_ids: selected,
      p_location_id: targetLocationId,
    });
    if (rpcError) { setError(rpcError.message); return; }
    setMessage(`הועברו ${data} קרטונים`);
    setSelected([]);
    await load();
  };

  const vans = locations.filter((l) => l.location_type === 'van');

  return (
    <div className="space-y-8" dir="rtl">
      <h1 className="text-2xl font-bold">מלאי רכב</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <form onSubmit={createVan} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3">
        <Input placeholder="שם רכב / מיקום נייד" value={vanName} onChange={(e) => setVanName(e.target.value)} required />
        <select className="h-10 rounded-md border bg-background px-3" value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)}>
          <option value="">נציג משויך</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
        </select>
        <Button type="submit">יצירת רכב</Button>
      </form>

      <form onSubmit={moveCartons} className="space-y-3 rounded-lg border bg-card p-4">
        <select className="h-10 w-full rounded-md border bg-background px-3" value={targetLocationId} onChange={(e) => setTargetLocationId(e.target.value)} required>
          <option value="">העברה למיקום</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.location_type})</option>)}
        </select>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {cartons.map((carton) => (
            <label key={carton.id} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected.includes(carton.id)}
                onChange={() => setSelected((cur) => cur.includes(carton.id) ? cur.filter((id) => id !== carton.id) : [...cur, carton.id])}
              />
              <span>{carton.carton_code} · {carton.device_models?.model_name} · מיקום נוכחי: {locations.find((l) => l.id === carton.location_id)?.name || 'ללא'}</span>
            </label>
          ))}
        </div>
        <Button type="submit" disabled={selected.length === 0}>העברת קרטונים</Button>
      </form>

      <section>
        <h2 className="mb-2 text-lg font-semibold">רכבים</h2>
        <ul className="divide-y rounded-lg border bg-card">
          {vans.map((van) => (
            <li key={van.id} className="px-4 py-3">
              {van.name} · {users.find((u) => u.id === van.assigned_user_id)?.full_name || users.find((u) => u.id === van.assigned_user_id)?.email || 'ללא נציג'}
            </li>
          ))}
          {vans.length === 0 && <li className="px-4 py-6 text-muted-foreground">אין רכבים מוגדרים</li>}
        </ul>
      </section>
    </div>
  );
}
