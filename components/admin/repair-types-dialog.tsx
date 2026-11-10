'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RepairType } from '@/types';
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
import { Plus, Pencil, Trash2, Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
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

interface RepairTypesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RepairTypesDialog({ open, onOpenChange }: RepairTypesDialogProps) {
  const [repairTypes, setRepairTypes] = useState<RepairType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingType, setEditingType] = useState<RepairType | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
  });

  const [formErrors, setFormErrors] = useState({
    name: '',
  });

  const supabase = createClient();
  const { toast } = useToast();

  const fetchRepairTypes = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('repair_types')
        .select('*')
        .order('name');

      if (error) throw error;
      setRepairTypes(data || []);
    } catch (error) {
      console.error('Error fetching repair types:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בטעינת סוגי התיקונים',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    if (open) {
      fetchRepairTypes();
      setSearchQuery('');
      setCurrentPage(1);
      setSelectedIds(new Set());
    }
  }, [open, fetchRepairTypes]);

  // Filter and paginate repair types
  const filteredTypes = useMemo(() => {
    return repairTypes.filter((type) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        type.name.toLowerCase().includes(searchLower) ||
        (type.description?.toLowerCase() || '').includes(searchLower)
      );
    });
  }, [repairTypes, searchQuery]);

  const totalPages = Math.ceil(filteredTypes.length / itemsPerPage);
  const paginatedTypes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTypes.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTypes, currentPage]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleAddNew = () => {
    setEditingType(null);
    setFormData({
      name: '',
      description: '',
      is_active: true,
    });
    setFormErrors({
      name: '',
    });
    setIsFormOpen(true);
  };

  const validateField = (field: string, value: any) => {
    let error = '';
    
    if (field === 'name') {
      if (!value.trim()) {
        error = 'שם סוג התיקון הוא שדה חובה';
      } else if (value.trim().length < 2) {
        error = 'שם סוג התיקון חייב להכיל לפחות 2 תווים';
      } else {
        // Check for duplicate name
        const duplicate = repairTypes.find(
          (type) =>
            type.name.toLowerCase() === value.trim().toLowerCase() &&
            type.id !== editingType?.id
        );
        if (duplicate) {
          error = 'סוג תיקון עם שם זה כבר קיים במערכת';
        }
      }
    }
    
    setFormErrors((prev) => ({ ...prev, [field]: error }));
    return error === '';
  };

  const handleEdit = (repairType: RepairType) => {
    setEditingType(repairType);
    setFormData({
      name: repairType.name,
      description: repairType.description || '',
      is_active: repairType.is_active,
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    const trimmedName = formData.name.trim();

    if (!trimmedName) {
      toast({
        title: 'שגיאה',
        description: 'שם סוג התיקון הוא שדה חובה',
        variant: 'destructive',
      });
      return;
    }

    if (trimmedName.length < 2) {
      toast({
        title: 'שגיאה',
        description: 'שם סוג התיקון חייב להכיל לפחות 2 תווים',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicate name (excluding current item if editing)
    const duplicateName = repairTypes.find(
      (type) =>
        type.name.toLowerCase() === trimmedName.toLowerCase() &&
        type.id !== editingType?.id
    );

    if (duplicateName) {
      toast({
        title: 'שגיאה',
        description: 'סוג תיקון עם שם זה כבר קיים במערכת',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);

      const dataToSave = {
        name: trimmedName,
        description: formData.description.trim() || null,
        is_active: formData.is_active,
      };

      if (editingType) {
        const { error } = await supabase
          .from('repair_types')
          // @ts-ignore - Supabase type inference issue
          .update(dataToSave)
          .eq('id', editingType.id);

        if (error) throw error;

        toast({
          title: 'הצלחה',
          description: 'סוג התיקון עודכן בהצלחה',
        });
      } else {
        const { error } = await supabase
          .from('repair_types')
          // @ts-ignore - Supabase type inference issue
          .insert([dataToSave]);

        if (error) throw error;

        toast({
          title: 'הצלחה',
          description: 'סוג התיקון נוסף בהצלחה',
        });
      }

      setIsFormOpen(false);
      fetchRepairTypes();
    } catch (error: any) {
      console.error('Error saving repair type:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה בשמירת סוג התיקון',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (repairType: RepairType) => {
    // Check if there are any repairs using this type
    try {
      const { count, error: countError } = await supabase
        .from('repairs')
        .select('id', { count: 'exact', head: true })
        .eq('repair_type_id', repairType.id);

      if (countError) throw countError;

      if (count && count > 0) {
        toast({
          title: 'לא ניתן למחוק',
          description: `סוג תיקון זה משויך ל-${count} תיקונים פעילים. לא ניתן למחוק אותו.`,
          variant: 'destructive',
        });
        return;
      }
    } catch (error) {
      console.error('Error checking dependencies:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בבדיקת תלויות',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm(`האם אתה בטוח שברצונך למחוק את סוג התיקון "${repairType.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('repair_types')
        .delete()
        .eq('id', repairType.id);

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: 'סוג התיקון נמחק בהצלחה',
      });

      fetchRepairTypes();
    } catch (error: any) {
      console.error('Error deleting repair type:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה במחיקת סוג התיקון',
        variant: 'destructive',
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    // Check dependencies for all selected items
    try {
      for (const id of selectedIds) {
        const type = repairTypes.find((t) => t.id === id);
        if (!type) continue;

        const { count } = await supabase
          .from('repairs')
          .select('id', { count: 'exact', head: true })
          .eq('repair_type_id', type.id);

        if (count && count > 0) {
          toast({
            title: 'לא ניתן למחוק',
            description: `סוג התיקון "${type.name}" משויך ל-${count} תיקונים. הסר אותו מהבחירה.`,
            variant: 'destructive',
          });
          return;
        }
      }
    } catch (error) {
      console.error('Error checking dependencies:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בבדיקת תלויות',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm(`האם אתה בטוח שברצונך למחוק ${selectedIds.size} סוגי תיקונים?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('repair_types')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast({
        title: 'הצלחה',
        description: `${selectedIds.size} סוגי תיקונים נמחקו בהצלחה`,
      });

      setSelectedIds(new Set());
      fetchRepairTypes();
    } catch (error: any) {
      console.error('Error deleting repair types:', error);
      toast({
        title: 'שגיאה',
        description: error.message || 'אירעה שגיאה במחיקת סוגי התיקונים',
        variant: 'destructive',
      });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginatedTypes.map((t) => t.id)));
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
          aria-describedby="repair-types-description"
        >
          <DialogHeader>
            <DialogTitle>ניהול סוגי תיקונים</DialogTitle>
            <DialogDescription id="repair-types-description">
              הוסף, ערוך או מחק סוגי תיקונים במערכת
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search and Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="חיפוש לפי שם או תיאור..."
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
                    aria-label={`מחק ${selectedIds.size} סוגי תיקונים נבחרים`}
                  >
                    <Trash2 className="ml-2 h-4 w-4" />
                    מחק ({selectedIds.size})
                  </Button>
                )}
                <Button onClick={handleAddNew} aria-label="הוסף סוג תיקון חדש">
                  <Plus className="ml-2 h-4 w-4" aria-hidden="true" />
                  הוסף סוג תיקון
                </Button>
              </div>
            </div>

            {isLoading ? (
              <TableSkeleton columns={5} rows={5} />
            ) : filteredTypes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  {searchQuery ? (
                    <Search className="h-8 w-8 text-muted-foreground" />
                  ) : (
                    <Plus className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {searchQuery ? 'לא נמצאו תוצאות' : 'אין סוגי תיקונים במערכת'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery
                    ? 'נסה לשנות את מילות החיפוש'
                    : 'התחל על ידי הוספת סוג תיקון ראשון'}
                </p>
                {!searchQuery && (
                  <Button onClick={handleAddNew} size="sm">
                    <Plus className="ml-2 h-4 w-4" />
                    הוסף סוג תיקון ראשון
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
                              paginatedTypes.length > 0 &&
                              paginatedTypes.every((t) => selectedIds.has(t.id))
                            }
                            onCheckedChange={handleSelectAll}
                            aria-label="בחר הכל"
                          />
                        </TableHead>
                        <TableHead className="text-right">שם</TableHead>
                        <TableHead className="text-right">תיאור</TableHead>
                        <TableHead className="text-right">סטטוס</TableHead>
                        <TableHead className="text-right">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTypes.map((type) => (
                        <TableRow key={type.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(type.id)}
                              onCheckedChange={(checked: boolean) =>
                                handleSelectOne(type.id, checked)
                              }
                              aria-label={`בחר ${type.name}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{type.name}</TableCell>
                          <TableCell>{type.description || '-'}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                type.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {type.is_active ? 'פעיל' : 'לא פעיל'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(type)}
                                aria-label={`ערוך סוג תיקון ${type.name}`}
                              >
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(type)}
                                aria-label={`מחק סוג תיקון ${type.name}`}
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
                      {Math.min(currentPage * itemsPerPage, filteredTypes.length)} מתוך{' '}
                      {filteredTypes.length}
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
        <DialogContent aria-describedby="repair-type-form-description">
          <DialogHeader>
            <DialogTitle>
              {editingType ? 'עריכת סוג תיקון' : 'הוספת סוג תיקון חדש'}
            </DialogTitle>
            <DialogDescription id="repair-type-form-description">
              מלא את הפרטים הבאים כדי {editingType ? 'לעדכן' : 'להוסיף'} סוג תיקון
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">שם סוג התיקון *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  validateField('name', e.target.value);
                }}
                onBlur={(e) => validateField('name', e.target.value)}
                placeholder="לדוגמה: החלפת מסך"
                className={formErrors.name ? 'border-red-500' : ''}
              />
              {formErrors.name ? (
                <p className="text-sm text-red-500">{formErrors.name}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  השם חייב להיות ייחודי ולפחות 2 תווים
                </p>
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
              <Label htmlFor="is_active">תיקון פעיל / מושבת</Label>
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
                disabled={isSaving || !!formErrors.name}
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
