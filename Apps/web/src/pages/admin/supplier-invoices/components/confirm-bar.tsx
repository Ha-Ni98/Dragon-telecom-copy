import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, CheckCircle, Ban } from "lucide-react";
import { SupplierInvoiceStatus } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface ConfirmBarProps {
  status: SupplierInvoiceStatus;
  onSaveDraft?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  isSaving?: boolean;
  isConfirming?: boolean;
  isCancelling?: boolean;
  /** Set when a PATCH after CONFIRMED comes back 409 — surfaced inline, not as a toast. */
  alreadyConfirmedError?: boolean;
}

// ADM-08 editor — the bottom action bar. DRAFT: Save + Confirm; CONFIRMED: Cancel only
// (append-only past that point, per the DRAFT-only PATCH enforcement); CANCELLED: read-only.
export function ConfirmBar({
  status,
  onSaveDraft,
  onConfirm,
  onCancel,
  isSaving = false,
  isConfirming = false,
  isCancelling = false,
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
        {status === SupplierInvoiceStatus.DRAFT && (
          <>
            <Button type="button" variant="outline" onClick={onSaveDraft} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? t("common.saving") : t("admin.supplierInvoices.editor.save")}
            </Button>
            <Button type="button" onClick={onConfirm} disabled={isConfirming}>
              <CheckCircle className="mr-2 h-4 w-4" />
              {t("admin.supplierInvoices.editor.confirm")}
            </Button>
          </>
        )}
        {status !== SupplierInvoiceStatus.CANCELLED && (
          <Button type="button" variant="destructive" onClick={onCancel} disabled={isCancelling}>
            <Ban className="mr-2 h-4 w-4" />
            {t("admin.supplierInvoices.editor.cancel")}
          </Button>
        )}
      </div>
    </div>
  );
}
