'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { opsClient } from '@/lib/ops';

export default function InventoryHomePage() {
  const [counts, setCounts] = useState({ models: 0, cartons: 0, inStock: 0, sold: 0, distributors: 0 });

  useEffect(() => {
    const load = async () => {
      const db = opsClient();
      const [models, cartons, inStock, sold, distributors] = await Promise.all([
        db.from('device_models').select('id', { count: 'exact', head: true }),
        db.from('cartons').select('id', { count: 'exact', head: true }),
        db.from('devices').select('id', { count: 'exact', head: true }).eq('inventory_status', 'in_stock'),
        db.from('devices').select('id', { count: 'exact', head: true }).eq('inventory_status', 'sold'),
        db.from('distributors').select('id', { count: 'exact', head: true }),
      ]);
      setCounts({
        models: models.count ?? 0,
        cartons: cartons.count ?? 0,
        inStock: inStock.count ?? 0,
        sold: sold.count ?? 0,
        distributors: distributors.count ?? 0,
      });
    };
    load();
  }, []);

  const cards = [
    ['דגמים', counts.models, '/admin/inventory/models'],
    ['קרטונים', counts.cartons, '/admin/inventory/cartons'],
    ['במלאי', counts.inStock, '/admin/inventory/devices'],
    ['נמכרו', counts.sold, '/admin/sales'],
    ['מפיצים', counts.distributors, '/admin/inventory/distributors'],
  ] as const;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">מלאי</h1>
        <p className="text-muted-foreground">מכשיר אחד לפי IMEI משמש גם למכירה וגם להפעלת אחריות בחנות.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([label, value, href]) => (
          <Link key={label} href={href} className="rounded-lg border bg-card p-4 hover:bg-accent">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-3xl font-semibold">{value}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
