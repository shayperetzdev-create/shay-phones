'use client';

import { FormEvent, useEffect, useState } from 'react';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Distributor = { id: string; name: string; phone: string | null; customer_type: string; store_user_id: string | null; users: { full_name: string | null; email: string } | null };
type StoreUser = { id: string; full_name: string | null; email: string };

export default function DistributorsPage() {
  const [rows, setRows] = useState<Distributor[]>([]);
  const [stores, setStores] = useState<StoreUser[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [customerType, setCustomerType] = useState('distributor');
  const [storeUserId, setStoreUserId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const db = opsClient();
    const [distRes, storeRes] = await Promise.all([
      db.from('distributors').select('id, name, phone, customer_type, store_user_id, users(full_name, email)').order('name'),
      db.from('users').select('id, full_name, email').eq('role', 'store').eq('is_active', true).order('email'),
    ]);
    if (distRes.error) setError(distRes.error.message);
    setRows(distRes.data ?? []);
    setStores(storeRes.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const { error: insertError } = await opsClient().from('distributors').insert({
      name: name.trim(),
      phone: phone.trim() || null,
      customer_type: customerType,
      store_user_id: storeUserId || null,
    });
    if (insertError) { setError(insertError.message); return; }
    setName('');
    setPhone('');
    setStoreUserId('');
    await load();
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">מפיצים וחנויות</h1>
      <p className="text-muted-foreground">קישור משתמש חנות מאפשר רק לחנות הזו להפעיל אחריות על מכשירים שנמכרו למפיץ.</p>
      <form onSubmit={onSubmit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-5">
        <Input placeholder="שם" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input placeholder="טלפון" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <select className="h-10 rounded-md border bg-background px-3" value={customerType} onChange={(e) => setCustomerType(e.target.value)}>
          <option value="distributor">מפיץ</option>
          <option value="store">חנות</option>
        </select>
        <select className="h-10 rounded-md border bg-background px-3" value={storeUserId} onChange={(e) => setStoreUserId(e.target.value)}>
          <option value="">בלי משתמש חנות</option>
          {stores.map((store) => <option key={store.id} value={store.id}>{store.full_name || store.email}</option>)}
        </select>
        <Button type="submit">הוספה</Button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="flex justify-between px-4 py-3">
            <span>{row.name} · {row.customer_type === 'store' ? 'חנות' : 'מפיץ'}</span>
            <span className="text-muted-foreground">{row.users?.full_name || row.users?.email || 'לא מקושר לחנות'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
