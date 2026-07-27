import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface ConfirmBarProps {
  onSave?: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  /** Set when a write comes back 409 — surfaced inline, not as a toast. */
  alreadyConfirmedError?: boolean;
}

// ADM-08 editor — the bottom action bar. S7 R1: Save now creates + confirms in one click (no
// DRAFT UI state, no separate Confirm step), so the bar is reduced to two buttons. Cancel
// discards the in-progress form and returns to the list, writing nothing — it is not the
// destructive "cancel this invoice" affordance, which S7 I8 removes entirely (a saved invoice
// can never be cancelled from this page).
export function ConfirmBar({
  onSave,
  onCancel,
  isSaving = false,
  alreadyConfirmedError = false,
}: ConfirmBarProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3 border-t pt-4">
      {alreadyConfirmedError && (
        <Alert variant="destructive">
          <AlertDescription>{t("admin.supplierInvoices.editor.alreadyConfirmed")}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          {t("admin.supplierInvoices.editor.cancelEdit")}
        </Button>
        {onSave && (
          <Button type="button" onClick={onSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? t("common.saving") : t("admin.supplierInvoices.editor.save")}
          </Button>
        )}
      </div>
    </div>
  );
}
