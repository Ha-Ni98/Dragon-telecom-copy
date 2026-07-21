import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  createPosClientSchema,
  type CreatePosClientFormValues,
} from "@/pages/admin/pos-clients/components/pos-client.schema";
import { useTranslation } from "@/hooks/useTranslation";

interface AddPosClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryOptions: AutocompleteOption[];
  onSave: (values: CreatePosClientFormValues) => void;
  isSaving?: boolean;
}

// ADM-11 — dumb (owns only local form state); Sprint 5 wires `useCreatePosClient`.
export function AddPosClientDialog({
  open,
  onOpenChange,
  categoryOptions,
  onSave,
  isSaving = false,
}: AddPosClientDialogProps) {
  const { t } = useTranslation();
  const form = useForm<CreatePosClientFormValues>({
    resolver: zodResolver(createPosClientSchema(t)),
    defaultValues: { name: "", phone: "", categoryId: undefined, initialCredit: 0 },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.posClients.addClient")}</DialogTitle>
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
            <FormItem>
              <FormLabel>{t("admin.posClients.form.category")}</FormLabel>
              <Controller
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <AutocompleteInput
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    suggestions={categoryOptions}
                    disabled={isSaving}
                  />
                )}
              />
            </FormItem>
            <FormField
              control={form.control}
              name="initialCredit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.posClients.form.initialCredit")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      disabled={isSaving}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormDescription>{t("admin.posClients.form.categoryHelp")}</FormDescription>
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
