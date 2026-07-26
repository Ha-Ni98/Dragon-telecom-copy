import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  FormDescription,
} from "@/components/ui/form";
import { AutocompleteInput, type AutocompleteOption } from "@/components/shared/autocomplete-input";
import {
  updatePosClientSchema,
  type UpdatePosClientFormValues,
} from "@/pages/admin/pos-clients/components/pos-client.schema";
import type { PosClientDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface EditPosClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: PosClientDto | null;
  categoryOptions: AutocompleteOption[];
  onSave: (values: UpdatePosClientFormValues) => void;
  isSaving?: boolean;
}

// ADM-11 — dumb (owns only local form state); Sprint 5 wires `useUpdatePosClient`.
export function EditPosClientDialog({
  open,
  onOpenChange,
  client,
  categoryOptions,
  onSave,
  isSaving = false,
}: EditPosClientDialogProps) {
  const { t } = useTranslation();
  const form = useForm<UpdatePosClientFormValues>({
    resolver: zodResolver(updatePosClientSchema(t)),
    values: {
      name: client?.name ?? "",
      phone: client?.phone ?? "",
      categoryId: client?.categoryId,
      isEnabled: client?.isEnabled ?? true,
    },
  });

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{client.name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.posClients.form.name")}</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSaving} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.posClients.form.phone")}</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSaving} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.posClients.form.category")}</FormLabel>
                  <FormControl>
                    <AutocompleteInput
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      suggestions={categoryOptions}
                      disabled={isSaving}
                    />
                  </FormControl>
                  <FormDescription>{t("admin.posClients.form.categoryHelp")}</FormDescription>
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
