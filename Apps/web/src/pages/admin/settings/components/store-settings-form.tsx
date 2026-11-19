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
  toStorePatch,
  type StoreSettingsFormValues,
  type StoreSettingsPatch,
} from "@/pages/admin/settings/components/store-settings.schema";
import type { SettingsDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface StoreSettingsFormProps {
  /** The stored `store` section — S38: absent contact fields are seeded as "" below. */
  values?: SettingsDto["store"];
  onSave: (patch: StoreSettingsPatch) => void;
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
    values: {
      name: values?.name ?? "",
      activityLine: values?.activityLine ?? "",
      address: values?.address ?? "",
      phone: values?.phone ?? "",
      repairPhone: values?.repairPhone ?? "",
      salesPhone: values?.salesPhone ?? "",
      whatsappPhone: values?.whatsappPhone ?? "",
      email: values?.email ?? "",
      facebookUrl: values?.facebookUrl ?? "",
      instagramUrl: values?.instagramUrl ?? "",
      tiktokUrl: values?.tiktokUrl ?? "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => onSave(toStorePatch(v)))} className="space-y-4">
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
        <FormField
          control={form.control}
          name="whatsappPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.settings.general.whatsappPhone")}</FormLabel>
              <FormControl>
                <Input {...field} type="tel" inputMode="tel" disabled={isSaving} />
              </FormControl>
              <FormDescription>{t("admin.settings.general.whatsappPhoneHelp")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.settings.general.storeEmail")}</FormLabel>
              <FormControl>
                <Input {...field} type="email" inputMode="email" disabled={isSaving} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-4 pt-2">
          <div>
            <h3 className="text-sm font-semibold">{t("admin.settings.general.socialLinks")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("admin.settings.general.socialLinksHelp")}
            </p>
          </div>
          {(
            [
              ["facebookUrl", "admin.settings.general.facebookUrl"],
              ["instagramUrl", "admin.settings.general.instagramUrl"],
              ["tiktokUrl", "admin.settings.general.tiktokUrl"],
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
                      type="url"
                      inputMode="url"
                      placeholder="https://"
                      disabled={isSaving}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
        <Button type="submit" disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? t("common.saving") : t("admin.settings.general.save")}
        </Button>
      </form>
    </Form>
  );
}
