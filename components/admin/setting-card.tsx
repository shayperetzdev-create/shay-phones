'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SettingCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
  badge?: string;
  className?: string;
}

export function SettingCard({
  title,
  description,
  icon: Icon,
  onClick,
  disabled = false,
  badge,
  className,
}: SettingCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <Card
      className={cn(
        'p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        disabled && 'opacity-60 cursor-not-allowed hover:scale-100 focus:ring-0',
        className
      )}
      onClick={disabled ? undefined : onClick}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="button"
      aria-label={`${title}: ${description}${disabled ? ' (לא זמין)' : ''}`}
      aria-disabled={disabled}
    >
      <div className="flex flex-col items-center text-center gap-3 h-full">
        {/* Icon */}
        <div
          className={cn(
            'p-4 rounded-full bg-primary/10 transition-all duration-200',
            !disabled && 'group-hover:bg-primary/20 group-hover:scale-110'
          )}
          aria-hidden="true"
        >
          <Icon className="h-7 w-7 text-primary" />
        </div>

        {/* Title with optional badge */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <h3
            className={cn(
              'text-lg font-semibold transition-colors duration-200',
              !disabled && 'group-hover:text-primary'
            )}
          >
            {title}
          </h3>
          {badge && (
            <Badge 
              variant="secondary" 
              className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-100" 
              aria-label={badge}
            >
              {badge}
            </Badge>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>
      </div>
    </Card>
  );
}
