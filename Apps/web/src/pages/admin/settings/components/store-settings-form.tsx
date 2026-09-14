import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
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

// ADM-17 Store tab — dumb (owns only local form state); wired to
// `usePlatformSettings`/`useUpdatePlatformSettings` by AdminSettings.tsx. The store/print logos
// are handled beside this form (their own upload controls, own PATCH), not inside it — see
// store-settings.schema.ts for why.
export function StoreSettingsForm({ values, onSave, isSaving = false }: StoreSettingsFormProps) {
  const { t } = useTranslation();
  const form = useForm<StoreSettingsFormValues>({
    resolver: zodResolver(storeSettingsSchema(t)),
    values: values ?? {
      name: "",
      activityLine: "",
      address: "",
      phone: "",
      repairPhone: "",
      salesPhone: "",
    },
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
          name="activityLine"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.settings.general.activityLine")}</FormLabel>
              <FormControl>
                <Input {...field} disabled={isSaving} />
              </FormControl>
              <FormDescription>{t("admin.settings.general.activityLineHelp")}</FormDescription>
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
              <FormDescription>{t("admin.settings.general.storePhoneHelp")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="repairPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.settings.general.repairPhone")}</FormLabel>
              <FormControl>
                <Input {...field} disabled={isSaving} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="salesPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.settings.general.salesPhone")}</FormLabel>
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
