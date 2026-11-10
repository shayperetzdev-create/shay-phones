'use client';

import { FormEvent, useEffect, useState } from 'react';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';

type Batch = { id: string; batch_code: string; supplier_name: string | null; arrived_at: string };
type DeviceRow = {
  id: string;
  imei: string;
  inventory_status: string;
  device_models: { model_name: string } | null;
  cartons: { carton_code: string; batch_id: string | null } | null;
};

const statusLabel: Record<string, string> = {
  in_stock: 'במלאי',
  sold: 'נמכר',
  at_marketing: 'בשיווק',
  defective: 'פגום',
  written_off: 'הוצא',
};

export default function BatchTracePage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState('');
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    opsClient()
      .from('batches')
      .select('id, batch_code, supplier_name, arrived_at')
      .order('arrived_at', { ascending: false })
      .then(({ data }: { data: Batch[] | null }) => setBatches(data ?? []));
  }, []);

  const onSearch = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const { data: cartons, error: cartonError } = await opsClient()
      .from('cartons')
      .select('id')
      .eq('batch_id', batchId);
    if (cartonError) { setError(cartonError.message); return; }
    const cartonIds = (cartons ?? []).map((c: { id: string }) => c.id);
    if (cartonIds.length === 0) { setDevices([]); return; }
    const { data, error: deviceError } = await opsClient()
      .from('devices')
      .select('id, imei, inventory_status, device_models(model_name), cartons(carton_code, batch_id)')
      .in('carton_id', cartonIds)
      .order('imei');
    if (deviceError) { setError(deviceError.message); return; }
    setDevices(data ?? []);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">איתור אצווה</h1>
      <form onSubmit={onSearch} className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row">
        <select className="h-10 flex-1 rounded-md border bg-background px-3" value={batchId} onChange={(e) => setBatchId(e.target.value)} required>
          <option value="">בחרו אצווה / משלוח</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.batch_code} · {b.supplier_name || 'ספק לא צוין'} · {b.arrived_at}
            </option>
          ))}
        </select>
        <Button type="submit">איתור</Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-sm text-muted-foreground">{devices.length} מכשירים באצווה</p>
      <ul className="divide-y rounded-lg border bg-card">
        {devices.map((row) => (
          <li key={row.id} className="flex justify-between px-4 py-3">
            <span>{row.imei} · {row.device_models?.model_name}</span>
            <span className="text-muted-foreground">{row.cartons?.carton_code} · {statusLabel[row.inventory_status] ?? row.inventory_status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
