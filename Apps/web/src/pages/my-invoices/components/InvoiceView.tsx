import { Download, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { InvoiceStatusBadge } from "@/components/shared/StatusBadge";
import type { InvoiceDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDateTime } from "@/lib/utils";
import { formatPrice } from "@/lib/price-format";

// Dumb, props-only (Sprint 4). Sprint 5 wires useMyInvoice(number)/useMyInvoicePdf() around
// this. `lines[]`/header fields are a frozen snapshot (billing.dtos.ts) — never re-derived from
// live catalog/client data, so this only ever reads off `invoice` directly.
interface InvoiceViewProps {
  invoice?: InvoiceDto;
  isLoading?: boolean;
  isNotFound?: boolean;
  onDownloadPdf?: () => void;
  isDownloadingPdf?: boolean;
}

export function InvoiceViewSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-40" />
      <div className="rounded-2xl border border-border p-5 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}

export function InvoiceView({
  invoice,
  isLoading = false,
  isNotFound = false,
  onDownloadPdf,
  isDownloadingPdf = false,
}: InvoiceViewProps) {
  const { t } = useTranslation();

  if (isLoading) return <InvoiceViewSkeleton />;

  if (isNotFound || !invoice) {
    return (
      <NotFoundState
        title={t("invoices.notFound")}
        body={t("invoices.notFoundBody")}
        action={
          <Button variant="outline" asChild>
            <Link to="/invoices">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("invoices.backToList")}
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          to="/invoices"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("invoices.backToList")}
        </Link>
        <Button size="sm" onClick={onDownloadPdf} disabled={isDownloadingPdf}>
          <Download className="mr-2 h-4 w-4" />
          {isDownloadingPdf ? t("invoices.downloading") : t("invoices.downloadPdf")}
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold">{invoice.number}</h2>
            <p className="text-sm text-muted-foreground">
              {t("invoices.detail.issuedAt")}: {formatDateTime(invoice.issuedAt)}
              {invoice.dueDate && ` · ${t("invoices.detail.dueDate")}: ${invoice.dueDate}`}
            </p>
          </div>
          <InvoiceStatusBadge status={invoice.status} />
        </div>

        <Separator className="my-4" />

        <div className="text-sm">
          <p className="text-muted-foreground">{t("invoices.detail.billedTo")}</p>
          <p className="break-words font-medium">{invoice.clientNameSnapshot}</p>
          {invoice.clientAddressSnapshot && (
            <p className="break-words text-muted-foreground">{invoice.clientAddressSnapshot}</p>
          )}
        </div>

        <Separator className="my-4" />

        {/* This is a raw <table>, not the shared DataTable (whose mobile answer is a stacked
            card list) — a snapshot line-items table reads naturally as a real table even on
            mobile, so it gets a horizontal-scroll container instead (PUB-10, Sprint 7). */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2">{t("invoices.detail.lines")}</th>
                <th className="pb-2 text-right">{t("invoices.detail.quantity")}</th>
                <th className="pb-2 text-right">{t("invoices.detail.unitPrice")}</th>
                <th className="pb-2 text-right">{t("invoices.detail.lineTotal")}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-2">{line.label}</td>
                  <td className="py-2 text-right">{line.quantity}</td>
                  <td className="py-2 text-right">{formatPrice(line.unitPrice)}</td>
                  <td className="py-2 text-right font-medium">{formatPrice(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Separator className="my-4" />

        <div className="space-y-1 text-sm">
          <div className="flex justify-between font-semibold">
            <span>{t("invoices.table.total")}</span>
            <span>{formatPrice(invoice.totalAmount)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>{t("orders.paid")}</span>
            <span>{formatPrice(invoice.paidAmount)}</span>
          </div>
          {invoice.newCredit !== undefined && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t("invoices.detail.newCredit")}</span>
              <span>{formatPrice(invoice.newCredit)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
