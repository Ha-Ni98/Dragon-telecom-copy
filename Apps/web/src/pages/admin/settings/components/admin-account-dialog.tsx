/**
 * Admin Account Dialog Component
 * Reusable dialog for adding/editing admin accounts
 */

import React from 'react';
import { Save, X, User, Lock, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/hooks/useTranslation';
import { AdminAccountWithDetails } from '@/types/draft-types';
import { UserRoleCode } from '@/types/draft-types/enums.types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { adminAccountSchema, type AdminAccountFormData } from './admin-account-dialog.schema';

interface AdminAccountDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when admin account is saved */
  onSave: (data: AdminAccountFormData) => void;
  /** Admin account data for edit mode */
  admin?: AdminAccountWithDetails;
  /** Whether a save operation is in progress */
  isSaving: boolean;
}

/**
 * Admin Account Dialog Component
 * Handles both add and edit modes for admin accounts
 */
export function AdminAccountDialog({
  isOpen,
  onClose,
  onSave,
  admin,
  isSaving,
}: AdminAccountDialogProps) {
  const { t } = useTranslation();
  const isEditMode = !!admin;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid, isDirty },
  } = useForm<AdminAccountFormData>({
    resolver: zodResolver(adminAccountSchema),
    mode: 'onChange',
    defaultValues: {
      userName: admin?.userName || '',
      password: '',
      confirmPassword: '',
      userRole: UserRoleCode.admin,
    },
  });

  /**
   * Handle form submission
   */
  const onSubmit = (data: AdminAccountFormData) => {
    onSave(data);
  };

  /**
   * Handle dialog close with reset
   */
  const handleClose = () => {
    reset();
    onClose();
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /**
   * Get role label
   */
  const getRoleLabel = (role: UserRoleCode) => {
    switch (role) {
      case UserRoleCode.admin:
        return 'Administrator';
      default:
        return 'Unknown';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {isEditMode ? 'Edit Admin Account' : 'Add New Admin Account'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Update the admin account information below.'
              : 'Create a new admin account with the required information.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Admin Information Card (Edit Mode) */}
          {isEditMode && admin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Current Account Information
                </CardTitle>
                <CardDescription>
                  {t('admin.settings.accounts.viewCurrentDetails')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">{t('admin.settings.accounts.userId')}</Label>
                    <p className="text-sm">{admin.idUser}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">{t('admin.settings.accounts.role')}</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">{getRoleLabel(admin.userRole)}</Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">{t('common.labels.createdDate')}</Label>
                    <p className="text-sm">{formatDate(admin.createdDate)}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">{t('admin.settings.accounts.canBeDeleted')}</Label>
                    <Badge variant={admin.canBeDeleted ? "secondary" : "destructive"}>
                      {admin.canBeDeleted ? t('common.yes') : t('common.no')}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {t('admin.settings.accounts.accountDetails')}
                </CardTitle>
                <CardDescription>
                  {isEditMode
                    ? t('admin.settings.accounts.updateBelow')
                    : t('admin.settings.accounts.enterBelow')
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Username Field */}
                <div className="space-y-2">
                  <Label htmlFor="userName">{t('admin.settings.accounts.username')} *</Label>
                  <Controller
                    name="userName"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        id="userName"
                        placeholder={t('admin.settings.accounts.usernamePlaceholder')}
                        className={errors.userName ? 'border-destructive' : ''}
                        disabled={isSaving}
                      />
                    )}
                  />
                  {errors.userName && (
                    <p className="text-sm text-destructive">{errors.userName.message}</p>
                  )}
                </div>

                {/* Password Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      {isEditMode ? t('admin.settings.accounts.newPassword') : t('auth.login.password')} *
                    </Label>
                    <Controller
                      name="password"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="password"
                          type="password"
                          placeholder={isEditMode ? t('admin.settings.accounts.newPasswordPlaceholder') : t('admin.settings.accounts.passwordPlaceholder')}
                          className={errors.password ? 'border-destructive' : ''}
                          disabled={isSaving}
                        />
                      )}
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password.message}</p>
                    )}
                    {isEditMode && (
                      <p className="text-xs text-muted-foreground">
                        {t('admin.settings.accounts.leaveBlankPassword')}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      {t('admin.settings.accounts.confirmPassword')} *
                    </Label>
                    <Controller
                      name="confirmPassword"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          id="confirmPassword"
                          type="password"
                          placeholder={t('admin.settings.accounts.confirmPasswordPlaceholder')}
                          className={errors.confirmPassword ? 'border-destructive' : ''}
                          disabled={isSaving}
                        />
                      )}
                    />
                    {errors.confirmPassword && (
                      <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                    )}
                  </div>
                </div>

                {/* Role Field */}
                <div className="space-y-2">
                  <Label htmlFor="userRole" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {t('admin.settings.accounts.role')} *
                  </Label>
                  <Controller
                    name="userRole"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value.toString()}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        disabled={isSaving}
                      >
                        <SelectTrigger className={errors.userRole ? 'border-destructive' : ''}>
                          <SelectValue placeholder={t('admin.settings.accounts.selectRole')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UserRoleCode.admin.toString()}>
                            {t('admin.settings.accounts.administrator')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.userRole && (
                    <p className="text-sm text-destructive">{errors.userRole.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex justify-end gap-3">
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
                disabled={!isValid || isSaving || (!isDirty && isEditMode)}
              >
                {isSaving ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-foreground" />
                    {isEditMode ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {isEditMode ? 'Update Account' : 'Create Account'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
