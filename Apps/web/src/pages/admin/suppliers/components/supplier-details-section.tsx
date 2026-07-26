import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  updateSupplierSchema,
  type UpdateSupplierFormValues,
} from "@/pages/admin/suppliers/components/supplier.schema";
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Edit3, Save, X, User } from "lucide-react";
import type { SupplierDto } from "@dragon-telecom/contract";

interface SupplierDetailsSectionProps {
  supplier: SupplierDto;
  onSave: (data: UpdateSupplierFormValues) => Promise<void>;
  saving?: boolean;
}

// ADM-07 detail — retyped off SupplierDto; edit-mode is now self-contained (was lifted through
// the page + header). Validated via the Sprint-1 `updateSupplierSchema` wrapper.
export function SupplierDetailsSection({
  supplier,
  onSave,
  saving = false,
}: SupplierDetailsSectionProps) {
  const { t } = useTranslation();
  const [isEditMode, setIsEditMode] = useState(false);

  const form = useForm<UpdateSupplierFormValues>({
    resolver: zodResolver(updateSupplierSchema(t)),
    values: {
      name: supplier.name,
      contactName: supplier.contactName ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      location: supplier.location ?? "",
    },
  });

  const onSubmit = async (data: UpdateSupplierFormValues) => {
    await onSave(data);
    setIsEditMode(false);
  };

  const handleCancel = () => {
    form.reset();
    setIsEditMode(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t("admin.suppliers.details")}
            </CardTitle>
            <CardDescription>{t("admin.suppliers.detailsDescription")}</CardDescription>
          </div>
          {!isEditMode && (
            <Button
              onClick={() => setIsEditMode(true)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Edit3 className="h-4 w-4" />
              {t("common.edit")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {(
              [
                ["name", "admin.suppliers.supplierName"],
                ["contactName", "admin.suppliers.personName"],
                ["phone", "admin.suppliers.phone"],
                ["email", "admin.suppliers.email"],
                ["location", "admin.suppliers.location"],
              ] as const
            ).map(([name, labelKey]) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t(labelKey)}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={!isEditMode}
                        className={isEditMode ? "" : "bg-muted"}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            {isEditMode && (
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
                  <X className="mr-2 h-4 w-4" />
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
