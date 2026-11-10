'use client';

import { useEffect, useState } from 'react';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';

type Entry = {
  id: string;
  work_date: string;
  clock_in: string;
  clock_out: string | null;
  note: string | null;
  users: { full_name: string | null; email: string } | null;
};

export default function AttendancePage() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const { data, error: loadError } = await opsClient()
      .from('attendance_entries')
      .select('id, work_date, clock_in, clock_out, note, users(full_name, email)')
      .order('work_date', { ascending: false })
      .limit(100);
    if (loadError) setError(loadError.message);
    setRows(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const clockIn = async () => {
    setError('');
    setMessage('');
    const { data: auth } = await opsClient().auth.getUser();
    if (!auth.user) { setError('יש להתחבר'); return; }
    const today = new Date().toISOString().slice(0, 10);
    const { error: insertError } = await opsClient().from('attendance_entries').upsert({
      user_id: auth.user.id,
      work_date: today,
      clock_in: new Date().toISOString(),
      clock_out: null,
    }, { onConflict: 'user_id,work_date' });
    if (insertError) setError(insertError.message);
    else { setMessage('נרשמה כניסה'); await load(); }
  };

  const clockOut = async () => {
    setError('');
    setMessage('');
    const { data: auth } = await opsClient().auth.getUser();
    if (!auth.user) { setError('יש להתחבר'); return; }
    const today = new Date().toISOString().slice(0, 10);
    const { error: updateError } = await opsClient()
      .from('attendance_entries')
      .update({ clock_out: new Date().toISOString() })
      .eq('user_id', auth.user.id)
      .eq('work_date', today);
    if (updateError) setError(updateError.message);
    else { setMessage('נרשמה יציאה'); await load(); }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">דוח נוכחות</h1>
      <div className="flex gap-2">
        <Button type="button" onClick={clockIn}>כניסה</Button>
        <Button type="button" variant="outline" onClick={clockOut}>יציאה</Button>
      </div>
      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="flex justify-between px-4 py-3">
            <span>{row.users?.full_name || row.users?.email} · {row.work_date}</span>
            <span className="text-muted-foreground">
              {new Date(row.clock_in).toLocaleTimeString('he-IL')} – {row.clock_out ? new Date(row.clock_out).toLocaleTimeString('he-IL') : 'פתוח'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
