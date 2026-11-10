'use client';

import { FormEvent, useEffect, useState } from 'react';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type OpenOrder = { id: string; order_number: string; balance_due: number; distributors: { id: string; name: string } | null };
type EventRow = { id: string; note: string; created_at: string; distributors: { name: string } | null };

export default function CollectionsPage() {
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [orderId, setOrderId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const db = opsClient();
    const [orderRes, eventRes] = await Promise.all([
      db.from('sales_orders').select('id, order_number, balance_due, distributors(id, name)').gt('balance_due', 0).order('sale_date'),
      db.from('collection_events').select('id, note, created_at, distributors(name)').order('created_at', { ascending: false }).limit(30),
    ]);
    if (orderRes.error) setError(orderRes.error.message);
    setOrders(orderRes.data ?? []);
    setEvents(eventRes.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const order = orders.find((item) => item.id === orderId);
    if (!order?.distributors) return;
    const { error: insertError } = await opsClient().from('collection_events').insert({
      distributor_id: order.distributors.id,
      sales_order_id: order.id,
      note: note.trim(),
    });
    if (insertError) { setError(insertError.message); return; }
    setNote('');
    await load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">גבייה</h1>
      <form onSubmit={onSubmit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3">
        <select className="h-10 rounded-md border bg-background px-3" value={orderId} onChange={(e) => setOrderId(e.target.value)} required>
          <option value="">הזמנה פתוחה</option>
          {orders.map((order) => <option key={order.id} value={order.id}>{order.order_number} · {order.distributors?.name} · {order.balance_due}</option>)}
        </select>
        <Input placeholder="הערת מעקב" value={note} onChange={(e) => setNote(e.target.value)} required />
        <Button type="submit">שמירת מעקב</Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {events.map((event) => (
          <li key={event.id} className="px-4 py-3">
            <div>{event.distributors?.name}</div>
            <div className="text-sm text-muted-foreground">{event.note}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
