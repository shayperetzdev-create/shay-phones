'use client';

import { FormEvent, useEffect, useState } from 'react';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Carton = { id: string; carton_code: string; quantity: number; device_models: { model_name: string } | null };

export default function CartonsPage() {
  const [rows, setRows] = useState<Carton[]>([]);
  const [models, setModels] = useState<{ id: string; model_name: string }[]>([]);
  const [code, setCode] = useState('');
  const [modelId, setModelId] = useState('');
  const [quantity, setQuantity] = useState('10');
  const [error, setError] = useState('');

  const load = async () => {
    const db = opsClient();
    const [cartonRes, modelRes] = await Promise.all([
      db.from('cartons').select('id, carton_code, quantity, device_models(model_name)').order('created_at', { ascending: false }),
      db.from('device_models').select('id, model_name').eq('is_active', true).order('model_name'),
    ]);
    if (cartonRes.error) setError(cartonRes.error.message);
    setRows(cartonRes.data ?? []);
    setModels(modelRes.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const { error: insertError } = await opsClient().from('cartons').insert({
      carton_code: code.trim(),
      model_id: modelId,
      quantity: Number(quantity),
    });
    if (insertError) { setError(insertError.message); return; }
    setCode('');
    await load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">קרטונים</h1>
      <form onSubmit={onSubmit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <Input placeholder="קוד קרטון" value={code} onChange={(e) => setCode(e.target.value)} required />
        <select className="h-10 rounded-md border bg-background px-3" value={modelId} onChange={(e) => setModelId(e.target.value)} required>
          <option value="">דגם</option>
          {models.map((model) => <option key={model.id} value={model.id}>{model.model_name}</option>)}
        </select>
        <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        <Button type="submit">הוספת קרטון</Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="flex justify-between px-4 py-3">
            <span>{row.carton_code}</span>
            <span className="text-muted-foreground">{row.device_models?.model_name} · {row.quantity} יח׳</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
