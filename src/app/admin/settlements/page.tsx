'use client';

import { FormEvent, useEffect, useState } from 'react';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Settlement = {
  id: string;
  settlement_number: string;
  period_start: string;
  period_end: string;
  status: string;
  total_units: number;
  total_amount_due: number;
};

const statusLabel: Record<string, string> = { draft: 'טיוטה', approved: 'מאושר', paid: 'שולם' };

export default function SettlementsPage() {
  const [rows, setRows] = useState<Settlement[]>([]);
  const [error, setError] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [units, setUnits] = useState('0');
  const [amount, setAmount] = useState('0');
  const [notes, setNotes] = useState('');

  const load = async () => {
    const { data, error: loadError } = await opsClient()
      .from('settlements')
      .select('id, settlement_number, period_start, period_end, status, total_units, total_amount_due')
      .order('created_at', { ascending: false });
    if (loadError) setError(loadError.message);
    setRows(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const number = `STL-${Date.now()}`;
    const { data, error: insertError } = await opsClient().from('settlements').insert({
      settlement_number: number,
      period_start: start,
      period_end: end,
      total_units: Number(units) || 0,
      total_amount_due: Number(amount) || 0,
      notes: notes.trim() || null,
    }).select('id').single();
    if (insertError) { setError(insertError.message); return; }
    await opsClient().from('settlement_lines').insert({
      settlement_id: data.id,
      model_label: 'סיכום תקופה',
      units: Number(units) || 0,
      price_per_device: Number(units) > 0 ? Number(amount) / Number(units) : 0,
      subtotal: Number(amount) || 0,
    });
    await opsClient().rpc('log_activity', {
      p_entity: 'settlements',
      p_entity_id: data.id,
      p_action: 'create',
      p_summary: `התחשבנות ${number}`,
    });
    setNotes('');
    await load();
  };

  const setStatus = async (id: string, status: 'approved' | 'paid') => {
    const patch: Record<string, unknown> = { status };
    if (status === 'approved') patch.approved_at = new Date().toISOString();
    if (status === 'paid') patch.paid_at = new Date().toISOString();
    const { error: updateError } = await opsClient().from('settlements').update(patch).eq('id', id);
    if (updateError) setError(updateError.message);
    else await load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">התחשבנות עם חברת השיווק</h1>
      <form onSubmit={onSubmit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3">
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
        <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
        <Input type="number" min={0} placeholder="יחידות" value={units} onChange={(e) => setUnits(e.target.value)} />
        <Input type="number" min={0} step="0.01" placeholder="סכום לתשלום" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input placeholder="הערות" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button type="submit">יצירת התחשבנות</Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div>{row.settlement_number}</div>
              <div className="text-sm text-muted-foreground">{row.period_start} עד {row.period_end} · {row.total_units} יח׳ · ₪{row.total_amount_due}</div>
            </div>
            <div className="flex items-center gap-2">
              <span>{statusLabel[row.status] ?? row.status}</span>
              {row.status === 'draft' && <Button type="button" size="sm" onClick={() => setStatus(row.id, 'approved')}>אישור</Button>}
              {row.status === 'approved' && <Button type="button" size="sm" onClick={() => setStatus(row.id, 'paid')}>סימון כשולם</Button>}
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-6 text-muted-foreground">אין התחשבנויות</li>}
      </ul>
    </div>
  );
}
