'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import ShekelIcon from '@/components/ui/shekel-icon';

interface RepairType {
  id: string;
  name: string;
  description: string | null;
}

interface LabRepairPrice {
  id: string;
  lab_id: string;
  repair_type_id: string;
  price: number;
  is_active: boolean;
  notes: string | null;
  repair_types: RepairType;
}

export default function RepairPricingPage() {
  const [labPrices, setLabPrices] = useState<LabRepairPrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const pricesRes = await fetch('/api/lab/repair-prices');

      if (pricesRes.ok) {
        const prices = await pricesRes.json();
        setLabPrices(prices);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            מחירי תיקונים
          </h1>
          <p className="text-muted-foreground mt-1">רשימת סוגי התיקונים והמחירים המאושרים</p>
        </div>
        <Button
          variant="outline"
          onClick={loadData}
          disabled={loading}
          className="flex-1 sm:flex-none"
        >
          רענן
          <RefreshCw className={cn("h-4 w-4 ms-2", loading && "animate-spin")} />
        </Button>
      </div>

      {labPrices.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">אין מחירי תיקונים זמינים</p>
            <p className="text-sm mt-1">המנהל טרם הגדיר מחירים עבור המעבדה שלך</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {labPrices
            .filter(price => price.is_active)
            .map(price => (
              <Card key={price.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{price.repair_types.name}</CardTitle>
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      פעיל
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {price.repair_types.description && (
                    <p className="text-sm text-muted-foreground">
                      {price.repair_types.description}
                    </p>
                  )}
                  <div className="pt-2 border-t">
                    <div className="flex items-baseline gap-1">
                      <ShekelIcon className="h-6 w-6 text-primary inline-block mb-1" />
                      <span className="text-3xl font-bold text-primary">
                        {price.price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  {price.notes && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">הערות:</span> {price.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {labPrices.some(price => !price.is_active) && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4 text-muted-foreground">מחירים לא פעילים</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {labPrices
              .filter(price => !price.is_active)
              .map(price => (
                <Card key={price.id} className="opacity-60">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{price.repair_types.name}</CardTitle>
                      <Badge variant="secondary" className="bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                        לא פעיל
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {price.repair_types.description && (
                      <p className="text-sm text-muted-foreground">
                        {price.repair_types.description}
                      </p>
                    )}
                    <div className="pt-2 border-t">
                      <div className="flex items-baseline gap-1">
                        <ShekelIcon className="h-6 w-6 text-muted-foreground inline-block mb-1" />
                        <span className="text-3xl font-bold text-muted-foreground">
                          {price.price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    {price.notes && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">הערות:</span> {price.notes}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
