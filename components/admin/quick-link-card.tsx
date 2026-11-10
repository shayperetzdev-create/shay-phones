'use client';

import Link from 'next/link';
import { LucideIcon, ChevronLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface QuickLinkCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  iconColor?: string;
  className?: string;
}

export function QuickLinkCard({
  title,
  description,
  icon: Icon,
  href,
  iconColor = 'text-primary',
  className,
}: QuickLinkCardProps) {
  return (
    <Link 
      href={href} 
      className="block h-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg"
      aria-label={`נווט ל${title}: ${description}`}
      dir="rtl"
    >
      <Card
        className={cn(
          'h-full p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] group',
          className
        )}
        role="article"
      >
        <div className="grid grid-cols-[auto_1fr_auto] items-start gap-4 h-full" dir="rtl">
          {/* Icon on the right (RTL) */}
          <div className="flex-shrink-0" aria-hidden="true">
            <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-200">
              <Icon className={cn('h-6 w-6', iconColor)} />
            </div>
          </div>

          {/* Content */}
          <div className="text-right min-w-0">
            <h3 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors duration-200">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {description}
            </p>
          </div>

          {/* Arrow on the left (RTL) */}
          <div className="flex-shrink-0 self-center" aria-hidden="true">
            <ChevronLeft className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:-translate-x-1 transition-all duration-200" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
