'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';

type Row = { id: string; write_off_number: string; reason_type: string; write_off_date: string; notes: string | null };

const reasonLabel: Record<string, string> = {
  lost: 'אבד',
  damaged: 'ניזוק',
  donation: 'תרומה',
  demo: 'דמו',
  other: 'אחר',
};

export default function WriteOffsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    opsClient()
      .from('write_offs')
      .select('id, write_off_number, reason_type, write_off_date, notes')
      .order('created_at', { ascending: false })
      .then(({ data, error: loadError }: { data: Row[] | null; error: { message: string } | null }) => {
        if (loadError) setError(loadError.message);
        setRows(data ?? []);
      });
  }, []);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">הוצאה מהמלאי</h1>
        <Button asChild><Link href="/admin/write-offs/new">הוצאה חדשה</Link></Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="flex justify-between px-4 py-3">
            <span>{row.write_off_number}</span>
            <span className="text-muted-foreground">{reasonLabel[row.reason_type] ?? row.reason_type} · {row.write_off_date}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-6 text-muted-foreground">אין הוצאות מהמלאי</li>}
      </ul>
    </div>
  );
}
