'use client';

import { FormEvent, useEffect, useState } from 'react';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Row = {
  id: string;
  target_profit_per_device: number;
  valid_from: string;
  for_marketing: boolean;
  device_models: { model_name: string } | null;
  distributors: { name: string } | null;
};
type Model = { id: string; model_name: string };
type Distributor = { id: string; name: string };

export default function TargetProfitsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [modelId, setModelId] = useState('');
  const [distributorId, setDistributorId] = useState('');
  const [profit, setProfit] = useState('0');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [forMarketing, setForMarketing] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [rowsRes, modelsRes, distRes] = await Promise.all([
      opsClient().from('target_profits').select('id, target_profit_per_device, valid_from, for_marketing, device_models(model_name), distributors(name)').order('valid_from', { ascending: false }),
      opsClient().from('device_models').select('id, model_name').eq('is_active', true).order('model_name'),
      opsClient().from('distributors').select('id, name').eq('is_active', true).order('name'),
    ]);
    if (rowsRes.error) setError(rowsRes.error.message);
    setRows(rowsRes.data ?? []);
    setModels(modelsRes.data ?? []);
    setDistributors(distRes.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const { error: insertError } = await opsClient().from('target_profits').insert({
      model_id: modelId,
      distributor_id: distributorId || null,
      target_profit_per_device: Number(profit),
      valid_from: validFrom,
      for_marketing: forMarketing,
    });
    if (insertError) { setError(insertError.message); return; }
    await load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">רווח יעד</h1>
      <form onSubmit={onSubmit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3">
        <select className="h-10 rounded-md border bg-background px-3" value={modelId} onChange={(e) => setModelId(e.target.value)} required>
          <option value="">דגם</option>
          {models.map((m) => <option key={m.id} value={m.id}>{m.model_name}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-background px-3" value={distributorId} onChange={(e) => setDistributorId(e.target.value)}>
          <option value="">כל המפיצים</option>
          {distributors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <Input type="number" step="0.01" value={profit} onChange={(e) => setProfit(e.target.value)} placeholder="רווח ליחידה" required />
        <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={forMarketing} onChange={(e) => setForMarketing(e.target.checked)} />
          לחברת השיווק
        </label>
        <Button type="submit">שמירה</Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="flex justify-between px-4 py-3">
            <span>{row.device_models?.model_name} · {row.distributors?.name || 'כללי'}{row.for_marketing ? ' · שיווק' : ''}</span>
            <span className="text-muted-foreground">₪{row.target_profit_per_device} מ־{row.valid_from}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
