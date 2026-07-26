import { Save, X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useTranslation } from "@/hooks/useTranslation";
import type { ClientCategoryDto } from "@dragon-telecom/contract";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createClientCategorySchema,
  updateClientCategorySchema,
  type CreateClientCategoryFormValues,
  type UpdateClientCategoryFormValues,
} from "@/pages/admin/settings/components/client-category.schema";

interface ClientCategoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateClientCategoryFormValues | UpdateClientCategoryFormValues) => void;
  category?: ClientCategoryDto;
  isSaving: boolean;
}

// ADM-17 Settings Categories tab — retyped off ClientCategoryDto (catalog.dtos.ts) via the
// Sprint-1 `client-category.schema.ts` wrapper. Create mode uses `createClientCategorySchema`
// (name required); edit mode uses `updateClientCategorySchema` (name + isEnabled, both
// optional) — disable-only per the universal convention, no delete.
export function ClientCategoryDialog({
  isOpen,
  onClose,
  onSave,
  category,
  isSaving,
}: ClientCategoryDialogProps) {
  const { t } = useTranslation();
  const isEditMode = !!category;

  const createForm = useForm<CreateClientCategoryFormValues>({
    resolver: zodResolver(createClientCategorySchema(t)),
    values: { name: category?.name ?? "" },
  });
  const updateForm = useForm<UpdateClientCategoryFormValues>({
    resolver: zodResolver(updateClientCategorySchema(t)),
    values: { name: category?.name ?? "", isEnabled: category?.isEnabled ?? true },
  });
  const form = isEditMode ? updateForm : createForm;

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            {isEditMode
              ? t("admin.clients.categories.updateBelow")
              : t("admin.clients.categories.enterBelow")}
          </DialogTitle>
          <DialogDescription>{t("admin.clients.categories.description")}</DialogDescription>
        </DialogHeader>

        {isEditMode ? (
          <Form {...updateForm}>
            <form onSubmit={updateForm.handleSubmit((data) => onSave(data))} className="space-y-4">
              <FormField
                control={updateForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.clients.categories.name")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t("admin.clients.categories.namePlaceholder")}
                        disabled={isSaving}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={updateForm.control}
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
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
                  <X className="mr-2 h-4 w-4" />
                  {t("common.actions.cancel")}
                </Button>
                <Button type="submit" disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit((data) => onSave(data))} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.clients.categories.name")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t("admin.clients.categories.namePlaceholder")}
                        disabled={isSaving}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
                  <X className="mr-2 h-4 w-4" />
                  {t("common.actions.cancel")}
                </Button>
                <Button type="submit" disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
