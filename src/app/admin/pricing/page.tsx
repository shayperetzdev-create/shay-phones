'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Sim = {
  id: string;
  name: string;
  status: string;
  landed_cost: number;
  wholesale_price: number;
  retail_price: number;
  device_models: { model_name: string } | null;
};
type Model = { id: string; model_name: string };

export default function PricingPage() {
  const [rows, setRows] = useState<Sim[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [name, setName] = useState('');
  const [modelId, setModelId] = useState('');
  const [landed, setLanded] = useState('0');
  const [wholesale, setWholesale] = useState('0');
  const [retail, setRetail] = useState('0');
  const [error, setError] = useState('');

  const load = async () => {
    const [sims, mods] = await Promise.all([
      opsClient().from('pricing_simulations').select('id, name, status, landed_cost, wholesale_price, retail_price, device_models(model_name)').order('created_at', { ascending: false }),
      opsClient().from('device_models').select('id, model_name').eq('is_active', true).order('model_name'),
    ]);
    if (sims.error) setError(sims.error.message);
    setRows(sims.data ?? []);
    setModels(mods.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const { data, error: insertError } = await opsClient().from('pricing_simulations').insert({
      name: name.trim(),
      model_id: modelId || null,
      landed_cost: Number(landed) || 0,
      wholesale_price: Number(wholesale) || 0,
      retail_price: Number(retail) || 0,
    }).select('id').single();
    if (insertError) { setError(insertError.message); return; }
    await opsClient().from('simulation_lines').insert([
      { simulation_id: data.id, label: 'עלות נחתת', amount: Number(landed) || 0, sort_order: 1 },
      { simulation_id: data.id, label: 'מחיר סיטונאי', amount: Number(wholesale) || 0, sort_order: 2 },
      { simulation_id: data.id, label: 'מחיר לצרכן', amount: Number(retail) || 0, sort_order: 3 },
    ]);
    setName('');
    await load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">תמחור וסימולציה</h1>
      <form onSubmit={onSubmit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3">
        <Input placeholder="שם סימולציה" value={name} onChange={(e) => setName(e.target.value)} required />
        <select className="h-10 rounded-md border bg-background px-3" value={modelId} onChange={(e) => setModelId(e.target.value)}>
          <option value="">דגם (אופציונלי)</option>
          {models.map((m) => <option key={m.id} value={m.id}>{m.model_name}</option>)}
        </select>
        <Input type="number" step="0.01" placeholder="עלות נחתת" value={landed} onChange={(e) => setLanded(e.target.value)} />
        <Input type="number" step="0.01" placeholder="סיטונאי" value={wholesale} onChange={(e) => setWholesale(e.target.value)} />
        <Input type="number" step="0.01" placeholder="לצרכן" value={retail} onChange={(e) => setRetail(e.target.value)} />
        <Button type="submit">יצירה</Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={`/admin/pricing/${row.id}`} className="flex justify-between px-4 py-3 hover:bg-accent">
              <span>{row.name} · {row.device_models?.model_name || 'כללי'}</span>
              <span className="text-muted-foreground">{row.status} · מרווח ₪{(Number(row.wholesale_price) - Number(row.landed_cost)).toFixed(2)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
