'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock, Sparkles } from 'lucide-react';

interface ComingSoonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  features?: string[];
}

export function ComingSoonDialog({
  open,
  onOpenChange,
  title,
  description,
  features = [],
}: ComingSoonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="coming-soon-description">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-full bg-primary/10 p-3 animate-pulse">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">{title}</DialogTitle>
          </div>
          <DialogDescription id="coming-soon-description" className="text-base">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {features.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                תכונות מתוכננות:
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              תכונה זו נמצאת בפיתוח ותהיה זמינה בגרסה הבאה
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // TODO: Implement notification subscription
              onOpenChange(false);
            }}
            className="text-muted-foreground hover:text-primary"
          >
            <Clock className="ml-2 h-4 w-4" />
            הודע לי כשזה יהיה מוכן
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            הבנתי
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
