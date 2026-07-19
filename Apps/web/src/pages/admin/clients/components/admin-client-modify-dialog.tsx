/**
 * Admin Client Modification Dialog Component
 * Provides a dialog for modifying client information with conditional form logic
 */

import React, { memo, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { clientModificationSchema, type ClientModificationFormData } from './admin-client-modify-dialog.schema';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  User, 
  Save, 
  X, 
  AlertTriangle, 
  CreditCard, 
  Key, 
  UserCheck,
  Clock,
  UserX,
  AlertCircle
} from 'lucide-react';
import { AdminClientWithDetails, ClientModificationData, ClientStatusCode } from '@/types/draft-types/client.types';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Props for AdminClientModifyDialog component
 */
interface AdminClientModifyDialogProps {
  /** Client data to modify */
  client: AdminClientWithDetails;
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog closes */
  onClose: () => void;
  /** Callback when save is successful */
  onSave: (updates: ClientModificationData) => Promise<void>;
  /** Whether a save operation is in progress */
  isSaving: boolean;
}

/**
 * Status options for the dropdown
 */
const STATUS_OPTIONS = [
  { value: ClientStatusCode.active, label: 'Active', icon: UserCheck, description: 'Client can place orders' },
  { value: ClientStatusCode.pending, label: 'Pending', icon: Clock, description: 'Awaiting approval' },
  { value: ClientStatusCode.disabled, label: 'Disabled', icon: UserX, description: 'Account disabled' },
  { value: ClientStatusCode.refused, label: 'Refused', icon: AlertCircle, description: 'Application refused' },
];

/**
 * Category options for the dropdown
 */
const CATEGORY_OPTIONS = [
  { value: 1, label: 'Individual', description: 'Individual customer' },
  { value: 2, label: 'Business', description: 'Business customer' },
  { value: 3, label: 'Wholesale', description: 'Wholesale customer' },
  { value: 4, label: 'VIP', description: 'VIP customer' },
];

/**
 * Main AdminClientModifyDialog component
 */
export const AdminClientModifyDialog = memo(function AdminClientModifyDialog({
  client,
  isOpen,
  onClose,
  onSave,
  isSaving,
}: AdminClientModifyDialogProps) {
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid, isDirty },
  } = useForm<ClientModificationFormData>({
    resolver: zodResolver(clientModificationSchema),
    mode: 'onChange',
    defaultValues: {
      status: client.clientStatus,
      credit: client.clientCredit,
      username: client.clientUserName,
      password: '',
      confirmPassword: '',
      categoryId: client.idCategory,
    },
  });

  // Watch the status field to determine if username/password are required
  const watchedStatus = watch('status');
  const isActiveStatus = watchedStatus === ClientStatusCode.active;
  const hasExistingPassword = client.clientPassword && client.clientPassword !== '';

  /**
   * Handle form submission
   */
  const onSubmit = async (data: ClientModificationFormData) => {
    try {
      const updates: ClientModificationData = {
        status: data.status,
        credit: data.credit,
        username: isActiveStatus ? data.username : undefined,
        password: data.password || undefined,
        confirmPassword: data.confirmPassword || undefined,
        categoryId: isActiveStatus ? data.categoryId : undefined,
      };

      await onSave(updates);
      reset();
      onClose();
    } catch (error) {
      console.error('Error saving client modifications:', error);
    }
  };

  /**
   * Handle dialog close with reset
   */
  const handleClose = () => {
    reset();
    onClose();
  };

  /**
   * Reset form when dialog opens
   */
  useEffect(() => {
    if (isOpen) {
      reset({
        status: client.clientStatus,
        credit: client.clientCredit,
        username: client.clientUserName,
        password: '',
        confirmPassword: '',
      });
    }
  }, [isOpen, client, reset]);

  /**
   * Format currency for display
   */
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('admin.clients.modifyDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('admin.clients.modifyDialog.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Client Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('admin.clients.modifyDialog.clientDetails')}</CardTitle>
              <CardDescription>{t('admin.clients.modifyDialog.currentInfo')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">{t('admin.clients.modifyDialog.clientName')}</Label>
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3" />
                    <span className="text-sm font-medium">{client.fullName}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">{t('admin.clients.modifyDialog.currentStatus')}</Label>
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-3 w-3" />
                    <span className="text-sm">{client.displayStatus}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">{t('common.labels.phone')}</Label>
                  <span className="text-sm">{client.clientPhoneNumber}</span>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">{t('common.labels.email')}</Label>
                  <span className="text-sm">{client.clientEmail || t('common.labels.notProvided')}</span>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">{t('admin.clients.modifyDialog.totalSpent')}</Label>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-3 w-3" />
                    <span className="text-sm font-semibold">{formatCurrency(client.totalSpent)}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">{t('admin.clients.modifyDialog.totalOrders')}</Label>
                  <span className="text-sm font-semibold">{client.totalOrders}</span>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">{t('admin.clients.modifyDialog.currentCategory')}</Label>
                  <span className="text-sm">{CATEGORY_OPTIONS.find(cat => cat.value === client.idCategory)?.label || t('common.labels.notAssigned')}</span>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground">{t('common.labels.createdDate')}</Label>
                  <span className="text-sm">{new Date(client.clientCreatedDate).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Modification Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Status and Credit Fields - Inline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status Field */}
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value.toString()} onValueChange={(value) => field.onChange(parseInt(value))}>
                      <SelectTrigger id="status">
                        <SelectValue placeholder={t('admin.clients.modifyDialog.selectStatus')} />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => {
                          const Icon = option.icon;
                          return (
                            <SelectItem key={option.value} value={option.value.toString()}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                <div>
                                  <div className="font-medium">{option.label}</div>
                                  <div className="text-sm text-muted-foreground">{option.description}</div>
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.status && (
                  <p className="text-sm text-destructive">{errors.status.message}</p>
                )}
              </div>

              {/* Credit Field */}
              <div className="space-y-2">
                <Label htmlFor="credit">Credit Amount *</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Controller
                    name="credit"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="credit"
                        type="number"
                        placeholder="0.00"
                        className="pl-10"
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    )}
                  />
                </div>
                {errors.credit && (
                  <p className="text-sm text-destructive">{errors.credit.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Current: {formatCurrency(client.clientCredit)}
                </p>
              </div>
            </div>

            {/* Category Field - Required when status is Active */}
            {isActiveStatus && (
              <div className="space-y-2">
                <Label htmlFor="categoryId">Category *</Label>
                <Controller
                  name="categoryId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value?.toString() || ''} onValueChange={(value) => field.onChange(parseInt(value))}>
                      <SelectTrigger id="categoryId">
                        <SelectValue placeholder={t('admin.clients.modifyDialog.selectCategory')} />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value.toString()}>
                            <div className="flex items-center gap-2">
                              <div>
                                <div className="font-medium">{option.label}</div>
                                <div className="text-sm text-muted-foreground">{option.description}</div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.categoryId && (
                  <p className="text-sm text-destructive">{errors.categoryId.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Current: {CATEGORY_OPTIONS.find(cat => cat.value === client.idCategory)?.label || 'Not assigned'}
                </p>
              </div>
            )}

            {/* Username Field - Required when status is Active */}
            {isActiveStatus && (
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Controller
                  name="username"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="username"
                      placeholder={t('admin.settings.accounts.usernamePlaceholder')}
                    />
                  )}
                />
                {errors.username && (
                  <p className="text-sm text-destructive">{errors.username.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Required for active clients
                </p>
              </div>
            )}

            {/* Password Fields - Required when activating client without existing password */}
            {isActiveStatus && !hasExistingPassword && (
              <div className="space-y-3">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    This client doesn't have a password. You must set a password to activate the account.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Controller
                      name="password"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="password"
                          type="password"
                          placeholder={t('admin.settings.accounts.passwordPlaceholder')}
                        />
                      )}
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t('admin.settings.accounts.confirmPassword')} *</Label>
                    <Controller
                      name="confirmPassword"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="confirmPassword"
                          type="password"
                          placeholder={t('admin.settings.accounts.confirmPasswordPlaceholder')}
                        />
                      )}
                    />
                    {errors.confirmPassword && (
                      <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Optional Password Fields - When client has existing password */}
            {isActiveStatus && hasExistingPassword && (
              <div className="space-y-3">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    This client already has a password. Leave password fields empty to keep the current password.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">New Password (Optional)</Label>
                    <Controller
                      name="password"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="password"
                          type="password"
                          placeholder="Enter new password (optional)"
                        />
                      )}
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t('admin.clients.modifyDialog.confirmNewPassword')}</Label>
                    <Controller
                      name="confirmPassword"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="confirmPassword"
                          type="password"
                          placeholder={t('account.confirmPasswordPlaceholder')}
                        />
                      )}
                    />
                    {errors.confirmPassword && (
                      <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isValid || isSaving}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
});
