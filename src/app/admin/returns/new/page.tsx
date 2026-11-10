'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';

type Order = { id: string; order_number: string };
type Item = { device_id: string; unit_price: number; devices: { imei: string } | null };

export default function NewReturnPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderId, setOrderId] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [condition, setCondition] = useState<'resalable' | 'defective'>('resalable');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    opsClient().from('sales_orders').select('id, order_number').order('created_at', { ascending: false }).limit(100)
      .then(({ data }: { data: Order[] | null }) => setOrders(data ?? []));
  }, []);

  useEffect(() => {
    if (!orderId) { setItems([]); setSelected([]); return; }
    opsClient()
      .from('sales_order_items')
      .select('device_id, unit_price, devices(imei)')
      .eq('sales_order_id', orderId)
      .then(({ data }: { data: Item[] | null }) => {
        setItems(data ?? []);
        setSelected([]);
      });
  }, [orderId]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const { error: rpcError } = await opsClient().rpc('create_return', {
      p_sales_order_id: orderId,
      p_device_ids: selected,
      p_condition: condition,
      p_notes: notes.trim() || null,
    });
    if (rpcError) { setError(rpcError.message); return; }
    router.push('/admin/returns');
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">החזרה חדשה</h1>
      <select className="h-10 w-full rounded-md border bg-background px-3" value={orderId} onChange={(e) => setOrderId(e.target.value)} required>
        <option value="">בחרו הזמנה</option>
        {orders.map((o) => <option key={o.id} value={o.id}>{o.order_number}</option>)}
      </select>
      <select className="h-10 w-full rounded-md border bg-background px-3" value={condition} onChange={(e) => setCondition(e.target.value as 'resalable' | 'defective')}>
        <option value="resalable">ניתן למכירה מחדש</option>
        <option value="defective">פגום</option>
      </select>
      <div className="space-y-2 rounded-lg border bg-card p-4">
        {items.map((item) => (
          <label key={item.device_id} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selected.includes(item.device_id)}
              onChange={() => setSelected((cur) => cur.includes(item.device_id) ? cur.filter((id) => id !== item.device_id) : [...cur, item.device_id])}
            />
            <span>{item.devices?.imei} · {item.unit_price}</span>
          </label>
        ))}
        {orderId && items.length === 0 && <p className="text-muted-foreground">אין פריטים בהזמנה</p>}
      </div>
      <textarea className="min-h-24 w-full rounded-md border bg-background p-3" placeholder="הערות" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={!orderId || selected.length === 0}>שמירת החזרה</Button>
    </form>
  );
}
