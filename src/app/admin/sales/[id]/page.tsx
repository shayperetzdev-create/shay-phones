'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Item = { unit_price: number; devices: { imei: string; imei2: string | null; device_models: { model_name: string } | null } | null };
type Order = {
  id: string;
  order_number: string;
  delivery_note_number: string | null;
  sale_date: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
  distributors: { name: string; phone: string | null; address: string | null } | null;
};

export default function SaleDetailPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('transfer');
  const [error, setError] = useState('');

  const load = async () => {
    const db = opsClient();
    const [orderRes, itemRes] = await Promise.all([
      db.from('sales_orders').select('id, order_number, delivery_note_number, sale_date, total_amount, amount_paid, balance_due, notes, distributors(name, phone, address)').eq('id', params.id).single(),
      db.from('sales_order_items').select('unit_price, devices(imei, imei2, device_models(model_name))').eq('sales_order_id', params.id),
    ]);
    if (orderRes.error) setError(orderRes.error.message);
    setOrder(orderRes.data);
    setItems(itemRes.data ?? []);
  };

  useEffect(() => { if (params.id) load(); }, [params.id]);

  const onPay = async (event: FormEvent) => {
    event.preventDefault();
    const { error: payError } = await opsClient().rpc('record_sale_payment', {
      p_order_id: params.id,
      p_amount: Number(amount),
      p_method: method,
      p_notes: null,
    });
    if (payError) { setError(payError.message); return; }
    setAmount('');
    await load();
  };

  if (!order) return <p dir="rtl">{error || 'טוען...'}</p>;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold">תעודת משלוח {order.delivery_note_number}</h1>
        <Button type="button" onClick={() => window.print()}>הדפסה</Button>
      </div>
      <section className="rounded-lg border bg-card p-4 space-y-2">
        <p>הזמנה: {order.order_number}</p>
        <p>תאריך: {order.sale_date}</p>
        <p>לקוח: {order.distributors?.name}</p>
        <p>טלפון: {order.distributors?.phone || '—'}</p>
        <p>כתובת: {order.distributors?.address || '—'}</p>
        {order.notes && <p>הערות: {order.notes}</p>}
      </section>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-right">
            <th className="py-2">IMEI</th>
            <th>דגם</th>
            <th>מחיר</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.devices?.imei} className="border-b">
              <td className="py-2">{item.devices?.imei}</td>
              <td>{item.devices?.device_models?.model_name}</td>
              <td>{item.unit_price}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>סה״כ {order.total_amount} · שולם {order.amount_paid} · יתרה {order.balance_due}</p>
      <form onSubmit={onPay} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3 print:hidden">
        <Input type="number" min={0.01} step="0.01" placeholder="סכום" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <select className="h-10 rounded-md border bg-background px-3" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="transfer">העברה</option>
          <option value="cash">מזומן</option>
          <option value="check">צ׳ק</option>
          <option value="credit">אשראי</option>
        </select>
        <Button type="submit">רישום תשלום</Button>
      </form>
      {error && <p className="text-sm text-red-600 print:hidden">{error}</p>}
    </div>
  );
}
