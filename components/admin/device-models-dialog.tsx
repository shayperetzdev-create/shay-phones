'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DeviceModel } from '@/types';
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
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableSkeleton } from '@/components/admin/table-skeleton';
import { Checkbox } from '../../components/ui/checkbox';

interface DeviceModelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeviceModelsDialog({ open, onOpenChange }: DeviceModelsDialogProps) {
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingModel, setEditingModel] = useState<DeviceModel | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    model_name: '',
    manufacturer: '',
    warranty_months: 12,
    description: '',
    is_active: true,
  });

  const [formErrors, setFormErrors] = useState({
    model_name: '',
    warranty_months: '',
  });

  const supabase = createClient();
  const { toast } = useToast();

  const fetchModels = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('device_models')
        .select('*')
        .order('model_name');

      if (error) throw error;
      setModels(data || []);
    } catch (error) {
      console.error('Error fetching models:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בטעינת הדגמים',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    if (open) {
      fetchModels();
      setSearchQuery('');
      setCurrentPage(1);
      setSelectedIds(new Set());
    }
  }, [open, fetchModels]);

  // Filter and paginate models
  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        model.model_name.toLowerCase().includes(searchLower) ||
        (model.manufacturer?.toLowerCase() || '').includes(searchLower)
      );
    });
  }, [models, searchQuery]);

  const totalPages = Math.ceil(filteredModels.length / itemsPerPage);
  const paginatedModels = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredModels.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredModels, currentPage]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleAddNew = () => {
    setEditingModel(null);
    setFormData({
      model_name: '',
      manufacturer: '',
      warranty_months: 12,
      description: '',
      is_active: true,
    });
    setFormErrors({
      model_name: '',
      warranty_months: '',
    });
    setIsFormOpen(true);
  };

  const validateField = (field: string, value: any) => {
    let error = '';

    if (field === 'model_name') {
      if (!value.trim()) {
        error = 'שם הדגם הוא שדה חובה';
      } else if (value.trim().length < 2) {
        error = 'שם הדגם חייב להכיל לפחות 2 תווים';
      }
    } else if (field === 'warranty_months') {
      if (value < 0) {
        error = 'משך האחריות חייב להיות מספר חיובי';
      } else if (value > 120) {
        error = 'משך האחריות לא יכול לעלות על 120 חודשים';
      }
    }

    setFormErrors((prev) => ({ ...prev, [field]: error }));
    return error === '';
  };

  const handleEdit = (model: DeviceModel) => {
    setEditingModel(model);
    setFormData({
      model_name: model.model_name,
      manufacturer: model.manufacturer || '',
      warranty_months: model.warranty_months,
      description: model.description || '',
      is_active: model.is_active,
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.model_name.trim()) {
      toast({
        title: 'שגיאה',
        description: 'שם הדגם הוא שדה חובה',
        variant: 'destructive',
      });
      return;
    }

    if (formData.warranty_months < 0) {
      toast({
        title: 'שגיאה',
        description: 'משך האחריות חייב להיות מספר חיובי',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);

      const dataToSave = {
        model_name: formData.model_name.trim(),
        manufacturer: formData.manufacturer.trim() || null,
        warranty_months: formData.warranty_months,
        description: formData.description.trim() || null,
        is_active: formData.is_active,
      };

      if (editingModel) {
        const { error } = await supabase
          .from('device_models')
          // @ts-ignore - Supabase type inference issue
          .update(dataToSave)
          .eq('id', editingModel.id);

        if (error) throw error;

        toast({
          title: 'הצלחה',
          description: 'הדגם עודכן בהצלחה',
        });
      } else {
        const { error } = await supabase
          .from('device_models')
          // @ts-ignore - Supabase type inference issue
          .insert([dataToSave]);

        if (error) throw error;

        toast({
          title: 'הצלחה',
          description: 'הדגם נוסף בהצלחה',
        });
      }

      setIsFormOpen(false);
      fetchModels();
    } catch (error: any) {
      console.error('Error saving model:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בשמירת הדגם',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (model: DeviceModel) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את הדגם "${model.model_name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('device_models')
        .delete()
        .eq('id', model.id);

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: 'הדגם נמחק בהצלחה',
      });

      fetchModels();
    } catch (error: any) {
      console.error('Error deleting model:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה במחיקת הדגם',
        variant: 'destructive',
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`האם אתה בטוח שברצונך למחוק ${selectedIds.size} דגמים?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('device_models')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: `${selectedIds.size} דגמים נמחקו בהצלחה`,
      });

      setSelectedIds(new Set());
      fetchModels();
    } catch (error: any) {
      console.error('Error deleting models:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה במחיקת הדגמים',
        variant: 'destructive',
      });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginatedModels.map((m) => m.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-4xl max-h-[80vh] overflow-y-auto"
          aria-describedby="device-models-description"
        >
          <DialogHeader>
            <DialogTitle>ניהול דגמי מכשירים</DialogTitle>
            <DialogDescription id="device-models-description">
              הוסף, ערוך או מחק דגמי מכשירים והגדר את משך האחריות לכל דגם
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search and Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="חיפוש לפי שם דגם או יצרן..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
              <div className="flex gap-2">
                {selectedIds.size > 0 && (
                  <Button
                    variant="destructive"
                    onClick={handleBulkDelete}
                    aria-label={`מחק ${selectedIds.size} דגמים נבחרים`}
                  >
                    <Trash2 className="ml-2 h-4 w-4" />
                    מחק ({selectedIds.size})
                  </Button>
                )}
                <Button onClick={handleAddNew} aria-label="הוסף דגם מכשיר חדש">
                  <Plus className="ml-2 h-4 w-4" aria-hidden="true" />
                  הוסף דגם חדש
                </Button>
              </div>
            </div>

            {isLoading ? (
              <TableSkeleton columns={6} rows={5} />
            ) : filteredModels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  {searchQuery ? (
                    <Search className="h-8 w-8 text-muted-foreground" />
                  ) : (
                    <Plus className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {searchQuery ? 'לא נמצאו תוצאות' : 'אין דגמים במערכת'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery
                    ? 'נסה לשנות את מילות החיפוש'
                    : 'התחל על ידי הוספת דגם מכשיר ראשון'}
                </p>
                {!searchQuery && (
                  <Button onClick={handleAddNew} size="sm">
                    <Plus className="ml-2 h-4 w-4" />
                    הוסף דגם ראשון
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={
                              paginatedModels.length > 0 &&
                              paginatedModels.every((m) => selectedIds.has(m.id))
                            }
                            onCheckedChange={handleSelectAll}
                            aria-label="בחר הכל"
                          />
                        </TableHead>
                        <TableHead className="text-right">שם הדגם</TableHead>
                        <TableHead className="text-right">יצרן</TableHead>
                        <TableHead className="text-right">אחריות (חודשים)</TableHead>
                        <TableHead className="text-right">סטטוס</TableHead>
                        <TableHead className="text-right">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedModels.map((model) => (
                        <TableRow key={model.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(model.id)}
                              onCheckedChange={(checked: boolean) =>
                                handleSelectOne(model.id, checked)
                              }
                              aria-label={`בחר ${model.model_name}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{model.model_name}</TableCell>
                          <TableCell>{model.manufacturer || '-'}</TableCell>
                          <TableCell>{model.warranty_months}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${model.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                                }`}
                            >
                              {model.is_active ? 'פעיל' : 'לא פעיל'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(model)}
                                aria-label={`ערוך דגם ${model.model_name}`}
                              >
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(model)}
                                aria-label={`מחק דגם ${model.model_name}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      מציג {(currentPage - 1) * itemsPerPage + 1}-
                      {Math.min(currentPage * itemsPerPage, filteredModels.length)} מתוך{' '}
                      {filteredModels.length}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(
                            (page) =>
                              page === 1 ||
                              page === totalPages ||
                              Math.abs(page - currentPage) <= 1
                          )
                          .map((page, idx, arr) => (
                            <div key={page} className="flex items-center">
                              {idx > 0 && arr[idx - 1] !== page - 1 && (
                                <span className="px-2">...</span>
                              )}
                              <Button
                                variant={currentPage === page ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setCurrentPage(page)}
                              >
                                {page}
                              </Button>
                            </div>
                          ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent aria-describedby="device-model-form-description">
          <DialogHeader>
            <DialogTitle>
              {editingModel ? 'עריכת דגם' : 'הוספת דגם חדש'}
            </DialogTitle>
            <DialogDescription id="device-model-form-description">
              מלא את הפרטים הבאים כדי {editingModel ? 'לעדכן' : 'להוסיף'} דגם
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="model_name">שם הדגם *</Label>
              <Input
                id="model_name"
                value={formData.model_name}
                onChange={(e) => {
                  setFormData({ ...formData, model_name: e.target.value });
                  validateField('model_name', e.target.value);
                }}
                onBlur={(e) => validateField('model_name', e.target.value)}
                placeholder="לדוגמה: ATLAS 10"
                className={formErrors.model_name ? 'border-red-500' : ''}
              />
              {formErrors.model_name && (
                <p className="text-sm text-red-500">{formErrors.model_name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="manufacturer">יצרן</Label>
              <Input
                id="manufacturer"
                value={formData.manufacturer}
                onChange={(e) =>
                  setFormData({ ...formData, manufacturer: e.target.value })
                }
                placeholder="לדוגמה: ATLAS"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="warranty_months">משך אחריות (חודשים) *</Label>
              <Input
                id="warranty_months"
                type="number"
                min="0"
                max="120"
                value={formData.warranty_months}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  setFormData({
                    ...formData,
                    warranty_months: value,
                  });
                  validateField('warranty_months', value);
                }}
                onBlur={(e) => validateField('warranty_months', parseInt(e.target.value) || 0)}
                className={formErrors.warranty_months ? 'border-red-500' : ''}
              />
              {formErrors.warranty_months && (
                <p className="text-sm text-red-500">{formErrors.warranty_months}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">תיאור</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="תיאור אופציונלי"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">דגם פעיל</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                disabled={isSaving}
              >
                ביטול
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || !!formErrors.model_name || !!formErrors.warranty_months}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    שומר...
                  </>
                ) : (
                  'שמור'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
