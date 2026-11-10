'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/src/lib/utils';
import ShekelIcon from '@/components/ui/shekel-icon';

interface Lab {
  id: string;
  full_name: string | null;
  email: string;
}

interface RepairType {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface LabPrice {
  id: string;
  lab_id: string;
  repair_type_id: string;
  price: number;
  is_active: boolean;
}

interface LabRepairPricesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LabRepairPricesDialog({ open, onOpenChange }: LabRepairPricesDialogProps) {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [repairTypes, setRepairTypes] = useState<RepairType[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<string>('');
  const [labPrices, setLabPrices] = useState<LabPrice[]>([]);
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const supabase = createClient();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch active labs
      const { data: labsData, error: labsError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'lab')
        .eq('is_active', true)
        .order('full_name');

      if (labsError) throw labsError;
      setLabs(labsData || []);

      // Fetch active repair types
      const { data: typesData, error: typesError } = await supabase
        .from('repair_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (typesError) throw typesError;
      setRepairTypes(typesData || []);
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לטעון את הנתונים',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [supabase, toast]);

  const fetchLabPrices = useCallback(async (labId: string) => {
    try {
      const { data, error } = await supabase
        .from('lab_repair_prices')
        .select('*')
        .eq('lab_id', labId);

      if (error) throw error;
      
      setLabPrices(data || []);
      
      // Initialize price inputs and active states
      const inputs: Record<string, string> = {};
      const states: Record<string, boolean> = {};
      (data || []).forEach((price: LabPrice) => {
        inputs[price.repair_type_id] = price.price.toString();
        states[price.repair_type_id] = price.is_active;
      });
      setPriceInputs(inputs);
      setActiveStates(states);
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון מחירים',
        variant: 'destructive',
      });
    }
  }, [supabase, toast]);

  useEffect(() => {
    if (open) {
      fetchData();
      setSelectedLabId('');
      setLabPrices([]);
      setPriceInputs({});
      setActiveStates({});
    }
  }, [open, fetchData]);

  useEffect(() => {
    if (selectedLabId) {
      fetchLabPrices(selectedLabId);
    } else {
      setLabPrices([]);
      setPriceInputs({});
      setActiveStates({});
    }
  }, [selectedLabId, fetchLabPrices]);

  const handlePriceChange = (repairTypeId: string, value: string) => {
    setPriceInputs((prev) => ({
      ...prev,
      [repairTypeId]: value,
    }));
  };

  const handleActiveToggle = (repairTypeId: string, isActive: boolean) => {
    setActiveStates((prev) => ({
      ...prev,
      [repairTypeId]: isActive,
    }));
  };

  const handleSavePrice = async (repairTypeId: string) => {
    if (!selectedLabId) return;

    const priceValue = parseFloat(priceInputs[repairTypeId] || '0');
    
    if (isNaN(priceValue) || priceValue < 0) {
      toast({
        title: 'שגיאה',
        description: 'מחיר לא תקין',
        variant: 'destructive',
      });
      return;
    }

    const existingPrice = labPrices.find(lp => lp.repair_type_id === repairTypeId);
    
    // If no existing price and price is 0, don't create a record
    if (!existingPrice && priceValue === 0) {
      toast({
        title: 'שים לב',
        description: 'יש להזין מחיר גדול מ-0 כדי ליצור רשומה חדשה',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);
      const isActive = activeStates[repairTypeId] !== undefined ? activeStates[repairTypeId] : true;

      if (existingPrice) {
        // Update existing price
        const { error } = await (supabase.from('lab_repair_prices') as any)
          .update({ 
            price: priceValue, 
            is_active: isActive 
          })
          .eq('id', existingPrice.id);

        if (error) throw error;
      } else {
        // Insert new price
        const { error } = await (supabase.from('lab_repair_prices') as any)
          .insert({
            lab_id: selectedLabId,
            repair_type_id: repairTypeId,
            price: priceValue,
            is_active: isActive,
          });

        if (error) throw error;
      }

      toast({
        title: 'הצלחה',
        description: 'המחיר עודכן בהצלחה',
      });

      await fetchLabPrices(selectedLabId);
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לעדכן את המחיר',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAll = async () => {
    if (!selectedLabId) return;

    try {
      setIsSaving(true);
      let successCount = 0;
      let errorCount = 0;

      for (const repairType of repairTypes) {
        const priceValue = parseFloat(priceInputs[repairType.id] || '0');
        
        if (isNaN(priceValue) || priceValue < 0) {
          continue;
        }

        const existingPrice = labPrices.find(lp => lp.repair_type_id === repairType.id);
        const isActive = activeStates[repairType.id] !== undefined ? activeStates[repairType.id] : true;

        try {
          if (existingPrice) {
            const { error } = await (supabase.from('lab_repair_prices') as any)
              .update({ 
                price: priceValue, 
                is_active: isActive 
              })
              .eq('id', existingPrice.id);

            if (error) throw error;
          } else if (priceValue > 0) {
            const { error } = await (supabase.from('lab_repair_prices') as any)
              .insert({
                lab_id: selectedLabId,
                repair_type_id: repairType.id,
                price: priceValue,
                is_active: isActive,
              });

            if (error) throw error;
          }
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`Error saving price for ${repairType.name}:`, error);
        }
      }

      if (errorCount === 0) {
        toast({
          title: 'הצלחה',
          description: `כל המחירים עודכנו בהצלחה (${successCount})`,
        });
      } else {
        toast({
          title: 'הושלם עם שגיאות',
          description: `${successCount} מחירים עודכנו, ${errorCount} נכשלו`,
          variant: 'destructive',
        });
      }

      await fetchLabPrices(selectedLabId);
    } catch (error: any) {
      toast({
        title: 'שגיאה',
        description: error.message || 'לא ניתן לעדכן את המחירים',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedLab = labs.find(lab => lab.id === selectedLabId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-3xl max-h-[80vh] overflow-y-auto"
        aria-describedby="lab-prices-description"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            ניהול מחירי תיקונים למעבדות
          </DialogTitle>
          <DialogDescription id="lab-prices-description">
            בחר מעבדה והגדר מחירים לכל סוג תיקון. ניתן להשבית תיקונים ספציפיים לכל מעבדה
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Lab Selection */}
          <div className="space-y-2">
            <Label htmlFor="lab-select">בחר מעבדה *</Label>
            <Select value={selectedLabId} onValueChange={setSelectedLabId}>
              <SelectTrigger id="lab-select">
                <SelectValue placeholder="בחר מעבדה..." />
              </SelectTrigger>
              <SelectContent>
                {labs.map((lab) => (
                  <SelectItem key={lab.id} value={lab.id}>
                    {lab.full_name || lab.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedLab && (
              <p className="text-sm text-muted-foreground">
                {selectedLab.email}
              </p>
            )}
          </div>

          {/* Prices List */}
          {selectedLabId && (
            <>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : repairTypes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>אין סוגי תיקונים פעילים במערכת</p>
                  <p className="text-sm mt-2">הוסף סוגי תיקונים בהגדרות המערכת</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">מחירי תיקונים</h3>
                    <Button 
                      onClick={handleSaveAll} 
                      disabled={isSaving}
                      size="sm"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                          שומר...
                        </>
                      ) : (
                        <>
                          <Save className="ml-2 h-4 w-4" />
                          שמור הכל
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto border rounded-lg p-4">
                    {repairTypes.map((repairType) => {
                      const existingPrice = labPrices.find(
                        lp => lp.repair_type_id === repairType.id
                      );
                      const currentPrice = priceInputs[repairType.id] || existingPrice?.price?.toString() || '';
                      const isActive = activeStates[repairType.id] !== undefined 
                        ? activeStates[repairType.id] 
                        : (existingPrice?.is_active ?? true);

                      return (
                        <div 
                          key={repairType.id} 
                          className={`flex items-center gap-4 p-3 border rounded-lg transition-all ${
                            isActive 
                              ? 'hover:bg-accent/50 border-border' 
                              : 'bg-muted/50 border-muted opacity-70'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="font-medium">{repairType.name}</div>
                              {!isActive && (
                                <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                                  מושבת
                                </span>
                              )}
                            </div>
                            {repairType.description && (
                              <div className="text-sm text-muted-foreground">
                                {repairType.description}
                              </div>
                            )}
                            {existingPrice && (
                              <div className="text-xs text-muted-foreground mt-1">
                                מחיר נוכחי: {formatCurrency(existingPrice.price)}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col items-center gap-1">
                              <Switch
                                checked={isActive}
                                onCheckedChange={(checked) => handleActiveToggle(repairType.id, checked)}
                                aria-label={`${isActive ? 'השבת' : 'הפעל'} תיקון ${repairType.name}`}
                              />
                              <span className="text-xs text-muted-foreground">
                                {isActive ? 'פעיל' : 'מושבת'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={currentPrice}
                                onChange={(e) => handlePriceChange(repairType.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSavePrice(repairType.id);
                                  }
                                }}
                                className="w-32 text-left"
                                min="0"
                                step="0.01"
                                disabled={!isActive}
                              />
                              <ShekelIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSavePrice(repairType.id)}
                              disabled={isSaving}
                              title="שמור מחיר זה"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {!selectedLabId && (
            <div className="text-center py-12 text-muted-foreground">
              <ShekelIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>בחר מעבדה כדי להתחיל להגדיר מחירים</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
