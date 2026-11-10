'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type DeviceOption = { id: string; imei: string; device_models: { model_name: string } | null };

export default function NewSalePage() {
  const router = useRouter();
  const [distributors, setDistributors] = useState<{ id: string; name: string }[]>([]);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [distributorId, setDistributorId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [price, setPrice] = useState('0');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const db = opsClient();
    Promise.all([
      db.from('distributors').select('id, name').eq('is_active', true).order('name'),
      db.from('devices').select('id, imei, device_models(model_name)').eq('inventory_status', 'in_stock').eq('is_replaced', false).order('imei'),
    ]).then(([distRes, deviceRes]) => {
      setDistributors(distRes.data ?? []);
      setDevices(deviceRes.data ?? []);
    });
  }, []);

  const toggle = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const { data, error: saleError } = await opsClient().rpc('create_sale', {
      p_distributor_id: distributorId,
      p_device_ids: selected,
      p_unit_price: Number(price),
      p_notes: notes.trim() || null,
    });
    if (saleError) { setError(saleError.message); return; }
    router.push(`/admin/sales/${data}`);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">מכירה חדשה</h1>
      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3">
        <select className="h-10 rounded-md border bg-background px-3" value={distributorId} onChange={(e) => setDistributorId(e.target.value)} required>
          <option value="">מפיץ</option>
          {distributors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
        <Input placeholder="הערות" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border bg-card p-4">
        {devices.length === 0 && <p className="text-muted-foreground">אין מכשירים זמינים במלאי.</p>}
        {devices.map((device) => (
          <label key={device.id} className="flex items-center gap-3">
            <input type="checkbox" checked={selected.includes(device.id)} onChange={() => toggle(device.id)} />
            <span>{device.imei} · {device.device_models?.model_name}</span>
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={selected.length === 0}>יצירת מכירה ותעודת משלוח</Button>
    </form>
  );
}
