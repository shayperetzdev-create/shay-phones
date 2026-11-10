'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Package,
  Shield,
  Wrench,
  FileText,
  Upload,
  UserPlus,
  Download,
  Settings,
  TrendingUp
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function QuickActions() {
  const [openDialog, setOpenDialog] = useState<string | null>(null);

  const actions = [
    {
      id: 'import-devices',
      title: 'ייבוא מכשירים',
      description: 'ייבוא מכשירים מקובץ CSV',
      icon: Upload,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      href: '/admin/devices?action=import',
      dialog: false,
    },
    {
      id: 'activate-warranty',
      title: 'הפעלת אחריות',
      description: 'הפעלה מהירה של אחריות',
      icon: Shield,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      href: '/admin/warranties?action=activate',
      dialog: false,
    },
    {
      id: 'new-repair',
      title: 'תיקון חדש',
      description: 'פתיחת כרטיס תיקון',
      icon: Wrench,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      href: '/admin/repairs?action=new',
      dialog: false,
    },
    {
      id: 'generate-report',
      title: 'הפקת דוח',
      description: 'יצירת דוח מותאם אישית',
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      href: '/admin/reports?action=generate',
      dialog: false,
    },
    {
      id: 'add-user',
      title: 'משתמש חדש',
      description: 'הוספת משתמש למערכת',
      icon: UserPlus,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      href: '/admin/users?action=new',
      dialog: false,
    },
    {
      id: 'export-data',
      title: 'ייצוא נתונים',
      description: 'ייצוא נתונים ל-Excel',
      icon: Download,
      color: 'text-teal-600',
      bgColor: 'bg-teal-100',
      href: '#',
      dialog: true,
    },
    {
      id: 'system-settings',
      title: 'הגדרות מערכת',
      description: 'הגדרות וקונפיגורציה',
      icon: Settings,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      href: '/admin/settings',
      dialog: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {actions.map((action) => {
        const Icon = action.icon;
        
        if (action.dialog) {
          return (
            <Dialog key={action.id} open={openDialog === action.id} onOpenChange={(open) => setOpenDialog(open ? action.id : null)}>
              <DialogTrigger asChild>
                <button className="flex flex-col items-center p-5 border rounded-xl hover:bg-accent transition-all duration-200 hover:shadow-lg group">
                  <div className={`p-3 rounded-full ${action.bgColor} group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className={`h-6 w-6 ${action.color}`} />
                  </div>
                  <span className="mt-3 text-sm font-semibold">{action.title}</span>
                  <span className="text-xs text-muted-foreground text-center">{action.description}</span>
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{action.title}</DialogTitle>
                  <DialogDescription>{action.description}</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <p className="text-sm text-muted-foreground">
                    פונקציונליות זו תהיה זמינה בקרוב...
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          );
        }
        
        return (
          <Link key={action.id} href={action.href}>
            <button className="flex flex-col items-center p-5 border rounded-xl hover:bg-accent transition-all duration-200 hover:shadow-lg group w-full h-full">
              <div className={`p-3 rounded-full ${action.bgColor} group-hover:scale-110 transition-transform duration-200`}>
                <Icon className={`h-6 w-6 ${action.color}`} />
              </div>
              <span className="mt-3 text-sm font-semibold">{action.title}</span>
              <span className="text-xs text-muted-foreground text-center">{action.description}</span>
            </button>
          </Link>
        );
      })}
    </div>
  );
}