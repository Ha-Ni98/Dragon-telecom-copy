import { useForm } from "react-hook-form";
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
} from "@/components/ui/form";
import { Plus } from "lucide-react";
import {
  inlineCreateProductSchema,
  type InlineCreateProductFormValues,
} from "@/pages/admin/supplier-invoices/components/inline-create-product.schema";
import { useTranslation } from "@/hooks/useTranslation";

interface InlineCreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: InlineCreateProductFormValues) => void;
  isSaving?: boolean;
}

// ADM-08 — dumb (owns only local form state); Sprint 6 wires `useCreateProduct`.
export function InlineCreateProductDialog({
  open,
  onOpenChange,
  onSave,
  isSaving = false,
}: InlineCreateProductDialogProps) {
  const { t } = useTranslation();
  const form = useForm<InlineCreateProductFormValues>({
    resolver: zodResolver(inlineCreateProductSchema(t)),
    defaultValues: { name: "", newFamilyName: "", newBrandName: "", initialQuantity: 0 },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {t("admin.supplierInvoices.editor.createProduct")}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.suppliers.productName")}</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSaving} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newFamilyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.settings.hierarchy.tabs.families")}</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSaving} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newBrandName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.settings.hierarchy.tabs.brands")}</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSaving} />
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
