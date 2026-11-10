'use client';

import { FormEvent, useEffect, useState } from 'react';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type User = { id: string; full_name: string | null; email: string };
type Distributor = { id: string; name: string };
type Assignment = {
  id: string;
  assigned_at: string;
  is_active: boolean;
  distributor_id: string;
  rep_user_id: string;
  distributors: { name: string } | null;
};
type Visit = {
  id: string;
  visited_at: string;
  notes: string | null;
  outcome: string | null;
  distributors: { name: string } | null;
};

export default function FieldSalesPage() {
  const [reps, setReps] = useState<User[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [repId, setRepId] = useState('');
  const [distributorId, setDistributorId] = useState('');
  const [visitDistributorId, setVisitDistributorId] = useState('');
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const [usersRes, distRes, assignRes, visitRes] = await Promise.all([
      opsClient().from('users').select('id, full_name, email').in('role', ['ops', 'marketing', 'admin']).eq('is_active', true),
      opsClient().from('distributors').select('id, name').eq('is_active', true).order('name'),
      opsClient().from('store_assignments').select('id, assigned_at, is_active, distributor_id, rep_user_id, distributors(name)').eq('is_active', true).order('assigned_at', { ascending: false }),
      opsClient().from('store_visits').select('id, visited_at, notes, outcome, distributors(name)').order('visited_at', { ascending: false }).limit(40),
    ]);
    setReps(usersRes.data ?? []);
    setDistributors(distRes.data ?? []);
    setAssignments(assignRes.data ?? []);
    setVisits(visitRes.data ?? []);
    if (usersRes.error || distRes.error || assignRes.error || visitRes.error) {
      setError(usersRes.error?.message || distRes.error?.message || assignRes.error?.message || visitRes.error?.message || '');
    }
  };

  useEffect(() => { load(); }, []);

  const onAssign = async (event: FormEvent) => {
    event.preventDefault();
    const { error: insertError } = await opsClient().from('store_assignments').upsert({
      distributor_id: distributorId,
      rep_user_id: repId,
      is_active: true,
      assigned_at: new Date().toISOString().slice(0, 10),
    }, { onConflict: 'distributor_id,rep_user_id' });
    if (insertError) { setError(insertError.message); return; }
    await load();
  };

  const onVisit = async (event: FormEvent) => {
    event.preventDefault();
    const { data: auth } = await opsClient().auth.getUser();
    const { error: insertError } = await opsClient().from('store_visits').insert({
      distributor_id: visitDistributorId,
      notes: notes.trim() || null,
      outcome: outcome.trim() || null,
      visited_by: auth.user?.id ?? null,
    });
    if (insertError) { setError(insertError.message); return; }
    setNotes('');
    setOutcome('');
    await load();
  };

  return (
    <div className="space-y-8" dir="rtl">
      <h1 className="text-2xl font-bold">אנשי מכירות</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">שיוך חנות לנציג</h2>
        <form onSubmit={onAssign} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3">
          <select className="h-10 rounded-md border bg-background px-3" value={repId} onChange={(e) => setRepId(e.target.value)} required>
            <option value="">נציג</option>
            {reps.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
          </select>
          <select className="h-10 rounded-md border bg-background px-3" value={distributorId} onChange={(e) => setDistributorId(e.target.value)} required>
            <option value="">מפיץ / חנות</option>
            {distributors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Button type="submit">שיוך</Button>
        </form>
        <ul className="divide-y rounded-lg border bg-card">
          {assignments.map((row) => {
            const rep = reps.find((u) => u.id === row.rep_user_id);
            return (
              <li key={row.id} className="px-4 py-3">
                {rep?.full_name || rep?.email || row.rep_user_id} ← {row.distributors?.name}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">ביקורי שטח</h2>
        <form onSubmit={onVisit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
          <select className="h-10 rounded-md border bg-background px-3" value={visitDistributorId} onChange={(e) => setVisitDistributorId(e.target.value)} required>
            <option value="">חנות</option>
            {distributors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Input placeholder="תוצאה" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
          <Input placeholder="הערות" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button type="submit">רישום ביקור</Button>
        </form>
        <ul className="divide-y rounded-lg border bg-card">
          {visits.map((visit) => (
            <li key={visit.id} className="px-4 py-3">
              <div>{visit.distributors?.name} · {visit.visited_at}</div>
              <div className="text-sm text-muted-foreground">{visit.outcome} {visit.notes}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
