'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';

type Order = {
  id: string;
  order_number: string;
  sale_date: string;
  total_amount: number;
  balance_due: number;
  payment_status: string;
  distributors: { name: string } | null;
};

const paymentLabel: Record<string, string> = { unpaid: 'לא שולם', partial: 'שולם חלקית', paid: 'שולם' };

export default function SalesPage() {
  const [rows, setRows] = useState<Order[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    opsClient()
      .from('sales_orders')
      .select('id, order_number, sale_date, total_amount, balance_due, payment_status, distributors(name)')
      .order('created_at', { ascending: false })
      .then(({ data, error: loadError }: { data: Order[] | null; error: { message: string } | null }) => {
        if (loadError) setError(loadError.message);
        setRows(data ?? []);
      });
  }, []);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">מכירות</h1>
        <Button asChild><Link href="/admin/sales/new">מכירה חדשה</Link></Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={`/admin/sales/${row.id}`} className="flex justify-between px-4 py-3 hover:bg-accent">
              <span>{row.order_number} · {row.distributors?.name}</span>
              <span className="text-muted-foreground">{paymentLabel[row.payment_status] ?? row.payment_status} · יתרה {row.balance_due}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
