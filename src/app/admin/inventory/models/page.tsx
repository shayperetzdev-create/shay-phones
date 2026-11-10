'use client';

import { FormEvent, useEffect, useState } from 'react';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Model = { id: string; model_name: string; manufacturer: string | null; warranty_months: number; is_active: boolean };
type Batch = { id: string; batch_code: string; supplier_name: string | null; arrived_at: string; unit_cost: number; notes: string | null };

export default function ModelsPage() {
  const [tab, setTab] = useState<'models' | 'shipments'>('models');
  const [rows, setRows] = useState<Model[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [months, setMonths] = useState('12');
  const [batchCode, setBatchCode] = useState('');
  const [supplier, setSupplier] = useState('');
  const [arrivedAt, setArrivedAt] = useState(new Date().toISOString().slice(0, 10));
  const [unitCost, setUnitCost] = useState('0');
  const [batchNotes, setBatchNotes] = useState('');

  const load = async () => {
    const [modelsRes, batchesRes] = await Promise.all([
      opsClient().from('device_models').select('id, model_name, manufacturer, warranty_months, is_active').order('model_name'),
      opsClient().from('batches').select('id, batch_code, supplier_name, arrived_at, unit_cost, notes').order('arrived_at', { ascending: false }),
    ]);
    if (modelsRes.error) setError(modelsRes.error.message);
    else setRows(modelsRes.data ?? []);
    if (batchesRes.error) setError(batchesRes.error.message);
    else setBatches(batchesRes.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const onSubmitModel = async (event: FormEvent) => {
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

  const onSubmitBatch = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const { error: insertError } = await opsClient().from('batches').insert({
      batch_code: batchCode.trim(),
      supplier_name: supplier.trim() || null,
      arrived_at: arrivedAt,
      unit_cost: Number(unitCost) || 0,
      notes: batchNotes.trim() || null,
    });
    if (insertError) { setError(insertError.message); return; }
    setBatchCode('');
    setSupplier('');
    setBatchNotes('');
    await load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">דגמים ומשלוחים</h1>
      <div className="flex gap-2">
        <Button type="button" variant={tab === 'models' ? 'default' : 'outline'} onClick={() => setTab('models')}>דגמים</Button>
        <Button type="button" variant={tab === 'shipments' ? 'default' : 'outline'} onClick={() => setTab('shipments')}>משלוחים / אצוות</Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {tab === 'models' ? (
        <>
          <form onSubmit={onSubmitModel} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
            <Input placeholder="שם דגם" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input placeholder="יצרן" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
            <Input type="number" min={1} max={36} value={months} onChange={(e) => setMonths(e.target.value)} required />
            <Button type="submit">הוספת דגם</Button>
          </form>
          <ul className="divide-y rounded-lg border bg-card">
            {rows.map((row) => (
              <li key={row.id} className="flex justify-between px-4 py-3">
                <span>{row.manufacturer ? `${row.manufacturer} ` : ''}{row.model_name}</span>
                <span className="text-muted-foreground">{row.warranty_months} חודשי אחריות</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <form onSubmit={onSubmitBatch} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3">
            <Input placeholder="קוד אצווה / משלוח" value={batchCode} onChange={(e) => setBatchCode(e.target.value)} required />
            <Input placeholder="ספק" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            <Input type="date" value={arrivedAt} onChange={(e) => setArrivedAt(e.target.value)} required />
            <Input type="number" min={0} step="0.01" placeholder="עלות ליחידה" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            <Input placeholder="הערות" value={batchNotes} onChange={(e) => setBatchNotes(e.target.value)} />
            <Button type="submit">הוספת משלוח</Button>
          </form>
          <ul className="divide-y rounded-lg border bg-card">
            {batches.map((row) => (
              <li key={row.id} className="flex justify-between px-4 py-3">
                <span>{row.batch_code} · {row.supplier_name || 'ללא ספק'}</span>
                <span className="text-muted-foreground">{row.arrived_at} · עלות {row.unit_cost}</span>
              </li>
            ))}
            {batches.length === 0 && <li className="px-4 py-6 text-muted-foreground">אין משלוחים עדיין</li>}
          </ul>
        </>
      )}
    </div>
  );
}
