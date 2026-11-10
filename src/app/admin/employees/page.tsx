'use client';

import { useEffect, useState } from 'react';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';

type User = { id: string; email: string; full_name: string | null; role: string; is_active: boolean };
type Perm = { id: string; role: string; permission: string; can_view: boolean; can_edit: boolean };

const roleLabel: Record<string, string> = {
  admin: 'מנהל',
  ops: 'תפעול',
  marketing: 'שיווק',
  store: 'חנות',
  lab: 'מעבדה',
};

const permLabel: Record<string, string> = {
  inventory: 'מלאי',
  sales: 'מכירות',
  returns: 'החזרות',
  writeoff: 'הוצאה מהמלאי',
  collections: 'גבייה',
  consignment: 'שיווק',
  settlement: 'התחשבנות',
  field_sales: 'שטח',
  van_stock: 'מלאי רכב',
  finance: 'כספים',
  cashflow: 'תזרים',
  attendance_report: 'נוכחות',
  employees: 'עובדים',
  audit: 'יומן',
};

export default function EmployeesPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    const [usersRes, permsRes] = await Promise.all([
      opsClient().from('users').select('id, email, full_name, role, is_active').order('created_at', { ascending: false }),
      opsClient().from('role_permissions').select('id, role, permission, can_view, can_edit').order('role', { ascending: true }).order('permission', { ascending: true }),
    ]);
    if (usersRes.error || permsRes.error) setError(usersRes.error?.message || permsRes.error?.message || '');
    setUsers(usersRes.data ?? []);
    setPerms(permsRes.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const toggleEdit = async (perm: Perm) => {
    const { error: updateError } = await opsClient()
      .from('role_permissions')
      .update({ can_edit: !perm.can_edit })
      .eq('id', perm.id);
    if (updateError) setError(updateError.message);
    else await load();
  };

  const staffPerms = perms.filter((p) => ['admin', 'ops', 'marketing'].includes(p.role));

  return (
    <div className="space-y-8" dir="rtl">
      <h1 className="text-2xl font-bold">עובדים והרשאות</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">משתמשים</h2>
        <ul className="divide-y rounded-lg border bg-card">
          {users.map((user) => (
            <li key={user.id} className="flex justify-between px-4 py-3">
              <span>{user.full_name || user.email}</span>
              <span className="text-muted-foreground">{roleLabel[user.role] ?? user.role} · {user.is_active ? 'פעיל' : 'מושבת'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">מטריצת הרשאות</h2>
        <ul className="divide-y rounded-lg border bg-card">
          {staffPerms.map((perm) => (
            <li key={perm.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>{roleLabel[perm.role] ?? perm.role} · {permLabel[perm.permission] ?? perm.permission}</span>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{perm.can_view ? 'צפייה' : 'ללא צפייה'}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => toggleEdit(perm)}>
                  {perm.can_edit ? 'עריכה פעילה' : 'עריכה כבויה'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
