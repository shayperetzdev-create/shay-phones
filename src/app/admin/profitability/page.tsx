'use client';

import { useEffect, useMemo, useState } from 'react';
import { opsClient } from '@/lib/ops';

type Item = {
  unit_price: number;
  devices: {
    model_id: string | null;
    device_models: { model_name: string } | null;
    cartons: { batches: { unit_cost: number } | null } | null;
  } | null;
  sales_orders: { sale_date: string; payment_status: string } | null;
};

type Target = { model_id: string; target_profit_per_device: number; valid_from: string };

export default function ProfitabilityPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      opsClient().from('sales_order_items').select('unit_price, devices(model_id, device_models(model_name), cartons(batches(unit_cost))), sales_orders(sale_date, payment_status)'),
      opsClient().from('target_profits').select('model_id, target_profit_per_device, valid_from').order('valid_from', { ascending: false }),
    ]).then(([itemsRes, targetsRes]) => {
      if (itemsRes.error || targetsRes.error) setError(itemsRes.error?.message || targetsRes.error?.message || '');
      setItems(itemsRes.data ?? []);
      setTargets(targetsRes.data ?? []);
    });
  }, []);

  const byModel = useMemo(() => {
    const map = new Map<string, { name: string; units: number; revenue: number; cost: number; target: number }>();
    for (const item of items) {
      const modelId = item.devices?.model_id || 'unknown';
      const name = item.devices?.device_models?.model_name || 'לא ידוע';
      const cost = Number(item.devices?.cartons?.batches?.unit_cost || 0);
      const current = map.get(modelId) || { name, units: 0, revenue: 0, cost: 0, target: 0 };
      current.units += 1;
      current.revenue += Number(item.unit_price);
      current.cost += cost;
      map.set(modelId, current);
    }
    for (const [modelId, row] of map) {
      const target = targets.find((t) => t.model_id === modelId);
      row.target = target ? Number(target.target_profit_per_device) * row.units : 0;
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [items, targets]);

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">רווחיות לפי דגם</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y rounded-lg border bg-card">
        {byModel.map((row) => {
          const profit = row.revenue - row.cost;
          return (
            <li key={row.name} className="px-4 py-3">
              <div className="font-medium">{row.name} · {row.units} יח׳</div>
              <div className="text-sm text-muted-foreground">
                הכנסות ₪{row.revenue} · עלות ₪{row.cost} · רווח ₪{profit} · יעד ₪{row.target}
              </div>
            </li>
          );
        })}
        {byModel.length === 0 && !error && <li className="px-4 py-6 text-muted-foreground">אין נתוני מכירות</li>}
      </ul>
    </div>
  );
}
