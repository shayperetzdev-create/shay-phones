'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { opsClient } from '@/lib/ops';

export default function FinancePage() {
  const [totals, setTotals] = useState({ sales: 0, paid: 0, due: 0, orders: 0 });

  useEffect(() => {
    opsClient().from('sales_orders').select('total_amount, amount_paid, balance_due').then(({ data }: { data: { total_amount: number; amount_paid: number; balance_due: number }[] | null }) => {
      const rows = data ?? [];
      setTotals({
        orders: rows.length,
        sales: rows.reduce((sum, row) => sum + Number(row.total_amount), 0),
        paid: rows.reduce((sum, row) => sum + Number(row.amount_paid), 0),
        due: rows.reduce((sum, row) => sum + Number(row.balance_due), 0),
      });
    });
  }, []);

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">כספים</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['הזמנות', totals.orders],
          ['מכירות', totals.sales],
          ['שולם', totals.paid],
          ['יתרה לגבייה', totals.due],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-3xl font-semibold">{value}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['תזרים צפוי', '/admin/cashflow'],
          ['רווח יעד', '/admin/target-profits'],
          ['רווחיות לפי דגם', '/admin/profitability'],
          ['תמחור וסימולציה', '/admin/pricing'],
        ].map(([label, href]) => (
          <Link key={href} href={href} className="rounded-lg border bg-card p-4 hover:bg-accent">
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
