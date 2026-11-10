
import { Separator } from '@/components/ui/separator';

interface SettingsLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function SettingsLayout({
  title,
  description,
  children,
}: SettingsLayoutProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <Separator />
      <div className="space-y-8">{children}</div>
    </div>
  );
}
