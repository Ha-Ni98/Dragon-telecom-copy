import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

  // Password validation schema
  const schema = z.object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters"),
      //.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      //.regex(/[a-z]/, "Password must contain at least one lowercase letter")
      //.regex(/[0-9]/, "Password must contain at least one number")
     // .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    confirmPassword: z.string()
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur"
  });

  const handleFormSubmit = async (data: FormValues) => {
    try {
      await onSubmit(data);
      reset();
      toast.success(t('account.passwordResetSuccess'));
    } catch (error) {
      toast.error("Password reset failed. Please try again.");
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
          Enter a new password for your account. Make sure it's secure and memorable.
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
                placeholder="Enter new password"
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
                placeholder="Confirm new password"
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
              {isLoading || isSubmitting ? "Resetting..." : t('account.resetPassword')}
            </Button>
          </div>
        </form>

        {/* Password Requirements */}
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <h4 className="text-sm font-medium mb-2">Password Requirements:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• At least 8 characters long</li>
            <li>• Contains uppercase and lowercase letters</li>
            <li>• Contains at least one number</li>
            <li>• Contains at least one special character</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
