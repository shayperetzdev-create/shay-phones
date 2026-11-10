import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BackgroundRefreshIndicatorProps {
  /**
   * האם מתבצע רענון ברקע
   */
  isFetching: boolean;

  /**
   * האם זו טעינה ראשונית (לא להציג את ה-badge)
   */
  isLoading?: boolean;

  /**
   * מיקום ה-badge
   * @default 'top-right'
   */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

  /**
   * טקסט מותאם אישית
   * @default 'מעדכן...'
   */
  text?: string;

  /**
   * className נוסף
   */
  className?: string;
}

const positionClasses = {
  'top-right': 'top-4 left-4',
  'top-left': 'top-4 right-4',
  'bottom-right': 'bottom-4 left-4',
  'bottom-left': 'bottom-4 right-4',
};

/**
 * אינדיקטור עדין לרענון ברקע
 *
 * מציג badge קטן וצף בפינת המסך כשמתבצע רענון ברקע.
 * לא מוצג בזמן טעינה ראשונית (isLoading).
 *
 * @example
 * ```tsx
 * const { data, isLoading, isFetching } = useLabRepairs(labId);
 *
 * return (
 *   <>
 *     <BackgroundRefreshIndicator
 *       isFetching={isFetching}
 *       isLoading={isLoading}
 *     />
 *     {isLoading ? <Skeleton /> : <DataTable data={data} />}
 *   </>
 * );
 * ```
 */
export function BackgroundRefreshIndicator({
  isFetching,
  isLoading = false,
  position = 'top-right',
  text = 'מעדכן...',
  className,
}: BackgroundRefreshIndicatorProps) {
  // לא להציג בזמן טעינה ראשונית
  if (isLoading || !isFetching) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed z-50 animate-in fade-in slide-in-from-top-2 duration-300',
        positionClasses[position],
        className
      )}
    >
      <Badge
        variant="secondary"
        className="flex items-center gap-2 shadow-lg border border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <RefreshCw className="h-3 w-3 animate-spin" />
        <span className="text-xs font-medium">{text}</span>
      </Badge>
    </div>
  );
}
