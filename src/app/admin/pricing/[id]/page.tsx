'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { opsClient } from '@/lib/ops';
import { Button } from '@/components/ui/button';

type Sim = {
  id: string;
  name: string;
  status: string;
  landed_cost: number;
  wholesale_price: number;
  retail_price: number;
  notes: string | null;
  device_models: { model_name: string } | null;
};
type Line = { id: string; label: string; amount: number; sort_order: number };

export default function PricingDetailPage() {
  const params = useParams<{ id: string }>();
  const [sim, setSim] = useState<Sim | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    const [simRes, linesRes] = await Promise.all([
      opsClient().from('pricing_simulations').select('id, name, status, landed_cost, wholesale_price, retail_price, notes, device_models(model_name)').eq('id', params.id).single(),
      opsClient().from('simulation_lines').select('id, label, amount, sort_order').eq('simulation_id', params.id).order('sort_order'),
    ]);
    if (simRes.error) setError(simRes.error.message);
    setSim(simRes.data);
    setLines(linesRes.data ?? []);
  };

  useEffect(() => { load(); }, [params.id]);

  const approve = async () => {
    const { error: updateError } = await opsClient().from('pricing_simulations').update({ status: 'approved' }).eq('id', params.id);
    if (updateError) setError(updateError.message);
    else await load();
  };

  if (!sim && !error) return <p dir="rtl">טוען...</p>;

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">{sim?.name}</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {sim && (
        <>
          <div className="rounded-lg border bg-card p-4 text-sm">
            <div>דגם: {sim.device_models?.model_name || 'כללי'}</div>
            <div>סטטוס: {sim.status}</div>
            <div>עלות נחתת: ₪{sim.landed_cost}</div>
            <div>סיטונאי: ₪{sim.wholesale_price}</div>
            <div>לצרכן: ₪{sim.retail_price}</div>
            <div>מרווח סיטונאי: ₪{(Number(sim.wholesale_price) - Number(sim.landed_cost)).toFixed(2)}</div>
          </div>
          <ul className="divide-y rounded-lg border bg-card">
            {lines.map((line) => (
              <li key={line.id} className="flex justify-between px-4 py-3">
                <span>{line.label}</span>
                <span>₪{line.amount}</span>
              </li>
            ))}
          </ul>
          {sim.status === 'draft' && <Button onClick={approve}>אישור סימולציה</Button>}
        </>
      )}
    </div>
  );
}
