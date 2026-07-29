import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createSupplierSchema,
  type CreateSupplierFormValues,
} from "@/pages/admin/suppliers/components/supplier.schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Truck, Save, X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface AdminSupplierAddDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (supplier: CreateSupplierFormValues) => Promise<void>;
  loading: boolean;
}

// ADM-07 — retyped onto CreateSupplierCommand via the Sprint-1 `supplier.schema.ts` wrapper
// (was the stub `admin-supplier-add-dialog.schema.ts`'s inline-string schema).
export function AdminSupplierAddDialog({
  open,
  onClose,
  onSave,
  loading,
}: AdminSupplierAddDialogProps) {
  const { t } = useTranslation();
  const form = useForm<CreateSupplierFormValues>({
    resolver: zodResolver(createSupplierSchema(t)),
    defaultValues: {
      name: "",
      contactName: "",
      phone: "",
      email: "",
      location: "",
      initialCredit: 0,
    },
  });

  const handleClose = () => {
    if (!form.formState.isSubmitting && !loading) {
      form.reset();
      onClose();
    }
  };

  const onSubmit = async (data: CreateSupplierFormValues) => {
    await onSave(data);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            {t("admin.suppliers.addSupplier")}
          </DialogTitle>
          <DialogDescription>{t("admin.suppliers.addSupplierDescription")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.suppliers.supplierName")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("admin.suppliers.supplierNamePlaceholder")}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.suppliers.personName")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("admin.suppliers.personNamePlaceholder")}
                      disabled={loading}
                    />
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
                  <FormLabel>{t("admin.suppliers.phone")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("admin.suppliers.phonePlaceholder")}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.suppliers.email")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder={t("admin.suppliers.emailPlaceholder")}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.suppliers.location")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("admin.suppliers.locationPlaceholder")}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="initialCredit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.suppliers.credit")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={loading}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                <X className="mr-2 h-4 w-4" />
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={loading}>
                <Save className="mr-2 h-4 w-4" />
                {loading ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default AdminSupplierAddDialog;
