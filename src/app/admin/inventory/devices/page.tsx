'use client';

import { FormEvent, useEffect, useState } from 'react';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type DeviceRow = {
  id: string;
  imei: string;
  inventory_status: string;
  device_models: { model_name: string } | null;
  cartons: { carton_code: string } | null;
};

const statusLabel: Record<string, string> = {
  in_stock: 'במלאי',
  sold: 'נמכר',
  at_marketing: 'בחברת השיווק',
  defective: 'פגום',
  written_off: 'הוצא',
};

export default function InventoryDevicesPage() {
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [models, setModels] = useState<{ id: string; model_name: string }[]>([]);
  const [cartons, setCartons] = useState<{ id: string; carton_code: string }[]>([]);
  const [imei, setImei] = useState('');
  const [imei2, setImei2] = useState('');
  const [modelId, setModelId] = useState('');
  const [cartonId, setCartonId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const db = opsClient();
    const [deviceRes, modelRes, cartonRes] = await Promise.all([
      db.from('devices').select('id, imei, inventory_status, device_models(model_name), cartons(carton_code)').order('created_at', { ascending: false }).limit(100),
      db.from('device_models').select('id, model_name').eq('is_active', true).order('model_name'),
      db.from('cartons').select('id, carton_code').order('carton_code'),
    ]);
    if (deviceRes.error) setError(deviceRes.error.message);
    setRows(deviceRes.data ?? []);
    setModels(modelRes.data ?? []);
    setCartons(cartonRes.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const { error: insertError } = await opsClient().from('devices').insert({
      imei: imei.trim(),
      imei2: imei2.trim() || null,
      model_id: modelId,
      carton_id: cartonId || null,
      inventory_status: 'in_stock',
    });
    if (insertError) { setError(insertError.message); return; }
    setImei('');
    setImei2('');
    await load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">מכשירים במלאי</h1>
      <form onSubmit={onSubmit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-5">
        <Input placeholder="IMEI" value={imei} onChange={(e) => setImei(e.target.value)} required pattern="[0-9]{15}" />
        <Input placeholder="IMEI 2" value={imei2} onChange={(e) => setImei2(e.target.value)} pattern="[0-9]{15}" />
        <select className="h-10 rounded-md border bg-background px-3" value={modelId} onChange={(e) => setModelId(e.target.value)} required>
          <option value="">דגם</option>
          {models.map((model) => <option key={model.id} value={model.id}>{model.model_name}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-background px-3" value={cartonId} onChange={(e) => setCartonId(e.target.value)}>
          <option value="">בלי קרטון</option>
          {cartons.map((carton) => <option key={carton.id} value={carton.id}>{carton.carton_code}</option>)}
        </select>
        <Button type="submit">קליטת מכשיר</Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="flex justify-between px-4 py-3">
            <span>{row.imei} · {row.device_models?.model_name}</span>
            <span className="text-muted-foreground">{statusLabel[row.inventory_status] ?? row.inventory_status}{row.cartons ? ` · ${row.cartons.carton_code}` : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
