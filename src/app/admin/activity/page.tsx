'use client';

import { useEffect, useState } from 'react';
import { opsClient } from '@/lib/ops';

type Row = {
  id: string;
  created_at: string;
  entity: string;
  action: string;
  summary: string;
  actor_name: string | null;
  actor_email: string | null;
};

export default function ActivityPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    opsClient()
      .from('activity_feed')
      .select('id, created_at, entity, action, summary, actor_name, actor_email')
      .order('created_at', { ascending: false })
      .limit(150)
      .then(({ data, error: loadError }: { data: Row[] | null; error: { message: string } | null }) => {
        if (loadError) setError(loadError.message);
        setRows(data ?? []);
      });
  }, []);

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">יומן פעולות</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="px-4 py-3">
            <div className="font-medium">{row.summary}</div>
            <div className="text-sm text-muted-foreground">
              {new Date(row.created_at).toLocaleString('he-IL')} · {row.actor_name || row.actor_email || 'מערכת'} · {row.entity}/{row.action}
            </div>
          </li>
        ))}
        {rows.length === 0 && !error && <li className="px-4 py-6 text-muted-foreground">אין רשומות עדיין</li>}
      </ul>
    </div>
  );
}
