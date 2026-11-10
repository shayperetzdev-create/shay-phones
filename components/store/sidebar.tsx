'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  RefreshCw,
  Package,
  FileText,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const navigation = [
  { name: 'לוח בקרה', href: '/store/dashboard', icon: LayoutDashboard },
  { name: 'המכשירים שלי', href: '/store/devices', icon: Package },
  { name: 'בקשות החלפה', href: '/store/replacements', icon: RefreshCw },
  { name: 'דוחות', href: '/store/reports', icon: FileText },
  { name: 'הגדרות', href: '/store/settings', icon: Settings },
];

export function StoreSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed top-4 end-4 z-50 p-2 rounded-md bg-white dark:bg-gray-800 shadow-md"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </button>

      {/* Sidebar */}
      <div
        className={cn(
          'fixed lg:static inset-y-0 end-0 z-40 w-64 bg-white dark:bg-gray-800 border-e border-gray-200 dark:border-gray-700 transform transition-transform duration-200 ease-in-out',
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
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
                מערכת שירות ואחריות
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-sm'
                  )}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Icon className={cn(
                    "me-3 h-5 w-5 transition-transform group-hover:scale-110",
                    isActive && "animate-pulse"
                  )} />
                  <div className="flex-1">
                    <div>{item.name}</div>
                  </div>
                  {isActive && (
                    <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={handleSignOut}
            >
              <LogOut className="me-3 h-5 w-5" />
              התנתק
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black bg-opacity-50"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}