'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  Shield,
  Wrench,
  RefreshCw,
  Building2,
  Users,
  FileText,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Store,
  Smartphone,
} from 'lucide-react';
import ShekelIcon from '@/components/ui/shekel-icon';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const navigationSections = [
  {
    items: [
      { name: 'לוח בקרה', href: '/admin/dashboard', icon: LayoutDashboard },
      { name: 'מלאי', href: '/admin/inventory', icon: Package },
      { name: 'דגמים', href: '/admin/inventory/models', icon: Smartphone },
      { name: 'קרטונים', href: '/admin/inventory/cartons', icon: Package },
      { name: 'מכשירים במלאי', href: '/admin/inventory/devices', icon: Smartphone },
      { name: 'מפיצים', href: '/admin/inventory/distributors', icon: Store },
      { name: 'מכירות', href: '/admin/sales', icon: FileText },
      { name: 'גבייה', href: '/admin/collections', icon: ShekelIcon },
      { name: 'העברה לשיווק', href: '/admin/consignment', icon: RefreshCw },
      { name: 'ביקורי שטח', href: '/admin/field', icon: Building2 },
      { name: 'כספים', href: '/admin/finance', icon: ShekelIcon },
      { name: 'מכשירים', href: '/admin/devices', icon: Package },
      { name: 'אחריות', href: '/admin/warranties', icon: Shield },
      { name: 'תיקונים', href: '/admin/repairs', icon: Wrench },
      { name: 'בקשות החלפה', href: '/admin/replacements', icon: RefreshCw },
      { name: 'חנויות', href: '/admin/stores', icon: Store },
      { name: 'מעבדות', href: '/admin/labs', icon: Building2 },
      { name: 'משתמשים', href: '/admin/users', icon: Users },
      { name: 'תשלומים', href: '/admin/payments', icon: ShekelIcon },
      { name: 'דוחות', href: '/admin/reports', icon: FileText },
    ],
  },
  {
    title: 'הגדרות',
    items: [
      { name: 'הגדרות כלליות', href: '/admin/settings', icon: Settings },
      { name: 'דגמי מכשירים', href: '/admin/dashboard?dialog=models', icon: Smartphone },
      { name: 'סוגי תיקונים', href: '/admin/dashboard?dialog=repair-types', icon: Wrench },
      { name: 'מחירי תיקון', href: '/admin/dashboard?dialog=lab-prices', icon: ShekelIcon },
    ],
  },
];

interface SidebarProps {
  isCollapsed?: boolean;
  setIsCollapsed?: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const supabase = createClient();
  const { user } = useCurrentUser();
  const isAdmin = !user || user.role === 'admin';
  const adminOnly = ['/admin/users', '/admin/payments', '/admin/settings', '/admin/stores', '/admin/labs'];

  // התנתקות מהמערכת
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <>
      {/* כפתור תפריט במובייל */}
      <button
        className="lg:hidden fixed top-4 right-4 z-50 p-2 rounded-md bg-white dark:bg-gray-800 shadow-md border border-border"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Sidebar */}
      <div
        className={cn(
          'fixed lg:static inset-y-0 right-0 z-40 bg-card border-l border-border shadow-sm transition-all duration-300 ease-in-out',
          isMobileMenuOpen ? 'translate-x-0 w-[17.5rem]' : 'translate-x-full', // מובייל: פתוח/סגור
          'lg:translate-x-0', // דסקטופ: תמיד מוצג
          'lg:w-[17.5rem]' // רוחב קבוע בדסקטופ
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo – אזור קומפקטי יותר עם לוגו גדול וטקסט מתחת */}
          <div className="flex items-center justify-center h-16 px-3 border-b border-border bg-gradient-to-l from-primary/10 to-transparent">
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-full h-11 overflow-hidden flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="ATLAS"
                  width={180}
                  height={26}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                מערכת מלאי, מכירות ואחריות
              </span>
            </div>
          </div>


          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
            {navigationSections.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                {section.title && (
                  <h3 className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {section.title}
                  </h3>
                )}

                <div className="space-y-1">
                  {section.items
                    .filter((item) => isAdmin || !adminOnly.some((href) => item.href.startsWith(href)))
                    .filter((item) => isAdmin || section.title !== 'הגדרות')
                    .map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          'group flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-sm'
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Icon
                          className={cn(
                            'h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-110',
                            isActive && 'animate-pulse'
                          )}
                        />
                        <span className="flex-1">{item.name}</span>
                        {isActive && (
                          <ChevronRight className="h-4 w-4 flex-shrink-0" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* User section – כפתור התנתקות */}
          <div className="p-4 border-t border-border">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5" />
              <span>התנתק</span>
            </Button>
          </div>
        </div>
      </div>

      {/* שכבת רקע למובייל */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
