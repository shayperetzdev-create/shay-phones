'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAllRepairTypes, useActiveLabs, useLabRepairPrices } from '@/hooks/queries/useRepairTypes';
import { BackgroundRefreshIndicator } from '@/components/ui/background-refresh-indicator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Wrench, Plus, Edit } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import ShekelIcon from '@/components/ui/shekel-icon';
import type { RepairType } from '@/types';
import type { Lab, LabRepairPrice } from '@/hooks/queries/useRepairTypes';

export default function AdminRepairTypesPage() {
  // React Query hooks with Realtime
  const { repairTypes, isLoading: isTypesLoading, isFetching: isTypesFetching } = useAllRepairTypes();
  const { labs, isLoading: isLabsLoading, isFetching: isLabsFetching } = useActiveLabs();

  // Local state
  const [selectedRepairType, setSelectedRepairType] = useState<RepairType | null>(null);
  const [isNewTypeDialogOpen, setIsNewTypeDialogOpen] = useState(false);
  const [isPricingDialogOpen, setIsPricingDialogOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');

  const supabase = createClient();
  const { toast } = useToast();

  const isLoading = isTypesLoading || isLabsLoading;
  const isFetching = isTypesFetching || isLabsFetching;

  // Lab prices for selected repair type
  const { labPrices } = useLabRepairPrices(selectedRepairType?.id || null);

  const handleCreateRepairType = async () => {
    if (!newTypeName.trim()) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין שם לסוג התיקון',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await (supabase
        .from('repair_types') as any)
        .insert({
          name: newTypeName.trim(),
          description: newTypeDescription.trim() || null,
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: 'סוג התיקון נוסף בהצלחה',
      });

      setIsNewTypeDialogOpen(false);
      setNewTypeName('');
      setNewTypeDescription('');
      // React Query + Realtime will auto-refresh
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן ליצור סוג תיקון',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (repairType: RepairType) => {
    try {
      const { error } = await (supabase
        .from('repair_types') as any)
        .update({ is_active: !repairType.is_active })
        .eq('id', repairType.id);

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: `סוג התיקון ${repairType.is_active ? 'הושבת' : 'הופעל'} בהצלחה`,
      });
      // React Query + Realtime will auto-refresh
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לעדכן את הסטטוס',
        variant: 'destructive',
      });
    }
  };

  const handleOpenPricingDialog = (repairType: RepairType) => {
    setSelectedRepairType(repairType);
    setIsPricingDialogOpen(true);
    // useLabRepairPrices hook will auto-fetch based on selectedRepairType
  };

  const handleUpdatePrice = async (labId: string, price: string) => {
    if (!selectedRepairType) return;

    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue < 0) {
      toast({
        title: 'שגיאה',
        description: 'מחיר לא תקין',
        variant: 'destructive',
      });
      return;
    }

    try {
      const existingPrice = labPrices.find(lp => lp.lab_id === labId);

      if (existingPrice) {
        // Update existing price
        console.log('Updating existing price:', existingPrice.id, priceValue);
        const { error } = await (supabase.from('lab_repair_prices') as any).update({ 
          price: priceValue, 
          is_active: true 
        }).eq('id', existingPrice.id);

        if (error) {
          console.error('Error updating price:', error);
          throw error;
        }
      } else {
        // Insert new price
        console.log('Inserting new price for lab:', labId, 'repair type:', selectedRepairType.id, 'price:', priceValue);
        const { error } = await (supabase.from('lab_repair_prices') as any).insert({
          lab_id: labId,
          repair_type_id: selectedRepairType.id,
          price: priceValue,
          is_active: true,
        });

        if (error) {
          console.error('Error inserting price:', error);
          throw error;
        }
      }

      toast({
        title: 'הצלחה',
        description: 'המחיר עודכן בהצלחה',
      });
      // React Query + Realtime will auto-refresh
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לעדכן את המחיר',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Background refresh indicator */}
      <BackgroundRefreshIndicator
        isFetching={isFetching}
        isLoading={isLoading}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Wrench className="h-7 w-7 text-primary" />
            ניהול סוגי תיקונים
          </h1>
          <p className="text-muted-foreground mt-1">הגדרת סוגי תיקונים ומחירים למעבדות</p>
        </div>
        <Button onClick={() => setIsNewTypeDialogOpen(true)}>
          <Plus className="h-4 w-4 ms-2" />
          סוג תיקון חדש
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>סוגי תיקונים</CardTitle>
          <CardDescription>רשימת כל סוגי התיקונים במערכת</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם</TableHead>
                <TableHead>תיאור</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead className="text-center">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repairTypes.map((repairType) => (
                <TableRow key={repairType.id}>
                  <TableCell className="font-medium">{repairType.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {repairType.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={repairType.is_active ? 'default' : 'secondary'}>
                      {repairType.is_active ? 'פעיל' : 'מושבת'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenPricingDialog(repairType)}
                      >
                        <ShekelIcon className="h-4 w-4 ms-1" />
                        מחירים
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleActive(repairType)}
                      >
                        {repairType.is_active ? 'השבת' : 'הפעל'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* New Repair Type Dialog */}
      <Dialog open={isNewTypeDialogOpen} onOpenChange={setIsNewTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>סוג תיקון חדש</DialogTitle>
            <DialogDescription>הוסף סוג תיקון חדש למערכת</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">שם *</Label>
              <Input
                id="name"
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="לדוגמה: החלפת מסך"
              />
            </div>
            <div>
              <Label htmlFor="description">תיאור</Label>
              <Textarea
                id="description"
                value={newTypeDescription}
                onChange={(e) => setNewTypeDescription(e.target.value)}
                placeholder="תיאור אופציונלי"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewTypeDialogOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleCreateRepairType}>שמור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pricing Dialog */}
      <Dialog open={isPricingDialogOpen} onOpenChange={setIsPricingDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>מחירים למעבדות - {selectedRepairType?.name}</DialogTitle>
            <DialogDescription>הגדר מחירים לכל מעבדה</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {labs.map((lab) => {
              const existingPrice = labPrices.find(lp => lp.lab_id === lab.id);
              return (
                <div key={lab.id} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{lab.full_name}</div>
                    <div className="text-sm text-muted-foreground">{lab.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="מחיר"
                      defaultValue={existingPrice?.price || ''}
                      className="w-32"
                      onBlur={(e) => {
                        if (e.target.value) {
                          handleUpdatePrice(lab.id, e.target.value);
                        }
                      }}
                    />
                    <ShekelIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
