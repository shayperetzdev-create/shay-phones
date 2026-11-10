'use client';

import { FormEvent, useEffect, useState } from 'react';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';

type DeviceOption = { id: string; imei: string; device_models: { model_name: string } | null };

export default function ConsignmentPage() {
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  const load = async () => {
    const { data } = await opsClient().from('devices').select('id, imei, device_models(model_name)').eq('inventory_status', 'in_stock').order('imei');
    setDevices(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const { data, error } = await opsClient().rpc('move_devices_to_marketing', { p_device_ids: selected, p_notes: null });
    if (error) { setMessage(error.message); return; }
    setMessage(`הועברו ${data} מכשירים לחברת השיווק`);
    setSelected([]);
    await load();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">העברה לחברת השיווק</h1>
      <div className="space-y-2 rounded-lg border bg-card p-4">
        {devices.map((device) => (
          <label key={device.id} className="flex items-center gap-3">
            <input type="checkbox" checked={selected.includes(device.id)} onChange={() => setSelected((current) => current.includes(device.id) ? current.filter((id) => id !== device.id) : [...current, device.id])} />
            <span>{device.imei} · {device.device_models?.model_name}</span>
          </label>
        ))}
      </div>
      {message && <p>{message}</p>}
      <Button type="submit" disabled={selected.length === 0}>העברה</Button>
    </form>
  );
}
