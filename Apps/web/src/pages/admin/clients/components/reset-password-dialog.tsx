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
  resetClientPasswordSchema,
  type ResetClientPasswordFormValues,
} from "@/pages/admin/clients/components/reset-client-password.schema";
import { useTranslation } from "@/hooks/useTranslation";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: ResetClientPasswordFormValues) => void;
  isSaving?: boolean;
}

// ADM-12b — no invalidation, warning banner (the reset kills every active session). Dumb (owns
// only local form state); Sprint 7 wires `useResetClientPassword`.
export function ResetPasswordDialog({
  open,
  onOpenChange,
  onSave,
  isSaving = false,
}: ResetPasswordDialogProps) {
  const { t } = useTranslation();
  const form = useForm<ResetClientPasswordFormValues>({
    resolver: zodResolver(resetClientPasswordSchema(t)),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {t("admin.clients.resetPassword.title")}
          </DialogTitle>
        </DialogHeader>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{t("admin.clients.resetPassword.warning")}</AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.clients.resetPassword.newPassword")}</FormLabel>
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
                  <FormLabel>{t("admin.clients.resetPassword.confirmPassword")}</FormLabel>
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
