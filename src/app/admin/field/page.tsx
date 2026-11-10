'use client';

import { FormEvent, useEffect, useState } from 'react';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Visit = { id: string; visited_at: string; notes: string | null; distributors: { name: string } | null };

export default function FieldPage() {
  const [distributors, setDistributors] = useState<{ id: string; name: string }[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [distributorId, setDistributorId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const db = opsClient();
    const [distRes, visitRes] = await Promise.all([
      db.from('distributors').select('id, name').eq('is_active', true).order('name'),
      db.from('store_visits').select('id, visited_at, notes, distributors(name)').order('visited_at', { ascending: false }).limit(30),
    ]);
    setDistributors(distRes.data ?? []);
    setVisits(visitRes.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const { error: insertError } = await opsClient().from('store_visits').insert({ distributor_id: distributorId, notes: notes.trim() || null });
    if (insertError) { setError(insertError.message); return; }
    setNotes('');
    await load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">ביקורי שטח</h1>
      <form onSubmit={onSubmit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3">
        <select className="h-10 rounded-md border bg-background px-3" value={distributorId} onChange={(e) => setDistributorId(e.target.value)} required>
          <option value="">מפיץ או חנות</option>
          {distributors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <Input placeholder="סיכום ביקור" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button type="submit">שמירה</Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {visits.map((visit) => (
          <li key={visit.id} className="px-4 py-3">
            <div>{visit.distributors?.name} · {visit.visited_at}</div>
            <div className="text-sm text-muted-foreground">{visit.notes}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
