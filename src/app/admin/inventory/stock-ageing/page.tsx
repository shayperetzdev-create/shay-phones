'use client';

import { useEffect, useMemo, useState } from 'react';
import { opsClient } from '@/lib/ops';

type Row = {
  device_id: string;
  imei: string;
  model_name: string | null;
  carton_code: string | null;
  batch_code: string | null;
  days_in_stock: number;
  age_bucket: string;
  inventory_status: string;
};

export default function StockAgeingPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    opsClient()
      .from('device_ageing')
      .select('device_id, imei, model_name, carton_code, batch_code, days_in_stock, age_bucket, inventory_status')
      .order('days_in_stock', { ascending: false })
      .then(({ data, error: loadError }: { data: Row[] | null; error: { message: string } | null }) => {
        if (loadError) setError(loadError.message);
        setRows(data ?? []);
      });
  }, []);

  const summary = useMemo(() => {
    const buckets: Record<string, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    for (const row of rows) buckets[row.age_bucket] = (buckets[row.age_bucket] || 0) + 1;
    return buckets;
  }, [rows]);

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">גיול מלאי</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-4">
        {Object.entries(summary).map(([bucket, count]) => (
          <div key={bucket} className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground">{bucket} ימים</div>
            <div className="text-3xl font-semibold">{count}</div>
          </div>
        ))}
      </div>
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((row) => (
          <li key={row.device_id} className="flex justify-between px-4 py-3">
            <span>{row.imei} · {row.model_name}</span>
            <span className="text-muted-foreground">{row.days_in_stock} ימים · {row.age_bucket} · {row.batch_code || 'ללא אצווה'}</span>
          </li>
        ))}
        {rows.length === 0 && !error && <li className="px-4 py-6 text-muted-foreground">אין מכשירים במלאי</li>}
      </ul>
    </div>
  );
}
