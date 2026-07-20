import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CreditMovementPreview } from "@/components/shared/CreditMovementPreview";
import { InvoiceStatusBadge } from "@/components/shared/StatusBadge";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";
import type { InvoiceDto } from "@dragon-telecom/contract";

interface InvoiceSnapshotViewProps {
  invoice: InvoiceDto;
  onDownloadPdf: () => void;
  onPrint: () => void;
  /** ADM-14 §UI — cost + profit per line and the current avg cost joined beside each product
   * row are admin-only; staff (STF-06) sees the plain snapshot. */
  scope?: "staff" | "admin";
}

// Dumb, props-only (Sprint 4) — Sprint 6 wires useMyInvoice()/useInvoice('admin', number).
export function InvoiceSnapshotView({
  invoice,
  onDownloadPdf,
  onPrint,
  scope = "staff",
}: InvoiceSnapshotViewProps) {
  const { t, language } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono font-medium">{invoice.number}</div>
          <div className="text-sm text-muted-foreground">{invoice.clientNameSnapshot}</div>
        </div>
        <InvoiceStatusBadge status={invoice.status} />
      </div>

      <div className="divide-y divide-border rounded-xl border border-border">
        {invoice.lines.map((line, index) => (
          <div key={index} className="flex items-center justify-between gap-3 p-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{line.label}</div>
              {line.serialNumbers && (
                <div className="text-xs text-muted-foreground">{line.serialNumbers}</div>
              )}
              {scope === "admin" && line.profit != null && (
                <div className="text-xs text-muted-foreground">
                  {t("admin.invoices.outgoing.table.profit")}: {formatDZD(line.profit, language)}
                  {line.currentAverageCost != null &&
                    ` · ${t("admin.invoices.outgoing.table.averageCost")}: ${formatDZD(line.currentAverageCost, language)}`}
                </div>
              )}
            </div>
            <div className="w-16 text-right text-muted-foreground">{line.quantity}</div>
            <div className="w-24 text-right font-semibold">
              {formatDZD(line.lineTotal, language)}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-lg font-bold">
        <span>{t("staff.invoices.table.total")}</span>
        <span>{formatDZD(invoice.totalAmount, language)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("staff.invoices.table.paid")}</span>
        <span>{formatDZD(invoice.paidAmount, language)}</span>
      </div>

      {invoice.previousCredit != null && invoice.newCredit != null && (
        <CreditMovementPreview
          previousCredit={invoice.previousCredit}
          newCredit={invoice.newCredit}
        />
      )}

      <Separator />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onDownloadPdf}>
          <Download className="mr-1 h-3.5 w-3.5" />
          {t("staff.invoices.snapshot.pdf")}
        </Button>
        <Button variant="outline" size="sm" onClick={onPrint}>
          <Printer className="mr-1 h-3.5 w-3.5" />
          {t("staff.invoices.snapshot.print")}
        </Button>
      </div>
    </div>
  );
}
