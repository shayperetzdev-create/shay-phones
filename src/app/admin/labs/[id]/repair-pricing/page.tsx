'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Plus, Pencil, Trash2, ArrowRight } from 'lucide-react';
import ShekelIcon from '@/components/ui/shekel-icon';

interface RepairType {
  id: string;
  name: string;
  description: string | null;
}

interface LabRepairPrice {
  id: string;
  lab_id: string;
  repair_type_id: string;
  price: number;
  is_active: boolean;
  notes: string | null;
  repair_types: RepairType;
}

interface Lab {
  id: string;
  full_name: string;
  email: string;
}

export default function AdminLabRepairPricingPage() {
  const params = useParams();
  const router = useRouter();
  const labId = params.id as string;

  const [lab, setLab] = useState<Lab | null>(null);
  const [repairTypes, setRepairTypes] = useState<RepairType[]>([]);
  const [labPrices, setLabPrices] = useState<LabRepairPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<LabRepairPrice | null>(null);
  
  const [formData, setFormData] = useState({
    repair_type_id: '',
    price: '',
    notes: '',
    is_active: true
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [labRes, typesRes, pricesRes] = await Promise.all([
        fetch(`/api/admin/labs/${labId}`),
        fetch('/api/admin/repair-types'),
        fetch(`/api/admin/labs/${labId}/repair-prices`)
      ]);

      if (labRes.ok) {
        const labData = await labRes.json();
        setLab(labData);
      }

      if (typesRes.ok) {
        const types = await typesRes.json();
        setRepairTypes(types.filter((t: RepairType) => t));
      }

      if (pricesRes.ok) {
        const prices = await pricesRes.json();
        setLabPrices(prices);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [labId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    try {
      if (editingPrice) {
        // עדכון מחיר קיים
        const res = await fetch(`/api/admin/labs/${labId}/repair-prices`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingPrice.id,
            price: parseFloat(formData.price),
            is_active: formData.is_active,
            notes: formData.notes || null
          })
        });

        if (res.ok) {
          await loadData();
          closeDialog();
        }
      } else {
        // הוספת מחיר חדש
        const res = await fetch(`/api/admin/labs/${labId}/repair-prices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repair_type_id: formData.repair_type_id,
            price: parseFloat(formData.price),
            notes: formData.notes || null
          })
        });

        if (res.ok) {
          await loadData();
          closeDialog();
        }
      }
    } catch (error) {
      console.error('Error saving price:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק מחיר זה?')) return;

    try {
      const res = await fetch(`/api/admin/labs/${labId}/repair-prices?id=${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Error deleting price:', error);
    }
  };

  const openAddDialog = () => {
    setEditingPrice(null);
    setFormData({ repair_type_id: '', price: '', notes: '', is_active: true });
    setDialogOpen(true);
  };

  const openEditDialog = (price: LabRepairPrice) => {
    setEditingPrice(price);
    setFormData({
      repair_type_id: price.repair_type_id,
      price: price.price.toString(),
      notes: price.notes || '',
      is_active: price.is_active
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingPrice(null);
    setFormData({ repair_type_id: '', price: '', notes: '', is_active: true });
  };

  const availableTypes = repairTypes.filter(
    type => !labPrices.some(price => price.repair_type_id === type.id)
  );

  if (loading) {
    return <div className="p-6">טוען...</div>;
  }

  if (!lab) {
    return <div className="p-6">מעבדה לא נמצאה</div>;
  }

  return (
    <TooltipProvider>
      <div className="p-6 max-w-6xl mx-auto" dir="rtl">
        <div className="mb-6">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" onClick={() => router.push('/admin/labs')} className="mb-4">
                <ArrowRight className="ml-2 h-4 w-4" />
                חזרה למעבדות
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>חזור לרשימת המעבדות</p>
            </TooltipContent>
          </Tooltip>
          
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">ניהול מחירי תיקונים - {lab.full_name}</h1>
              <p className="text-gray-600 mt-1">{lab.email}</p>
            </div>
            {availableTypes.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={openAddDialog}>
                    <Plus className="ml-2 h-4 w-4" />
                    הוסף מחיר חדש
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>הוסף מחיר חדש עבור סוג תיקון למעבדה זו</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

      <div className="grid gap-4">
        {labPrices.map(price => (
          <Card key={price.id}>
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">{price.repair_types.name}</h3>
                    {!price.is_active && (
                      <span className="text-xs bg-gray-200 px-2 py-1 rounded">לא פעיל</span>
                    )}
                  </div>
                  {price.repair_types.description && (
                    <p className="text-sm text-gray-600 mb-2">{price.repair_types.description}</p>
                  )}
                  <div className="flex items-baseline gap-1">
                    <ShekelIcon className="h-5 w-5 text-blue-600 inline-block" />
                    <p className="text-2xl font-bold text-blue-600">{price.price.toFixed(2)}</p>
                  </div>
                  {price.notes && (
                    <p className="text-sm text-gray-500 mt-2">{price.notes}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(price)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>ערוך מחיר תיקון</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(price.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>מחק מחיר תיקון</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {labPrices.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center text-gray-500">
              <p>עדיין לא הוגדרו מחירי תיקונים למעבדה זו</p>
              <p className="text-sm mt-1">לחץ על "הוסף מחיר חדש" כדי להתחיל</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog למחירים */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingPrice ? 'עריכת מחיר תיקון' : 'הוספת מחיר חדש'}
            </DialogTitle>
            <DialogDescription>
              {editingPrice 
                ? 'ערוך את פרטי המחיר עבור סוג התיקון'
                : 'הוסף מחיר חדש עבור סוג תיקון'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!editingPrice && (
              <div>
                <Label>סוג תיקון</Label>
                <select
                  title="בחר סוג תיקון"
                  className="w-full mt-1 p-2 border rounded-md"
                  value={formData.repair_type_id}
                  onChange={(e) => setFormData({ ...formData, repair_type_id: e.target.value })}
                >
                  <option value="">בחר סוג תיקון</option>
                  {availableTypes.map(type => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {editingPrice && (
              <div>
                <Label>סוג תיקון</Label>
                <Input value={editingPrice.repair_types.name} disabled className="bg-gray-50" />
              </div>
            )}

            <div>
              <Label className="flex items-center gap-1">
                מחיר
                <ShekelIcon className="h-3 w-3 inline-block" />
              </Label>
              <Input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label>הערות</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="הערות נוספות..."
                rows={3}
              />
            </div>

            {editingPrice && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>פעיל</Label>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDialog}>
              ביטול
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!formData.price || (!editingPrice && !formData.repair_type_id)}
            >
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </TooltipProvider>
  );
}
