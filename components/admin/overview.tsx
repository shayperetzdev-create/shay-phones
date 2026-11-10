'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export function Overview() {
  const [data, setData] = useState<any[]>([]);
  const supabase = createClient();

  const fetchChartData = useCallback(async () => {
    // Fetch monthly data for the last 6 months
    const months = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
      
      const monthName = date.toLocaleDateString('he-IL', { month: 'short' });
      
      // Fetch warranties activated in this month
      const { count: warranties } = await supabase
        .from('warranties')
        .select('*', { count: 'exact', head: true })
        .gte('activation_date', date.toISOString().split('T')[0])
        .lte('activation_date', endDate.toISOString().split('T')[0]);
      
      // Fetch repairs created in this month
      const { count: repairs } = await supabase
        .from('repairs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', date.toISOString())
        .lt('created_at', new Date(endDate.getTime() + 86400000).toISOString());
      
      months.push({
        name: monthName,
        warranties: warranties || 0,
        repairs: repairs || 0,
      });
    }
    
    setData(months);
  }, [supabase]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  // Simple bar chart visualization using CSS
  const maxValue = Math.max(...data.flatMap(d => [d.warranties, d.repairs])) || 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>אחריות</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>תיקונים</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-end justify-between gap-2 h-[200px]">
        {data.map((month, index) => (
          <div key={index} className="flex-1 flex flex-col items-center gap-2">
            <div className="flex gap-1 items-end flex-1 w-full">
              <div 
                className="flex-1 bg-blue-500 rounded-t transition-all duration-300"
                style={{ 
                  height: `${(month.warranties / maxValue) * 100}%`,
                  minHeight: '4px'
                }}
                title={`אחריות: ${month.warranties}`}
              />
              <div 
                className="flex-1 bg-green-500 rounded-t transition-all duration-300"
                style={{ 
                  height: `${(month.repairs / maxValue) * 100}%`,
                  minHeight: '4px'
                }}
                title={`תיקונים: ${month.repairs}`}
              />
            </div>
            <span className="text-xs text-muted-foreground">{month.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}