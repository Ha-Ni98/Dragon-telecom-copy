import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  updateClientSchema,
  type UpdateClientFormValues,
} from "@/pages/admin/clients/components/admin-client-modify-dialog.schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ClientStatusBadge } from "@/components/shared/StatusBadge";
import { User, Save, X } from "lucide-react";
import type { AdminClientDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface AdminClientModifyDialogProps {
  client: AdminClientDto;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: UpdateClientFormValues) => Promise<void>;
  isSaving: boolean;
}

// ADM-12 — retyped onto AdminUpdateClientCommand via the Sprint-3 `admin-client-modify-dialog.
// schema.ts` wrapper. Contact-info + enable/disable only (status/username/password/category
// belong to the separate approval-dialog, Sprint 7).
export const AdminClientModifyDialog = ({
  client,
  isOpen,
  onClose,
  onSave,
  isSaving,
}: AdminClientModifyDialogProps) => {
  const { t } = useTranslation();
  const form = useForm<UpdateClientFormValues>({
    resolver: zodResolver(updateClientSchema(t)),
    values: {
      email: client.email ?? "",
      storeName: client.storeName ?? "",
      address: "",
      isEnabled: client.isEnabled,
    },
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const onSubmit = async (data: UpdateClientFormValues) => {
    await onSave(data);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t("admin.clients.modifyDialog.title")}
          </DialogTitle>
          <DialogDescription>{t("admin.clients.modifyDialog.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <div className="font-medium">{client.fullName}</div>
            <div className="text-sm text-muted-foreground">{client.phone}</div>
          </div>
          <ClientStatusBadge status={client.status} />
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("common.labels.email")}</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" disabled={isSaving} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="storeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.clients.modifyDialog.storeName")}</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSaving} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.clients.modifyDialog.address")}</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSaving} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel>{t("common.status.enabled")}</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSaving}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
                <X className="mr-2 h-4 w-4" />
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminClientModifyDialog;
