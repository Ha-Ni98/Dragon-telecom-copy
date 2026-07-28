import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AlertTriangle, KeyRound } from "lucide-react";
import {
  changeUserPasswordSchema,
  type ChangeUserPasswordFormValues,
} from "@/pages/admin/users/components/change-user-password.schema";
import { useTranslation } from "@/hooks/useTranslation";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username?: string;
  onSave: (values: ChangeUserPasswordFormValues) => void;
  isSaving?: boolean;
}

// S17 — mirrors pages/admin/clients/components/reset-password-dialog.tsx (warning banner, the
// change signs the user out everywhere via `shouldRevokeTokens`). Dumb (owns only local form
// state); AdminUsers.tsx wires it to the existing useUpdateUser mutation — no new backend
// surface, UpdateUserCommand.password already exists.
export function ChangePasswordDialog({
  open,
  onOpenChange,
  username,
  onSave,
  isSaving = false,
}: ChangePasswordDialogProps) {
  const { t } = useTranslation();
  const form = useForm<ChangeUserPasswordFormValues>({
    resolver: zodResolver(changeUserPasswordSchema(t)),
    defaultValues: { password: "", confirmPassword: "" },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {username
              ? `${t("admin.users.changePassword.title")} ${username}`
              : t("admin.users.changePassword.title")}
          </DialogTitle>
        </DialogHeader>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{t("admin.users.changePassword.warning")}</AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.users.changePassword.newPassword")}</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} disabled={isSaving} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.users.changePassword.confirmPassword")}</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} disabled={isSaving} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
