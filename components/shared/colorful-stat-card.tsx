'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColorfulStatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'gray' | 'cyan' | 'pink' | 'indigo' | 'teal';
  onClick?: () => void;
  className?: string;
}

const colorClasses = {
  blue: {
    border: 'border-r-blue-500',
    bg: 'bg-blue-100 dark:bg-blue-900',
    icon: 'text-blue-600 dark:text-blue-400',
    value: 'text-blue-600',
  },
  green: {
    border: 'border-r-green-500',
    bg: 'bg-green-100 dark:bg-green-900',
    icon: 'text-green-600 dark:text-green-400',
    value: 'text-green-600',
  },
  orange: {
    border: 'border-r-orange-500',
    bg: 'bg-orange-100 dark:bg-orange-900',
    icon: 'text-orange-600 dark:text-orange-400',
    value: 'text-orange-600',
  },
  purple: {
    border: 'border-r-purple-500',
    bg: 'bg-purple-100 dark:bg-purple-900',
    icon: 'text-purple-600 dark:text-purple-400',
    value: 'text-purple-600',
  },
  red: {
    border: 'border-r-red-500',
    bg: 'bg-red-100 dark:bg-red-900',
    icon: 'text-red-600 dark:text-red-400',
    value: 'text-red-600',
  },
  gray: {
    border: 'border-r-gray-500',
    bg: 'bg-gray-100 dark:bg-gray-900',
    icon: 'text-gray-600 dark:text-gray-400',
    value: 'text-gray-600',
  },
  cyan: {
    border: 'border-r-cyan-500',
    bg: 'bg-cyan-100 dark:bg-cyan-900',
    icon: 'text-cyan-600 dark:text-cyan-400',
    value: 'text-cyan-600',
  },
  pink: {
    border: 'border-r-pink-500',
    bg: 'bg-pink-100 dark:bg-pink-900',
    icon: 'text-pink-600 dark:text-pink-400',
    value: 'text-pink-600',
  },
  indigo: {
    border: 'border-r-indigo-500',
    bg: 'bg-indigo-100 dark:bg-indigo-900',
    icon: 'text-indigo-600 dark:text-indigo-400',
    value: 'text-indigo-600',
  },
  teal: {
    border: 'border-r-teal-500',
    bg: 'bg-teal-100 dark:bg-teal-900',
    icon: 'text-teal-600 dark:text-teal-400',
    value: 'text-teal-600',
  },
};

export function ColorfulStatCard({
  title,
  value,
  icon: Icon,
  description,
  color = 'blue',
  onClick,
  className,
}: ColorfulStatCardProps) {
  const colors = colorClasses[color];

  return (
    <Card
      className={cn(
        'shadow-sm hover:shadow-md transition-all duration-200 border-r-4',
        colors.border,
        onClick && 'cursor-pointer hover:scale-[1.02]',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={cn('h-10 w-10 rounded-full flex items-center justify-center', colors.bg)}>
          <Icon className={cn('h-5 w-5', colors.icon)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn('text-3xl font-bold', colors.value)}>{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
