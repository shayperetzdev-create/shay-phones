'use client';

import { FormEvent, useEffect, useState } from 'react';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Model = { id: string; model_name: string; manufacturer: string | null; warranty_months: number; is_active: boolean };

export default function ModelsPage() {
  const [rows, setRows] = useState<Model[]>([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [months, setMonths] = useState('12');

  const load = async () => {
    const { data, error: loadError } = await opsClient().from('device_models').select('id, model_name, manufacturer, warranty_months, is_active').order('model_name');
    if (loadError) setError(loadError.message);
    else setRows(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const { error: insertError } = await opsClient().from('device_models').insert({
      model_name: name.trim(),
      manufacturer: manufacturer.trim() || null,
      warranty_months: Number(months),
    });
    if (insertError) { setError(insertError.message); return; }
    setName('');
    setManufacturer('');
    await load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">דגמים</h1>
      <form onSubmit={onSubmit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <Input placeholder="שם דגם" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input placeholder="יצרן" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
        <Input type="number" min={1} max={36} value={months} onChange={(e) => setMonths(e.target.value)} required />
        <Button type="submit">הוספת דגם</Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="flex justify-between px-4 py-3">
            <span>{row.manufacturer ? `${row.manufacturer} ` : ''}{row.model_name}</span>
            <span className="text-muted-foreground">{row.warranty_months} חודשי אחריות</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
