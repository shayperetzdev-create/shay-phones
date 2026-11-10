'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';

type Row = {
  id: string;
  return_number: string;
  condition: string;
  credit_amount: number;
  created_at: string;
  sales_orders: { order_number: string } | null;
};

export default function ReturnsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    opsClient()
      .from('returns')
      .select('id, return_number, condition, credit_amount, created_at, sales_orders(order_number)')
      .order('created_at', { ascending: false })
      .then(({ data, error: loadError }: { data: Row[] | null; error: { message: string } | null }) => {
        if (loadError) setError(loadError.message);
        setRows(data ?? []);
      });
  }, []);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">החזרות</h1>
        <Button asChild><Link href="/admin/returns/new">החזרה חדשה</Link></Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="flex justify-between px-4 py-3">
            <span>{row.return_number} · {row.sales_orders?.order_number}</span>
            <span className="text-muted-foreground">
              {row.condition === 'defective' ? 'פגום' : 'ניתן למכירה'} · זיכוי {row.credit_amount}
            </span>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-6 text-muted-foreground">אין החזרות עדיין</li>}
      </ul>
    </div>
  );
}
