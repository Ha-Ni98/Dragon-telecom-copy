import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { passwordResetSchema, type PasswordResetFormValues } from "./PasswordResetForm.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import { toast } from "sonner";
import { Lock, Eye, EyeOff } from "lucide-react";
import { PasswordResetData } from "@/types/draft-types";

interface PasswordResetFormProps {
  onSubmit: (data: PasswordResetData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PasswordResetForm({ onSubmit, onCancel, isLoading = false }: PasswordResetFormProps) {
  const { t } = useTranslation();
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm<PasswordResetFormValues>({
    resolver: zodResolver(passwordResetSchema),
    mode: "onBlur"
  });

  const handleFormSubmit = async (data: PasswordResetFormValues) => {
    try {
      await onSubmit(data);
      reset();
      toast.success(t('account.passwordResetSuccess'));
    } catch (error) {
      toast.error(t('account.passwordResetError'));
    }
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          {t('account.resetPassword')}
        </CardTitle>
        <CardDescription>
          {t('account.resetPasswordSubtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('account.newPassword')}</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                {...register("newPassword")}
                placeholder={t('account.newPasswordPlaceholder')}
                className="pr-10"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowNewPassword(!showNewPassword)}
                disabled={isLoading}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.newPassword && (
              <p className="text-sm text-destructive">{errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('account.confirmPassword')}</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                {...register("confirmPassword")}
                placeholder={t('account.confirmPasswordPlaceholder')}
                className="pr-10"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading || isSubmitting}
              className="flex-1"
            >
              {t('register.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isLoading || isSubmitting}
              className="flex-1"
            >
              {isLoading || isSubmitting ? t('account.resetting') : t('account.resetPassword')}
            </Button>
          </div>
        </form>

        {/* Password Requirements */}
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <h4 className="text-sm font-medium mb-2">{t('account.passwordRequirements.title')}</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• {t('account.passwordRequirements.minLength')}</li>
            <li>• {t('account.passwordRequirements.mixedCase')}</li>
            <li>• {t('account.passwordRequirements.number')}</li>
            <li>• {t('account.passwordRequirements.specialChar')}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
