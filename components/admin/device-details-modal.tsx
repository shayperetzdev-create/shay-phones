'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Device, DeviceModel, Warranty } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

interface DeviceDetailsModalProps {
  deviceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeviceUpdate: () => void;
}

const deviceSchema = z.object({
  imei2: z.string().nullable(),
  model_id: z.string().min(1, 'יש לבחור דגם'),
  import_batch: z.string().nullable(),
  notes: z.string().nullable(),
});

type DeviceFormData = z.infer<typeof deviceSchema>;

export function DeviceDetailsModal({ deviceId, open, onOpenChange, onDeviceUpdate }: DeviceDetailsModalProps) {
  const [device, setDevice] = useState<Device | null>(null);
  const [deviceModels, setDeviceModels] = useState<Pick<DeviceModel, 'id' | 'model_name'>[]>([]);
  const [activeWarranty, setActiveWarranty] = useState<Warranty | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const supabase = createClient();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<DeviceFormData>({
    resolver: zodResolver(deviceSchema),
  });

  useEffect(() => {
    const fetchDetails = async () => {
      if (!deviceId) return;
      setIsLoading(true);
      try {
        const [deviceRes, deviceModelsRes, warrantyRes] = await Promise.all([
          supabase.from('devices').select('*').eq('id', deviceId).single(),
          supabase.from('device_models').select('id, model_name').order('model_name'),
          supabase.from('warranties').select('*').eq('device_id', deviceId).eq('is_active', true).maybeSingle()
        ]);

        if (deviceRes.error) throw deviceRes.error;
        if (deviceModelsRes.error) throw deviceModelsRes.error;
        if (warrantyRes.error) throw warrantyRes.error;

        const deviceData = deviceRes.data as Device;
        setDevice(deviceData);
        setDeviceModels(deviceModelsRes.data || []);
        setActiveWarranty(warrantyRes.data || null);

        reset({
          imei2: deviceData.imei2 ?? null,
          model_id: deviceData.model_id ?? '',
          import_batch: deviceData.import_batch ?? null,
          notes: deviceData.notes ?? null,
        });

      } catch (error) {
        console.error('Error fetching details:', error);
        toast({ title: 'שגיאה בטעינת הפרטים', variant: 'destructive' });
      }
      setIsLoading(false);
    };

    if (open) {
      fetchDetails();
    } else {
      setDevice(null);
      setActiveWarranty(null);
      reset();
    }
  }, [deviceId, open, supabase, toast, reset]);

  const handleSave = async (data: DeviceFormData) => {
    if (!deviceId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('devices')
        .update(data)
        .eq('id', deviceId);
      if (error) throw error;
      toast({ title: 'פרטי המכשיר עודכנו בהצלחה' });
      onDeviceUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating device:', error);
      toast({ title: 'שגיאה בעדכון פרטי המכשיר', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>פרטי מכשיר</DialogTitle>
          <DialogDescription>ערוך את פרטי המכשיר</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : device ? (
          <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
            <div>
              <Label>IMEI</Label>
              <Input value={device.imei} disabled />
            </div>
            <div>
              <Label htmlFor="imei2">IMEI 2</Label>
              <Input id="imei2" {...register('imei2')} />
            </div>
            <div>
              <Label htmlFor="model_id">דגם</Label>
              <Select onValueChange={(value) => setValue('model_id', value)} value={device.model_id}>
                <SelectTrigger id="model_id">
                  <SelectValue placeholder="בחר דגם" />
                </SelectTrigger>
                <SelectContent>
                  {deviceModels.map(model => (
                    <SelectItem key={model.id} value={model.id}>{model.model_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.model_id && <p className="text-sm text-red-500 mt-1">{errors.model_id.message}</p>}
            </div>
            <div>
              <Label htmlFor="import_batch">אצוות יבוא</Label>
              <Input id="import_batch" {...register('import_batch')} />
            </div>
            <div>
              <Label htmlFor="notes">הערות</Label>
              <Textarea id="notes" {...register('notes')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>ביטול</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                שמור שינויים
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div>לא נמצא מכשיר</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
