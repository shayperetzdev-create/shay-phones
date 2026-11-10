'use client';

import { useEffect, useState } from 'react';
import { opsClient } from '@/lib/ops';

type Settlement = {
  id: string;
  settlement_number: string;
  period_start: string;
  period_end: string;
  status: string;
  total_units: number;
  total_amount_due: number;
  approved_at: string | null;
  paid_at: string | null;
};

const statusLabel: Record<string, string> = { approved: 'מאושר / חוב פתוח', paid: 'שולם' };

export default function DebtPage() {
  const [rows, setRows] = useState<Settlement[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    opsClient()
      .from('settlements')
      .select('id, settlement_number, period_start, period_end, status, total_units, total_amount_due, approved_at, paid_at')
      .neq('status', 'draft')
      .order('period_end', { ascending: false })
      .then(({ data, error: loadError }: { data: Settlement[] | null; error: { message: string } | null }) => {
        if (loadError) setError(loadError.message);
        setRows(data ?? []);
      });
  }, []);

  const openDebt = rows.filter((r) => r.status === 'approved').reduce((sum, r) => sum + Number(r.total_amount_due), 0);

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">חוב לפלא</h1>
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm text-muted-foreground">יתרת חוב פתוחה מחברת השיווק</div>
        <div className="text-3xl font-semibold">₪{openDebt}</div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="flex justify-between px-4 py-3">
            <span>{row.settlement_number} · {row.period_start}–{row.period_end}</span>
            <span className="text-muted-foreground">{statusLabel[row.status] ?? row.status} · ₪{row.total_amount_due}</span>
          </li>
        ))}
        {rows.length === 0 && !error && <li className="px-4 py-6 text-muted-foreground">אין חובות רשומים</li>}
      </ul>
    </div>
  );
}
