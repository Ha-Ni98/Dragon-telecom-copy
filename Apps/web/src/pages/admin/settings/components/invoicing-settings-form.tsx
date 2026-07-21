import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save } from "lucide-react";
import { DocType } from "@dragon-telecom/contract";
import {
  invoicingSettingsSchema,
  type InvoicingSettingsFormValues,
} from "@/pages/admin/settings/components/invoicing-settings.schema";
import { useTranslation } from "@/hooks/useTranslation";

interface InvoicingSettingsFormProps {
  values?: InvoicingSettingsFormValues;
  onSave: (values: InvoicingSettingsFormValues) => void;
  isSaving?: boolean;
  /** Set when the server rejects a lowered next-sequence (409 SEQUENCE_DECREASE_FORBIDDEN). */
  sequenceDecreaseError?: boolean;
}

const defaultPrefixes = Object.fromEntries(Object.values(DocType).map((d) => [d, ""])) as Record<
  DocType,
  string
>;
const defaultSequences = Object.fromEntries(Object.values(DocType).map((d) => [d, 1])) as Record<
  DocType,
  number
>;

// ADM-17 Invoicing tab — one row per DocType (Sprint 1 finding: `z.record` keyed by an enum is
// **exhaustive** in Zod 4, so the prefixes/nextSequences maps must submit every member, not a
// partial map). Dumb (owns only local form state); Sprint 8 wires
// `usePlatformSettings`/`useUpdatePlatformSettings`.
export function InvoicingSettingsForm({
  values,
  onSave,
  isSaving = false,
  sequenceDecreaseError = false,
}: InvoicingSettingsFormProps) {
  const { t } = useTranslation();
  const [dismissedError, setDismissedError] = useState(false);
  const form = useForm<InvoicingSettingsFormValues>({
    resolver: zodResolver(invoicingSettingsSchema(t)),
    values: values ?? {
      prefixes: defaultPrefixes,
      nextSequences: defaultSequences,
      footerNote: "",
    },
  });

  return (
    <form
      onSubmit={form.handleSubmit((v) => {
        setDismissedError(false);
        onSave(v);
      })}
      className="space-y-4"
    >
      {sequenceDecreaseError && !dismissedError && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            <span>{t("admin.settings.invoicing.sequenceDecreaseError")}</span>
            <Button variant="outline" size="sm" onClick={() => setDismissedError(true)}>
              {t("common.dismiss")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        {Object.values(DocType).map((docType) => (
          <div key={docType} className="grid grid-cols-3 items-center gap-2 rounded-lg border p-2">
            <span className="text-sm font-medium">{docType}</span>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t("admin.settings.invoicing.prefix")}
              </Label>
              <Controller
                control={form.control}
                name={`prefixes.${docType}`}
                render={({ field }) => <Input {...field} disabled={isSaving} />}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t("admin.settings.invoicing.nextSequence")}
              </Label>
              <Controller
                control={form.control}
                name={`nextSequences.${docType}`}
                render={({ field }) => (
                  <Input
                    type="number"
                    min={0}
                    value={field.value}
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                    disabled={isSaving}
                  />
                )}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <Label>{t("admin.settings.invoicing.footerNote")}</Label>
        <Controller
          control={form.control}
          name="footerNote"
          render={({ field }) => <Input {...field} disabled={isSaving} />}
        />
      </div>

      <Button type="submit" disabled={isSaving}>
        <Save className="mr-2 h-4 w-4" />
        {isSaving ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
