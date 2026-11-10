'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';

type Device = { id: string; imei: string; device_models: { model_name: string } | null };

export default function NewWriteOffPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState('other');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    opsClient()
      .from('devices')
      .select('id, imei, device_models(model_name)')
      .in('inventory_status', ['in_stock', 'at_marketing', 'defective'])
      .eq('is_replaced', false)
      .order('imei')
      .then(({ data }: { data: Device[] | null }) => setDevices(data ?? []));
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const { error: rpcError } = await opsClient().rpc('create_write_off', {
      p_device_ids: selected,
      p_reason: reason,
      p_notes: notes.trim() || null,
    });
    if (rpcError) { setError(rpcError.message); return; }
    router.push('/admin/write-offs');
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">הוצאה מהמלאי חדשה</h1>
      <select className="h-10 w-full rounded-md border bg-background px-3" value={reason} onChange={(e) => setReason(e.target.value)}>
        <option value="lost">אבד</option>
        <option value="damaged">ניזוק</option>
        <option value="donation">תרומה</option>
        <option value="demo">דמו</option>
        <option value="other">אחר</option>
      </select>
      <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border bg-card p-4">
        {devices.map((device) => (
          <label key={device.id} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selected.includes(device.id)}
              onChange={() => setSelected((cur) => cur.includes(device.id) ? cur.filter((id) => id !== device.id) : [...cur, device.id])}
            />
            <span>{device.imei} · {device.device_models?.model_name}</span>
          </label>
        ))}
      </div>
      <textarea className="min-h-24 w-full rounded-md border bg-background p-3" placeholder="הערות" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={selected.length === 0}>שמירה</Button>
    </form>
  );
}
