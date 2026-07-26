import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Save } from "lucide-react";
import {
  storeSettingsSchema,
  type StoreSettingsFormValues,
} from "@/pages/admin/settings/components/store-settings.schema";
import { useTranslation } from "@/hooks/useTranslation";

interface StoreSettingsFormProps {
  values?: StoreSettingsFormValues;
  onSave: (values: StoreSettingsFormValues) => void;
  isSaving?: boolean;
}

// ADM-17 Store tab — dumb (owns only local form state); Sprint 8 wires
// `usePlatformSettings`/`useUpdatePlatformSettings`.
export function StoreSettingsForm({ values, onSave, isSaving = false }: StoreSettingsFormProps) {
  const { t } = useTranslation();
  const form = useForm<StoreSettingsFormValues>({
    resolver: zodResolver(storeSettingsSchema(t)),
    values: values ?? { name: "", address: "", phone: "", logoUrl: "" },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.settings.general.storeName")}</FormLabel>
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
              <FormLabel>{t("admin.settings.general.storeAddress")}</FormLabel>
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
              <FormLabel>{t("admin.settings.general.storePhone")}</FormLabel>
              <FormControl>
                <Input {...field} disabled={isSaving} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? t("common.saving") : t("admin.settings.general.save")}
        </Button>
      </form>
    </Form>
  );
}
