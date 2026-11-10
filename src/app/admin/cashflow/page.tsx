'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Expected = {
  id: string;
  due_date: string;
  expected_amount: number;
  status: string;
  sales_orders: { order_number: string; distributors: { name: string } | null } | null;
};
type Check = {
  id: string;
  check_date: string;
  amount: number;
  status: string;
  check_number: string | null;
  sales_orders: { order_number: string } | null;
};
type Order = { id: string; order_number: string };

export default function CashflowPage() {
  const [expected, setExpected] = useState<Expected[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderId, setOrderId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [checkOrderId, setCheckOrderId] = useState('');
  const [checkDate, setCheckDate] = useState('');
  const [checkAmount, setCheckAmount] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const [expRes, checkRes, orderRes] = await Promise.all([
      opsClient().from('sale_expected_payments').select('id, due_date, expected_amount, status, sales_orders(order_number, distributors(name))').order('due_date'),
      opsClient().from('sale_checks').select('id, check_date, amount, status, check_number, sales_orders(order_number)').order('check_date'),
      opsClient().from('sales_orders').select('id, order_number').order('created_at', { ascending: false }).limit(100),
    ]);
    if (expRes.error || checkRes.error) setError(expRes.error?.message || checkRes.error?.message || '');
    setExpected(expRes.data ?? []);
    setChecks(checkRes.data ?? []);
    setOrders(orderRes.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const openTotal = useMemo(
    () => expected.filter((e) => e.status === 'open' || e.status === 'partial').reduce((s, e) => s + Number(e.expected_amount), 0),
    [expected]
  );

  const addExpected = async (event: FormEvent) => {
    event.preventDefault();
    const { error: insertError } = await opsClient().from('sale_expected_payments').insert({
      sales_order_id: orderId,
      due_date: dueDate,
      expected_amount: Number(amount),
    });
    if (insertError) { setError(insertError.message); return; }
    setAmount('');
    await load();
  };

  const addCheck = async (event: FormEvent) => {
    event.preventDefault();
    const { error: insertError } = await opsClient().from('sale_checks').insert({
      sales_order_id: checkOrderId,
      check_date: checkDate,
      amount: Number(checkAmount),
      check_number: checkNumber.trim() || null,
    });
    if (insertError) { setError(insertError.message); return; }
    setCheckAmount('');
    setCheckNumber('');
    await load();
  };

  return (
    <div className="space-y-8" dir="rtl">
      <h1 className="text-2xl font-bold">תזרים צפוי</h1>
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm text-muted-foreground">סך תשלומים צפויים פתוחים</div>
        <div className="text-3xl font-semibold">₪{openTotal}</div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={addExpected} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <select className="h-10 rounded-md border bg-background px-3" value={orderId} onChange={(e) => setOrderId(e.target.value)} required>
          <option value="">הזמנה</option>
          {orders.map((o) => <option key={o.id} value={o.id}>{o.order_number}</option>)}
        </select>
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        <Input type="number" min={0.01} step="0.01" placeholder="סכום צפוי" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <Button type="submit">הוספת צפי</Button>
      </form>

      <ul className="divide-y rounded-lg border bg-card">
        {expected.map((row) => (
          <li key={row.id} className="flex justify-between px-4 py-3">
            <span>{row.due_date} · {row.sales_orders?.order_number} · {row.sales_orders?.distributors?.name}</span>
            <span className="text-muted-foreground">₪{row.expected_amount} · {row.status}</span>
          </li>
        ))}
      </ul>

      <h2 className="text-lg font-semibold">צ׳קים</h2>
      <form onSubmit={addCheck} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-5">
        <select className="h-10 rounded-md border bg-background px-3" value={checkOrderId} onChange={(e) => setCheckOrderId(e.target.value)} required>
          <option value="">הזמנה</option>
          {orders.map((o) => <option key={o.id} value={o.id}>{o.order_number}</option>)}
        </select>
        <Input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} required />
        <Input type="number" min={0.01} step="0.01" placeholder="סכום" value={checkAmount} onChange={(e) => setCheckAmount(e.target.value)} required />
        <Input placeholder="מספר צ׳ק" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} />
        <Button type="submit">הוספת צ׳ק</Button>
      </form>
      <ul className="divide-y rounded-lg border bg-card">
        {checks.map((row) => (
          <li key={row.id} className="flex justify-between px-4 py-3">
            <span>{row.check_date} · {row.sales_orders?.order_number} · {row.check_number}</span>
            <span className="text-muted-foreground">₪{row.amount} · {row.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
