'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bell, Check, Trash2, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  is_opened: boolean;
  created_at: string;
}

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isDecisionDialogOpen, setIsDecisionDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const { toast } = useToast();
  const supabase = createClient();

  const loadNotifications = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await (supabase as any)
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        const typedData = data as Notification[];
        setNotifications(typedData);
        setUnreadCount(typedData.filter(n => !n.is_read).length);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, [supabase]);

  useEffect(() => {
    loadNotifications();

    // Realtime subscription for instant updates (no polling needed)
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        loadNotifications();
      })
      .subscribe();

    // ✅ Removed polling interval - Supabase Realtime handles updates instantly
    // This reduces database load by ~3,000 queries/minute for 500 concurrent users

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadNotifications, supabase]);

  const markAsOpened = async (notificationId: string) => {
    try {
      await supabase.from('notifications').update({ is_opened: true, is_read: true }).eq('id', notificationId);
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_opened: true, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as opened:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await supabase.from('notifications').delete().eq('id', notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      const wasUnread = notifications.find(n => n.id === notificationId)?.is_read === false;
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const openNotification = (notification: Notification) => {
    setSelectedNotification(notification);
    if (notification.type === 'replacement_request_new') {
      setIsDecisionDialogOpen(true);
    } else {
      setIsDetailDialogOpen(true);
    }
    if (!notification.is_opened) {
      markAsOpened(notification.id);
    }
  };

  const handleDecision = async (decision: 'approve' | 'reject') => {
    if (!selectedNotification?.data?.request_id) return;

    if (decision === 'reject' && !adminNotes.trim()) {
      toast({ title: 'שגיאה', description: 'יש לציין סיבת דחייה', variant: 'destructive' });
      return;
    }

    try {
      const rpcName = decision === 'approve' ? 'approve_replacement' : 'reject_replacement';
      const { error } = await supabase.rpc(rpcName, {
        p_request_id: selectedNotification.data.request_id,
        p_admin_notes: adminNotes || '',
      });

      if (error) throw error;

      toast({ title: 'הצלחה', description: `הבקשה ${decision === 'approve' ? 'אושרה' : 'נדחתה'} בהצלחה` });
      setIsDecisionDialogOpen(false);
      setAdminNotes('');
      // Remove the notification locally after handling it
      setNotifications(prev => prev.filter(n => n.id !== selectedNotification.id));

    } catch (error: any) {
      console.error('Error processing decision:', error);
      toast({ title: 'שגיאה', description: error.message || 'אירעה שגיאה בעיבוד הבקשה', variant: 'destructive' });
    }
  };

  const getNotificationIcon = (type: string) => '🔔';

  const renderNotificationData = (notification: Notification | null) => {
    if (!notification || !notification.data) return null;

    const { type, data } = notification;

    if (type === 'replacement_request_approved' || type === 'replacement_request_rejected') {
      return (
        <div className="bg-muted p-4 rounded-lg space-y-2">
          <p className="text-sm font-medium">פרטי הבקשה:</p>
          {data.device_model_name && <p className="text-sm"><span className="font-medium">דגם:</span> {data.device_model_name}</p>}
          {data.device_imei && <p className="text-sm"><span className="font-medium">IMEI:</span> {data.device_imei}</p>}
          {data.admin_notes && <p className="text-sm"><span className="font-medium">הערות מנהל:</span> {data.admin_notes}</p>}
        </div>
      );
    }

  // Fallback for other notification types
  if (Object.keys(data).length > 0) {
   return (
    <div className="bg-muted p-4 rounded-lg space-y-2">
     <p className="text-sm font-medium">פרטים נוספים:</p>
     <div className="space-y-1 mt-2">
      {Object.entries(data).map(([key, value]) => (
       <div key={key} className="flex justify-between text-sm gap-2">
        <span className="font-medium text-muted-foreground">{key}:</span>
        <span className="text-right">{String(value)}</span>
       </div>
      ))}
     </div>
    </div>
   );
  }

    return null;
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -left-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-96">
          <div dir="rtl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">התראות</h3>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs">
                  <Check className="h-3 w-3 me-1" />
                  סמן הכל כנקרא
                </Button>
              )}
            </div>
            <ScrollArea className="h-[400px]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">אין התראות</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map(notification => (
                    <div key={notification.id} className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${!notification.is_read ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`} onClick={() => openNotification(notification)}>
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">{getNotificationIcon(notification.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-sm">{notification.title}</p>
                            {!notification.is_read && <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{notification.message}</p>
                          <p className="text-xs text-muted-foreground mt-2">{formatDateTime(notification.created_at)}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={e => { e.stopPropagation(); deleteNotification(notification.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Notification Detail Dialog (for non-actionable notifications) */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>{selectedNotification?.title}</DialogTitle>
            <DialogDescription>{selectedNotification && formatDateTime(selectedNotification.created_at)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">{selectedNotification?.message}</p>
            {renderNotificationData(selectedNotification)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>סגור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replacement Request Decision Dialog */}
      <Dialog open={isDecisionDialogOpen} onOpenChange={setIsDecisionDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>טיפול בבקשת החלפה</DialogTitle>
            <DialogDescription>{selectedNotification?.message}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedNotification?.data && (
                <div className="text-sm">
                    <p><span className="font-medium">מבקש:</span> {selectedNotification.data.requester_name}</p>
                    <p><span className="font-medium">IMEI:</span> {selectedNotification.data.device_imei}</p>
                </div>
            )}
            <div>
              <Label htmlFor="admin_notes">הערות (חובה בדחייה)</Label>
              <Textarea id="admin_notes" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="הזן הערות או סיבת דחייה..." />
            </div>
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>שים לב</AlertTitle>
                <AlertDescription>אישור הבקשה ישנה את סטטוס המכשיר ל"הוחלף".</AlertDescription>
            </Alert>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDecisionDialogOpen(false)}>ביטול</Button>
            <Button variant="destructive" onClick={() => handleDecision('reject')} disabled={!adminNotes}>דחה בקשה</Button>
            <Button onClick={() => handleDecision('approve')}>אשר החלפה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
