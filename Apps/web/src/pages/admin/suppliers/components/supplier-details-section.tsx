import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from '@/hooks/useTranslation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { 
  Edit3, 
  Save, 
  X, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { SupplierWithDetails, SupplierFormData } from '@/types/draft-types';

// Validation schema for supplier form
const supplierFormSchema = z.object({
  supplierName: z.string().min(1, 'Supplier name is required'),
  supplierPersonName: z.string().min(1, 'Contact person name is required'),
  supplierPhone: z.string().min(1, 'Phone number is required'),
  supplierEmail: z.string().email('Invalid email address'),
  supplierLocation: z.string().min(1, 'Location is required'),
  supplierCredit: z.number().min(0, 'Credit must be non-negative'),
});

type SupplierFormValues = z.infer<typeof supplierFormSchema>;

interface SupplierDetailsSectionProps {
  supplier: SupplierWithDetails;
  isEditMode: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  onEditModeToggle: () => void;
  onSave: (data: SupplierFormData) => Promise<void>;
  onCancel: () => void;
}

/**
 * Supplier Details Section Component
 * Displays and allows editing of supplier information
 */
export function SupplierDetailsSection({
  supplier,
  isEditMode,
  isSaving,
  hasUnsavedChanges,
  onEditModeToggle,
  onSave,
  onCancel,
}: SupplierDetailsSectionProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  // Form setup
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      supplierName: supplier.supplierName,
      supplierPersonName: supplier.supplierPersonName,
      supplierPhone: supplier.supplierPhone,
      supplierEmail: supplier.supplierEmail,
      supplierLocation: supplier.supplierLocation,
      supplierCredit: supplier.supplierCredit,
    },
  });

  // Update form values when supplier data changes
  useEffect(() => {
    form.reset({
      supplierName: supplier.supplierName,
      supplierPersonName: supplier.supplierPersonName,
      supplierPhone: supplier.supplierPhone,
      supplierEmail: supplier.supplierEmail,
      supplierLocation: supplier.supplierLocation,
      supplierCredit: supplier.supplierCredit,
    });
  }, [supplier, form]);

  // Watch for form changes
  const watchedValues = form.watch();
  const [hasFormChanges, setHasFormChanges] = useState(false);

  useEffect(() => {
    const hasChanges = JSON.stringify(watchedValues) !== JSON.stringify({
      supplierName: supplier.supplierName,
      supplierPersonName: supplier.supplierPersonName,
      supplierPhone: supplier.supplierPhone,
      supplierEmail: supplier.supplierEmail,
      supplierLocation: supplier.supplierLocation,
      supplierCredit: supplier.supplierCredit,
    });
    setHasFormChanges(hasChanges);
  }, [watchedValues, supplier]);

  // Handle form submission
  const onSubmit = async (data: SupplierFormValues) => {
    try {
      await onSave(data);
      toast({
        title: t('common.success'),
        description: t('admin.suppliers.updateSuccess'),
        variant: 'default',
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('admin.suppliers.updateError'),
        variant: 'destructive',
      });
    }
  };

  // Handle cancel
  const handleCancel = () => {
    form.reset();
    onCancel();
  };

  return (
    <Card role="region" aria-labelledby="supplier-details-title">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle id="supplier-details-title" className="flex items-center gap-2">
              <User className="h-5 w-5" aria-hidden="true" />
              {t('admin.suppliers.details')}
            </CardTitle>
            <CardDescription>
              {t('admin.suppliers.detailsDescription')}
            </CardDescription>
          </div>
          {!isEditMode && (
            <Button
              onClick={onEditModeToggle}
              variant="outline"
              size="sm"
              className="gap-2"
              aria-label={t('admin.suppliers.editDetailsAria')}
            >
              <Edit3 className="h-4 w-4" aria-hidden="true" />
              {t('common.edit')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" role="form" aria-label={t("admin.suppliers.detailsFormAria")}>
            {/* Supplier Name */}
            <FormField
              control={form.control}
              name="supplierName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2" htmlFor="supplier-name-input">
                    <User className="h-4 w-4" aria-hidden="true" />
                    {t('admin.suppliers.supplierName')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      id="supplier-name-input"
                      disabled={!isEditMode}
                      placeholder={t('admin.suppliers.supplierNamePlaceholder')}
                      className={isEditMode ? 'bg-background' : 'bg-muted'}
                      aria-describedby="supplier-name-error"
                    />
                  </FormControl>
                  <FormMessage id="supplier-name-error" />
                </FormItem>
              )}
            />

            {/* Contact Person */}
            <FormField
              control={form.control}
              name="supplierPersonName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {t('admin.suppliers.contactPerson')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={!isEditMode}
                      placeholder={t('admin.suppliers.contactPersonPlaceholder')}
                      className={isEditMode ? 'bg-background' : 'bg-muted'}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Phone */}
              <FormField
                control={form.control}
                name="supplierPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {t('admin.suppliers.phone')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={!isEditMode}
                        placeholder={t('admin.suppliers.phonePlaceholder')}
                        className={isEditMode ? 'bg-background' : 'bg-muted'}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email */}
              <FormField
                control={form.control}
                name="supplierEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {t('admin.suppliers.email')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        disabled={!isEditMode}
                        placeholder={t('admin.suppliers.emailPlaceholder')}
                        className={isEditMode ? 'bg-background' : 'bg-muted'}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Location */}
            <FormField
              control={form.control}
              name="supplierLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {t('admin.suppliers.location')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={!isEditMode}
                      placeholder={t('admin.suppliers.locationPlaceholder')}
                      className={isEditMode ? 'bg-background' : 'bg-muted'}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Credit */}
            <FormField
              control={form.control}
              name="supplierCredit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    {t('admin.suppliers.credit')}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      step="0.01"
                      disabled={!isEditMode}
                      placeholder={t('admin.suppliers.creditPlaceholder')}
                      className={isEditMode ? 'bg-background' : 'bg-muted'}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Edit Mode Actions */}
            {isEditMode && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {hasFormChanges ? (
                      <>
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span>{t('common.unsavedChanges')}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>{t('common.noChanges')}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                      disabled={isSaving}
                    >
                      <X className="h-4 w-4 mr-2" />
                      {t('common.cancel')}
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSaving || !hasFormChanges}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {isSaving ? t('common.saving') : t('common.save')}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Form Errors */}
            {form.formState.errors && Object.keys(form.formState.errors).length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {t('admin.suppliers.formErrors')}
                </AlertDescription>
              </Alert>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
