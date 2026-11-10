'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface QuickStatProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'blue' | 'orange' | 'green' | 'purple' | 'red';
  onClick?: () => void;
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-900',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-r-blue-500',
    value: 'text-blue-600',
  },
  orange: {
    bg: 'bg-orange-100 dark:bg-orange-900',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-r-orange-500',
    value: 'text-orange-600',
  },
  green: {
    bg: 'bg-green-100 dark:bg-green-900',
    text: 'text-green-600 dark:text-green-400',
    border: 'border-r-green-500',
    value: 'text-green-600',
  },
  purple: {
    bg: 'bg-purple-100 dark:bg-purple-900',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-r-purple-500',
    value: 'text-purple-600',
  },
  red: {
    bg: 'bg-red-100 dark:bg-red-900',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-r-red-500',
    value: 'text-red-600',
  },
};

export function QuickStat({
  title,
  value,
  icon: Icon,
  description,
  trend,
  color = 'blue',
  onClick,
}: QuickStatProps) {
  const colors = colorClasses[color];

  return (
    <Card
      className={cn(
        'shadow-sm hover:shadow-md transition-all duration-200 border-r-4',
        colors.border,
        onClick && 'cursor-pointer hover:scale-105'
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className={cn('h-10 w-10 rounded-full flex items-center justify-center', colors.bg)}>
            <Icon className={cn('h-5 w-5', colors.text)} />
          </div>
        </div>
        
        <div className="space-y-1">
          <div className={cn('text-3xl font-bold', colors.value)}>{value}</div>
          
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          
          {trend && (
            <div className="flex items-center gap-1 text-xs">
              <span className={trend.isPositive ? 'text-green-600' : 'text-red-600'}>
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-muted-foreground">מהחודש הקודם</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
