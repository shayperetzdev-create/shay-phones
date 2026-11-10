
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Save, Shield } from 'lucide-react';

export function SystemSettingsCard() {
  const [isLoading, setIsLoading] = useState(true);
  const [rateLimit, setRateLimit] = useState<number>(50);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const supabase = createClient();
  const { toast } = useToast();

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const rateLimitResult = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'imei_search_rate_limit')
        .maybeSingle();

      if (rateLimitResult.error && rateLimitResult.error.code !== 'PGRST116') {
        throw rateLimitResult.error;
      }

      if (rateLimitResult.data) {
        setRateLimit((rateLimitResult.data.value as any)?.value || 50);
      }

    } catch (error: any) {
      toast({
        title: 'שגיאה בטעינת הגדרות מערכת',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    const loadUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    loadUserId();
    loadSettings();
  }, [supabase, loadSettings]);

  const saveSettings = async () => {
    setIsLoading(true);
    try {
      const rateLimitResult = await supabase
        .from('settings')
        .upsert({
          key: 'imei_search_rate_limit',
          value: { value: rateLimit },
        });

      if (rateLimitResult.error) throw rateLimitResult.error;

      toast({
        title: 'הצלחה',
        description: 'הגדרות המערכת עודכנו בהצלחה',
      });

      if(currentUserId){
        supabase.from('audit_log').insert({
          actor_user_id: currentUserId,
          action: 'settings.update',
          entity_type: 'setting',
          entity_id: 'imei_search_rate_limit',
          meta: { new_value: rateLimit }
        }).then(({error: logError}) => {
            if(logError) console.error('Audit log for settings update failed:', logError);
        });
      }

    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לשמור את הגדרות המערכת',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>הגדרות מערכת</CardTitle>
        <CardDescription>
          הגדרות גלובליות של המערכת.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rateLimit" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              מגבלת חיפושי IMEI יומית (לחנות)
            </Label>
            <Input
              id="rateLimit"
              type="number"
              value={rateLimit}
              onChange={(e) => setRateLimit(parseInt(e.target.value, 10))}
              className="w-48"
              disabled={isLoading}
              min="1"
            />
             <p className="text-sm text-muted-foreground">
              זוהי כמות החיפושים המקסימלית שמשתמש 'חנות' יכול לבצע ביום.
            </p>
          </div>
        </div>

        <Button onClick={saveSettings} disabled={isLoading}>
          <Save className="ms-2 h-4 w-4" />
          שמור הגדרות מערכת
        </Button>
      </CardContent>
    </Card>
  );
}
